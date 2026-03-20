import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return NextResponse.json({ error: 'Gemini API key missing' }, { status: 500 });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
      }),
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });

    const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (!part) throw new Error('Image generation failed');

    return NextResponse.json({ url: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
