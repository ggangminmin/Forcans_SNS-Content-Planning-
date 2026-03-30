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
      console.error('[/api/scrape] 요청 본문 파싱 오류:', e.message);
      return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
    }

    const { url } = body;
    console.log('[/api/scrape] URL:', url);

    if (!url) return NextResponse.json({ error: 'URL이 필요합니다.', received: body }, { status: 400 });

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
    console.error('[/api/scrape] 오류:', err.message);
    return NextResponse.json({ title: '오류', content: '' }, { status: 200 });
  }
}
