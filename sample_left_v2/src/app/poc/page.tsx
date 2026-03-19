"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { Loader2, Copy, Check, Sparkles, Image, Wand2, Upload, Search, Link as LinkIcon, DollarSign, AlignLeft, Info, FileText } from 'lucide-react';
import './poc.css';

const SNS_PLATFORMS = [
  { key: 'instagram', label: 'Instagram',     icon: 'insta',   color: '#ec4899', bg: 'rgba(236,72,153,0.12)' },
  { key: 'threads',   label: 'Threads',        icon: 'threads', color: '#374151', bg: 'rgba(55,65,81,0.08)'   },
  { key: 'shorts',    label: 'YouTube Shorts', icon: 'shorts',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  { key: 'blog',      label: '블로그',           icon: 'blog',    color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  { key: 'twitter',   label: 'X (Twitter)',    icon: 'twitter', color: '#1d9bf0', bg: 'rgba(29,155,240,0.12)' },
  { key: 'tiktok',    label: 'TikTok',         icon: 'tiktok',  color: '#00bcd4', bg: 'rgba(0,188,212,0.12)'  },
];

type View = 'input' | 'results' | 'research';

interface StoryboardFrame { timeCode: string; visual: string; script: string; imageUrl?: string; }
interface ContentVariant  { content: string; images?: string[]; storyboard?: StoryboardFrame[]; visualPrompts?: string[]; visual?: string; duration?: string; }
interface ContentResults  { [key: string]: ContentVariant[]; }
interface UploadedImage   { preview: string; base64: string; mimeType: string; }

function normalizeVariant(value: unknown): ContentVariant {
  if (typeof value === 'string') return { content: value };
  const r = value as any;
  if (r && typeof r === 'object' && !Array.isArray(r)) {
    // 필드 추출 로직 강화
    const rawContent = r.content || r.caption || r.body || r.script || r.text || '';
    const content = typeof rawContent === 'object' ? (rawContent.text || JSON.stringify(rawContent)) : String(rawContent);

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
    if (!res.ok) throw new Error(data.error || 'GPT 오류');
    return JSON.parse(data.choices[0].message.content);
}

async function generateAIImage(prompt: string): Promise<string> {
    const res  = await fetch('/api/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Image 오류');
    return data.url;
}

/* ── 이미지 슬롯 ── */
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

function BlogPreview({ content, images, visualPrompts, onGenerateImage, onUploadImage, imgLoadingSet }: any) {
  const parts: any[] = [];
  const regex = /\[사진(\d+)\]/g;
  let last = 0, m;
  while ((m = regex.exec(content)) !== null) {
    const txt = content.slice(last, m.index);
    if (txt.trim()) parts.push({ type: 'text', text: txt.trim() });
    parts.push({ type: 'image', imgIdx: parseInt(m[1]) - 1 });
    last = m.index + m[0].length;
  }
  const tail = content.slice(last);
  if (tail.trim()) parts.push({ type: 'text', text: tail.trim() });

  return (
    <div style={{ fontFamily: '"Apple SD Gothic Neo", "Noto Sans KR", sans-serif', maxWidth: '680px', margin: '0 auto' }}>
      {/* 네이버 블로그 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '20px', marginBottom: '24px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#03c75a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '17px', flexShrink: 0 }}>N</div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#222' }}>AI 콘텐츠 블로그</div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>방금 전 · 이웃공개</div>
        </div>
      </div>

      <article style={{ lineHeight: '2.0', color: '#333', fontSize: '16px', wordBreak: 'keep-all' }}>
        {parts.map((p, i) => {
          if (p.type === 'text') {
            // 해시태그 줄은 본문에서 제거 (하단 TAG 영역으로 이동)
            const bodyText = p.text.split('\n').filter((l: string) => !l.trim().startsWith('#')).join('\n').trim();
            if (!bodyText) return null;
            return (
              <div key={i} style={{ marginBottom: '28px', whiteSpace: 'pre-wrap', lineHeight: '2.1' }}>{bodyText}</div>
            );
          }
          const idx = p.imgIdx;
          return (
            <div key={i} style={{ margin: '36px 0' }}>
              <div style={{ borderRadius: '6px', overflow: 'hidden', background: '#f7f7f7' }}>
                <ImageSlot src={images[idx]} loading={imgLoadingSet.has(idx)} onGenerate={() => onGenerateImage(idx)} onUpload={(src: string) => onUploadImage(idx, src)} aspect="4/3" />
              </div>
              {visualPrompts?.[idx] && (
                <div style={{ textAlign: 'center', fontSize: '13px', color: '#aaa', marginTop: '8px' }}>사진 {idx + 1}</div>
              )}
            </div>
          );
        })}
      </article>

      {/* 해시태그 분리 영역 */}
      {(() => {
        const lastPart = parts[parts.length - 1];
        const hashtagLine = lastPart?.type === 'text'
          ? lastPart.text.split('\n').filter((l: string) => l.trim().startsWith('#')).join(' ')
          : '';
        if (!hashtagLine) return null;
        return (
          <div style={{ marginTop: '32px', padding: '20px 24px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e8f0fe' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#03c75a', marginBottom: '10px', letterSpacing: '0.5px' }}>TAG</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {hashtagLine.split(/\s+/).filter((t: string) => t.startsWith('#')).map((tag: string, i: number) => (
                <span key={i} style={{ fontSize: '13px', color: '#1a73e8', cursor: 'pointer', background: '#e8f0fe', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>{tag}</span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 네이버 블로그 하단 */}
      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '16px' }}>
        {['♡ 공감', '💬 댓글', '🔗 공유'].map(label => (
          <div key={label} style={{ fontSize: '13px', color: '#888', cursor: 'pointer' }}>{label}</div>
        ))}
      </div>
    </div>
  );
}

function InstagramPreview({ variant, onGenerateImage, onUploadImage, isLoading }: any) {
  return (
    <div style={{ maxWidth: '470px', margin: '0 auto', background: '#fff', border: '1px solid #dbdbdb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* 헤더 */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', padding: '2px', flexShrink: 0 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 900, color: '#e6683c' }}>AI</div>
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#262626' }}>ai_content_studio</div>
            <div style={{ fontSize: '11px', color: '#8e8e8e' }}>오리지널 오디오 ♪</div>
          </div>
        </div>
        <div style={{ fontSize: '20px', color: '#262626', letterSpacing: '2px', cursor: 'pointer' }}>···</div>
      </div>

      {/* 이미지 */}
      <div style={{ width: '100%', aspectRatio: '1/1', background: '#111' }}>
        <ImageSlot src={variant.images?.[0]} loading={isLoading} onGenerate={onGenerateImage} onUpload={onUploadImage} aspect="1/1" />
      </div>

      {/* 액션 아이콘 */}
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

      {/* 좋아요 + 캡션 */}
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 영상 개요 */}
      <div style={{ padding: '16px 20px', background: '#fff5f5', borderRadius: '14px', border: '1px solid #fecaca', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ background: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: 900, padding: '3px 10px', borderRadius: '20px', flexShrink: 0, marginTop: '2px' }}>
          {variant.duration || 'SHORTS'}
        </div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', lineHeight: '1.6' }}>{variant.content}</div>
      </div>

      {storyboard.length === 0 ? (
        <div style={{ padding: '32px', background: '#f8fafc', borderRadius: '14px', border: '2px dashed #e2e8f0', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
          스토리보드 데이터가 없습니다. 다시 생성해보세요.
          <div style={{ fontSize: '12px', marginTop: '8px', color: '#cbd5e1' }}>
            (raw keys: {Object.keys(variant).join(', ')})
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            🎬 스토리보드 — {storyboard.length}개 씬
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {storyboard.map((scene: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '16px', padding: '16px', background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ aspectRatio: '9/16', borderRadius: '8px', overflow: 'hidden' }}>
                  <ImageSlot src={scene.imageUrl} loading={sceneLoadingSet.has(i)} onGenerate={() => onGenerateScene(i)} onUpload={(s: string) => onUploadScene(i, s)} aspect="9/16" size="sm" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: '#ef4444', color: '#fff', fontSize: '11px', fontWeight: 900, padding: '2px 8px', borderRadius: '6px' }}>Scene {i + 1}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444' }}>{scene.timeCode}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', fontStyle: 'italic' }}>{scene.visual}</div>
                  <div style={{ fontSize: '14px', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #ef4444', color: '#1e293b', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{scene.script}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

import { Sidebar } from '@/components/layout/sidebar';

export default function POCPage() {
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
    setImages(prev => [...prev, ...next].slice(0, 4));
  };

  const generateContent = async () => {
    const hasData = url || product.name || product.feature;
    if (!hasData || !selectedPlatform) return;
    setLoading(true); setResults(null); setLogs([]);
    try {
      let scrapedData = '';
      if (url && url.startsWith('http')) {
        addLog('🌐 [사무원] URL 페이지 상세 내용 읽는 중 (MCP)...');
        try {
          const res = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
          const data = await res.json();
          scrapedData = `\n[웹 페이지 실제 내용]\n타이틀: ${data.title}\n내용: ${data.content}`;
        } catch (e) { console.error('Scraping failed', e); }
      }

      // ── 실시간 트렌드 데이터 수집 ──
      let trendContext = '';
      const trendKeyword = product.name || product.feature?.split(/[\s,]/)[0] || '';
      if (trendKeyword) {
        addLog('🔍 [트렌드봇] 구글 뉴스 및 실시간 이슈 검색 중...');
        try {
          const trendRes = await fetch('/api/trend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: trendKeyword }),
          });
          const trendData = await trendRes.json();
          if (trendRes.ok && trendData.trending_issues) {
            const issues = trendData.trending_issues.map((t: any) => `- ${t.title}: ${t.summary}`).join('\n');
            const keywords = trendData.keywords?.map((k: any) => `${k.keyword}(${k.reason})`).join(', ') || '';
            const hashtags = trendData.hashtags?.join(' ') || '';
            const ideas = trendData.content_ideas?.map((c: any) => `[${c.platform}] ${c.idea} — ${c.angle}`).join('\n') || '';
            trendContext = `\n\n[실시간 구글 트렌드 & 뉴스 — ${trendKeyword}]\n트렌딩 이슈:\n${issues}\n\n지금 핫한 키워드: ${keywords}\n\n플랫폼별 콘텐츠 소재 힌트:\n${ideas}\n\n추천 해시태그: ${hashtags}`;
            localStorage.setItem('office_trend_raw', JSON.stringify(trendData));
            addLog(`✅ [트렌드봇] 실시간 이슈 ${trendData.trending_issues.length}개 발견!`);
          }
        } catch (e) {
          console.error('트렌드 수집 실패', e);
          addLog('⚠️ 트렌드 수집 실패. 계속 진행합니다.');
        }
      }

      addLog('🤖 [사무원] 트렌드 분석 및 소재 발굴 중 (GPT)...');
      // 스크랩 데이터 최대 1500자, 트렌드 컨텍스트 최대 2000자로 제한 (토큰 초과 방지)
      const trimmedScrape = scrapedData.slice(0, 1500);
      const trimmedTrend = trendContext.slice(0, 2000);
      const ctxBody = `[사용자 입력 상품 정보]\n상품명: ${product.name}\n가격: ${product.price}\n특징: ${product.feature}\n상세: ${product.detail}\n참고 URL: ${url}\n${trimmedScrape}${trimmedTrend}`;
      const platformGuides = (p: string) => {
        if (p === 'instagram') return `"instagram": 3개 항목. 각 항목: { "content": "감성적 캡션(600자 내외, 훅+본문+CTA+해시태그)", "visual": "이미지 묘사(영문, 1~2문장)" }`;
        if (p === 'shorts') return `"shorts": 3개 항목. 1안=15초/씬5개, 2안=30초/씬7개, 3안=60초/씬10개. 각 항목: { "content": "영상 주제", "duration": "N초", "storyboard": [ { "timeCode": "0:00~0:03", "visual": "장면묘사(영문)", "script": "대사(한국어)" } ] }`;
        if (p === 'blog') return `"blog": 3개 항목. 각 항목: { "content": "블로그 포스팅(2200자 내외). [사진1]~[사진5] 마커를 본문 사이에 배치. 마커 사이 최소 5~7문장. 마지막에 해시태그 10개 이상 추가.", "visualPrompts": ["사진1 영문 묘사", "사진2", "사진3", "사진4", "사진5"] }`;
        return `"${p}": 3개 항목. 각 항목: { "content": "상세 본문" }`;
      };

      const officePrompt = `당신은 대한민국 최고의 마케팅 전문가 팀입니다. 아래 상품 정보와 [실시간 구글 트렌드 & 뉴스]를 함께 분석하여 창의적인 SNS 기획안을 작성하세요.

[핵심 요구사항 — 반드시 준수]
1안, 2안, 3안은 서로 완전히 다른 트렌드 이슈/소재/컨셉/톤앤매너를 사용해야 합니다.
- 1안: 위 트렌딩 이슈 중 첫 번째 소재를 중심으로 구성
- 2안: 위 트렌딩 이슈 중 두 번째(또는 다른) 소재를 중심으로, 완전히 다른 각도로 구성
- 3안: 트렌딩 키워드 중 가장 감성적/바이럴 가능성 높은 소재로, 1안·2안과 전혀 다른 스타일로 구성
절대 비슷한 내용의 반복이 없어야 합니다.

${platformGuides(selectedPlatform)}

[연구 결과 추가 요청]
반드시 별도의 "research" 필드를 만드세요. 위 [실시간 구글 트렌드 & 뉴스] 데이터를 적극 활용하여 실제 현재 이슈를 반영하세요:
"research": {
  "searchKeywords": ["검색어1", "검색어2"...],
  "trendAnalysis": "현재 실시간 이슈와 뉴스를 바탕으로 한 구체적인 SNS 트렌드 분석 (최소 3~5문장, 실제 트렌딩 이슈를 언급할 것)",
  "competitorKeywords": ["경쟁사 키워드1"...],
  "targetAudience": "주요 타겟층 상세 분석"
}

[주의]
1. 모든 콘텐츠는 '초장문'으로, 사용자가 정보를 충분히 얻을 수 있게 아주 상세히 작성하세요.
2. '나노바나나', '에이전트' 등의 내부 명칭은 본문에 포함하지 마십시오.
결과는 반드시 JSON 형태로만 응답하세요.`;

      const officeMessages: any[] = [
        { role: 'system', content: 'You are an elite marketing analyst. Always respond in valid JSON format with a mandatory "research" field.' },
        { role: 'user', content: [{ type: 'text', text: officePrompt }, ...images.map(img => ({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64}` } }))] }
      ];

      let geminiResult: any;
      try {
        geminiResult = await callGPT(officeMessages);
      } catch (error: any) {
        if (images.length > 0) {
          addLog('⚠️ 이미지 포함 요청 실패. 이미지 없이 재시도 중...');
          const officeMessagesWithoutImages = [
            { role: 'system', content: 'You are an elite marketing analyst. Always respond in valid JSON format with a mandatory "research" field.' },
            { role: 'user', content: officePrompt }
          ];
          geminiResult = await callGPT(officeMessagesWithoutImages);
        } else {
          throw error;
        }
      }

      // 2차 고도화 제거 — 1차 결과 바로 사용 (토큰 초과 방지)
      const normalized: any = {};
      Object.entries(geminiResult).forEach(([k, v]) => {
        const key = k.toLowerCase().trim();
        if (key === 'research') { normalized.research = v; localStorage.setItem('office_research', JSON.stringify(v)); }
        else normalized[key] = (Array.isArray(v) ? v : [v]).map(normalizeVariant);
      });

      setResults(normalized);
      setActiveTab(selectedPlatform);
      setView('results');
      addLog('✅ 콘텐츠 기획 완료!');
    } catch (err: any) { 
      console.error(err);
      addLog(`⚠️ 오류: ${err.message}`); 
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
    } catch (e:any) { addLog(`⚠️ 이미지 실패: ${e.message}`); } finally { setImgLoadingMap((prev:any) => ({...prev, [key]:false})); }
  };

  const renderInput = () => (
    <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
      <div className="max-w-4xl mx-auto py-10">
        <header className="mb-14 text-center">
          <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black uppercase tracking-widest mb-4">Multi-Agent System</div>
          <h1 className="text-5xl font-black text-gray-900 tracking-tight leading-tight">
            SNS <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-emerald-500">콘텐츠 기획</span> 에이전트
          </h1>
          <p className="text-gray-400 mt-4 text-lg font-medium">상품 정보 하나로 전 채널 콘텐츠를 한 번에 기획하세요.</p>
        </header>

        <div className="bg-white rounded-[40px] p-12 shadow-2xl shadow-gray-200/50 border border-gray-100 animate-in fade-in zoom-in-95 duration-500">
          <div className="space-y-10">
            {/* 사진 업로드 */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-black text-gray-800 uppercase tracking-tighter"><Image size={18} className="text-indigo-500" /> 상품 및 참고 이미지 (최대 4장)</label>
              <div className="grid grid-cols-4 gap-4">
                {images.map((img, i) => (
                  <div key={i} className="aspect-square rounded-2xl overflow-hidden border-2 border-indigo-100 relative group animate-in slide-in-from-bottom-2">
                    <img src={img.preview} alt="p" className="w-full h-full object-cover" />
                    <button onClick={() => setImages(prev => prev.filter((_, idx)=>idx!==i))} className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Copy size={14} /></button>
                  </div>
                ))}
                {images.length < 4 && (
                  <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all flex flex-col items-center justify-center gap-2 text-gray-400">
                    <Upload size={24} />
                    <span className="text-xs font-bold">사진 추가</span>
                  </button>
                )}
                <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={(e)=>handleFiles(e.target.files)} className="hidden" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-black text-gray-800 uppercase tracking-tighter"><LinkIcon size={18} className="text-indigo-500" /> 참고 URL</label>
                <input type="text" placeholder="https://..." className="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-medium outline-none" value={url} onChange={e => setUrl(e.target.value)} />
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-black text-gray-800 uppercase tracking-tighter"><Search size={18} className="text-indigo-500" /> 상품명</label>
                <input type="text" placeholder="포켄스 덴티페어리..." className="w-full px-6 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-medium outline-none" value={product.name} onChange={e => setProduct({...product, name: e.target.value})} />
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-black text-gray-800 uppercase tracking-tighter"><AlignLeft size={18} className="text-indigo-500" /> 핵심 홍보 포인트</label>
              <textarea rows={4} placeholder="강조하고 싶은 제품의 특징이나 유행하는 키워드를 입력해 주세요." className="w-full px-6 py-4 rounded-3xl border border-gray-100 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-medium outline-none resize-none" value={product.feature} onChange={e => setProduct({...product, feature: e.target.value})} />
            </div>

            <div className="space-y-5">
              <label className="block text-sm font-black text-gray-800 uppercase tracking-tighter">플랫폼 멀티 채널 선택</label>
              <div className="flex flex-wrap gap-3">
            {SNS_PLATFORMS.map((p) => {
              const selected = selectedPlatform === p.key;
              return (
                <button 
                  key={p.key} 
                  onClick={() => setSelectedPlatform(p.key)}
                  className={`px-8 py-3 rounded-2xl text-sm font-black transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 border-2 ${selected ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-200' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'}`}
                >
                  <span className="capitalize">{p.label}</span>
                </button>
              );
            })}
          </div>
            </div>

            <button disabled={loading} onClick={generateContent} className="w-full h-20 rounded-3xl bg-indigo-600 text-white text-xl font-black shadow-2xl shadow-indigo-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-4">
              {loading ? <><Loader2 className="animate-spin" /> 기획안을 다듬는 중...</> : <><Sparkles size={24} /> 콘텐츠 생성하기</>}
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

    return (
      <div className="flex-1 overflow-y-auto p-12 bg-white">
        <div className="max-w-4xl mx-auto py-10">
          <div className="flex items-center justify-between mb-12">
            <div>
              <div className="text-gray-400 text-xs font-black uppercase tracking-widest mb-1.5">{activeTab} Planner</div>
              <h2 className="text-4xl font-black text-gray-900 tracking-tight capitalize">{activeTab} 기획 결과</h2>
            </div>
            <div className="flex p-1.5 bg-gray-100 rounded-2xl gap-1">
              {variants.map((_:any, i:number) => (
                <button key={i} onClick={()=>setActiveVariant({...activeVariant,[activeTab]:i})} className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${vIdx===i?'bg-white text-indigo-600 shadow-sm':'text-gray-400 hover:text-gray-600'}`}>
                  {i+1}안
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[40px] border border-gray-100 bg-white p-10 min-h-[600px] shadow-sm animate-in fade-in duration-500">
            {activeTab==='blog' && <BlogPreview content={variant.content} images={variant.images||[]} onGenerateImage={(i:any)=>generateSingleImage('blog',vIdx,'blog',i)} onUploadImage={(i:any,s:any)=>{const upd={...results}; upd.blog[vIdx].images[i]=s; setResults({...upd});}} imgLoadingSet={blogs} />}
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
    if (!research && !trendRaw) return <div className="flex-1 flex items-center justify-center text-gray-400 font-bold bg-[#f8fafc]">데이터 분석 결과가 없습니다.</div>;
    return (
      <div className="flex-1 overflow-y-auto p-12 bg-white">
        <div className="max-w-4xl mx-auto">
          <header className="mb-12">
            <h2 className="text-4xl font-black text-gray-900 tracking-tight flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                <Search size={24} />
              </div>
              기획안 서칭 결과
            </h2>
            <p className="text-gray-400 mt-2 font-bold ml-16">실시간 구글 뉴스 + AI 분석 기반 트렌드 인사이트</p>
          </header>

          {/* 실시간 트렌딩 이슈 */}
          {trendRaw?.trending_issues?.length > 0 && (
            <div className="mb-8 bg-orange-50/40 border border-orange-100 rounded-3xl p-8">
              <h3 className="text-orange-600 font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                🔥 실시간 트렌딩 이슈
              </h3>
              <div className="space-y-4">
                {trendRaw.trending_issues.map((issue: any, i: number) => (
                  <div key={i} className="bg-white rounded-2xl p-5 border border-orange-100/60">
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
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-emerald-50/30 border border-emerald-100/50 rounded-3xl p-8">
              <h3 className="text-emerald-600 font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                트렌드 분석
              </h3>
              <p className="text-gray-700 leading-relaxed font-bold text-lg">{research?.trendAnalysis}</p>
            </div>

            <div className="bg-indigo-50/30 border border-indigo-100/50 rounded-3xl p-8">
              <h3 className="text-indigo-600 font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                주요 타겟층
              </h3>
              <p className="text-gray-700 leading-relaxed font-bold text-lg">{research?.targetAudience}</p>
            </div>
          </div>

          <div className="mt-8 space-y-8">
            {/* 실시간 추천 해시태그 */}
            {trendRaw?.hashtags?.length > 0 && (
              <div className="bg-orange-50/30 border border-orange-100/50 rounded-3xl p-8">
                <h3 className="text-orange-500 font-black text-xs uppercase tracking-widest mb-6">🏷️ 실시간 추천 해시태그</h3>
                <div className="flex flex-wrap gap-2">
                  {trendRaw.hashtags.map((tag: string, i: number) => (
                    <span key={i} className="bg-white border-2 border-orange-100 px-4 py-2 rounded-2xl text-orange-600 font-black text-sm shadow-sm">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-50 border border-gray-100 rounded-3xl p-8">
              <h3 className="text-gray-500 font-black text-xs uppercase tracking-widest mb-6">타겟 키워드</h3>
              <div className="flex flex-wrap gap-2">
                {research?.searchKeywords?.map((k: string, i: number) => (
                  <span key={i} className="bg-white border-2 border-gray-100 px-4 py-2 rounded-2xl text-gray-700 font-black text-sm shadow-sm">#{k}</span>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-3xl p-8">
              <h3 className="text-gray-500 font-black text-xs uppercase tracking-widest mb-6">경쟁사 주요 키워드</h3>
              <div className="flex flex-wrap gap-2">
                {research?.competitorKeywords?.map((k: string, i: number) => (
                  <span key={i} className="bg-white border-2 border-gray-100 px-4 py-2 rounded-2xl text-gray-400 font-bold text-sm">#{k}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen w-screen bg-white overflow-hidden text-gray-900">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} view={view} setView={setView} />
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {view === 'input' && renderInput()}
        {view === 'results' && renderResults()}
        {view === 'research' && renderResearch()}
      </main>
    </div>
  );
}
