"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

/* ═══════════════════════════════════════════════════════════════
   EXECUTION TIMELINE — Drawer with execution history for a rule
   ═══════════════════════════════════════════════════════════════ */

interface Execution {
  id: string;
  entityType: string;
  entityId: string;
  eventType: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  actionsExecuted?: { type: string; success?: boolean; result?: string }[];
  error?: string;
  executedAt: string;
}

interface PaginatedExec {
  data: Execution[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const STATUS_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  SUCCESS: { label: 'Sucesso',  icon: '✅', color: 'bg-green-100 text-green-800' },
  FAILED:  { label: 'Falha',    icon: '❌', color: 'bg-red-100 text-red-800' },
  SKIPPED: { label: 'Ignorada', icon: '⏭️', color: 'bg-slate-100 text-slate-600' },
};

interface Props {
  open: boolean;
  ruleId: string;
  ruleName: string;
  onClose: () => void;
}

export default function ExecutionTimeline({ open, ruleId, ruleName, onClose }: Props) {
  const { toast } = useToast();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadExecutions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<PaginatedExec>(`/automations/${ruleId}/executions?page=${page}&limit=20`);
      setExecutions(res.data);
      setTotalPages(res.meta.totalPages);
    } catch {
      toast("Erro ao carregar execuções", "error");
    } finally {
      setLoading(false);
    }
  }, [ruleId, page, toast]);

  useEffect(() => {
    if (open) loadExecutions();
  }, [open, loadExecutions]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white shadow-2xl flex flex-col h-full animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Histórico de Execuções</h2>
            <p className="text-sm text-slate-500 truncate">{ruleName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
            </div>
          ) : executions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3 opacity-30">📜</div>
              <p className="text-sm text-slate-400">Nenhuma execução registrada ainda.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200" />

              <div className="space-y-4">
                {executions.map((exec) => {
                  const statusCfg = STATUS_CONFIG[exec.status] || STATUS_CONFIG.SKIPPED;
                  const date = new Date(exec.executedAt);
                  const timeStr = date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

                  return (
                    <div key={exec.id} className="relative pl-10">
                      {/* Dot */}
                      <div className="absolute left-2.5 top-3 w-3 h-3 rounded-full bg-white border-2 border-slate-300" />

                      <div className="bg-white border border-slate-200 rounded-xl p-3 hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${statusCfg.color}`}>
                              {statusCfg.icon} {statusCfg.label}
                            </span>
                            <span className="text-[10px] text-slate-400">{exec.eventType}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{timeStr}</span>
                        </div>

                        <div className="text-xs text-slate-600">
                          <span className="font-medium">{exec.entityType}</span>
                          <span className="text-slate-400 ml-1 font-mono text-[10px]">
                            {exec.entityId.substring(0, 8)}...
                          </span>
                        </div>

                        {/* Actions executed */}
                        {exec.actionsExecuted && exec.actionsExecuted.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {exec.actionsExecuted.map((act, i) => (
                              <span
                                key={i}
                                className={`px-1.5 py-0.5 text-[10px] rounded border ${
                                  act.success !== false
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : 'bg-red-50 text-red-700 border-red-200'
                                }`}
                              >
                                {act.type}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Error */}
                        {exec.error && (
                          <div className="mt-2 text-[10px] text-red-600 bg-red-50 rounded px-2 py-1 border border-red-200">
                            {exec.error}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-center gap-2 shrink-0">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-100"
            >
              ← Anterior
            </button>
            <span className="text-xs text-slate-500">
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-100"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
