export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
  if (!OPENAI_API_KEY) return res.status(200).json({ skipped: true, error: 'OPENAI_API_KEY 환경변수 없음' });

  try {
    const { messages } = req.body;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(200).json({ skipped: true, error: data.error?.message || `OpenAI ${response.status}` });

    res.json(data);
  } catch (err) {
    res.status(200).json({ skipped: true, error: err.message });
  }
}
