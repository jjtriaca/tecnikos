"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useDebounce } from "@/hooks/useDebounce";

/* ---- Types ---- */

export interface LookupFetcherResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export type LookupFetcher<T> = (
  search: string,
  page: number,
  signal: AbortSignal,
) => Promise<LookupFetcherResult<T>>;

export interface SearchLookupModalProps<T> {
  open: boolean;
  title: string;
  placeholder?: string;
  fetcher: LookupFetcher<T>;
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onSelect: (item: T) => void;
  onClose: () => void;
  /** When true, shows a "Confirmar" button in the footer */
  showConfirmButton?: boolean;
  /** Number of currently selected items (used for confirm button label) */
  selectedCount?: number;
  /** Called when confirm button is clicked */
  onConfirm?: () => void;
}

/* ---- Component ---- */

export default function SearchLookupModal<T>({
  open,
  title,
  placeholder = "Buscar...",
  fetcher,
  keyExtractor,
  renderItem,
  onSelect,
  onClose,
  showConfirmButton,
  selectedCount = 0,
  onConfirm,
}: SearchLookupModalProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<LookupFetcherResult<T>["meta"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const debouncedSearch = useDebounce(searchTerm, 300);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setSearchTerm("");
      setPage(1);
      setItems([]);
      setMeta(null);
      setError(null);
      setHighlightIndex(0);
      // auto-focus with small delay for animation
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Fetch data on debounced search or page change
  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetcher(debouncedSearch, page, controller.signal)
      .then((result) => {
        setItems(result.data);
        setMeta(result.meta);
        setHighlightIndex(0);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError("Erro ao buscar resultados.");
        setItems([]);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [open, debouncedSearch, page, fetcher]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Scroll highlighted item into view
  useEffect(() => {
    itemRefs.current[highlightIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIndex((prev) => (prev + 1) % Math.max(items.length, 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIndex((prev) => (prev - 1 + items.length) % Math.max(items.length, 1));
          break;
        case "Enter":
          e.preventDefault();
          if (items[highlightIndex]) {
            onSelect(items[highlightIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [items, highlightIndex, onSelect, onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative mx-4 w-full max-w-lg rounded-2xl bg-white shadow-xl animate-scale-in flex flex-col" style={{ maxHeight: "min(600px, 85vh)" }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Input */}
        <div className="border-b border-slate-200 px-5 py-3">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="space-y-1 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : error ? (
            <div className="p-5 text-center">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="mx-auto mb-2 h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm text-slate-400">
                {debouncedSearch ? "Nenhum resultado encontrado." : "Digite para buscar..."}
              </p>
            </div>
          ) : (
            <div className="p-2">
              {items.map((item, idx) => (
                <button
                  key={keyExtractor(item)}
                  ref={(el) => { itemRefs.current[idx] = el; }}
                  onClick={() => onSelect(item)}
                  className={`w-full text-left rounded-lg px-4 py-3 transition-colors ${
                    idx === highlightIndex
                      ? "bg-blue-50 ring-1 ring-blue-200"
                      : "hover:bg-slate-50"
                  }`}
                >
                  {renderItem(item)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer: total + pagination */}
        {meta && meta.total > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
            <span className="text-xs text-slate-400">
              {meta.total} resultado{meta.total !== 1 ? "s" : ""}
            </span>
            {meta.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                >
                  Anterior
                </button>
                <span className="text-xs text-slate-500">
                  {page} / {meta.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={page >= meta.totalPages}
                  className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        )}

        {/* Confirm button for multi-select */}
        {showConfirmButton && (
          <div className="border-t border-slate-200 px-5 py-3">
            <button
              type="button"
              onClick={() => { onConfirm?.(); onClose(); }}
              className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                selectedCount > 0
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-slate-100 text-slate-400 cursor-default"
              }`}
            >
              {selectedCount > 0
                ? `Confirmar ${selectedCount} selecionado${selectedCount !== 1 ? "s" : ""}`
                : "Selecione ao menos um item"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
