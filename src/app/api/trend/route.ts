import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { keyword } = await req.json();
    if (!keyword) return NextResponse.json({ error: 'keyword required' }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OpenAI API key missing' }, { status: 500 });

    const prompt = `현재 대한민국에서 "${keyword}"(상품/카테고리)와 관련된 최신 SNS 트렌드와 이슈를 분석해줘.

다음 4가지 관점에서 총 8개 이상의 이슈를 찾아줘:
1. [SNS 트렌드] 한국 인스타, 릴스, 틱톡에서 유행하는 챌린지, 밈, 키워드
2. [사회적 이슈] 최근 화제가 되는 뉴스나 포털 실시간 이슈 (정치/경제 제외)
3. [카테고리 트렌드] "${keyword}"가 속한 산업군에서 떠오르는 소비자 관심사
4. [시즌/기념일] 현재 계절, 다가오는 기념일과 연계된 트렌드

반드시 아래 JSON 형식으로만 답변:
{
  "trending_issues": [
    {"title": "이슈 제목", "summary": "2~3문장 요약", "source": "출처 매체명", "url": null}
  ],
  "keywords": [{"keyword": "핫한 키워드", "reason": "이유"}],
  "hashtags": ["#해시태그1", "#해시태그2"],
  "content_ideas": [
    {"platform": "instagram", "idea": "콘텐츠 아이디어", "angle": "접근 각도"},
    {"platform": "blog", "idea": "콘텐츠 아이디어", "angle": "접근 각도"},
    {"platform": "shorts", "idea": "콘텐츠 아이디어", "angle": "접근 각도"}
  ]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a Korean SNS trend analyst. Always respond in valid JSON format only.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
      })
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });

    const content = data.choices?.[0]?.message?.content || '{}';
    let trendData: any = {};
    try { trendData = JSON.parse(content); } catch {}

    return NextResponse.json({
      trending_issues: trendData.trending_issues || [],
      keywords: trendData.keywords || [],
      hashtags: trendData.hashtags || [],
      content_ideas: trendData.content_ideas || [],
      citations: [],
    });
  } catch (err: any) {
    console.error('[/api/trend] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
