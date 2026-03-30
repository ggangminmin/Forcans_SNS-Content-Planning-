"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Loader2, Check, Sparkles, Image, Wand2, Upload, Search, 
  Link as LinkIcon, DollarSign, AlignLeft, Info, FileText, 
  Instagram, Youtube, Twitter, Film, PenSquare, 
  MessageCircleMore, PencilLine, Trash2, Layout, BarChart3 
} from 'lucide-react';
import './home.css';
import { Sidebar } from '@/components/layout/sidebar';

const SNS_PLATFORMS = [
  { key: 'instagram', label: 'Instagram',      icon: 'insta',   color: '#ec4899', bg: 'rgba(236,72,153,0.12)' },
  { key: 'shorts',    label: 'YouTube Shorts', icon: 'shorts',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  { key: 'blog',      label: '블로그',           icon: 'blog',    color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
];

const PLATFORM_ICONS: Record<string, any> = {
  instagram: Instagram,
  shorts: Youtube,
  blog: PenSquare,
};

type View = 'input' | 'research' | 'planning' | 'results';

interface PlanningDoc {
  concept: string;
  trendReason: string;
  targetPersona: string;
  targetReason: string;
  tone: string;
  visualMood: string;
  coreMessage: string;
  cta: string;
  platformStrategy: Record<string, string>;
}

interface StoryboardFrame { timeCode: string; visual: string; script: string; imageUrl?: string; }
interface ContentVariant  { content: string; images?: string[]; storyboard?: StoryboardFrame[]; visualPrompts?: string[]; visual?: string; duration?: string; }
interface ContentResults  { [key: string]: ContentVariant[]; }
interface UploadedImage   { preview: string; base64: string; mimeType: string; }

function normalizeVariant(value: unknown): ContentVariant {
  if (typeof value === 'string') return { content: value };
  const r = value as any;
  if (r && typeof r === 'object' && !Array.isArray(r)) {
    const rawContent = r.content || r.caption || r.body || r.script || r.text || '';
    const content = Array.isArray(rawContent) ? rawContent.join('\n') : typeof rawContent === 'object' ? (rawContent.text || JSON.stringify(rawContent)) : String(rawContent);

    return {
      content: content,
      storyboard: Array.isArray(r.storyboard) ? r.storyboard : [],
      images: Array.isArray(r.images) ? r.images : [],
      visualPrompts: Array.isArray(r.visualPrompts) ? r.visualPrompts : [],
      visual: String(r.visual || r.imagePrompt || ''),
      duration: String(r.duration || '')
    };
  }
  return { content: JSON.stringify(value) };
}

async function callGPT(messages: any[]): Promise<any> {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, response_format: { type: 'json_object' } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || data.error || 'GPT error');
    const content = data.choices[0].message.content;
    if (!content) throw new Error('GPT response is empty');
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') throw new Error('GPT response is not valid JSON');
    return parsed;
}

async function generateAIImage(prompt: string): Promise<string> {
    const res  = await fetch('/api/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Image 오류');
    return data.url;
}

function ImageSlot({ src, loading, onGenerate, onUpload, aspect = '16/9', hint = '', size = 'md' }: any) {
  const fileRef = useRef<HTMLInputElement>(null);
  const sm = size === 'sm';
  if (src) return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <img src={src} alt="이미지" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: sm ? '8px' : '14px' }} />
      <div style={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', gap: '4px' }}>
        <button onClick={onGenerate} style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(124,58,237,0.85)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}><Wand2 size={11} /></button>
        <button onClick={() => fileRef.current?.click()} style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(30,41,59,0.75)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}><Upload size={11} /></button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader(); reader.onload = () => onUpload(reader.result as string); reader.readAsDataURL(file);
      }} />
    </div>
  );
  return (
    <div style={{ width: '100%', aspectRatio: aspect, background: loading ? 'rgba(124,58,237,0.04)' : '#f8fafc', border: `2px dashed ${loading ? '#a78bfa' : '#cbd5e1'}`, borderRadius: sm ? '8px' : '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      {loading ? <><Loader2 size={24} className="animate-spin" style={{ color: '#7c3aed' }} /></> : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onGenerate} style={{ padding: '8px 12px', borderRadius: '10px', background: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>AI 생성</button>
          <button onClick={() => fileRef.current?.click()} style={{ padding: '8px 12px', borderRadius: '10px', background: '#fff', border: '1px solid #ddd', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>업로드</button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader(); reader.onload = () => onUpload(reader.result as string); reader.readAsDataURL(file);
      }} />
    </div>
  );
}

function BlogPreview({ title, content, images, visualPrompts, onGenerateImage, onUploadImage, imgLoadingSet }: any) {
  // GPT가 [](섹션묘사) 형태로 이미지 위치를 표시하는 경우 제거, 그리고 [섹션1묘사] 형태도 [섹션1]로 정규화
  const cleaned = content
    .replace(/!?\[\]\([^)]*\)/g, '')           // [](설명) 또는 ![](설명) 패턴 제거
    .replace(/\[섹션(\d+)[^\]]*\]/g, '[섹션$1]'); // [섹션1묘사] → [섹션1] 정규화

  const parts: any[] = [];
  const regex = /\[섹션(\d+)\]/g;
  let last = 0, m;
  while ((m = regex.exec(cleaned)) !== null) {
    const txt = cleaned.slice(last, m.index);
    if (txt.trim()) parts.push({ type: 'text', text: txt.trim() });
    parts.push({ type: 'image', imgIdx: parseInt(m[1]) - 1 });
    last = m.index + m[0].length;
  }
  const tail = cleaned.slice(last);
  if (tail.trim()) parts.push({ type: 'text', text: tail.trim() });

  // 모든 파트에서 #해시태그 수집 (인라인 포함, 중복 제거)
  const allHashtags = Array.from(new Set(
    parts.filter(p => p.type === 'text')
      .flatMap(p => (p.text.match(/#[\wㄱ-ㅎㅏ-ㅣ가-힣]+/g) || []))
  ));

  return (
    <div style={{ fontFamily: '"Apple SD Gothic Neo", "Noto Sans KR", sans-serif', maxWidth: '680px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '20px', marginBottom: '24px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #111827, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '14px', letterSpacing: '0.2px', flexShrink: 0 }}>B</div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#222' }}>{title}</div>
        </div>
      </div>

      <article style={{ lineHeight: '2.0', color: '#333', fontSize: '16px', wordBreak: 'keep-all' }}>
        {parts.map((p, i) => {
          if (p.type === 'text') {
            // 본문에서 #해시태그 토큰 제거 후 빈 줄 정리
            const bodyText = p.text.replace(/#[\wㄱ-ㅎㅏ-ㅣ가-힣]+/g, '').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
            if (!bodyText) return null;
            return (
              <div key={i} style={{ marginBottom: '28px', whiteSpace: 'pre-wrap', lineHeight: '2.1' }}>{bodyText}</div>
            );
          }
          const idx = p.imgIdx;
          return (
            <div key={i} style={{ margin: '24px 0' }}>
              <div style={{ borderRadius: '10px', overflow: 'hidden', background: '#f7f7f7', aspectRatio: '16/9', width: '100%' }}>
                <ImageSlot src={images[idx]} loading={imgLoadingSet.has(idx)} onGenerate={() => onGenerateImage(idx)} onUpload={(src: string) => onUploadImage(idx, src)} aspect="16/9" />
              </div>
            </div>
          );
        })}
      </article>

      {allHashtags.length > 0 && (
        <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {allHashtags.map((tag: string, i: number) => (
              <span key={i} style={{ fontSize: '13px', color: '#111827', fontWeight: 700 }}>{tag}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '16px' }}>
        {['좋아요', '댓글 달기', '공유하기'].map(label => (
          <div key={label} style={{ fontSize: '13px', color: '#888', cursor: 'pointer' }}>{label}</div>
        ))}
      </div>
    </div>
  );
}

function InstagramPreview({ variant, onGenerateImage, onUploadImage, isLoading }: any) {
  return (
    <div style={{ maxWidth: '540px', margin: '0 auto', background: '#fff', border: '1px solid #dbdbdb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', padding: '2px', flexShrink: 0 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 900, color: '#e6683c' }}>AI</div>
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#262626' }}>ai_content_studio</div>
          <div style={{ fontSize: '11px', color: '#8e8e8e' }}>스폰서 · 마케팅</div>
          </div>
        </div>
        <div style={{ fontSize: '20px', color: '#262626', letterSpacing: '2px', cursor: 'pointer' }}>•••</div>
      </div>

      <div style={{ width: '100%', aspectRatio: '1/1', background: '#fff' }}>
        <ImageSlot src={variant.images?.[0]} loading={isLoading} onGenerate={onGenerateImage} onUpload={onUploadImage} aspect="1/1" />
      </div>

      <div style={{ padding: '10px 14px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '14px' }}>
          {[
            <path key="h" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
            <path key="c" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
            <><line key="s1" x1="22" y1="2" x2="11" y2="13" /><polygon key="s2" points="22 2 15 22 11 13 2 9 22 2" /></>,
          ].map((d, i) => (
            <svg key={i} viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#262626" strokeWidth="2" style={{ cursor: 'pointer' }}>{d}</svg>
          ))}
        </div>
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#262626" strokeWidth="2" style={{ cursor: 'pointer' }}>
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </div>

      <div style={{ padding: '0 14px 16px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#262626', marginBottom: '8px' }}>좋아요 128개</div>
        <div style={{ fontSize: '14px', color: '#262626', lineHeight: '1.65' }}>
          <span style={{ fontWeight: 700, marginRight: '4px' }}>ai_content_studio</span>
          <span style={{ whiteSpace: 'pre-wrap' }}>{variant.content}</span>
        </div>
        <div style={{ fontSize: '13px', color: '#8e8e8e', marginTop: '8px', cursor: 'pointer' }}>댓글 달기...</div>
        <div style={{ fontSize: '11px', color: '#c7c7c7', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>1시간 전</div>
      </div>
    </div>
  );
}

function ShortsStoryboard({ variant, onGenerateScene, onUploadScene, sceneLoadingSet }: any) {
  const storyboard = variant.storyboard || variant.scenes || variant.frames || [];
  const [enPrompts, setEnPrompts] = useState<{visual: string; script: string}[]>([]);
  const [translating, setTranslating] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'loading' | 'done'>('idle');

  useEffect(() => {
    if (storyboard.length === 0) return;
    setTranslating(true);
    const prompt = `다음 YouTube Shorts 씬들을 영어 영상 제작 프롬프트로 번역해줘. 반드시 아래 JSON 배열 형식으로만 반환해:\n[{"visual":"English visual description","script":"English narration/caption"}]\n\n씬 목록:\n${storyboard.map((s: any, i: number) => `씬${i+1} - 비주얼: ${s.visual} / 나레이션: ${s.script}`).join('\n')}`;
    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: [{ text: prompt }] }),
    })
      .then(r => r.json())
      .then(data => {
        const text = data.text || '';
        const match = text.match(/\[[\s\S]*\]/);
        if (match) setEnPrompts(JSON.parse(match[0]));
      })
      .catch(() => {})
      .finally(() => setTranslating(false));
  }, [storyboard.length]);

  const copyEnglishPrompt = async () => {
    setCopyState('loading');
    const lines = storyboard.map((s: any, i: number) => {
      const en = enPrompts[i];
      return `[Scene ${i+1}] ${s.timeCode}\nVisual: ${en?.visual || s.visual}\nScript: ${en?.script || s.script}`;
    }).join('\n\n');
    const full = `=== YouTube Shorts Production Prompt ===\nTitle: ${variant.content}\nDuration: ${variant.duration}\n\n${lines}`;
    await navigator.clipboard.writeText(full).catch(() => {});
    setCopyState('done');
    setTimeout(() => setCopyState('idle'), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ padding: '16px 20px', background: '#fff5f5', borderRadius: '14px', border: '1px solid #fecaca', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ background: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: 900, padding: '3px 10px', borderRadius: '20px', flexShrink: 0, marginTop: '2px' }}>
          {variant.duration || 'SHORTS'}
        </div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', lineHeight: '1.6', flex: 1 }}>{variant.content}</div>
        <button
          onClick={copyEnglishPrompt}
          disabled={copyState === 'loading'}
          style={{ flexShrink: 0, padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: copyState === 'loading' ? 'wait' : 'pointer', fontSize: '12px', fontWeight: 700, background: copyState === 'done' ? '#22c55e' : '#1e293b', color: '#fff', transition: 'background 0.3s', whiteSpace: 'nowrap' }}
        >
          {copyState === 'loading' ? '번역 중...' : copyState === 'done' ? '✅ 복사됨!' : '📋 영문 프롬프트 복사'}
        </button>
      </div>

      {storyboard.length === 0 ? (
        <div style={{ padding: '32px', background: '#f8fafc', borderRadius: '14px', border: '2px dashed #e2e8f0', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
          스토리보드 데이터가 없습니다. 다시 생성해주세요.
        </div>
      ) : (
        <>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            총 스토리보드 {storyboard.length}개          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {storyboard.map((scene: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '16px', padding: '16px', background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ aspectRatio: '9/16', borderRadius: '8px', overflow: 'hidden' }}>
                  <ImageSlot src={scene.imageUrl} loading={sceneLoadingSet.has(i)} onGenerate={() => onGenerateScene(i)} onUpload={(s: string) => onUploadScene(i, s)} aspect="9/16" size="sm" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: 900, padding: '2px 8px', borderRadius: '6px' }}>Scene {i + 1}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444' }}>{scene.timeCode}</span>
                  </div>
                  <div><span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.4px', marginRight: '6px' }}>📷 비주얼</span><span style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', fontStyle: 'italic' }}>{scene.visual}</span></div>
                  <div style={{ fontSize: '14px', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #ef4444', color: '#1e293b', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}><div style={{ fontSize: '10px', fontWeight: 800, color: '#ef4444', marginBottom: '4px', letterSpacing: '0.4px' }}>🎙️ 대사 / 자막</div>{scene.script}</div>
                  <div style={{ marginTop: '4px', padding: '10px 12px', background: '#f0f9ff', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#3b82f6', marginBottom: '5px', letterSpacing: '0.5px' }}>Prompt</div>
                    {translating ? (
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>번역 중...</div>
                    ) : enPrompts[i] ? (
                      <>
                        <div><span style={{ fontSize: '10px', fontWeight: 800, color: '#93c5fd', marginRight: '6px', letterSpacing: '0.4px' }}>📷 Visual</span><span style={{ fontSize: '12px', color: '#475569', lineHeight: '1.6', fontStyle: 'italic' }}>{enPrompts[i].visual}</span></div>
                        <div style={{ marginTop: '6px' }}><div style={{ fontSize: '10px', fontWeight: 800, color: '#93c5fd', marginBottom: '3px', letterSpacing: '0.4px' }}>🎙️ Script</div><div style={{ fontSize: '13px', color: '#1e40af', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{enPrompts[i].script}</div></div>
                      </>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>영문 프롬프트 없음</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function HomePage() {
  const [view, setView]           = useState<View>('input');
  const [url, setUrl]             = useState('');
  const [product, setProduct]     = useState({ name: '', price: '', feature: '', detail: '' });
  const [images, setImages]       = useState<UploadedImage[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState('instagram');
  const [loading, setLoading]     = useState(false);
  const [results, setResults]     = useState<any>(null);
  const [activeTab, setActiveTab] = useState('');
  const [activeVariant, setActiveVariant] = useState<any>({});
  const [logs, setLogs]           = useState<string[]>([]);
  const [imgLoadingMap, setImgLoadingMap] = useState<any>({});
  const [copied, setCopied]       = useState<string|null>(null);
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);

  // Phase 4 states
  const [planningDoc, setPlanningDoc] = useState<PlanningDoc | null>(null);
  const [planningLoading, setPlanningLoading] = useState(false);
  const [planningEditMode, setPlanningEditMode] = useState(false);
  const [canOpenResearch, setCanOpenResearch] = useState(false);
  const [canOpenPlanning, setCanOpenPlanning] = useState(false);
  const [canOpenResults, setCanOpenResults] = useState(false);

  // Trend issues state
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [scrapedData, setScrapedData] = useState('');
  const [trendData, setTrendData] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const togglePlatform = (key: string) => setSelectedPlatform(key);
  const addLog = (msg: string) => setLogs(prev => [...prev, msg].slice(-8));
  const fileToBase64 = (file: File): Promise<string> => new Promise((res) => {
    const r = new FileReader(); r.readAsDataURL(file); r.onload = () => res((r.result as string).split(',')[1]);
  });
  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: any[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      next.push({ preview: URL.createObjectURL(file), base64: await fileToBase64(file), mimeType: file.type });
    }
    if (editingImageIndex !== null && next[0]) {
      setImages(prev => {
        const updated = [...prev];
        updated[editingImageIndex] = next[0];
        return updated.slice(0, 4);
      });
      setEditingImageIndex(null);
      return;
    }
    setImages(prev => [...prev, ...next].slice(0, 4));
  };

  const analyzeTrend = async () => {
    const hasData = url || product.name || product.feature;
    if (!hasData) return;
    setLoading(true); setLogs([]);
    try {
      let sd = '';
      if (url && url.startsWith('http')) {
        addLog('🔗 [분석중] URL 페이지 정보 읽는 중..');
        try {
          const res = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
          const data = await res.json();
          sd = `[웹페이지 실제 내용]\n제목: ${data.title}\n내용: ${data.content}`;
          setScrapedData(sd);
        } catch (e) { console.error('Scraping failed', e); }
      }

      // 트렌드 검색어: 상품 이름과 주요 기능/설명을 조합하여 '세상 속의 이슈'를 찾기 좋게 만듬
      const trendKeyword = `${product.name} ${product.feature || ''}`.trim().slice(0, 70);
      if (trendKeyword) {
        addLog('📊 [트렌드분석] 관련 이슈 및 실시간 트렌드 검색 중..');
        try {
          let trendRes = await fetch('/api/trend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: trendKeyword }),
          });
          if (trendRes.status === 404) {
            await new Promise(r => setTimeout(r, 1500));
            trendRes = await fetch('/api/trend', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ keyword: trendKeyword }),
            });
          }
          const data = await trendRes.json();
          if (trendRes.ok && data.trending_issues) {
            setTrendData(data);
            localStorage.setItem('office_trend_raw', JSON.stringify(data));
            addLog(`✅[트렌드분석] 실시간 이슈 ${data.trending_issues.length}개 수집!`);
            setCanOpenResearch(true);
            setView('research');
          }
        } catch (e) {
          console.error('트렌드 검색 실패', e);
          addLog('⚠️ 트렌드 검색 실패.');
        }
      }
    } catch (err: any) { 
      console.error(err);
      addLog(`❌ 오류: ${err.message}`); 
    } finally { setLoading(false); }
  };

  const generatePlanningDoc = async (issue: any) => {
    setSelectedIssue(issue);
    setPlanningLoading(true); setView('planning'); setLogs([]);
    try {
      addLog('🤖 [기획중] 트렌드 기반 기획서 초안 생성 중...');
      const ctxBody = `[사용자 입력 상품 정보]
상품명: ${product.name}
가격: ${product.price}
기능: ${product.feature}
상세: ${product.detail}
참고 URL: ${url}
${scrapedData}

[선택한 트렌드 이슈]
${issue.title}: ${issue.summary}`;

      const planningPrompt = `당신은 대한민국 최고의 SNS 콘텐츠 기획 전문가입니다. 
사용자가 선택한 기본 플랫폼 [${selectedPlatform}]을 최우선 타겟으로 하여, 상품 정보와 실시간 트렌드 이슈를 '파괴적으로 혼합'한 독창적인 SNS 콘텐츠 기획서를 JSON으로 작성하세요.

[핵심 미션]
1. 단순히 상품 설명을 나열하지 마세요. 
2. 선택된 [트렌드 이슈]가 왜 지금 뜨거운지 분석하고, 이를 상품의 소구점과 연결하여 대중이 열광할 수 있는 '뉴 앵글'을 제시하세요.
3. 기획서는 즉시 제작이 가능한 수준으로 구체적이어야 합니다.

반환 형식:
{
  "concept": "트렌드와 상품이 결합된 핵심 컨셉 한 줄",
  "trendReason": "이 트렌드(세상의 이슈)와 상품을 연결한 전략적 이유",
  "targetPersona": "이 트렌드에 반응할 핵심 타겟 페르소나",
  "targetReason": "이 타겟이 해당 트렌드와 상품의 조합에 반응할 심리학적 이유",
  "tone": "브랜드 아이덴티티와 트렌드 무드에 맞춘 말투",
  "visualMood": "시각적 연출 가이드",
  "coreMessage": "가장 강력한 한 마디 메시지",
  "cta": "전환을 유도하는 구체적인 행동 유도",
  "platformStrategy": {
    "instagram": "인스타그램 바이럴 전략",
    "shorts": "유튜브 쇼츠 숏폼 전략",
    "blog": "네이버 블로그 정보/리뷰 전략"
  }
}`;

      const messages = [
        { role: 'system', content: planningPrompt },
        { role: 'user', content: ctxBody }
      ];

      const res = await callGPT(messages);
      setPlanningDoc(res);
      setCanOpenPlanning(true);
      addLog('✅ 기획서 생성 완료!');
    } catch (err: any) {
      console.error(err);
      addLog(`❌ 기획서 생성 오류: ${err.message}`);
    } finally { setPlanningLoading(false); }
  };

  const generateContent = async () => {
    if (!planningDoc || !selectedPlatform) return;
    setLoading(true); setResults(null); setLogs([]);
    try {
      addLog('🤖 [생성중] 기획서가 반영된 콘텐츠 생성 중(GPT)...');
      
      const ctxBody = `[상품 정보]
상품명: ${product.name}
기능: ${product.feature}

[확정된 기획서]
컨셉: ${planningDoc.concept}
타겟: ${planningDoc.targetPersona}
톤앤매너: ${planningDoc.tone}
메시지: ${planningDoc.coreMessage}
플랫폼 전략: ${planningDoc.platformStrategy[selectedPlatform] || ''}`;

      const platformGuides = (p: string) => {
        if (p === 'instagram') return `"instagram": [{"content": "1안 내용(600자내외, 감성문구+CTA+해시태그)", "visual": "이미지묘사(한글 1~2문장)"}, {"content": "2안 내용", "visual": "이미지묘사"}, {"content": "3안 내용", "visual": "이미지묘사"}]`;
        if (p === 'shorts') return `반드시 JSON 키 이름은 정확히 "shorts" 사용:\n"shorts": [{"content": "영상제목1", "duration": "60초", "storyboard": [{"timeCode": "0:00~0:05", "visual": "장면묘사", "script": "나레이션/자막"}, {"timeCode": "0:05~0:15", "visual": "장면묘사", "script": "나레이션"}, {"timeCode": "0:15~0:30", "visual": "장면묘사", "script": "나레이션"}, {"timeCode": "0:30~0:45", "visual": "장면묘사", "script": "나레이션"}, {"timeCode": "0:45~1:00", "visual": "장면묘사", "script": "나레이션/CTA"}]}, {"content": "영상제목2", "duration": "60초", "storyboard": [{"timeCode": "0:00~0:05", "visual": "장면묘사", "script": "나레이션"}, {"timeCode": "0:05~0:20", "visual": "장면묘사", "script": "나레이션"}, {"timeCode": "0:20~0:40", "visual": "장면묘사", "script": "나레이션"}, {"timeCode": "0:40~1:00", "visual": "장면묘사", "script": "나레이션/CTA"}]}, {"content": "영상제목3", "duration": "60초", "storyboard": [{"timeCode": "0:00~0:05", "visual": "장면묘사", "script": "나레이션"}, {"timeCode": "0:05~0:20", "visual": "장면묘사", "script": "나레이션"}, {"timeCode": "0:20~0:40", "visual": "장면묘사", "script": "나레이션"}, {"timeCode": "0:40~1:00", "visual": "장면묘사", "script": "나레이션/CTA"}]}]`;
        if (p === 'blog') return `"blog": [{"content": "1안 블로그글(2200자내외). [섹션1]~[섹션5] 소제목포함. 각 소제목 아래 5~7문장. 소제목마다 해시태그 10개이상.", "visualPrompts": ["섹션1묘사","섹션2","섹션3","섹션4","섹션5"]}, {"content": "2안 블로그글", "visualPrompts": ["섹션1묘사","섹션2","섹션3","섹션4","섹션5"]}, {"content": "3안 블로그글", "visualPrompts": ["섹션1묘사","섹션2","섹션3","섹션4","섹션5"]}]`;
        return `"${p}": [{"content": "1안 내용"}, {"content": "2안 내용"}, {"content": "3안 내용"}]`;
      };

      const officePrompt = `당신은 최고의 마케팅 전문가이자 SNS 콘텐츠 1등 에이전트입니다.
제시된 [확정된 기획서]의 방향성을 100% 반영하여 SNS 콘텐츠 1안/2안/3안을 생성하세요.

${ctxBody}

[콘텐츠 생성 규칙]
1. 각 안은 기획서의 컨셉을 바탕으로 하되, 서로 다른 접근 방식(공감, 정면돌파, 일상형 등)을 사용하세요.
2. 각 안은 반드시 겹치지 않아야 합니다.
3. 플랫폼 형식:
${platformGuides(selectedPlatform)}

[research 데이터]
"research": {
  "trendAnalysis": "수집한 트렌드가 이 콘텐츠에 어떻게 녹아들었는지 설명 (3문장)",
  "targetAudience": "기획서에서 정의한 타겟층의 반응 예상"
}

반드시 JSON으로만 답변하세요.`;

      const officeMessages: any[] = [
        { role: 'system', content: 'You are an elite marketing analyst. Always respond in valid JSON format.' },
        { role: 'user', content: [{ type: 'text', text: officePrompt }, ...images.map(img => ({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } }))] }
      ];

      let geminiResult: any;
      try {
        geminiResult = await callGPT(officeMessages);
      } catch (error: any) {
        if (images.length > 0) {
          addLog('⚠️ 이미지 포함 요청 실패. 이미지 없이 재시도 중..');
          const officeMessagesWithoutImages = [
            { role: 'system', content: 'You are an elite marketing analyst. Always respond in valid JSON format.' },
            { role: 'user', content: officePrompt }
          ];
          geminiResult = await callGPT(officeMessagesWithoutImages);
        } else {
          throw error;
        }
      }

      if (!geminiResult || typeof geminiResult !== 'object') throw new Error('GPT returned invalid response.');

      const normalized: any = {};
      Object.entries(geminiResult).forEach(([k, v]) => {
        const raw = k.toLowerCase().trim();
        if (raw === 'research') { normalized.research = v; localStorage.setItem('office_research', JSON.stringify(v)); }
        else normalized[raw] = (Array.isArray(v) ? v : [v]).map(normalizeVariant);
      });

      if (!normalized[selectedPlatform]) {
        const fallbackKey = Object.keys(normalized).find(k => k !== 'research' && Array.isArray(normalized[k]));
        if (fallbackKey) normalized[selectedPlatform] = normalized[fallbackKey];
      }

      setResults(normalized);
      setActiveTab(selectedPlatform);
      setCanOpenResults(true);
      setView('results');
      addLog('✅ 콘텐츠 기획 완료!');
    } catch (err: any) { 
      console.error(err);
      addLog(`❌ 오류: ${err.message}`); 
    } finally { setLoading(false); }
  };

  const generateSingleImage = async (p:string, v:number, t:string, i:number) => {
    const key = `${p}-${v}-${t}-${i}`;
    setImgLoadingMap((prev:any) => ({...prev, [key]:true}));
    try {
      const variant = results[p][v];
      const prompt = t==='instagram' ? variant.visual : (t==='blog' ? variant.visualPrompts[i] : variant.storyboard[i].visual);
      const url = await generateAIImage(prompt);
      const updated = {...results};
      if (t==='instagram') updated[p][v].images = [url];
      else if (t==='blog') { updated[p][v].images = updated[p][v].images || []; updated[p][v].images[i] = url; }
      else if (t==='scene') updated[p][v].storyboard[i].imageUrl = url;
      setResults({...updated});
    } catch (e:any) { addLog(`❌ 이미지 생성 실패: ${e.message}`); } finally { setImgLoadingMap((prev:any) => ({...prev, [key]:false})); }
  };

  const renderInput = () => (
    <div className="flex-1 overflow-y-auto p-6 bg-[#f8fafc]">
      <div className="max-w-5xl mx-auto py-8">
        <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-2xl shadow-gray-200/50 border border-gray-100 animate-in fade-in zoom-in-95 duration-500">
          <div className="space-y-8">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-black text-gray-800 uppercase tracking-tighter"><Image size={18} className="text-indigo-500" /> 상품 참고 이미지 (최대 4개)</label>
              <div className="grid grid-cols-4 gap-4">
                {images.map((img, i) => (
                  <div key={i} className="aspect-square rounded-2xl overflow-hidden border-2 border-indigo-100 relative group animate-in slide-in-from-bottom-2">
                    <img src={img.preview} alt="p" className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingImageIndex(i);
                          fileInputRef.current?.click();
                        }}
                        className="p-1.5 bg-white/95 rounded-lg text-gray-700 shadow-sm"
                        aria-label="이미지 교체"
                      >
                        <PencilLine size={14} />
                      </button>
                      <button
                        onClick={() => setImages(prev => prev.filter((_, idx)=>idx!==i))}
                        className="p-1.5 bg-white/95 rounded-lg text-red-500 shadow-sm"
                        aria-label="이미지 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {images.length < 4 && (
                  <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all flex flex-col items-center justify-center gap-2 text-gray-400">
                    <Upload size={24} />
                    <span className="text-xs font-bold">이미지 추가</span>
                  </button>
                )}
                <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={(e)=>handleFiles(e.target.files)} className="hidden" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-black text-gray-800 uppercase tracking-tighter"><LinkIcon size={18} className="text-indigo-500" /> 참고 URL</label>
                <input type="text" placeholder="https://..." className="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-medium outline-none" value={url} onChange={e => setUrl(e.target.value)} />
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-black text-gray-800 uppercase tracking-tighter"><Search size={18} className="text-indigo-500" /> 상품명</label>
                <input type="text" placeholder="제품명을 입력해주세요.." className="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-medium outline-none" value={product.name} onChange={e => setProduct({...product, name: e.target.value})} />
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-black text-gray-800 uppercase tracking-tighter"><AlignLeft size={18} className="text-indigo-500" /> 주요 기능 및 특징</label>
              <textarea rows={6} placeholder="제품이 해결하는 문제, 핵심 기능, 타겟 고객층 등 입력하세요" className="w-full px-6 py-4 rounded-3xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-medium outline-none" style={{ resize: 'both', minHeight: '180px' }} value={product.feature} onChange={e => setProduct({...product, feature: e.target.value})} />
            </div>


            <button disabled={loading} onClick={analyzeTrend} className="w-full h-14 rounded-3xl bg-gray-900 text-white text-base md:text-lg font-bold shadow-xl shadow-gray-200 hover:bg-gray-800 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3">
              {loading ? <><Loader2 className="animate-spin" size={20} /> 트렌드를 분석하는 중...</> : <><Sparkles size={20} /> 트렌드 분석 및 기획 시작</>}
            </button>
            
            {logs.length > 0 && (
              <div className="mt-8 p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-2 animate-in slide-in-from-top-2">
                {logs.map((l, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm font-bold text-gray-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    {l}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderResults = () => {
    const vIdx = activeVariant[activeTab] || 0;
    const variants = results[activeTab] || [];
    const variant = variants[vIdx];
    if (!variant) return null;

    const blogs = new Set(Object.keys(imgLoadingMap).filter(k=>k.startsWith(`${activeTab}-${vIdx}-blog-`)&&imgLoadingMap[k]).map(k=>parseInt(k.split('-').pop() || '0')));
    const scenes = new Set(Object.keys(imgLoadingMap).filter(k=>k.startsWith(`${activeTab}-${vIdx}-scene-`)&&imgLoadingMap[k]).map(k=>parseInt(k.split('-').pop() || '0')));
    const instaL = !!imgLoadingMap[`${activeTab}-${vIdx}-instagram-0`];

    const trendRaw = JSON.parse(localStorage.getItem('office_trend_raw') || 'null');
    const issueUrlSet = new Set((trendRaw?.trending_issues || []).filter((t: any) => t.url).map((t: any) => t.url));
    const extraCitations = (trendRaw?.citations || []).filter((c: any) => c.url && !issueUrlSet.has(c.url));
    const allRefs = [
      ...(trendRaw?.trending_issues || []).map((t: any) => ({ url: t.url || null, title: t.title, source: t.source || '' })),
      ...extraCitations.map((c: any) => ({ url: c.url, title: c.title || c.url, source: '' })),
    ];

    return (
      <div className="flex-1 overflow-y-auto p-8 bg-white">
        <div className="max-w-5xl mx-auto py-8">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setView('planning')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-all border border-gray-200"
              >
                <AlignLeft size={16} /> 기획서로 돌아가기
              </button>
              <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight capitalize">{activeTab} 기획 결과</h2>
            </div>
            <div className="flex p-1.5 bg-gray-100 rounded-2xl gap-1">
              {variants.map((_:any, i:number) => (
                <button key={i} onClick={()=>setActiveVariant({...activeVariant,[activeTab]:i})} className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${vIdx===i?'bg-white text-indigo-600 shadow-sm':'text-gray-400 hover:text-gray-600'}`}>
                  {i+1}안
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-gray-100 bg-white p-8 md:p-10 min-h-[560px] shadow-sm animate-in fade-in duration-500">
            {activeTab==='blog' && <BlogPreview title={`${(product.name || '블로그 기획')} · ${((variant.content || '').split(/\n|[.!?]/)[0] || 'AI 기획').slice(0, 28)}`} content={variant.content} images={variant.images||[]} visualPrompts={variant.visualPrompts||[]} onGenerateImage={(i:any)=>generateSingleImage('blog',vIdx,'blog',i)} onUploadImage={(i:any,s:any)=>{const upd={...results}; upd.blog[vIdx].images[i]=s; setResults({...upd});}} imgLoadingSet={blogs} />}
            {activeTab==='instagram' && <InstagramPreview variant={variant} onGenerateImage={()=>generateSingleImage('instagram',vIdx,'instagram',0)} onUploadImage={(s:any)=>{const upd={...results}; upd.instagram[vIdx].images=[s]; setResults({...upd});}} isLoading={instaL} />}
            {activeTab==='shorts' && <ShortsStoryboard variant={variant} onGenerateScene={(i:any)=>generateSingleImage('shorts',vIdx,'scene',i)} onUploadScene={(i:any,s:any)=>{const upd={...results}; upd.shorts[vIdx].storyboard[i].imageUrl=s; setResults({...upd});}} sceneLoadingSet={scenes} />}
            {!['blog', 'instagram', 'shorts'].includes(activeTab) && <div className="p-8 bg-gray-50 rounded-3xl"><pre className="whitespace-pre-wrap text-lg text-gray-600 leading-relaxed font-medium">{variant.content}</pre></div>}
          </div>

        </div>
      </div>
    );
  };

  const renderResearch = () => {
    const research = results?.research || JSON.parse(localStorage.getItem('office_research') || 'null');
    const trendRaw = JSON.parse(localStorage.getItem('office_trend_raw') || 'null');
    if (!research && !trendRaw) return <div className="flex-1 flex items-center justify-center text-gray-400 font-bold bg-[#f8fafc]">분석 결과가 없습니다.</div>;
    return (
      <div className="flex-1 overflow-y-auto p-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <header className="mb-12">
            <h2 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                <BarChart3 size={24} />
              </div>
              기획의 종합 결과
            </h2>
            <p className="text-gray-400 mt-2 font-bold ml-16">실시간 트렌드 분석 + AI 분석 기반 마케팅 리포트</p>
          </header>

          {trendRaw?.trending_issues?.length > 0 && (
            <div className="mb-8 bg-orange-50/40 border border-orange-100 rounded-3xl p-8">
              <h3 className="text-orange-600 font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                🔴 실시간 트렌딩 이슈
              </h3>
              <div className="space-y-4">
                {trendRaw.trending_issues.map((issue: any, i: number) => (
                  <div key={i} className="bg-white rounded-2xl p-5 border border-orange-100/60 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-black text-gray-900 text-base mb-1">{issue.title}</div>
                      <div className="text-gray-500 text-sm leading-relaxed">{issue.summary}</div>
                      {issue.source && (
                        issue.url ? (
                          <a href={issue.url} target="_blank" rel="noopener noreferrer" className="text-orange-400 text-xs font-bold mt-2 flex items-center gap-1 hover:text-orange-600 hover:underline">
                            🔗 출처: {issue.source}
                          </a>
                        ) : (
                          <div className="text-orange-400 text-xs font-bold mt-2">출처: {issue.source}</div>
                        )
                      )}
                    </div>
                    <button 
                      onClick={() => generatePlanningDoc(issue)}
                      disabled={planningLoading}
                      className="shrink-0 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-black hover:bg-gray-800 transition-all flex items-center gap-2 shadow-lg shadow-gray-200"
                    >
                      <PencilLine size={16} /> 이 이슈로 기획서 생성
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-emerald-50/30 border border-emerald-100/50 rounded-3xl p-8">
              <h3 className="text-emerald-600 font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                트렌드 분석 및 혼합 전략
              </h3>
              <p className="text-gray-700 leading-relaxed text-sm md:text-[15px] whitespace-pre-wrap">{research?.trendAnalysis || (trendRaw?.keywords?.[0]?.reason)}</p>
            </div>

            <div className="bg-indigo-50/30 border border-indigo-100/50 rounded-3xl p-8">
              <h3 className="text-indigo-600 font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                예상 타겟 반응
              </h3>
              <p className="text-gray-700 leading-relaxed text-sm md:text-[15px] whitespace-pre-wrap">{research?.targetAudience || '수집된 트렌드 이슈에 반응할 최적의 타겟군을 분석 중입니다.'}</p>
            </div>
          </div>


          <div className="mt-8 space-y-8">
            {trendRaw?.hashtags?.length > 0 && (
              <div className="bg-orange-50/30 border border-orange-100/50 rounded-3xl p-8">
                <h3 className="text-orange-500 font-black text-xs uppercase tracking-widest mb-6">추천 해시태그</h3>
                <div className="flex flex-wrap gap-2">
                  {trendRaw.hashtags.map((tag: string, i: number) => (
                    <span key={i} className="bg-white border-2 border-orange-100 px-4 py-2 rounded-2xl text-orange-600 font-black text-sm shadow-sm">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {(() => {
              const issueUrlSet = new Set((trendRaw?.trending_issues || []).filter((t: any) => t.url).map((t: any) => t.url));
              const extraCitations = (trendRaw?.citations || []).filter((c: any) => c.url && !issueUrlSet.has(c.url));
              const allRefs = [
                ...(trendRaw?.trending_issues || []).map((t: any) => ({ url: t.url || null, title: t.title, source: t.source || '' })),
                ...extraCitations.map((c: any) => ({ url: c.url, title: c.title || c.url, source: '' })),
              ];
              if (allRefs.length === 0) return null;
              return (
                <div className="bg-blue-50/30 border border-blue-100/50 rounded-3xl p-8">
                  <h3 className="text-blue-600 font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    분석에 사용한 참고 자료
                  </h3>
                  <div className="space-y-3">
                    {allRefs.map((item: any, i: number) => item.url ? (
                      <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                        className="bg-white rounded-2xl p-4 border border-blue-100/60 flex items-center gap-4 hover:border-blue-300 hover:shadow-sm transition-all group block">
                        <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0 text-blue-600 font-black text-sm group-hover:bg-blue-500 group-hover:text-white transition-colors">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-900 text-sm mb-0.5 truncate group-hover:text-blue-600 transition-colors">{item.title}</div>
                          <div className="text-blue-400 text-xs truncate">{item.url}</div>
                        </div>
                        <span className="text-blue-400 text-xs font-bold flex-shrink-0 group-hover:text-blue-600">열기</span>
                      </a>
                    ) : (
                      <div key={i} className="bg-white rounded-2xl p-4 border border-blue-100/60 flex items-center gap-4">
                        <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 text-gray-400 font-black text-sm">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-900 text-sm mb-0.5 truncate">{item.title}</div>
                          {item.source && <div className="text-gray-400 text-xs truncate">{item.source}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  const renderPlanning = () => {
    if (planningLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#f8fafc] gap-6">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center animate-bounce">
            <PencilLine size={32} className="text-gray-900" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={24} className="animate-spin text-gray-400" />
            <p className="text-gray-900 font-black text-xl tracking-tight">기획서를 작성하고 있습니다...</p>
            <p className="text-gray-400 text-sm font-medium">트렌드와 상품을 분석해 최적의 전략을 도출 중입니다</p>
          </div>
        </div>
      );
    }

    if (!planningDoc) return null;

    return (
      <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto">
          <header className="mb-10 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="px-3 py-1 bg-gray-900 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">Step 3</span>
                <span className="text-gray-400 text-sm font-bold">콘텐츠 설계 및 기획 단계</span>
              </div>
              <h2 className="text-4xl font-black text-gray-900 tracking-tight">AI 기획서 초안</h2>
              <p className="text-gray-400 mt-2 font-medium">생성된 기획서 내용을 확인하고 필요에 따라 수정하세요.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setPlanningEditMode(!planningEditMode)}
                className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${planningEditMode ? 'bg-emerald-500 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
              >
                {planningEditMode ? <><Check size={18} /> 수정 완료</> : <><PencilLine size={18} /> 기획서 수정하기</>}
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8 items-start">
            <div className="space-y-6">
              {[
                { key: 'concept', label: '핵심 컨셉', icon: <Sparkles size={18} /> },
                { key: 'targetPersona', label: '타켓 페르소나', icon: <Search size={18} /> },
                { key: 'tone', label: '톤앤매너', icon: <AlignLeft size={18} /> },
                { key: 'coreMessage', label: '핵심 메시지', icon: <MessageCircleMore size={18} /> },
                { key: 'platformStrategy', label: '플랫폼별 전략', icon: <Layout size={18} /> },
                { key: 'cta', label: 'CTA (Call to Action)', icon: <LinkIcon size={18} /> }
              ].map((section) => (
                <div key={section.key} className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-900">
                      {section.icon}
                    </div>
                    <label className="text-sm font-black text-gray-900 uppercase tracking-wider">{section.label}</label>
                  </div>
                  {section.key === 'platformStrategy' ? (
                    <div className="space-y-4">
                      {SNS_PLATFORMS.map(p => (
                        <div key={p.key} className="flex gap-4 items-start">
                          <div className="w-24 shrink-0 pt-3 text-xs font-black text-gray-400 uppercase tracking-tighter">{p.label}</div>
                          {planningEditMode ? (
                            <textarea 
                              className="flex-1 p-4 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-[14px] leading-relaxed font-medium min-h-[80px]"
                              value={planningDoc.platformStrategy[p.key] || ''}
                              onChange={(e) => setPlanningDoc({ 
                                ...planningDoc, 
                                platformStrategy: { ...planningDoc.platformStrategy, [p.key]: e.target.value } 
                              })}
                            />
                          ) : (
                            <p className="flex-1 text-gray-700 leading-relaxed text-[14px] font-medium whitespace-pre-wrap py-2">{planningDoc.platformStrategy[p.key] || '전략 없음'}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : planningEditMode ? (
                    <textarea 
                      className="w-full p-4 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-[15px] leading-relaxed font-medium min-h-[100px]"
                      value={(planningDoc as any)[section.key]}
                      onChange={(e) => setPlanningDoc({ ...planningDoc, [section.key]: e.target.value })}
                    />
                  ) : (
                    <p className="text-gray-700 leading-relaxed text-[15px] font-medium whitespace-pre-wrap">{(planningDoc as any)[section.key]}</p>
                  )}
                </div>
              ))}
            </div>

            <aside className="space-y-6 sticky top-0">
              <div className="bg-gray-900 rounded-[32px] p-8 text-white shadow-xl shadow-gray-200">
                <h3 className="text-xs font-black uppercase tracking-widest text-white/50 mb-6">콘텐츠 생성 설정</h3>
                
                <div className="space-y-6">
                  <div>
                    <p className="text-sm font-bold mb-4">발행 채널 확인</p>
                    <div className="flex flex-col gap-2">
                      {SNS_PLATFORMS.map((p) => {
                        const selected = selectedPlatform === p.key;
                        const Icon = PLATFORM_ICONS[p.key];
                        return (
                          <button
                            key={p.key}
                            onClick={() => setSelectedPlatform(p.key)}
                            className={`p-3 rounded-xl border transition-all flex items-center gap-2 ${selected ? 'bg-white text-gray-900 border-white' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
                          >
                            <Icon size={14} />
                            <span className="text-[11px] font-black">{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/10">
                    <button 
                      disabled={loading}
                      onClick={generateContent}
                      className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                    >
                      {loading ? <><Loader2 className="animate-spin" size={18} /> 생성 중...</> : <><Sparkles size={18} /> 최종 콘텐츠 생성</>}
                    </button>
                    <button 
                      onClick={() => generatePlanningDoc(selectedIssue)}
                      className="w-full mt-3 py-4 bg-white/10 hover:bg-white/20 text-white/70 rounded-2xl font-bold text-sm transition-all"
                    >
                      기획안 재생성
                    </button>
                  </div>
                </div>
              </div>

              {selectedIssue && (
                <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm">
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">선택한 트렌드 배경</h3>
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-sm font-black text-gray-900 mb-2">{selectedIssue.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed font-medium">{selectedIssue.summary}</p>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-body flex h-screen w-screen bg-white overflow-hidden text-gray-900">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        view={view} 
        setView={setView} 
        canOpenResearch={canOpenResearch}
        canOpenPlanning={canOpenPlanning}
        canOpenResults={canOpenResults}
        visibleTabs={[selectedPlatform]} 
      />
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {view === 'input' && renderInput()}
        {view === 'results' && renderResults()}
        {view === 'research' && renderResearch()}
        {view === 'planning' && renderPlanning()}
      </main>
    </div>
  );
};
