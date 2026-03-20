import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (e: any) {
      console.error('[/api/chat] Body parse error:', e.message);
      return NextResponse.json({ error: 'Invalid request body: ' + e.message }, { status: 400 });
    }

    const { messages, response_format } = body;
    console.log('[/api/chat] received messages count:', messages?.length, 'type:', typeof messages);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OpenAI API key missing' }, { status: 500 });
    if (!messages || !Array.isArray(messages)) {
      console.error('[/api/chat] messages missing or not array:', messages);
      return NextResponse.json({ error: 'messages required', received: typeof messages }, { status: 400 });
    }

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
        model: 'gpt-4o-mini',
        messages: normalizedMessages,
        response_format: response_format || { type: 'json_object' },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[/api/chat] OpenAI error:', response.status, JSON.stringify(data));
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[/api/chat] Unexpected error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
