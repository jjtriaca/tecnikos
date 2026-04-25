"use client";

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}

export default function Pagination({ meta, onPageChange }: PaginationProps) {
  if (meta.totalPages <= 1) return null;

  const pages: number[] = [];
  const maxVisible = 5;
  let start = Math.max(1, meta.page - Math.floor(maxVisible / 2));
  const end = Math.min(meta.totalPages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-slate-500">
        {meta.total} registro{meta.total !== 1 ? "s" : ""} | Página {meta.page}{" "}
        de {meta.totalPages}
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(meta.page - 1)}
          disabled={meta.page <= 1}
          className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30"
        >
          Anterior
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`rounded px-2.5 py-1 text-xs font-medium ${
              p === meta.page
                ? "bg-blue-600 text-white"
                : "border border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(meta.page + 1)}
          disabled={meta.page >= meta.totalPages}
          className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30"
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
