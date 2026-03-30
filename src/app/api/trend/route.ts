import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string;
};

type TrendIssue = {
  title: string;
  summary: string;
  source: string;
  url: string | null;
};

type KeywordSuggestion = {
  keyword: string;
  reason: string;
};

type ContentIdea = {
  platform: "instagram" | "blog" | "shorts";
  idea: string;
  angle: string;
};

type TrendResponse = {
  trending_issues: TrendIssue[];
  keywords: KeywordSuggestion[];
  hashtags: string[];
  citations: Array<{ title: string; url: string }>;
};

function cleanText(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function shortenText(value: unknown, maxLength: number) {
  const text = cleanText(value);
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function toHostnameLabel(url: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname.split(".")[0] || hostname;
  } catch {
    return "";
  }
}

function normalizeIssue(raw: unknown, index: number): TrendIssue | null {
  const issue = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {};
  const title = cleanText(issue.title || `트렌드 이슈 ${index + 1}`);
  const summary = shortenText(issue.summary || issue.description || issue.content, 220) || "관련 요약을 아직 불러오지 못했습니다.";
  const url = cleanText(issue.url) || null;
  const source = cleanText(issue.source) || (url ? toHostnameLabel(url) : "");

  if (!title) return null;

  return {
    title,
    summary,
    source,
    url,
  };
}

function buildFallbackIssues(results: TavilyResult[], keyword: string): TrendIssue[] {
  const seen = new Set<string>();
  const normalized = results
    .map((result, index) => {
      const title = cleanText(result.title) || `${keyword} 관련 트렌드 ${index + 1}`;
      const url = cleanText(result.url) || null;
      const dedupeKey = url || title;

      if (!dedupeKey || seen.has(dedupeKey)) return null;
      seen.add(dedupeKey);

      return {
        title,
        summary:
          shortenText(result.content || result.raw_content, 220) ||
          `${keyword} 관련 검색 결과를 바탕으로 정리한 참고 이슈입니다.`,
        source: url ? toHostnameLabel(url) : "",
        url,
      } satisfies TrendIssue;
    })
    .filter((issue): issue is TrendIssue => Boolean(issue));

  if (normalized.length > 0) return normalized.slice(0, 10);

  return [
    {
      title: `${keyword} 관련 트렌드 조사`,
      summary: "검색 결과가 충분하지 않아 입력한 키워드를 기준으로 기본 조사 항목을 만들었습니다. 검색어를 더 구체적으로 적으면 더 정확한 결과를 받을 수 있습니다.",
      source: "기본 분석",
      url: null,
    },
  ];
}

function buildDefaultResponse(keyword: string, issues: TrendIssue[], citations: Array<{ title: string; url: string }>): TrendResponse {
  const compactKeyword = keyword.replace(/\s+/g, "");
  const safeHashtag = compactKeyword ? `#${compactKeyword.replace(/[^0-9A-Za-z가-힣]/g, "")}` : "#트렌드";

  return {
    trending_issues: issues,
    keywords: [
      {
        keyword,
        reason: "입력한 상품 또는 서비스 정보를 기준으로 조사한 핵심 키워드입니다.",
      },
    ],
    hashtags: [safeHashtag, "#콘텐츠기획", "#트렌드조사"].filter(Boolean),
    citations,
  };
}

async function tavilySearch(query: string, apiKey: string) {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query: `${query} 최신 SNS 트렌드 밈 소비자 반응 바이럴 이슈`,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false,
      max_results: 8,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Tavily 검색에 실패했습니다.");
  }

  return response.json();
}

async function enrichWithOpenAI(params: {
  keyword: string;
  openaiKey: string;
  fallbackIssues: TrendIssue[];
  searchContext: string;
}) {
  const { keyword, openaiKey, fallbackIssues, searchContext } = params;

  const prompt = `
당신은 대한민국 최고의 SNS 트렌드 분석가이자 콘텐츠 전략가입니다.
제공된 [검색 결과]는 실시간 뉴스, 세상의 이슈, 최신 SNS 밈 등을 포함하고 있습니다.

당신의 임무는 두 가지입니다:
1. **세상 이슈 발굴**: 제공된 [검색 결과]에서 현재 대한민국 대중이 가장 뜨겁게 반응하고 있는 '실시간 핫이슈', '정치/경제/사회/문화 뉴스', '최신 SNS 밈' 등을 최소 10개 이상 추출하세요. (사용자가 입력한 ${keyword}와 상관없는 순수 외부 이슈여야 합니다.)
2. **전략적 연결(Creative Connection)**: 발굴한 각각의 세상 이슈를 사용자의 상품/서비스(${keyword})와 창의적으로 연결하여, '왜 이 트렌드와 이 상품을 함께 이야기해야 하는지' 명분을 만드세요. 이슈 자체는 세상의 이야기지만, 그 끝은 자연스럽게 상품의 소구점으로 이어지는 '연결의 기술'을 보여주세요.

[검색 결과]
${searchContext}

[반환 규칙]
1. trending_issues: [검색 결과]의 뉴스/이슈를 바탕으로 요약한 리스트 (최소 10개 필수). 
   - 반드시 각 이슈에 해당하는 원본 검색 결과의 **url**과 **source**를 객체에 포함하세요. (예: { "title": "...", "summary": "...", "url": "원본URL", "source": "출처명" })
   - URL이 없는 이슈는 제외하거나, 검색 결과에 있는 가장 관련성 높은 URL을 찾아서 꼭 기입하세요.
2. keywords: 현재 트렌드를 관통하는 '트렌드 키워드'와 그 이유.
3. hashtags: 바이럴 가능성이 높은 태그.
5. 마크다운 없이 순수 JSON object만 반환하세요.
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "항상 유효한 JSON object만 반환하세요.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || "OpenAI 보강에 실패했습니다.");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI 응답이 비어 있습니다.");
  }

  return JSON.parse(content) as Partial<TrendResponse>;
}

function normalizeResponse(raw: Partial<TrendResponse> | null, fallback: TrendResponse): TrendResponse {
  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const issues = Array.isArray(raw.trending_issues)
    ? raw.trending_issues
        .map((issue, index) => normalizeIssue(issue, index))
        .filter((issue): issue is TrendIssue => Boolean(issue))
        .slice(0, 10)
    : [];

  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords
        .map((entry) => {
          const keyword = cleanText((entry as Record<string, unknown>)?.keyword);
          const reason = cleanText((entry as Record<string, unknown>)?.reason);
          if (!keyword) return null;
          return { keyword, reason: reason || "연관 키워드입니다." };
        })
        .filter((entry): entry is KeywordSuggestion => Boolean(entry))
        .slice(0, 8)
    : [];

  const hashtags = Array.isArray(raw.hashtags)
    ? raw.hashtags
        .map((tag) => cleanText(tag))
        .filter(Boolean)
        .slice(0, 12)
    : [];


  return {
    trending_issues: issues.length ? issues : fallback.trending_issues,
    keywords: keywords.length ? keywords : fallback.keywords,
    hashtags: hashtags.length ? hashtags : fallback.hashtags,
    citations: fallback.citations,
  };
}

export async function POST(req: Request) {
  try {
    const { keyword: rawKeyword } = await req.json();
    const keyword = cleanText(rawKeyword);

    if (!keyword) {
      return NextResponse.json({ error: "키워드가 필요합니다." }, { status: 400 });
    }

    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey) {
      return NextResponse.json({ error: "Tavily API 키가 설정되지 않았습니다." }, { status: 500 });
    }

    // 1. 세상의 핫이슈 및 트렌드 검색 (Broad & Primary)
    const generalSearchPromise = tavilySearch("오늘 대한민국 가장 화제인 뉴스 기사 실시간 이슈 SNS 트렌드 밈 유행", tavilyKey);
    // 2. 검색 유입 및 관련 이슈 검색 (General Viral Focus)
    const viralSearchPromise = tavilySearch("현재 SNS에서 가장 반응 좋은 콘텐츠 주제 및 바이럴 이슈", tavilyKey);

    const [generalRes, viralRes] = await Promise.all([generalSearchPromise, viralSearchPromise]);
    
    // 결과 합치기 (상품보다는 '세상의 이슈' 위주로 수집)
    const results = [
      ...(Array.isArray(generalRes?.results) ? generalRes.results : []),
      ...(Array.isArray(viralRes?.results) ? viralRes.results : [])
    ] as TavilyResult[];
    const citations = results
      .map((result) => ({
        title: cleanText(result.title) || "참고 링크",
        url: cleanText(result.url),
      }))
      .filter((citation) => citation.url)
      .slice(0, 10);

    const fallbackIssues = buildFallbackIssues(results, keyword);
    const fallbackResponse = buildDefaultResponse(keyword, fallbackIssues, citations);
    const searchContext = results.length
      ? results
          .map((result, index) =>
            [
              `[${index + 1}] ${cleanText(result.title) || "제목 없음"}`,
              `URL: ${cleanText(result.url) || "없음"}`,
              `내용: ${shortenText(result.content || result.raw_content, 300) || "요약 없음"}`,
            ].join("\n"),
          )
          .join("\n\n")
      : `검색 결과가 충분하지 않았습니다. 키워드: ${keyword}`;

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(fallbackResponse);
    }

    try {
      const enriched = await enrichWithOpenAI({
        keyword,
        openaiKey,
        fallbackIssues,
        searchContext,
      });

      return NextResponse.json(normalizeResponse(enriched, fallbackResponse));
    } catch (error) {
      console.error("[/api/trend] OpenAI fallback:", error);
      return NextResponse.json(fallbackResponse);
    }
  } catch (error) {
    console.error("[/api/trend] error:", error);
    return NextResponse.json({ error: "트렌드 조사 중 오류가 발생했습니다." }, { status: 500 });
  }
}
