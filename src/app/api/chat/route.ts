import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages, response_format } = await req.json();
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) return NextResponse.json({ error: 'OpenAI API key missing' }, { status: 500 });
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    // content가 배열인 경우 이미지 없으면 문자열로 단순화 (토큰 절약)
    const normalizedMessages = messages.map((msg: any) => {
      if (Array.isArray(msg.content)) {
        const hasImage = msg.content.some((p: any) => p.type === 'image_url');
        if (!hasImage) {
          const textPart = msg.content.find((p: any) => p.type === 'text');
          return { ...msg, content: textPart?.text || '' };
        }
      }
      return msg;
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: normalizedMessages,
        response_format: response_format || { type: 'json_object' },
        max_tokens: 4096,
      }),
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
