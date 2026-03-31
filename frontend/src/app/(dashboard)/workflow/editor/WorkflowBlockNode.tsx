"use client";

import { type Block, getCatalogEntry } from "@/types/workflow-blocks";

interface Props {
  block: Block;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onClick: () => void;
  onDelete: () => void;
  branchLabel?: string;
}

export default function WorkflowBlockNode({ block, isSelected, isFirst, isLast, onClick, onDelete, branchLabel }: Props) {
  const cat = getCatalogEntry(block.type);
  const isStartEnd = block.type === "START" || block.type === "END";

  if (isStartEnd) {
    return (
      <div className="flex flex-col items-center">
        {branchLabel && (
          <span className="mb-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            {branchLabel}
          </span>
        )}
        <div
          className={`flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold shadow-sm
            ${block.type === "START"
              ? "bg-gradient-to-r from-green-500 to-green-600 text-white"
              : "bg-gradient-to-r from-slate-500 to-slate-600 text-white"
            }`}
        >
          <span className="mr-1.5">{block.icon}</span>
          {block.name}
        </div>
      </div>
    );
  }

  const color = cat?.color || "bg-slate-50";
  const border = cat?.borderColor || "border-slate-300";
  const iconBg = cat?.iconBg || "bg-slate-500";
  const textColor = cat?.textColor || "text-slate-900";

  // Build subtitle from config
  let subtitle = "";
  if (block.type === "STATUS") subtitle = block.config?.targetStatus || "";
  if (block.type === "NOTIFY") {
    const recipients = block.config?.recipients;
    if (Array.isArray(recipients)) {
      subtitle = recipients.filter((r: any) => r.enabled).map((r: any) => r.type).join(", ");
    } else {
      subtitle = block.config?.recipient || "";
    }
  }
  if (block.type === "PHOTO") subtitle = block.config?.required === false ? "Opcional" : `Min: ${block.config?.minPhotos || 1} foto(s)`;
  if (block.type === "CHECKLIST") subtitle = `${block.config?.items?.length || 0} itens`;
  if (block.type === "FORM") subtitle = `${block.config?.fields?.length || 0} campos`;
  if (block.type === "MATERIALS") subtitle = `Min: ${block.config?.minItems || 1} material(is)`;
  if (block.type === "QUESTION") subtitle = block.config?.question || "";
  if (block.type === "CONDITION") subtitle = block.config?.question || "Condicao";
  if (block.type === "DELAY") {
    const dur = block.config?.duration ?? block.config?.minutes ?? 0;
    const unit = block.config?.unit || "minutes";
    const labels: Record<string, string> = { seconds: "s", minutes: "min", hours: "h", days: "dia(s)" };
    subtitle = `${dur} ${labels[unit] || "min"}`;
  }
  if (block.type === "SLA") subtitle = `Max: ${block.config?.maxMinutes || 0} min`;
  if (block.type === "STEP") subtitle = block.config?.description || "";
  if (block.type === "NOTE") subtitle = block.config?.placeholder || "";
  if (block.type === "SIGNATURE") subtitle = block.config?.label || "";
  if (block.type === "ALERT") subtitle = block.config?.severity || "";
  if (block.type === "INFO") subtitle = block.config?.title || block.config?.message?.substring(0, 40) || "Informação";

  return (
    <div className="flex flex-col items-center">
      {branchLabel && (
        <span className="mb-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          {branchLabel}
        </span>
      )}
      <div
        onClick={onClick}
        className={`group relative w-64 cursor-pointer rounded-xl border-2 px-3 py-2.5 transition-all
          ${isSelected ? "ring-2 ring-blue-400 ring-offset-2 shadow-md" : "hover:shadow-md hover:scale-[1.01]"}
          ${color} ${border}`}
      >
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-white text-sm shrink-0 shadow-sm ${iconBg}`}>
            {block.icon}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold truncate ${textColor}`}>{block.name}</p>
            {subtitle && (
              <p className="text-[10px] text-slate-400 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Delete button */}
        {!isFirst && !isLast && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="absolute -top-2 -right-2 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] shadow-sm hover:bg-red-600 transition-colors"
            title="Remover bloco"
          >
            x
          </button>
        )}
      </div>
    </div>
  );
}
