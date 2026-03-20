import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages, response_format } = await req.json();
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) return NextResponse.json({ error: 'OpenAI API key missing' }, { status: 500 });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        response_format: response_format || { type: 'json_object' },
      }),
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
