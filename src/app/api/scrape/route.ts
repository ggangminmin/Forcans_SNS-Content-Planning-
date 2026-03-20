import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (e: any) {
      console.error('[/api/scrape] Body parse error:', e.message);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { url } = body;
    console.log('[/api/scrape] url:', url);

    if (!url) return NextResponse.json({ error: 'URL is required', received: body }, { status: 400 });

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    $('script, style, nav, footer, iframe').remove();

    const title = $('title').text().trim();
    let text = $('body').find('h1, h2, h3, p, span').map((_: any, el: any) => $(el).text().trim()).get().join('\n');
    text = text.replace(/\n\s*\n/g, '\n').slice(0, 5000);

    return NextResponse.json({ title, content: text });
  } catch (err: any) {
    console.error('[/api/scrape] Error:', err.message);
    return NextResponse.json({ title: 'Error', content: '' }, { status: 200 });
  }
}
