import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { parts } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return NextResponse.json({ error: 'Gemini API key missing' }, { status: 500 });
    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json({ error: 'parts required' }, { status: 400 });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] }),
      }
    );

    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });

    return NextResponse.json({
      text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
