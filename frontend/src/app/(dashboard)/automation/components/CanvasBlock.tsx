"use client";

import { useRef, useCallback } from "react";
import { CATEGORY_COLORS, type AutoBlockCategory } from "@/types/automation-blocks";
import { BLOCK_W, BLOCK_H, PORT_R } from "./canvasUtils";
import type { CanvasBlock as CanvasBlockType } from "./useCanvasState";

/* ═══════════════════════════════════════════════════════════════
   CANVAS BLOCK — Individual block rendered on the canvas
   ═══════════════════════════════════════════════════════════════ */

interface Props {
  block: CanvasBlockType;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onPortDragStart: (blockId: string, portType: "output") => void;
  onPortDrop: (blockId: string) => void;
  onRemove: () => void;
}

export default function CanvasBlock({
  block,
  selected,
  onSelect,
  onDragStart,
  onPortDragStart,
  onPortDrop,
  onRemove,
}: Props) {
  const colors = CATEGORY_COLORS[block.category];

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect();
    onDragStart(e);
  };

  return (
    <g transform={`translate(${block.x}, ${block.y})`}>
      {/* Block body */}
      <foreignObject width={BLOCK_W} height={BLOCK_H} style={{ overflow: "visible" }}>
        <div
          onPointerDown={handlePointerDown}
          className={`
            w-[240px] h-[80px] rounded-xl border-2 cursor-grab active:cursor-grabbing
            flex items-center gap-3 px-4 select-none transition-shadow
            ${colors.bg} ${colors.border} ${colors.text}
            ${selected ? "ring-2 ring-offset-2 ring-violet-500 shadow-lg" : "shadow-sm hover:shadow-md"}
          `}
        >
          <div className={`w-9 h-9 ${colors.iconBg} rounded-lg flex items-center justify-center text-white text-base shrink-0`}>
            {block.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wide opacity-60">{block.category}</div>
            <div className="text-sm font-semibold truncate">{block.label}</div>
          </div>
          {/* Remove button */}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-all shrink-0"
            style={{ opacity: selected ? 1 : undefined }}
            title="Remover bloco"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </foreignObject>

      {/* Input port (left) */}
      {block.category !== "TRIGGER" && (
        <circle
          cx={0}
          cy={BLOCK_H / 2}
          r={PORT_R}
          className="fill-white stroke-slate-400 stroke-2 cursor-crosshair hover:fill-blue-200 transition-colors"
          onPointerUp={(e) => { e.stopPropagation(); onPortDrop(block.id); }}
        />
      )}

      {/* Output port (right) */}
      {block.category !== "ACTION" || true ? (
        <circle
          cx={BLOCK_W}
          cy={BLOCK_H / 2}
          r={PORT_R}
          className="fill-white stroke-slate-400 stroke-2 cursor-crosshair hover:fill-green-200 transition-colors"
          onPointerDown={(e) => {
            e.stopPropagation();
            onPortDragStart(block.id, "output");
          }}
        />
      ) : null}
    </g>
  );
}
