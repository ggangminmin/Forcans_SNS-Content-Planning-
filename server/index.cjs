const express = require('express');
const cors = require('cors');
require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = 3001;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

function normalizeTrendIssues(issues = []) {
  const normalized = issues
    .filter(Boolean)
    .map((issue, index) => ({
      title: String(issue.title || issue.keyword || `이슈 ${index + 1}`).trim(),
      summary: String(issue.summary || issue.reason || '관련 이슈 요약이 없습니다.').trim(),
      source: issue.source ? String(issue.source).trim() : '',
      url: issue.url || null,
    }))
    .filter((issue) => issue.title);

  if (normalized.length >= 10) return normalized.slice(0, 10);

  const filler = [];
  for (let i = normalized.length; i < 10; i += 1) {
    filler.push({
      title: `${normalized[0]?.title || '확장'} 파생 이슈 ${i + 1}`,
      summary: '관련 소비자 반응과 활용 포인트를 확장해서 확인할 수 있는 보조 이슈입니다.',
      source: 'AI expansion',
      url: null,
    });
  }

  return [...normalized, ...filler].slice(0, 10);
}

console.log('--- Server Starting ---');
console.log('OPENAI_KEY Loaded:', OPENAI_KEY ? OPENAI_KEY.slice(0, 10) + '...' : 'MISSING');

app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'] }));
app.use(express.json({ limit: '30mb' }));

// URL 스크래핑 엔드포인트 추가 (MCP-like 기능)
app.post('/api/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    console.log(`[/api/scrape] Fetching: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // 불필요한 태그 제거
    $('script, style, nav, footer, iframe, ads').remove();

    const title = $('title').text().trim();
    // 주요 텍스트 추출
    let text = $('body').find('h1, h2, h3, p, span').map((_, el) => $(el).text().trim()).get().join('\n');
    
    // 텍스트 정제 (연속된 공백 제거)
    text = text.replace(/\n\s*\n/g, '\n').slice(0, 5000); 

    res.json({ title, content: text });
  } catch (err) {
    console.error('[/api/scrape] Error:', err.message);
    res.status(200).json({ title: 'Error', content: `URL을 읽어올 수 없습니다: ${err.message}` });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, response_format } = req.body;
    const apiKey = process.env.OPENAI_API_KEY;
    console.log('[/api/chat] Using Responses API with gpt-5.4-mini');

    const payload = {
      model: 'gpt-5.4-mini',
      input: messages,
      tools: [{ type: 'web_search_preview' }],
      text: { 
        format: response_format?.type === 'json_object' ? { type: 'json_object' } : { type: 'text' }
      }
    };

    const response = await axios.post('https://api.openai.com/v1/responses', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      }
    });

    // Responses API 출력 추출
    const content = response.data.output
      ?.find(o => o.type === 'message')
      ?.content
      ?.find(c => c.type === 'output_text')
      ?.text || '';

    // 기존 프론트엔드 호환을 위해 choices 구조로 변환하여 에러 방지
    res.json({
      choices: [{
        message: { content }
      }]
    });
  } catch (err) {
    console.error('[/api/chat] Error:', err.response?.data || err.message);
    const status = err.response?.status || 500;
    const errorData = err.response?.data || { error: { message: err.message } };
    res.status(status).json(errorData);
  }
});

app.post('/api/image', async (req, res) => {
  try {
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const data = response.data;
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) throw new Error('Image generation failed');

    res.json({ url: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}` });
  } catch (err) {
    console.error('[/api/image] Error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

app.post('/api/gemini', async (req, res) => {
    try {
      const { parts } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
  
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        { contents: [{ parts }] },
        { headers: { 'Content-Type': 'application/json' } }
      );
  
      res.json({ text: response.data.candidates?.[0]?.content?.parts?.[0]?.text });
    } catch (err) {
      console.error('[/api/gemini] Error:', err.response?.data || err.message);
      res.status(err.response?.status || 500).json({ error: err.message });
    }
});

app.post('/api/trend', async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: 'keyword required' });
    const apiKey = process.env.OPENAI_API_KEY;
    console.log(`[/api/trend] Searching real-time trends for: ${keyword}`);

    const prompt = `지금 당장 "${keyword}" 관련 최신 뉴스와 실시간 트렌드를 웹에서 검색하여 아래 JSON 형식으로 반환하세요.

반드시 실제 검색된 뉴스/기사/이슈를 기반으로 작성하고, 출처 URL을 포함하세요.

{
  "trending_issues": [
    {
      "title": "실제 뉴스/이슈 제목",
      "summary": "이슈 요약 (2~3문장)",
      "source": "출처 매체명",
      "url": "실제 기사 URL"
    }
  ],
  "keywords": [
    { "keyword": "핫한 키워드", "reason": "이유" }
  ],
  "hashtags": ["#해시태그1", "#해시태그2"],
  "content_ideas": [
    { "platform": "instagram", "idea": "콘텐츠 아이디어", "angle": "접근 각도" },
    { "platform": "blog", "idea": "콘텐츠 아이디어", "angle": "접근 각도" },
    { "platform": "shorts", "idea": "콘텐츠 아이디어", "angle": "접근 각도" }
  ]
}

trending_issues는 최소 3개 이상, 실제 최신 뉴스 기반으로 작성. JSON만 반환.`;

    const requestPrompt = `
Search the web for recent real-world issues, conversations, and articles related to "${keyword}".

Return JSON only.

{
  "trending_issues": [
    {
      "title": "actual issue title",
      "summary": "2-3 sentence summary in Korean",
      "source": "source publication",
      "url": "article URL"
    }
  ],
  "keywords": [
    { "keyword": "relevant keyword", "reason": "why it matters" }
  ],
  "hashtags": ["#tag1", "#tag2"],
  "content_ideas": [
    { "platform": "instagram", "idea": "content idea", "angle": "why this works" },
    { "platform": "blog", "idea": "content idea", "angle": "why this works" },
    { "platform": "shorts", "idea": "content idea", "angle": "why this works" }
  ]
}

Rules:
- trending_issues must contain exactly 10 items.
- Every item should be distinct and based on actual recent web results.
- Summaries must be written in Korean.
- Include source and url whenever possible.
- Return JSON only.
    `.trim();

    const response = await axios.post('https://api.openai.com/v1/responses', {
      model: 'gpt-4o',
      input: [{ role: 'user', content: requestPrompt }],
      tools: [{ type: 'web_search_preview' }],
      text: { format: { type: 'text' } }
    }, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }
    });

    const outputText = response.data.output
      ?.find(o => o.type === 'message')
      ?.content
      ?.find(c => c.type === 'output_text');

    const content = outputText?.text || '{}';

    // annotations에서 실제 URL 추출 (중복 제거)
    const annotations = outputText?.annotations || [];
    const seen = new Set();
    const citations = annotations
      .filter(a => a.type === 'url_citation' && a.url)
      .filter(a => { if (seen.has(a.url)) return false; seen.add(a.url); return true; })
      .map(a => ({ url: a.url, title: a.title || '' }));

    // JSON 블록 추출 (```json ... ``` 또는 { ... })
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/(\{[\s\S]*\})/);
    const trendData = JSON.parse(jsonMatch ? jsonMatch[1] : content);

    // trending_issues에 실제 URL 매핑
    if (trendData.trending_issues) {
      trendData.trending_issues = trendData.trending_issues.map((issue, i) => ({
        ...issue,
        url: issue.url || citations[i]?.url || null,
      }));
    }

    trendData.trending_issues = normalizeTrendIssues(trendData.trending_issues);

    console.log(`[/api/trend] Found ${trendData.trending_issues?.length || 0} issues, ${citations.length} citations`);
    res.json({ ...trendData, citations });
  } catch (err) {
    console.error('[/api/trend] Error:', err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

app.post('/api/youtube', async (req, res) => {
  try {
    const { query } = req.body;
    const apiKey = process.env.YOUTUBE_API_KEY;

    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=4&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`;
    const response = await axios.get(url);
    const data = response.data;

    const items = data.items?.map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumb: item.snippet.thumbnails.medium.url,
      channel: item.snippet.channelTitle,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    })) || [];

    res.json(items);
  } catch (err) {
    console.error('[/api/youtube] Error:', err.message);
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

if (process.env.PORT || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`API server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
