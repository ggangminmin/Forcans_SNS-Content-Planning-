import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    $('script, style, nav, footer, iframe, ads').remove();

    const title = $('title').text().trim();
    let text = $('body').find('h1, h2, h3, p, span').map((_, el) => $(el).text().trim()).get().join('\n');
    text = text.replace(/\n\s*\n/g, '\n').slice(0, 5000); 

    return NextResponse.json({ title, content: text });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
