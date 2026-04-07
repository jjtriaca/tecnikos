"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { FinancialEntry, Boleto } from "@/types/finance";

interface Props {
  entry: FinancialEntry;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BoletoGenerationModal({ entry, onClose, onSuccess }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [hasConfig, setHasConfig] = useState<boolean | null>(null);
  const [existingBoletos, setExistingBoletos] = useState<Boleto[]>([]);

  useEffect(() => {
    checkConfig();
    loadExisting();
  }, []);

  const checkConfig = async () => {
    try {
      const config = await api.get<any>("/boleto/config");
      setHasConfig(!!config?.bankCode);
    } catch {
      setHasConfig(false);
    }
  };

  const loadExisting = async () => {
    try {
      const boletos = await api.get<Boleto[]>(`/boleto/by-entry/${entry.id}`);
      setExistingBoletos(boletos || []);
    } catch {
      // ignore
    }
  };

  const handleGenerate = async (registerImmediately: boolean) => {
    setLoading(true);
    try {
      const result = await api.post<Boleto | Boleto[]>("/boleto/for-entry", {
        financialEntryId: entry.id,
        registerImmediately,
      });
      const count = Array.isArray(result) ? result.length : 1;
      toast(`${count} boleto(s) gerado(s) com sucesso`, "success");
      onSuccess();
    } catch (err: any) {
      toast(err?.message || "Erro ao gerar boleto", "error");
    } finally {
      setLoading(false);
    }
  };

  const formatCents = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const activeBoletos = existingBoletos.filter(
    (b) => !["CANCELLED", "REJECTED", "WRITTEN_OFF"].includes(b.status)
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Gerar Boleto</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Config check */}
          {hasConfig === false && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
              Configure o modulo de boleto em{" "}
              <a href="/settings/boleto" className="underline font-medium">
                Configuracoes &gt; Boleto Bancario
              </a>{" "}
              antes de emitir boletos.
            </div>
          )}

          {hasConfig === null && (
            <div className="animate-pulse h-16 bg-slate-100 rounded" />
          )}

          {hasConfig && (
            <>
              {/* Entry info */}
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Lancamento</span>
                  <span className="font-medium">{entry.code || entry.id.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Valor</span>
                  <span className="font-medium">{formatCents(entry.grossCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Parceiro</span>
                  <span>{entry.partner?.name || "—"}</span>
                </div>
                {entry.installments && entry.installments.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Parcelas</span>
                    <span>
                      {entry.installments.filter((i) => i.status === "PENDING").length} pendente(s) de{" "}
                      {entry.installments.length}
                    </span>
                  </div>
                )}
              </div>

              {/* Existing boletos warning */}
              {activeBoletos.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                  Ja existem {activeBoletos.length} boleto(s) ativo(s) para este lancamento.
                  Somente parcelas sem boleto serao geradas.
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleGenerate(true)}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Gerando..." : "Gerar e Registrar"}
                </button>
                <button
                  onClick={() => handleGenerate(false)}
                  disabled={loading}
                  className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Rascunho
                </button>
              </div>

              <p className="text-xs text-slate-400">
                "Gerar e Registrar" cria e envia o boleto ao banco imediatamente.
                "Rascunho" cria localmente para registro posterior.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
