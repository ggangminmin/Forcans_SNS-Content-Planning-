"use client";

import { BarChart3, FileText, Layout, PencilLine, Sparkles } from "lucide-react";

type View = "input" | "research" | "planning" | "results";

interface SidebarProps {
  activeTab: string;
  canOpenResearch: boolean;
  canOpenPlanning: boolean;
  canOpenResults: boolean;
  setActiveTab: (tab: string) => void;
  setView: (view: View) => void;
  view: View;
  visibleTabs?: string[];
}

function StepButton({
  active,
  description,
  disabled,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  description: string;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-md"
          : disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${active ? "bg-white/12 text-white" : disabled ? "bg-slate-200 text-slate-400" : "bg-slate-100 text-slate-700"}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-black">{label}</p>
          <p className={`mt-1 text-xs whitespace-nowrap ${active ? "text-white/70" : disabled ? "text-slate-400" : "text-slate-500"}`}>{description}</p>
        </div>
      </div>
    </button>
  );
}

export function Sidebar({ canOpenResearch, canOpenPlanning, canOpenResults, setView, view }: SidebarProps) {
  return (
    <div className="flex h-full w-[300px] flex-col overflow-y-auto border-r border-slate-100 bg-white p-6">
      <div className="mb-10 px-2 pb-8 border-b border-slate-50">
        <h2 className="text-2xl font-black tracking-tight text-slate-950 leading-tight border-t-4 border-gray-900 pt-6">SNS 콘텐츠<br />기획 에이전트</h2>
        <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Forcans Digital Lab</p>
      </div>

      <div className="flex-1">
        <p className="mb-4 px-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">진행 워크플로우</p>
        <div className="space-y-3">
          <StepButton 
            active={view === "input"} 
            disabled={false} 
            icon={<Layout size={18} />} 
            label="상품 정보 입력" 
            description="기본 마케팅 자산 입력" 
            onClick={() => setView("input")} 
          />
          <StepButton 
            active={view === "research"} 
            disabled={!canOpenResearch} 
            icon={<BarChart3 size={18} />} 
            label="트렌드 분석" 
            description="이슈 발굴 및 선정" 
            onClick={() => canOpenResearch && setView("research")} 
          />
          <StepButton 
            active={view === "planning"} 
            disabled={!canOpenPlanning} 
            icon={<PencilLine size={18} />} 
            label="기획서 생성" 
            description="AI 전략 초안 확인/수정" 
            onClick={() => canOpenPlanning && setView("planning")} 
          />
          <StepButton 
            active={view === "results"} 
            disabled={!canOpenResults} 
            icon={<FileText size={18} />} 
            label="최종 원고 생성" 
            description="채널별 콘텐츠 결과물" 
            onClick={() => canOpenResults && setView("results")} 
          />
        </div>
      </div>

    </div>
  );
}
