const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app  = express();
const PORT = 3001;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '20mb' }));

/* ── GPT-4o 프록시 ── */
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, response_format } = req.body;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        max_tokens: 16000,
        ...(response_format ?? { type: 'json_object' })
          .type === 'json_object' ? { response_format: { type: 'json_object' } } : {},
      }),
    });

    let data;
    try {
      data = await response.json();
    } catch {
      const errMsg = `GPT API 오류 (${response.status}) — 응답이 JSON이 아닙니다.`;
      console.error('[GPT] 비-JSON 응답:', response.status);
      return res.status(response.status || 502).json({ error: errMsg });
    }

    if (!response.ok) {
      const errMsg = data.error?.message || data.error?.code || `GPT 오류 (${response.status})`;
      console.error('[GPT] API 오류:', errMsg);
      return res.status(response.status).json({ error: errMsg });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Nano Banana 2 (Gemini 3.1 Flash Image) 이미지 생성 프록시 ── */
app.post('/api/image', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: '이미지 프롬프트가 없습니다' });
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
      }),
    });
    clearTimeout(timer);

    const data = await response.json();
    if (!response.ok) {
      console.error('[Image] Gemini 오류:', data.error?.message || response.status);
      return res.status(response.status).json({ error: data.error?.message || 'Gemini 이미지 오류' });
    }

    const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!part) throw new Error('이미지 생성 실패 — 응답에 이미지가 없습니다');

    res.json({ url: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}` });
  } catch (err) {
    const msg = err.name === 'AbortError' ? '이미지 생성 타임아웃 (30초 초과)' : err.message;
    console.error('[Image] 실패:', msg);
    res.status(500).json({ error: msg });
  }
});

/* ── YouTube Data API 프록시 ── */
app.post('/api/youtube', async (req, res) => {
  try {
    const { query } = req.body;
    const apiKey = process.env.YOUTUBE_API_KEY;

    // 숏츠나 플랫폼 관련 레퍼런스 검색을 위해 쿼리 조합
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=4&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'YouTube API 오류' });
    }

    const items = data.items?.map(item => ({
      id:      item.id.videoId,
      title:   item.snippet.title,
      thumb:   item.snippet.thumbnails.medium.url,
      channel: item.snippet.channelTitle,
      url:     `https://www.youtube.com/watch?v=${item.id.videoId}`
    })) || [];

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
/* ── Gemini 프록시 ── */
app.post('/api/gemini', async (req, res) => {
  const { parts } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  // 429 시 최대 2회 재시도 (1초 대기)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.8, responseMimeType: 'application/json' }
        })
      });

      let data;
      try { data = await response.json(); } catch { data = {}; }

      if (response.status === 429) {
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, attempt * 1500));
          continue;
        }
        return res.status(429).json({ error: 'Gemini API 요청 한도 초과 (429). 잠시 후 다시 시도해주세요.' });
      }

      if (!response.ok) {
        const errMsg = data.error?.message || data.error?.status || JSON.stringify(data.error) || `Gemini 오류 (${response.status})`;
        console.error(`[Gemini] 오류 ${response.status}:`, errMsg);
        return res.status(response.status).json({ error: errMsg });
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        return res.status(502).json({ error: 'Gemini 응답이 비어 있습니다. 다시 시도해주세요.' });
      }
      return res.json({ text });
    } catch (err) {
      if (attempt === 3) return res.status(500).json({ error: err.message });
      await new Promise(r => setTimeout(r, 1000));
    }
  }
});

/* ── 트렌드 탐색 (Gemini + Google Search Grounding) ── */
app.post('/api/trend', async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: '키워드를 입력해주세요' });

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY 없음' });

    const prompt = `당신은 한국 SNS 마케팅 트렌드 분석가입니다.
Google 검색을 통해 "${keyword}"와 관련된 최신 이슈, 뉴스, 트렌드를 오늘 날짜 기준으로 조사하고 분석해주세요.

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이):
{
  "trending_issues": [
    {"title": "이슈 제목", "summary": "2~3문장 요약", "source": "출처 미디어/사이트명", "url": "실제 기사나 페이지의 전체 URL (https://로 시작, 반드시 실제 존재하는 URL)"}
  ],
  "keywords": [
    {"keyword": "키워드", "reason": "왜 지금 이 키워드가 중요한지 한 줄 설명"}
  ],
  "content_ideas": [
    {"platform": "instagram", "idea": "구체적인 콘텐츠 소재", "angle": "접근 각도나 훅"},
    {"platform": "shorts", "idea": "구체적인 콘텐츠 소재", "angle": "영상 컨셉"},
    {"platform": "blog", "idea": "구체적인 콘텐츠 소재", "angle": "SEO 포인트나 타겟 독자"}
  ],
  "hashtags": ["#해시태그1", "#해시태그2", "#해시태그3", "#해시태그4", "#해시태그5"]
}

trending_issues는 3~5개, keywords는 5~8개, 각 플랫폼별 content_ideas는 2~3개씩 생성해주세요.
각 trending_issue의 url 필드는 반드시 실제 검색된 기사/페이지의 실제 URL을 포함하세요.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.7 },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || '트렌드 검색 오류' });

    const rawText = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text || '';
    // JSON 추출 (마크다운 코드블록 제거)
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
    const jsonStr = (jsonMatch[1] || rawText).trim();

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      // JSON 파싱 실패 시 Gemini에 재요청 (JSON 정제)
      const fixRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: `다음 텍스트에서 JSON만 추출해서 반환해:\n${rawText}` }],
          response_format: { type: 'json_object' },
        }),
      });
      const fixData = await fixRes.json();
      result = JSON.parse(fixData.choices[0].message.content);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── URL 스크래핑 ── */
app.post('/api/scrape', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL이 필요합니다' });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const html = await response.text();

    // 제목 추출
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // 본문 텍스트 추출 (태그/스크립트/스타일 제거)
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000); // 최대 3000자

    res.json({ title, content: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Vercel 운영용 ── */
if (process.env.PORT || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✅ API 서버 실행 중: http://localhost:${PORT}`);
  });
}

module.exports = app;
