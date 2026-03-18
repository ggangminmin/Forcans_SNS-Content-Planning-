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
        // json_object 모드는 메시지에 "json" 단어가 있어야 함 — 없으면 일반 텍스트 모드
        ...(response_format ?? { type: 'json_object' })
          .type === 'json_object' ? { response_format: { type: 'json_object' } } : {},
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'GPT 오류' });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── DALL-E 3 이미지 생성 프록시 ── */
app.post('/api/image', async (req, res) => {
  try {
    const { prompt } = req.body;

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model:   'dall-e-3',
        prompt,
        n:       1,
        size:    '1792x1024',
        quality: 'standard',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'DALL-E 오류' });
    }

    res.json({ url: data.data[0].url });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
  try {
    const { parts } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.8, responseMimeType: "application/json" }
      })
    });

    const data = await response.json();

    if (!response.ok) {
        return res.status(response.status).json({ error: data.error?.message || 'Gemini 오류' });
    }

    // 클라이언트가 { text } 포맷으로 받기를 원함
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ text });
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
