export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY 환경변수 없음' });

  try {
    const { prompt } = req.body;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Gemini 이미지 생성 오류' });

    const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!part) throw new Error('생성된 이미지가 없습니다');

    res.json({ url: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
