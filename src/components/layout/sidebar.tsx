"use client";

import { useState, useEffect } from 'react';
import { Search, Layout, FileText, BarChart3, Settings, Instagram, Youtube, Twitter, Film, PenSquare, MessageCircleMore } from 'lucide-react';

interface SidebarProps {
  setActiveTab: (tab: string) => void;
  activeTab: string;
  view: 'input' | 'results' | 'research';
  setView: (view: 'input' | 'results' | 'research') => void;
  visibleTabs?: string[];
}

export function Sidebar({ setActiveTab, activeTab, view, setView, visibleTabs }: SidebarProps) {
  const [research, setResearch] = useState<any>(null);
  const sidebarMenuFont = '"Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

  useEffect(() => {
    const checkResearch = () => {
      const saved = localStorage.getItem('office_research');
      if (saved) {
        try {
          setResearch(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse research data', e);
        }
      }
    };

    checkResearch();
    window.addEventListener('storage', checkResearch);
    const interval = setInterval(checkResearch, 2000);

    return () => {
      window.removeEventListener('storage', checkResearch);
      clearInterval(interval);
    };
  }, []);

  const platformIcons: Record<string, any> = {
    instagram: Instagram,
    blog: PenSquare,
    shorts: Youtube,
    twitter: Twitter,
    tiktok: Film,
    threads: MessageCircleMore,
  };

  const renderPlatformButton = (p: string) => {
    const Icon = platformIcons[p] || Search;
    return (
      <button
        key={p}
        onClick={() => {
          setActiveTab(p);
          setView('results');
        }}
        className={`w-full text-left px-4 py-3 rounded-xl transition-all capitalize font-bold text-sm flex items-center ${
          view === 'results' && activeTab === p ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-gray-400 hover:bg-gray-50'
        }`}
        style={{ fontFamily: sidebarMenuFont }}
      >
        <span className="inline-flex items-center justify-center w-5 h-5 mr-2 align-middle flex-shrink-0">
          <Icon size={15} strokeWidth={2.2} />
        </span>
        <span className="text-sm font-bold">
          {p === 'shorts' ? 'YouTube Shorts' : p === 'blog' ? 'Blog Post' : p.charAt(0).toUpperCase() + p.slice(1)}
        </span>
      </button>
    );
  };

  return (
    <div className="w-64 bg-white border-r h-full flex flex-col p-3.5 shadow-sm z-50">
      <div className="mb-8 p-2">
        <div className="text-sm font-bold text-gray-800" style={{ fontFamily: sidebarMenuFont }}>
          SNS 콘텐츠 기획
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        <button
          onClick={() => setView('input')}
          className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${
            view === 'input' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Layout size={18} />
          <span className="font-bold">기획 정보 입력</span>
        </button>

        <button
          onClick={() => setView('research')}
          className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${
            view === 'research' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <BarChart3 size={18} />
          <span className="font-bold">기획안 서칭 결과</span>
        </button>

        {(view === 'results' || view === 'research') && (
          <div className="pt-6 space-y-1 animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="px-4 py-2 border-b border-gray-50 mb-2">
              <span className="text-base font-bold text-gray-400 flex items-center gap-1" style={{ fontFamily: sidebarMenuFont }}>
                <FileText size={10} /> 생성된 콘텐츠              </span>
            </div>

            {(visibleTabs?.length ? visibleTabs : ['instagram', 'threads', 'shorts', 'twitter', 'tiktok', 'blog']).map(renderPlatformButton)}
          </div>
        )}
      </nav>

      <div className="pt-4 mt-auto border-t border-gray-100">
        <button className="w-full text-left px-4 py-3 rounded-xl text-gray-400 flex items-center gap-3 hover:bg-gray-50 transition-colors">
          <Settings size={18} />
          <span className="font-bold">설정</span>
        </button>
      </div>
    </div>
  );
}

