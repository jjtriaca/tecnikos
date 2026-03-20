"use client";

import { CATALOG_BY_CATEGORY, CATEGORY_LABELS, type BlockCategory, type CatalogEntry } from "@/types/workflow-blocks";

interface Props {
  onAddBlock: (entry: CatalogEntry) => void;
}

export default function WorkflowPalette({ onAddBlock }: Props) {
  const categories: BlockCategory[] = ["ACTIONS", "VISUAL", "COMMUNICATION", "SYSTEM", "FLOW"];

  return (
    <div className="w-56 shrink-0 border-r border-slate-200 bg-slate-50/80 overflow-y-auto">
      <div className="p-3 border-b border-slate-200">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Blocos</h3>
        <p className="text-[10px] text-slate-400 mt-0.5">Clique para adicionar</p>
      </div>

      {categories.map((cat) => {
        const entries = CATALOG_BY_CATEGORY[cat];
        const meta = CATEGORY_LABELS[cat];
        if (!entries?.length) return null;

        return (
          <div key={cat} className="p-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1 mb-1.5">
              {meta.icon} {meta.label}
            </p>
            <div className="space-y-1">
              {entries.map((entry) => (
                <button
                  key={entry.type}
                  onClick={() => onAddBlock(entry)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-all
                    ${entry.color} ${entry.borderColor} border hover:shadow-sm hover:scale-[1.02] active:scale-[0.98]`}
                  title={entry.description}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-md text-white text-[11px] shrink-0 ${entry.iconBg}`}>
                    {entry.icon}
                  </span>
                  <span className={`font-medium truncate ${entry.textColor}`}>{entry.name}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
