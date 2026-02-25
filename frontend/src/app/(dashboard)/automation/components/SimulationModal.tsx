"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { ACTION_TYPES } from "@/types/automation-blocks";

/* ═══════════════════════════════════════════════════════════════
   SIMULATION MODAL — Dry-run a rule against a real entity
   ═══════════════════════════════════════════════════════════════ */

interface SimulationResult {
  ruleId: string;
  ruleName: string;
  entityMatch: boolean;
  eventMatch: boolean;
  conditionsEvaluated: {
    field: string;
    operator: string;
    value: any;
    actual: any;
    passed: boolean;
  }[];
  actionsWouldExecute: { type: string; config?: any }[];
  result: 'WOULD_EXECUTE' | 'WOULD_SKIP';
}

interface Props {
  open: boolean;
  ruleId: string;
  ruleName: string;
  entityType: string;
  onClose: () => void;
}

export default function SimulationModal({ open, ruleId, ruleName, entityType, onClose }: Props) {
  const { toast } = useToast();
  const [entityId, setEntityId] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleSimulate = async () => {
    if (!entityId.trim()) {
      toast("Informe o ID da entidade", "error");
      return;
    }

    try {
      setSimulating(true);
      const res = await api.post<SimulationResult>(`/automations/${ruleId}/simulate`, {
        entityType,
        entityId: entityId.trim(),
      });
      setResult(res);
    } catch {
      toast("Erro ao simular automação", "error");
    } finally {
      setSimulating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Simular Automação</h2>
            <p className="text-sm text-slate-500">Teste a regra &quot;{ruleName}&quot; sem executar ações</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-b border-slate-100">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            ID da {entityType === 'SERVICE_ORDER' ? 'Ordem de Serviço' : 'Parceiro'} para testar
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="Cole o ID da entidade..."
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
            />
            <button
              onClick={handleSimulate}
              disabled={simulating}
              className="px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {simulating ? "Simulando..." : "🔬 Simular"}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {result ? (
            <div className="space-y-4">
              {/* Overall result */}
              <div className={`rounded-xl p-4 border-2 ${
                result.result === 'WOULD_EXECUTE'
                  ? 'bg-green-50 border-green-300'
                  : 'bg-red-50 border-red-300'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{result.result === 'WOULD_EXECUTE' ? '✅' : '⏭️'}</span>
                  <div>
                    <div className="text-sm font-bold">
                      {result.result === 'WOULD_EXECUTE'
                        ? 'Regra EXECUTARIA'
                        : 'Regra seria IGNORADA'
                      }
                    </div>
                    <div className="text-xs text-slate-600">
                      Entidade: {result.entityMatch ? '✅ match' : '❌ não match'} ·
                      Evento: {result.eventMatch ? '✅ match' : '❌ não match'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Conditions */}
              {result.conditionsEvaluated.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Condições Avaliadas</h3>
                  <div className="space-y-2">
                    {result.conditionsEvaluated.map((cond, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                          cond.passed
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <span className="text-lg">{cond.passed ? '✅' : '❌'}</span>
                        <div className="flex-1 text-xs">
                          <span className="font-medium">{cond.field}</span>
                          <span className="text-slate-500"> {cond.operator} </span>
                          <span className="font-medium">{String(cond.value)}</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Valor atual: <span className="font-mono">{String(cond.actual ?? 'undefined')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {result.actionsWouldExecute.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">
                    Ações que seriam executadas ({result.actionsWouldExecute.length})
                  </h3>
                  <div className="space-y-1">
                    {result.actionsWouldExecute.map((act, i) => {
                      const def = ACTION_TYPES.find((a) => a.id === act.type);
                      return (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 bg-violet-50 rounded-lg border border-violet-200">
                          <span className="text-sm">{def?.icon || '🎯'}</span>
                          <span className="text-xs font-medium text-violet-900">{def?.label || act.type}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-4xl mb-3 opacity-30">🔬</div>
              <p className="text-sm text-slate-400">
                Informe o ID de uma entidade e clique em Simular
              </p>
              <p className="text-xs text-slate-300 mt-1">
                A simulação avalia as condições sem executar nenhuma ação
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
