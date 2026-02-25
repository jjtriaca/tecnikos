"use client";

import type { SortOrder } from "@/lib/types/table";

interface SortableHeaderProps {
  label: string;
  column: string;
  currentColumn: string | null;
  currentOrder: SortOrder;
  onToggle: (column: string) => void;
  align?: "left" | "right" | "center";
  className?: string;
  as?: "th" | "div";
}

export default function SortableHeader({
  label,
  column,
  currentColumn,
  currentOrder,
  onToggle,
  align = "left",
  className = "",
  as: Tag = "th",
}: SortableHeaderProps) {
  const isActive = currentColumn === column;
  const alignClass =
    align === "right"
      ? "text-right justify-end"
      : align === "center"
        ? "text-center justify-center"
        : "text-left";

  return (
    <Tag
      className={`py-3 px-4 text-xs font-semibold uppercase text-slate-600 cursor-pointer select-none hover:text-slate-900 hover:bg-slate-100 transition-colors ${className}`}
      onClick={() => onToggle(column)}
    >
      <span className={`inline-flex items-center gap-1 ${alignClass}`}>
        {label}
        <span className="inline-flex flex-col leading-none ml-0.5">
          <svg
            className={`h-2.5 w-2.5 ${isActive && currentOrder === "asc" ? "text-blue-600" : "text-slate-300"}`}
            viewBox="0 0 12 12"
            fill="currentColor"
          >
            <path d="M6 2L10 7H2z" />
          </svg>
          <svg
            className={`h-2.5 w-2.5 -mt-0.5 ${isActive && currentOrder === "desc" ? "text-blue-600" : "text-slate-300"}`}
            viewBox="0 0 12 12"
            fill="currentColor"
          >
            <path d="M6 10L2 5h8z" />
          </svg>
        </span>
      </span>
    </Tag>
  );
}
