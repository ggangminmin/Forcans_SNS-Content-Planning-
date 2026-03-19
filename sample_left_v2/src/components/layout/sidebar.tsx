"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Search, Layout, FileText, BarChart3, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';

interface SidebarProps {
  setActiveTab: (tab: string) => void;
  activeTab: string;
  view: 'input' | 'results' | 'research';
  setView: (view: 'input' | 'results' | 'research') => void;
}

export function Sidebar({ setActiveTab, activeTab, view, setView }: SidebarProps) {
  const pathname = usePathname();
  const [research, setResearch] = useState<any>(null);

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

  return (
    <div className="w-64 bg-white border-r h-full flex flex-col p-4 shadow-sm z-50">
      <div className="mb-8 p-2">
        <h1 className="text-xl font-black text-gray-800 tracking-tight flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <Sparkles size={18} />
          </div>
          포켄스 기획
        </h1>
        <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-extrabold ml-10">AI Content Team</p>
      </div>

      <nav className="flex-1 space-y-1">
        <button 
          onClick={() => setView('input')}
          className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${view === 'input' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Layout size={18} />
          <span className="font-bold">기획 정보 입력</span>
        </button>
        
        <button 
          onClick={() => setView('research')}
          className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${view === 'research' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <BarChart3 size={18} />
          <span className="font-bold">기획안 서칭 결과</span>
        </button>

        {(view === 'results' || view === 'research') && (
          <div className="pt-6 space-y-1 animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="px-4 py-2 border-b border-gray-50 mb-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <FileText size={10} /> 생성된 콘텐츠
              </span>
            </div>

            <button
              onClick={() => setView('input')}
              className="w-full text-left px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-2 mb-4"
            >
              ← 다시 작성하기
            </button>

            {['instagram', 'threads', 'shorts', 'twitter', 'tiktok', 'blog'].map((p) => (
              <button
                key={p}
                onClick={() => { setActiveTab(p); setView('results'); }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all capitalize font-bold text-sm ${view === 'results' && activeTab === p ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
              >
                {p === 'shorts' ? 'YouTube Shorts' : p === 'blog' ? 'Blog Post' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
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
