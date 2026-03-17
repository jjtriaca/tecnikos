"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

export interface TechCandidate {
  id: string;
  name: string;
  phone: string;
  rating: number | null;
  specializations: string[];
}

interface TechReviewModalProps {
  open: boolean;
  orderId: string;
  orderCode: string;
  orderTitle: string;
  candidates: TechCandidate[];
  allowEdit: boolean;
  onDispatched: (dispatchData: any) => void;
  onClose: () => void;
}

export default function TechReviewModal({
  open,
  orderId,
  orderCode,
  orderTitle,
  candidates,
  allowEdit,
  onDispatched,
  onClose,
}: TechReviewModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [extraTechs, setExtraTechs] = useState<TechCandidate[]>([]);
  const [searchResults, setSearchResults] = useState<TechCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize selected with all candidates
  useEffect(() => {
    if (open) {
      setSelected(new Set(candidates.map((c) => c.id)));
      setSearch("");
      setExtraTechs([]);
      setSearchResults([]);
      setError(null);
    }
  }, [open, candidates]);

  // Search for additional technicians
  const handleSearch = useCallback(async (q: string) => {
    setSearch(q);
    if (!q.trim() || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get<{ data: any[] }>(`/partners?type=TECNICO&status=ATIVO&search=${encodeURIComponent(q.trim())}&limit=10`);
      const existingIds = new Set([...candidates.map(c => c.id), ...extraTechs.map(c => c.id)]);
      const results: TechCandidate[] = (res.data || [])
        .filter((p: any) => !existingIds.has(p.id))
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          phone: p.phone || "",
          rating: p.rating || null,
          specializations: p.specializations?.map((s: any) => s.specialization?.name || s.name || "") || [],
        }));
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [candidates, extraTechs]);

  const addTech = (tech: TechCandidate) => {
    setExtraTechs((prev) => [...prev, tech]);
    setSelected((prev) => new Set([...prev, tech.id]));
    setSearchResults((prev) => prev.filter((t) => t.id !== tech.id));
    setSearch("");
  };

  const toggleTech = (id: string) => {
    if (!allowEdit) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDispatch = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      setError("Selecione pelo menos um técnico");
      return;
    }
    setDispatching(true);
    setError(null);
    try {
      const result = await api.post<any>(`/service-orders/${orderId}/dispatch-notifications`, {
        technicianIds: ids,
      });
      onDispatched(result);
    } catch (err: any) {
      setError(err?.message || "Erro ao disparar notificações");
      setDispatching(false);
    }
  };

  if (!open) return null;

  const allTechs = [...candidates, ...extraTechs];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            👁️ Revisão de Técnicos
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            OS #{orderCode} — {orderTitle}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {/* Counter */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-600">
              {selected.size} técnico{selected.size !== 1 ? "s" : ""} selecionado{selected.size !== 1 ? "s" : ""}
            </span>
            {!allowEdit && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                Somente visualização
              </span>
            )}
          </div>

          {/* Tech list */}
          <div className="space-y-2">
            {allTechs.map((tech) => (
              <div
                key={tech.id}
                onClick={() => toggleTech(tech.id)}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  allowEdit ? "cursor-pointer hover:bg-slate-50" : ""
                } ${
                  selected.has(tech.id)
                    ? "border-blue-200 bg-blue-50/50"
                    : "border-slate-200 bg-white opacity-50"
                }`}
              >
                {/* Checkbox */}
                {allowEdit && (
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    selected.has(tech.id)
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "border-slate-300 bg-white"
                  }`}>
                    {selected.has(tech.id) && (
                      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800 text-sm truncate">{tech.name}</span>
                    {tech.rating !== null && tech.rating > 0 && (
                      <span className="text-xs text-amber-600 flex items-center gap-0.5">
                        ⭐ {tech.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {tech.phone && (
                      <span className="text-xs text-slate-500">📱 {tech.phone}</span>
                    )}
                  </div>
                  {tech.specializations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tech.specializations.map((s, i) => (
                        <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {allTechs.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                Nenhum técnico encontrado para esta OS
              </div>
            )}
          </div>

          {/* Search to add more techs */}
          {allowEdit && (
            <div className="mt-4">
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Buscar técnico para adicionar... ex: João Silva"
                  className="w-full border border-dashed border-slate-300 rounded-lg px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-40 overflow-y-auto">
                  {searchResults.map((tech) => (
                    <button
                      key={tech.id}
                      onClick={() => addTech(tech)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors flex items-center gap-2"
                    >
                      <span className="text-green-500 text-sm">＋</span>
                      <span className="text-sm text-slate-700">{tech.name}</span>
                      {tech.phone && <span className="text-xs text-slate-400">({tech.phone})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 py-2">
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-1.5">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 flex gap-3">
          <button
            onClick={onClose}
            disabled={dispatching}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleDispatch}
            disabled={dispatching || selected.size === 0}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {dispatching ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Disparando...
              </>
            ) : (
              <>🚀 Disparar Notificações</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
