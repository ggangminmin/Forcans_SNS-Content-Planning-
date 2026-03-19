export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY 환경변수 없음' });

  try {
    const { parts } = req.body; // [{ text }, { inline_data }...]

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.8, responseMimeType: 'application/json' },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message });

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
