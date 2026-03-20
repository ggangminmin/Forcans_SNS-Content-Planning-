import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { keyword } = await req.json();
    if (!keyword) return NextResponse.json({ error: 'keyword required' }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OpenAI API key missing' }, { status: 500 });

    // 자연어로 이슈 서술 → annotations에 실제 URL 생성됨
    const prompt = `현재 대한민국에서 가장 주목받고 있는 '실시간 핫이슈', 'SNS 바이럴 트렌드', '라이프스타일 밈(Meme)'을 광범위하게 조사하고, 이를 "${keyword}"(상품/카테고리)와 연결할 수 있는 지점을 찾아줘.

다음 4가지 관점에서 각각 검색을 수행하고 결과를 합쳐서 총 12개 이상의 이슈를 찾아줘:
1. [범용 트렌드] 지금 한국 SNS(인스타, 릴스, 틱톡)에서 가장 유행하는 챌린지, 음악, 밈, 키워드
2. [사회적 이슈] 오늘/이번 주 가장 뉴스 보도가 많거나 포털 실시간 반응이 뜨거운 화제 (정치/경제 제외)
3. [카테고리 트렌드] "${keyword}"가 속한 산업군(반려동물, 뷰티, 푸드, 생활용품 등)에서 새롭게 떠오르는 소비자 관심사나 문제 해결 방식
4. [시즌/이슈] 현재 계절, 다가오는 기념일, 날씨 등과 연계된 '사람들이 지금 가장 하고 싶어 하는 것'

각 이슈마다 아래 형식으로 출처를 인용하며 설명해줘 (최악의 상황에서도 상품과 억지로 연결하지 말고, 실제 '세상 이야기'를 먼저 들려줘):
- 제목
- 2~3문장 요약 (왜 지금 주목받는지, 어떤 반응이 있는지 포함)
- 출처 매체명

이후 아래 JSON을 한 번에 포함해줘 (마지막에 추가):
---JSON---
{
  "keywords": [{"keyword": "트렌드 키워드", "reason": "왜 핫한지"}],
  "hashtags": ["#태그1", "#태그2"],
  "content_ideas": [
    {"platform": "instagram", "idea": "세상 트렌드와 상품을 엮는 기발한 아이디어", "angle": "어떤 트렌드를 활용했는가?"},
    {"platform": "blog", "idea": "세상 트렌드와 상품을 엮는 기발한 아이디어", "angle": "어떤 트렌드를 활용했는가?"},
    {"platform": "shorts", "idea": "세상 트렌드와 상품을 엮는 기발한 아이디어", "angle": "어떤 트렌드를 활용했는가?"}
  ]
}
---END---`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        input: [{ role: 'user', content: prompt }],
        tools: [{ type: 'web_search_preview' }],
        text: { format: { type: 'text' } }
      })
    });

    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });

    const msgContent = data.output
      ?.find((o: any) => o.type === 'message')
      ?.content || [];

    const outputText = msgContent.find((c: any) => c.type === 'output_text');
    const fullText = outputText?.text || '';

    // 실제 인용 URL 추출 (중복 제거)
    const annotations: any[] = outputText?.annotations || [];
    const seen = new Set<string>();
    const citations = annotations
      .filter((a: any) => a.type === 'url_citation' && a.url)
      .filter((a: any) => {
        if (seen.has(a.url)) return false;
        seen.add(a.url);
        return true;
      })
      .map((a: any) => ({ url: a.url, title: a.title || '' }));

    // JSON 메타데이터 파싱
    const jsonMatch = fullText.match(/---JSON---\s*([\s\S]*?)---END---/) ||
                      fullText.match(/```json\s*([\s\S]*?)```/) ||
                      fullText.match(/(\{[\s\S]*\})/);
    let meta: any = {};
    try { meta = JSON.parse(jsonMatch ? jsonMatch[1] : '{}'); } catch {}

    // 자연어 이슈 파싱 (번호 목록 또는 ## 헤딩 기반)
    const issueBlocks = fullText
      .replace(/---JSON---[\s\S]*?---END---/, '')
      .replace(/```json[\s\S]*?```/, '')
      .split(/\n(?=\d+[\.\)]|##\s|\*\*\d+)/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 30);

    const trending_issues = issueBlocks.slice(0, 15).map((block: string, i: number) => {
      const lines = block.split('\n').map((l: string) => l.trim()).filter(Boolean);
      const title = lines[0]
        ?.replace(/^[\d\.\*\#\)\(\s]+/, '')  // 숫자, ., *, #, ), (, 공백 제거
        ?.replace(/\*\*/g, '')                // ** 마크다운 제거
        ?.trim() || `이슈 ${i + 1}`;
      const summary = lines.slice(1).join(' ')
        .replace(/출처[:：].*/i, '')
        .replace(/\*\*(요약|Summary)[:：]?\**/gi, '')  // **요약:** 제거
        .replace(/\*\*/g, '')                           // 나머지 ** 제거
        .trim().slice(0, 250);
      const sourceMatch = block.match(/출처[:：]\s*(.+)/i);
      const source = sourceMatch?.[1]?.trim() || '';
      return {
        title,
        summary,
        source,
        url: citations[i]?.url || null,
      };
    }).filter((issue: any) => issue.title.length > 2);

    return NextResponse.json({
      trending_issues,
      keywords: meta.keywords || [],
      hashtags: meta.hashtags || [],
      content_ideas: meta.content_ideas || [],
      citations, // 실제 URL 목록 (UI 출처 섹션용)
    });
  } catch (err: any) {
    console.error('[/api/trend] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
