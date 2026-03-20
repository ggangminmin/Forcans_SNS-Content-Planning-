import { useState, useRef, useCallback } from 'react';
import {
  Search, Loader2, BookOpen, Copy, Check, Sparkles, Image, X,
  FileText, ChevronDown, Tag, DollarSign, AlignLeft, Info,
  ArrowLeft, Wand2, Pencil, TrendingUp, Zap, Hash, Lightbulb, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// 모든 API는 /api/* 서버리스 함수를 통해 호출 (키는 서버 환경변수)

const SNS_PLATFORMS = [
  { key: 'instagram', label: 'Instagram',     icon: 'insta',   color: '#ec4899', bg: 'rgba(236,72,153,0.12)' },
  { key: 'threads',   label: 'Threads',        icon: 'threads', color: '#374151', bg: 'rgba(55,65,81,0.08)'   },
  { key: 'shorts',    label: 'YouTube Shorts', icon: 'shorts',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  { key: 'blog',      label: '블로그',           icon: 'blog',    color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  { key: 'twitter',   label: 'X (Twitter)',    icon: 'twitter', color: '#1d9bf0', bg: 'rgba(29,155,240,0.12)' },
  { key: 'tiktok',    label: 'TikTok',         icon: 'tiktok',  color: '#00bcd4', bg: 'rgba(0,188,212,0.12)'  },
];

type View = 'input' | 'results';

interface StoryboardFrame {
  timeCode: string;
  visual: string; 
  script: string;
  imageUrl?: string;
}

interface ContentVariant {
  content: string;
  images?: string[];
  storyboard?: StoryboardFrame[];
}

interface ContentResults { [key: string]: ContentVariant[]; }
interface UploadedImage  { preview: string; base64: string; mimeType: string; }
interface ProductInfo    { name: string; price: string; feature: string; detail: string; }
interface YouTubeReference { id: string; title: string; thumb: string; channel: string; url: string; }

interface TrendIssue   { title: string; summary: string; source: string; }
interface TrendKeyword { keyword: string; reason: string; }
interface TrendIdea    { platform: string; idea: string; angle: string; }
interface TrendResult  {
  trending_issues: TrendIssue[];
  keywords: TrendKeyword[];
  content_ideas: TrendIdea[];
  hashtags: string[];
}

function normalizeVariant(value: unknown): ContentVariant {
  if (typeof value === 'string') return { content: value };
  
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as any;
    // 만약 이미 ContentVariant 형식이면 그대로 반환
    if ('content' in record) return record as ContentVariant;

    // 만약 객체인데 'content'가 없으면 문자열화해서 담음
    const content = ['title', 'headline', 'hook', 'summary', 'intro', 'body', 'caption', 'cta', 'script', 'scenario']
      .map(key => record[key])
      .filter(Boolean)
      .join('\n\n') || JSON.stringify(record, null, 2);
    
    return {
      content,
      storyboard: record.storyboard || record.story,
      images: record.images || []
    };
  }

  return { content: String(value) };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/* ── GPT-4o 호출 (서버 프록시) ── */
async function callGPT(messages: any[]): Promise<any> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'GPT 오류');
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('GPT 응답이 비어 있습니다.');
  return JSON.parse(content);
}

/* ── DALL-E 3 이미지 생성 (서버 프록시) ── */
async function generateAIImage(prompt: string): Promise<string> {
  const res = await fetch('/api/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'DALL-E 오류');
  return data.url;
}

/* ── 트렌드 탐색 (Gemini + Google Search) ── */
async function callTrendSearch(keyword: string): Promise<TrendResult> {
  const res = await fetch('/api/trend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '트렌드 검색 오류');
  return data;
}

/* ── YouTube 검색 (서버 프록시) ── */
async function callYouTube(query: string): Promise<YouTubeReference[]> {
  const res = await fetch('/api/youtube', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'YouTube 오류');
  return data;
}

/* ── OpenClaw 실행 (데스크톱 에이전트) ── */
async function callOpenClaw(task: string): Promise<any> {
    // OpenClaw 게이트웨이 인증 토큰 (안전하게 헤더에 포함)
    const token = 'c5761a5ed7aeff915549cd4e135067e16b9b2937ebe3dd7c';
    
    try {
        const res = await fetch('/api/openclaw/tools/invoke', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                tool: 'browser', 
                action: 'execute',
                args: { task }
            }),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `OpenClaw 응답 오류 (${res.status})`);
        }
        return await res.json();
    } catch (err: any) {
        if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
            throw new Error('OpenClaw 에이전트가 실행 중이 아니거나 포트가 올바르지 않습니다.');
        }
        throw err;
    }
}

/* ── 플랫폼 아이콘 ── */
function PlatformIcon({ platform, size = 18 }: { platform: string; size?: number }) {
  if (platform === 'insta') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>
  );
  if (platform === 'shorts') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
    </svg>
  );
  if (platform === 'blog')    return <BookOpen size={size} />;
  if (platform === 'threads') return <span style={{ fontWeight: 900, fontSize: size - 2 }}>@</span>;
  if (platform === 'twitter') return <span style={{ fontWeight: 900, fontSize: size - 4 }}>𝕏</span>;
  if (platform === 'tiktok')  return <span style={{ fontWeight: 900, fontSize: size - 4 }}>♪</span>;
  return null;
}

/* ── AI 이미지 컴포넌트 ── */
function AIImage({ src, label }: { src: string; label: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  return (
    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc', position: 'relative', width: '100%', aspectRatio: '16/9' }}>
      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, background: '#f1f5f9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#94a3b8' }}>
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}
      <img src={src} alt={label}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: status === 'loaded' ? 'block' : 'none' }}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
      />
      {status === 'loaded' && (
        <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(124,58,237,0.85)', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px' }}>
          ✨ AI 생성
        </div>
      )}
    </div>
  );
}

/* ── 블로그 미리보기 ── */
function BlogPreview({ content, images, aiImages, onReplaceImage, onRemoveImage }: {
  content: string; images: UploadedImage[]; aiImages: string[];
  onReplaceImage: (idx: number) => void; onRemoveImage: (idx: number) => void;
}) {
  const allImages = [
    ...images.map((img, idx) => ({ src: img.preview, isAI: false, uploadedIndex: idx })),
    ...aiImages.map(url => ({ src: url, isAI: true, uploadedIndex: -1 })),
  ];

  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let usedCount = 0;

  lines.forEach((line, i) => {
    const m = line.match(/^\[사진(\d+)\]/);
    if (m) {
      const idx = parseInt(m[1]) - 1;
      const img = allImages[idx] ?? allImages[usedCount];
      if (img) {
        elements.push(
          <figure key={`img-${i}`} style={{ margin: '16px 0' }}>
            {img.isAI ? <AIImage src={img.src} label={`사진 ${idx + 1}`} /> : <img src={img.src} style={{ width: '100%', borderRadius: '12px' }} />}
            <figcaption style={{ textAlign: 'center', fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              사진 {idx + 1}
            </figcaption>
          </figure>
        );
        usedCount++;
      }
      return;
    }

    if (line.startsWith('# ')) elements.push(<h1 key={i} style={{ fontSize: '24px', margin: '20px 0 10px' }}>{line.slice(2)}</h1>);
    else if (line.startsWith('## ')) elements.push(<h2 key={i} style={{ fontSize: '20px', margin: '15px 0 8px' }}>{line.slice(3)}</h2>);
    else elements.push(<p key={i} style={{ margin: '5px 0', lineHeight: '1.6' }}>{line}</p>);
  });

  return <div>{elements}</div>;
}

export default function App() {
  const [view, setView]           = useState<View>('input');
  const [url, setUrl]             = useState('');
  const [product, setProduct]     = useState<ProductInfo>({ name: '', price: '', feature: '', detail: '' });
  const [images, setImages]       = useState<UploadedImage[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram', 'shorts', 'blog']);
  const [loading, setLoading]     = useState(false);
  const [results, setResults]     = useState<ContentResults | null>(null);
  const [ytRefs, setYtRefs]       = useState<YouTubeReference[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [activeVariant, setActiveVariant] = useState<Record<string, number>>({});
  const [copied, setCopied]       = useState<string | null>(null);
  const [logs, setLogs]           = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showPlatforms, setShowPlatforms] = useState(false);
  const [openClawLoading, setOpenClawLoading] = useState(false);
  const [trendKeyword, setTrendKeyword]   = useState('');
  const [trendLoading, setTrendLoading]   = useState(false);
  const [trendResult, setTrendResult]     = useState<TrendResult | null>(null);
  const [trendError, setTrendError]       = useState('');
  const [selectedIdeas, setSelectedIdeas] = useState<string[]>([]);

  const replaceIdxRef   = useRef<number>(-1);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key); setTimeout(() => setCopied(null), 2000);
  };
  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const handleTrendSearch = async () => {
    const q = trendKeyword.trim() || product.name.trim();
    if (!q) return;
    setTrendLoading(true); setTrendResult(null); setTrendError(''); setSelectedIdeas([]);
    try {
      const result = await callTrendSearch(q);
      setTrendResult(result);
    } catch (e: any) {
      setTrendError(e.message);
    } finally {
      setTrendLoading(false);
    }
  };

  const applyIdeaToProduct = (idea: TrendIdea) => {
    const key = `${idea.platform}:${idea.idea}`;
    const isSelected = selectedIdeas.includes(key);
    setSelectedIdeas(prev => isSelected ? prev.filter(k => k !== key) : [...prev, key]);
    if (!isSelected) {
      setProduct(p => ({
        ...p,
        detail: p.detail
          ? `${p.detail}\n\n[${idea.platform.toUpperCase()} 소재] ${idea.idea} — ${idea.angle}`
          : `[${idea.platform.toUpperCase()} 소재] ${idea.idea} — ${idea.angle}`,
      }));
    }
  };

  const applyKeyword = (kw: string) => {
    if (!product.name) setProduct(p => ({ ...p, name: kw }));
    else setProduct(p => ({ ...p, feature: p.feature ? `${p.feature}, ${kw}` : kw }));
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.readAsDataURL(file);
      r.onload  = () => res((r.result as string).split(',')[1]);
      r.onerror = rej;
    });

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const next: UploadedImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      if (images.length + next.length >= 4) break;
      next.push({ preview: URL.createObjectURL(file), base64: await fileToBase64(file), mimeType: file.type });
    }
    setImages(prev => [...prev, ...next].slice(0, 4));
  }, [images]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const openReplace = (idx: number) => {
    replaceIdxRef.current = idx;
    replaceInputRef.current?.click();
  };
  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };
  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const idx  = replaceIdxRef.current;
    if (!file || idx < 0) return;
    const updated: UploadedImage = { preview: URL.createObjectURL(file), base64: await fileToBase64(file), mimeType: file.type };
    setImages(prev => prev.map((img, i) => i === idx ? updated : img));
    e.target.value = '';
  };

  const togglePlatform = (key: string) =>
    setSelectedPlatforms(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);

  const generateContent = async () => {
    const hasData = url || product.name || product.price || product.feature || product.detail || images.length > 0;
    if (!hasData || selectedPlatforms.length === 0) return;
    setLoading(true); setResults(null); setYtRefs([]); setLogs([]);

    try {
      addLog('🤖 [Gemini] 입력 데이터 분석 및 플랫폼 전략 수립 중...');
      
      const name = product.name || '상품';
      const platformGuides: Record<string, string> = {
        instagram: `Instagram 피드 게시물:
- content: 매력적인 캡션 (훅, 본문, 해시태그 포함)
- visual: 이 게시물에 어울리는 '감성적인 이미지' 생성용 영어 프롬프트 (Nanobanana용)`,
        threads: `Threads:
- content: 대화체 본문`,
        shorts: `YouTube Shorts (60초):
- content: 전체적인 영상 컨셉과 요약
- storyboard: 4~5개의 장면 배열. 각 장면은 { "timeCode": "시간", "visual": "영상 화면 묘사(영문 프롬프트)", "script": "대사/나레이션" } 형식을 따름.`,
        blog: `블로그 포스트:
- content: [사진1]~[사진4] 마커를 포함한 SEO 최적화 본문
- visualPrompts: 본문에 들어갈 사진 4장에 대한 각각의 영문 묘사 프롬프트 (배열)`,
        twitter: `X(Twitter):
- content: 140자 내외 본문`,
        tiktok: `TikTok:
- content: 영상 컨셉
- storyboard: { "timeCode", "visual", "script" } 배열`,
      };

      const ctx: string[] = [];
      if (url)             ctx.push(`참고 링크: ${url}`);
      if (product.name)    ctx.push(`상품명: ${product.name}`);
      if (product.price)   ctx.push(`판매가: ${product.price}`);
      if (product.feature) ctx.push(`핵심 특징:\n${product.feature}`);
      if (product.detail)  ctx.push(`상세 정보:\n${product.detail}`);
      if (images.length)   ctx.push(`첨부 이미지 ${images.length}장`);

      const jsonStructure = `{
  "instagram": [ { "content": "...", "visual": "..." }, ... ],
  "shorts": [ { "content": "...", "storyboard": [ { "timeCode": "...", "visual": "...", "script": "..." }, ... ] }, ... ],
  "blog": [ { "content": "...", "visualPrompts": ["...", "...", "...", "..."] } ]
}`;

      const geminiPrompt = `당신은 대한민국 최고의 SNS 마케팅 전략가(Gemini)입니다.
다음 정보를 바탕으로 각 플랫폼별 콘텐츠를 반드시 3개씩 생성해주세요.
반드시 각 플랫폼의 가이드와 JSON 구조를 엄격히 지켜주세요. 1안, 2안, 3안은 주제와 컨셉이 완전히 달라야 합니다.

[정보]
${ctx.join('\n')}

[대상 플랫폼 및 가이드]
${selectedPlatforms.map(p => `=== ${p.toUpperCase()} ===\n${platformGuides[p]}`).join('\n\n')}

반드시 아래와 같은 JSON 형식으로만 응답하세요:
${jsonStructure}`;

      // 1. Gemini: Planning & Drafting
      const parts: any[] = images.map(img => ({ inline_data: { mime_type: img.mimeType, data: img.base64 } }));
      parts.push({ text: geminiPrompt });

      const geminiRes = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts }),
      });

      if (!geminiRes.ok) {
        const e = await geminiRes.json().catch(() => ({}));
        const status = geminiRes.status;
        if (status === 429) throw new Error('Gemini API 요청 한도 초과 (429). 잠시 후 다시 시도해주세요.');
        throw new Error(`Gemini 오류 (${status}): ${e.error || '알 수 없는 오류'}`);
      }
      const geminiBody = await geminiRes.json();
      const geminiText: string = geminiBody?.text;
      if (!geminiText) throw new Error('Gemini 응답이 비어 있습니다. 잠시 후 다시 시도해주세요.');
      let geminiResult: any;
      try {
        geminiResult = JSON.parse(geminiText);
      } catch {
        throw new Error('Gemini 응답 파싱 실패. 다시 시도해주세요.');
      }

      // 2. GPT-4o: 고도화
      addLog('✨ [GPT-4o] 콘텐츠 정밀 고도화 및 톤앤매너 교정 중...');
      const gptPrompt = `당신은 SNS 콘텐츠 전문 에디터입니다.
Gemini가 작성한 초안을 더 매력적이고 트렌디하게 고도화해주세요.
한국 최신 유행어·감성을 반영하고, 전문적인 문장으로 다듬어주세요. 
JSON 구조와 영문 visual 프롬프트는 절대 변경하지 말고 내용만 매력적으로 다듬으세요.

[Gemini 초안]
${JSON.stringify(geminiResult, null, 2)}

반드시 동일한 JSON 구조로 응답하세요.`;

      let finalResult = geminiResult;
      try {
        finalResult = await callGPT([{ role: 'user', content: gptPrompt }]);
        addLog('✅ [GPT-4o] 고도화 완료');
      } catch (e: any) {
        addLog(`⚠️ [GPT-4o] 실패 — Gemini 초안 사용 (${e.message})`);
      }

      const normalized: ContentResults = Object.fromEntries(
        Object.entries(finalResult).map(([key, value]) => [
          key, 
          (Array.isArray(value) ? value.slice(0, 3) : [value]).map(normalizeVariant)
        ])
      );

      setResults(normalized);
      setActiveVariant(Object.fromEntries(Object.keys(normalized).map(key => [key, 0])));
      setActiveTab(selectedPlatforms[0]);
      setView('results'); // 텍스트 완성 즉시 결과 페이지 표시 (이미지는 이후 순차 로드)

      // 3. YouTube Search (Reference)
      addLog('🔍 [YouTube] 콘텐츠 참고 레퍼런스 탐색 중...');
      try {
          const platformLabel = SNS_PLATFORMS.find(p => p.key === selectedPlatforms[0])?.label || 'SNS';
          const searchQuery = `${name} ${platformLabel} 트렌드`;
          const refs = await callYouTube(searchQuery);
          setYtRefs(refs);
          addLog('✅ [YouTube] 참고 레퍼런스 탐색 완료');
      } catch (e: any) {
          addLog(`⚠️ [YouTube] 실패: ${e.message}`);
      }

      // 4. 이미지 생성 (플랫폼별 모든 안)
      addLog('🎨 [Image AI] 모든 안(1안/2안/3안) 시각 자료 생성 중...');

      for (const plat of selectedPlatforms) {
        const variants = normalized[plat] || [];

        for (let i = 0; i < variants.length; i++) {
          const variant = variants[i];
          const variantLabel = `${plat.toUpperCase()} ${i + 1}안`;

          // 블로그: variant.images에 직접 저장 (각 안별로 독립 관리)
          if (plat === 'blog') {
            const prompts = (variant as any).visualPrompts || [];
            const blogImages: string[] = [];
            for (let j = 0; j < prompts.slice(0, 4).length; j++) {
              try {
                const imgUrl = await generateAIImage(prompts[j]);
                blogImages.push(imgUrl);
                variant.images = [...blogImages];
                setResults({ ...normalized }); // 이미지 하나씩 생성될 때마다 UI 업데이트
                addLog(`✅ [Image AI] ${variantLabel} 이미지 ${j + 1}/4 생성`);
              } catch (err) { console.error(err); }
            }
          }

          // 인스타그램: variant.images에 저장
          if (plat === 'instagram' && (variant as any).visual) {
            try {
              const imgUrl = await generateAIImage((variant as any).visual);
              variant.images = [imgUrl];
              setResults({ ...normalized }); // UI 즉시 업데이트
              addLog(`✅ [Image AI] ${variantLabel} 메인 이미지 생성 완료`);
            } catch (err) { console.error(err); }
          }

          // 쇼츠/틱톡: 각 장면 이미지 생성
          if ((plat === 'shorts' || plat === 'tiktok') && variant.storyboard?.length) {
            for (let j = 0; j < variant.storyboard.length; j++) {
              try {
                const scene = variant.storyboard[j];
                const imgUrl = await generateAIImage(scene.visual);
                scene.imageUrl = imgUrl;
                setResults({ ...normalized }); // 장면 하나씩 생성될 때마다 UI 업데이트
                addLog(`✅ [Image AI] ${variantLabel} 스토리보드 ${j + 1}/${variant.storyboard.length} 장면 생성`);
              } catch (err) { console.error(err); }
            }
          }
        }
      }

      addLog('✅ 모든 콘텐츠 생성 완료!');
    } catch (err: any) {
      console.error(err);
      addLog(`⚠️ 오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenClaw = async (content: string, platform: string, images: string[] = []) => {
    setOpenClawLoading(true);
    addLog(`🚀 [OpenClaw] '${platform}' 게시 작업 전송 중...`);
    try {
      const task = `인스타그램 게시 작업을 수행해줘. 
내용: "${content}"
이미지 URL: ${images.join(', ')}
플랫폼: ${platform}
이 작업을 브라우저를 통해 완수해줘.`;

      await callOpenClaw(task);
      addLog('✅ [OpenClaw] 작업 전송 완료! (에이전트에서 작업을 시작합니다)');
      alert('OpenClaw 에이전트로 작업이 전송되었습니다.');
    } catch (err: any) {
      addLog(`⚠️ [OpenClaw] 오류: ${err.message}`);
      alert(err.message);
    } finally {
      setOpenClawLoading(false);
    }
  };

/* ── 트렌드 패널 ── */
function TrendPanel({
  result, selectedIdeas, onApplyIdea, onApplyKeyword,
}: {
  result: TrendResult;
  selectedIdeas: string[];
  onApplyIdea: (idea: TrendIdea) => void;
  onApplyKeyword: (kw: string) => void;
}) {
  const [activeSection, setActiveSection] = useState<'issues' | 'keywords' | 'ideas'>('issues');
  const platformColors: Record<string, string> = {
    instagram: '#ec4899', shorts: '#ef4444', blog: '#3b82f6',
  };
  const platformLabels: Record<string, string> = {
    instagram: 'Instagram', shorts: 'Shorts', blog: '블로그',
  };

  const tabStyle = (active: boolean, color = '#7c3aed'): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
    border: `2px solid ${active ? color : 'transparent'}`,
    background: active ? `${color}18` : 'rgba(255,255,255,0.5)',
    color: active ? color : 'var(--text-dim)', transition: 'all 0.15s',
  });

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.04) 0%, rgba(59,130,246,0.04) 100%)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: '16px', padding: '20px', marginTop: '8px' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button style={tabStyle(activeSection === 'issues', '#7c3aed')} onClick={() => setActiveSection('issues')}>
          🔥 이슈 {result.trending_issues.length}개
        </button>
        <button style={tabStyle(activeSection === 'keywords', '#0ea5e9')} onClick={() => setActiveSection('keywords')}>
          🔑 키워드 {result.keywords.length}개
        </button>
        <button style={tabStyle(activeSection === 'ideas', '#10b981')} onClick={() => setActiveSection('ideas')}>
          💡 소재 아이디어
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeSection === 'issues' && (
          <motion.div key="issues" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {result.trending_issues.map((issue, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: '10px', padding: '14px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>
                      {['🔥', '📢', '📰', '⚡', '🌟'][i % 5]}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>{issue.title}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: '1.5', marginBottom: '6px' }}>{issue.summary}</div>
                      {issue.source && (
                        <span style={{ fontSize: '11px', background: 'rgba(124,58,237,0.08)', color: '#7c3aed', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                          📌 {issue.source}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeSection === 'keywords' && (
          <motion.div key="keywords" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {result.keywords.map((kw, i) => (
                <button
                  key={i}
                  onClick={() => onApplyKeyword(kw.keyword)}
                  title={kw.reason}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.color = '#7c3aed'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                >
                  # {kw.keyword}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {result.keywords.map((kw, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', padding: '10px 14px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                  <span style={{ fontWeight: 700, color: '#0ea5e9', flexShrink: 0 }}>#{kw.keyword}</span>
                  <span style={{ color: 'var(--text-dim)' }}>{kw.reason}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeSection === 'ideas' && (
          <motion.div key="ideas" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {(['instagram', 'shorts', 'blog'] as const).map(plat => {
              const ideas = result.content_ideas.filter(c => c.platform === plat);
              if (!ideas.length) return null;
              return (
                <div key={plat} style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: platformColors[plat], marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ background: `${platformColors[plat]}18`, padding: '3px 10px', borderRadius: '12px' }}>
                      {platformLabels[plat]}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {ideas.map((idea, i) => {
                      const key = `${idea.platform}:${idea.idea}`;
                      const isSelected = selectedIdeas.includes(key);
                      return (
                        <div
                          key={i}
                          onClick={() => onApplyIdea(idea)}
                          style={{ padding: '12px 14px', background: isSelected ? `${platformColors[plat]}10` : '#fff', border: `1px solid ${isSelected ? platformColors[plat] : 'var(--border-color)'}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s' }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(124,58,237,0.04)'; }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#fff'; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>{idea.idea}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>💡 {idea.angle}</div>
                            </div>
                            <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '8px', fontWeight: 700, background: isSelected ? platformColors[plat] : 'var(--border-color)', color: isSelected ? '#fff' : 'var(--text-dim)', flexShrink: 0 }}>
                              {isSelected ? '✓ 적용됨' : '+ 적용'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {result.hashtags.length > 0 && (
              <div style={{ marginTop: '8px', padding: '12px 14px', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '8px' }}>추천 해시태그</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {result.hashtags.map((tag, i) => (
                    <span key={i} style={{ fontSize: '13px', color: '#0ea5e9', fontWeight: 600, background: 'rgba(14,165,233,0.08)', padding: '3px 10px', borderRadius: '10px' }}>{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── 인스타그램 미리보기 ── */
function InstagramPreview({ variant }: { variant: ContentVariant }) {
  return (
    <div style={{ maxWidth: '470px', margin: '0 auto', border: '1px solid var(--border-color)', borderRadius: '8px', background: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', padding: '2px' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#333' }}>AI</div>
        </div>
        <div style={{ fontSize: '13px', fontWeight: 700 }}>AI_Content_Agent</div>
      </div>
      
      <div style={{ width: '100%', aspectRatio: '1/1', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {variant.images?.[0] ? (
          <img src={variant.images[0]} alt="Insta" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ color: 'var(--text-dim)', fontSize: '14px' }}>이미지 생성 중...</div>
        )}
      </div>

      <div style={{ padding: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.38 8.38 0 0 1 3.8.9L21 3z"/></svg>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </div>
        <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
          <span style={{ fontWeight: 700, marginRight: '5px' }}>AI_Content_Agent</span>
          <pre style={{ margin: 0, padding: 0, display: 'inline', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{variant.content}</pre>
        </div>
      </div>
    </div>
  );
}

/* ── 쇼츠/틱톡 스토리보드 ── */
function ShortsStoryboard({ variant }: { variant: ContentVariant }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 700 }}>🎥 영상 컨셉</h4>
        <div style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-main)' }}>{variant.content}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>🎨 스토리보드</h4>
        {variant.storyboard?.map((scene, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '20px', padding: '20px', background: '#fff', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ width: '140px', aspectRatio: '9/16', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               {scene.imageUrl ? (
                 <img src={scene.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
               ) : (
                 <div style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>{i === 0 ? '샘플 생성 중...' : `Scene ${i+1}`}</div>
               )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#ef4444' }}>{scene.timeCode}</div>
              <div style={{ fontSize: '14px', fontWeight: 600, lineHeight: '1.55' }}>{scene.visual}</div>
              <div style={{ fontSize: '14px', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #cbd5e1', lineHeight: '1.6' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>AUDIO/SCRIPT</span>
                {scene.script}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

  const hasInput = url || product.name || product.price || product.feature || product.detail || images.length > 0;
  const inputSt: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: '10px',
    border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.85)',
    color: 'var(--text-main)', fontSize: '15px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
  };
  const labelSt: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px',
    fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)',
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px',
  };

  if (view === 'results' && results) {
    const activePl = SNS_PLATFORMS.find(p => p.key === activeTab);
    const variants = results[activeTab] ?? [];
    const variantIndex = activeVariant[activeTab] ?? 0;
    const variant  = variants[variantIndex] ?? variants[0];

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(248,250,252,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-color)', padding: '0 24px' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '16px', height: '60px' }}>
            <button onClick={() => setView('input')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', color: 'var(--text-dim)', fontSize: '14px', fontWeight: 600 }}>
              <ArrowLeft size={15} /> 다시 작성
            </button>
            <div style={{ flex: 1, display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
              {selectedPlatforms.map(key => {
                const pl  = SNS_PLATFORMS.find(p => p.key === key);
                const act = key === activeTab;
                if (!pl) return null;
                return (
                  <button key={key} onClick={() => setActiveTab(key)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', border: `2px solid ${act ? pl.color : 'transparent'}`, background: act ? pl.bg : 'rgba(255,255,255,0.7)', color: act ? pl.color : 'var(--text-dim)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
                    <PlatformIcon platform={pl.icon} size={14} />
                    {pl.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
          <AnimatePresence mode="wait">
            {activePl && (
              <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: activePl.color, display: 'flex', alignItems: 'center' }}><PlatformIcon platform={activePl.icon} size={22} /></span>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)' }}>{activePl.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-dim)', opacity: 0.6 }}>{(variant?.content || '').length}자</span>
                    <button onClick={() => handleCopy(variant?.content || '', activeTab)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: '1px solid var(--border-color)', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: copied === activeTab ? '#10b981' : 'var(--text-dim)', transition: 'all 0.15s' }}>
                      {copied === activeTab ? <><Check size={14} /> 복사됨</> : <><Copy size={14} /> 복사</>}
                    </button>
                  </div>
                </div>

                {variants.length > 1 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    {variants.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveVariant(prev => ({ ...prev, [activeTab]: idx }))}
                        style={{
                          padding: '7px 12px',
                          borderRadius: '999px',
                          border: `1px solid ${idx === variantIndex ? activePl.color : 'var(--border-color)'}`,
                          background: idx === variantIndex ? activePl.bg : '#fff',
                          color: idx === variantIndex ? activePl.color : 'var(--text-dim)',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {idx + 1}안
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                   <button 
                     onClick={() => handleOpenClaw(variant.content, activePl.label, variant.images)}
                     disabled={openClawLoading}
                     style={{ 
                       flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', 
                       padding: '14px', borderRadius: '12px', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', 
                       color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '15px',
                       boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', transition: 'all 0.2s'
                     }}
                     onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                     onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                   >
                     {openClawLoading ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
                     OpenClaw로 포스팅 실행하기
                   </button>
                </div>

                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', padding: activeTab === 'blog' ? '28px 32px' : '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', marginBottom: '32px' }}>
                  {activeTab === 'blog' && <BlogPreview content={variant.content} images={images} aiImages={variant.images || []} onReplaceImage={openReplace} onRemoveImage={removeImage} />}
                  {activeTab === 'instagram' && <InstagramPreview variant={variant} />}
                  {(activeTab === 'shorts' || activeTab === 'tiktok') && <ShortsStoryboard variant={variant} />}
                  {['threads', 'twitter'].includes(activeTab) && <pre style={{ margin: 0, fontSize: '15px', lineHeight: '1.8', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', color: 'var(--text-main)' }}>{variant.content}</pre>}
                </div>

                {ytRefs.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="#ef4444"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg>
                      YouTube 참고 레퍼런스
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                      {ytRefs.map(ref => (
                        <a key={ref.id} href={ref.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'block', background: '#fff', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', transition: 'transform 0.2s' }}
                           onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                           onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                          <img src={ref.thumb} alt={ref.title} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                          <div style={{ padding: '12px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: '1.4', marginBottom: '4px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {ref.title}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                              {ref.channel}
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <input ref={fileInputRef}    type="file" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
      <input ref={replaceInputRef} type="file" style={{ display: 'none' }} onChange={handleReplaceFile} />

      <header style={{ textAlign: 'center', marginBottom: '44px' }}>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '10px' }}>
            <Sparkles size={28} style={{ color: '#a78bfa' }} />
            <h1 style={{ fontSize: '38px', margin: 0, fontWeight: 800, letterSpacing: '-1px' }}>
              Content <span className="gradient-text">Ideation</span> Agent
            </h1>
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: '15px', margin: 0 }}>
            상품 정보와 이미지를 입력하면 각 SNS에 맞는 콘텐츠 초안을 즉시 생성합니다
          </p>
        </motion.div>
      </header>

      <div className="glass" style={{ padding: '32px', marginBottom: '32px' }}>

        {/* ── 트렌드 탐색 섹션 ── */}
        <div style={{ marginBottom: '28px', padding: '20px', background: 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(59,130,246,0.04) 100%)', borderRadius: '16px', border: '1px solid rgba(124,58,237,0.14)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <TrendingUp size={16} style={{ color: '#7c3aed' }} />
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px' }}>트렌드 탐색</span>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 500 }}>— 실시간 이슈·키워드·소재 발굴</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Globe style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} size={16} />
              <input
                type="text"
                placeholder="키워드·주제·상품명 입력 (예: 비건 화장품, 홈카페, 여름 다이어트)"
                style={{ ...inputSt, paddingLeft: '40px' }}
                value={trendKeyword}
                onChange={e => setTrendKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTrendSearch()}
              />
            </div>
            <button
              onClick={handleTrendSearch}
              disabled={trendLoading || (!trendKeyword.trim() && !product.name.trim())}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 20px', borderRadius: '10px', background: trendLoading ? '#e2e8f0' : 'linear-gradient(90deg, #7c3aed, #3b82f6)', color: trendLoading ? 'var(--text-dim)' : '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px', flexShrink: 0, transition: 'all 0.2s' }}
            >
              {trendLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              {trendLoading ? '탐색 중...' : '탐색하기'}
            </button>
          </div>
          {trendError && (
            <div style={{ marginTop: '10px', fontSize: '13px', color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: '8px' }}>
              ⚠️ {trendError}
            </div>
          )}
          <AnimatePresence>
            {trendResult && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden', marginTop: '8px' }}>
                <TrendPanel
                  result={trendResult}
                  selectedIdeas={selectedIdeas}
                  onApplyIdea={applyIdeaToProduct}
                  onApplyKeyword={applyKeyword}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={labelSt}><Search size={12} /> 참고 링크 (선택)</div>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} size={16} />
            <input type="text" placeholder="예: 상품 상세페이지 URL, 참고 블로그 글, 경쟁사 콘텐츠 링크" style={{ ...inputSt, paddingLeft: '40px' }} value={url} onChange={e => setUrl(e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={labelSt}><FileText size={12} /> 상품 정보</div>
          <div style={{ background: 'rgba(124,58,237,0.03)', border: '1px solid rgba(124,58,237,0.12)', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={labelSt}>상품명</div>
                <input type="text" placeholder="예: 강아지 덴탈껌, 프리미엄 텀블러, 비건 선크림" style={inputSt} value={product.name} onChange={e => setProduct(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <div style={labelSt}>판매가</div>
                <input type="text" placeholder="예: 19,900원 / 3개입 / 체험가 9,900원" style={inputSt} value={product.price} onChange={e => setProduct(p => ({ ...p, price: e.target.value }))} />
              </div>
            </div>
            <div>
              <div style={labelSt}>핵심 특징</div>
              <textarea rows={3} placeholder="예: 저자극 성분, 휴대성, 선물용 패키지, 타깃 고객이 바로 느끼는 장점" style={{ ...inputSt, resize: 'none' }} value={product.feature} onChange={e => setProduct(p => ({ ...p, feature: e.target.value }))} />
            </div>
            <div>
              <div style={labelSt}>상세 정보</div>
              <textarea rows={3} placeholder="예: 시즌성, 프로모션, 브랜드 톤앤매너, 후기 포인트, 반드시 넣을 메시지" style={{ ...inputSt, resize: 'none' }} value={product.detail} onChange={e => setProduct(p => ({ ...p, detail: e.target.value }))} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={labelSt}><Image size={12} /> 이미지 (최대 4장)</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {images.map((img, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={img.preview} style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', cursor: 'pointer' }} onClick={() => openReplace(i)} />
                <button onClick={() => removeImage(i)} style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer' }}>X</button>
              </div>
            ))}
            {images.length < 4 && (
              <button onClick={() => fileInputRef.current?.click()} style={{ width: '80px', height: '80px', border: '2px dashed #e2e8f0', borderRadius: '12px', background: '#f8fafc', cursor: 'pointer' }}>+</button>
            )}
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div onClick={() => setShowPlatforms(!showPlatforms)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '11px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={labelSt}>생성 플랫폼</span>
              {selectedPlatforms.map(p => {
                const pl = SNS_PLATFORMS.find(s => s.key === p);
                return pl ? <span key={p} className="tag" style={{ background: pl.bg, color: pl.color }}>{pl.label}</span> : null;
              })}
            </div>
            <ChevronDown size={15} style={{ transform: showPlatforms ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          <AnimatePresence>
            {showPlatforms && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '12px', background: 'rgba(255,255,255,0.6)', borderRadius: '0 0 10px 10px', border: '1px solid var(--border-color)', borderTop: 'none' }}>
                  {SNS_PLATFORMS.map(pl => {
                    const sel = selectedPlatforms.includes(pl.key);
                    return (
                      <button key={pl.key} onClick={() => togglePlatform(pl.key)}
                        style={{ padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', border: `2px solid ${sel ? pl.color : 'transparent'}`, background: sel ? pl.bg : '#fff', color: sel ? pl.color : 'var(--text-dim)', fontWeight: 600, fontSize: '13px' }}>
                        {pl.label}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button className="glow-btn" onClick={generateContent} disabled={loading || !hasInput} style={{ width: '100%', padding: '16px', fontSize: '16px' }}>
          {loading ? '생성 중...' : '콘텐츠 생성하기'}
        </button>

        <AnimatePresence>
          {logs.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ marginTop: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '12px', background: 'rgba(0,0,0,0.03)', borderRadius: '10px' }}>
                {logs.map((log, i) => <div key={i} style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>{log}</div>)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
