export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY 환경변수 없음' });

  try {
    const { prompt } = req.body;

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1792x1024',
        quality: 'standard',
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message });

    res.json({ url: data.data[0].url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
