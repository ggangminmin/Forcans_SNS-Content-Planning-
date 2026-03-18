import { useState, useRef, useCallback } from 'react';
import {
  Search, Loader2, BookOpen, Copy, Check, Sparkles, Image, X,
  FileText, ChevronDown, Tag, DollarSign, AlignLeft, Info,
  ArrowLeft, Wand2, Pencil
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
interface ContentResults { [key: string]: string[]; }
interface UploadedImage  { preview: string; base64: string; mimeType: string; }
interface ProductInfo    { name: string; price: string; feature: string; detail: string; }
interface YouTubeReference { id: string; title: string; thumb: string; channel: string; url: string; }

function normalizeVariant(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(normalizeVariant).filter(Boolean).join('\n\n');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const preferred = ['title', 'headline', 'hook', 'summary', 'intro', 'body', 'content', 'caption', 'cta']
      .map(key => record[key])
      .filter(Boolean)
      .map(normalizeVariant);
    if (preferred.length) return preferred.join('\n\n');
    return Object.entries(record)
      .map(([key, entry]) => `## ${key}\n${normalizeVariant(entry)}`)
      .join('\n\n');
  }
  return value == null ? '' : String(value);
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
  return JSON.parse(data.choices[0].message.content);
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
  const [aiImages, setAiImages]   = useState<string[]>([]);
  const [ytRefs, setYtRefs]       = useState<YouTubeReference[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [activeVariant, setActiveVariant] = useState<Record<string, number>>({});
  const [copied, setCopied]       = useState<string | null>(null);
  const [logs, setLogs]           = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showPlatforms, setShowPlatforms] = useState(false);

  const replaceIdxRef   = useRef<number>(-1);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key); setTimeout(() => setCopied(null), 2000);
  };
  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

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
    setLoading(true); setResults(null); setAiImages([]); setYtRefs([]); setLogs([]);

    try {
      addLog('🤖 [Gemini] 입력 데이터 분석 및 플랫폼 전략 수립 중...');
      
      const platformGuides: Record<string, string> = {
        instagram: `Instagram 피드 게시물:
- 첫 줄 강렬한 훅 (이모지 포함)
- 감성적 캡션 200~300자, 줄바꿈 가독성
- 팔로워 참여 유도 질문으로 마무리
- 해시태그 7~10개`,
        threads: `Threads 게시물:
- 짧고 임팩트 있는 첫 문장
- 대화체, 공감 유도
- 300자 내외, 댓글 유도 마무리`,
        shorts: `YouTube Shorts 대본 (60초):
[훅 0~3초] 충격적 첫 마디
[문제제기 3~15초] 공감 상황
[핵심 15~50초] 빠르고 임팩트
[CTA 50~60초] 구독/좋아요/댓글`,
        blog: `블로그 포스트 (SEO 최적화):
아래 형식을 정확히 따르세요. [사진1]~[사진4] 마커를 본문 사이사이에 반드시 4개 모두 배치하세요.

# [SEO 제목]

## 도입부
내용 2~3문장

[사진1]

## 핵심 내용 1
상세 설명

## 핵심 내용 2
상세 설명

[사진2]

## 핵심 내용 3
상세 설명

[사진3]

## 마무리
요약 + 구매/방문 유도

[사진4]

*추천 키워드 태그*`,
        twitter: `X(Twitter):
- 임팩트 첫 문장, 줄바꿈
- 140자 내외, 해시태그 2~3개`,
        tiktok: `TikTok 대본 (15~30초):
[오프닝 0~2초] 강한 훅
[본문 2~25초] 핵심만 빠르게
[엔딩] 팔로우 + 댓글 유도
추천 BGM:`,
      };

      const ctx: string[] = [];
      if (url)             ctx.push(`참고 링크: ${url}`);
      if (product.name)    ctx.push(`상품명: ${product.name}`);
      if (product.price)   ctx.push(`판매가: ${product.price}`);
      if (product.feature) ctx.push(`핵심 특징:\n${product.feature}`);
      if (product.detail)  ctx.push(`상세 정보:\n${product.detail}`);
      if (images.length)   ctx.push(`첨부 이미지 ${images.length}장`);

      const jsonKeys = selectedPlatforms.map(p => `"${p}": ["1안", "2안", "3안"]`).join(',\n  ');

      const geminiPrompt = `당신은 대한민국 최고의 SNS 마케팅 전략가(Gemini)입니다.
다음 정보를 바탕으로 각 플랫폼별 콘텐츠의 '핵심 전략'과 '초안'을 3개씩 생성해주세요.

[정보]
${ctx.join('\n')}

[대상 플랫폼 및 가이드]
${selectedPlatforms.map(p => `=== ${p.toUpperCase()} ===\n${platformGuides[p]}`).join('\n\n')}

반드시 JSON 형식으로만 응답하세요:
{
  ${jsonKeys}
}`;

      // 1. Gemini: Planning & Drafting (서버 프록시 경유)
      const parts: any[] = images.map(img => ({ inline_data: { mime_type: img.mimeType, data: img.base64 } }));
      parts.push({ text: geminiPrompt });

      const geminiRes = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts }),
      });

      if (!geminiRes.ok) { const e = await geminiRes.json(); throw new Error(`Gemini 오류: ${e.error}`); }
      const { text: geminiText } = await geminiRes.json();
      const geminiResult = JSON.parse(geminiText);

      // 2. GPT-4o: 고도화
      addLog('✨ [GPT-4o] 콘텐츠 정밀 고도화 중...');
      const gptPrompt = `당신은 SNS 콘텐츠 전문 에디터입니다.
Gemini가 작성한 초안을 더 매력적이고 트렌디하게 고도화해주세요.
한국 최신 유행어·감성을 반영하고, 전문적인 문장으로 다듬어주세요.

[Gemini 초안]
${JSON.stringify(geminiResult, null, 2)}

반드시 동일한 JSON 구조(플랫폼별 3개 안 배열)로만 응답하세요.`;

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
          (Array.isArray(value) ? value.slice(0, 3) : [value]).map(normalizeVariant).filter(Boolean)
        ])
      );

      setResults(normalized);
      setActiveVariant(Object.fromEntries(Object.keys(normalized).map(key => [key, 0])));
      setActiveTab(selectedPlatforms[0]);
      
      const name = product.name || '상품';

      // 3. YouTube Search (Reference)
      addLog('🔍 [YouTube] 콘텐츠 참고 레퍼런스 탐색 중...');
      try {
          // 첫 번째 활성 플랫폼에 대한 레퍼런스 우선 검색
          const platformLabel = SNS_PLATFORMS.find(p => p.key === selectedPlatforms[0])?.label || 'SNS';
          const searchQuery = `${name} ${platformLabel} 트렌드`;
          const refs = await callYouTube(searchQuery);
          setYtRefs(refs);
          addLog('✅ [YouTube] 참고 레퍼런스 탐색 완료');
      } catch (e: any) {
          addLog(`⚠️ [YouTube] 실패: ${e.message}`);
      }

      // 4. Codex: Image Enhancement (only for blog)
      if (selectedPlatforms.includes('blog') && normalized.blog?.length) {
        addLog('🎨 [Codex] 대시보드 내 AI 이미지 최적화 및 생성 중...');
        const prompts = [
            `Professional product photo of ${name} on white background, studio lighting, no text`,
            `${name} lifestyle shot, bright natural light, modern Korean home`,
            `Close-up detail of ${name} packaging and features, sharp focus, no text`,
            `${name} in use, warm atmosphere, happy pet owner, no text`,
        ];
        
        const generated: string[] = [];
        for (const pr of prompts) {
            try {
                const imgUrl = await generateAIImage(pr);
                generated.push(imgUrl);
                addLog(`✅ [DALL-E 3] ${generated.length}/${prompts.length}장 생성 완료`);
            } catch (err: any) {
                console.error('Image gen error:', err);
            }
        }
        setAiImages(generated);
      }

      addLog('✅ [Antigravity] 오케스트레이션 콘텐츠 생성 완료!');
      setView('results');
    } catch (err: any) {
      console.error(err);
      addLog(`⚠️ 오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

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
    const content  = variants[variantIndex] ?? variants[0] ?? '';

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
                    <span style={{ fontSize: '13px', color: 'var(--text-dim)', opacity: 0.6 }}>{content.length}자</span>
                    <button onClick={() => handleCopy(content, activeTab)}
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
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)', padding: activeTab === 'blog' ? '28px 32px' : '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', marginBottom: '32px' }}>
                  {activeTab === 'blog'
                    ? <BlogPreview content={content} images={images} aiImages={aiImages} onReplaceImage={openReplace} onRemoveImage={removeImage} />
                    : <pre style={{ margin: 0, fontSize: '15px', lineHeight: '1.8', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', color: 'var(--text-main)' }}>{content}</pre>
                  }
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
