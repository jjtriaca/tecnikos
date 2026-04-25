"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { maskCep, maskCpf, toTitleCase, STATES } from "@/lib/brazil-utils";

interface SefazData {
  name: string;
  ie: string;
  ieStatus: string;
  cnae: string | null;
  regime: string | null;
  activityStartDate: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  neighborhood: string | null;
  city: string | null;
  cityCode: string | null;
  cep: string | null;
  state: string;
}

interface SefazImportModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: SefazData) => void;
  initialCpf?: string;
  initialIe?: string;
  initialUf?: string;
}

export default function SefazImportModal({
  open,
  onClose,
  onConfirm,
  initialCpf = "",
  initialIe = "",
  initialUf = "",
}: SefazImportModalProps) {
  const { toast } = useToast();
  const [cpf, setCpf] = useState(initialCpf);
  const [ie, setIe] = useState(initialIe);
  const [uf, setUf] = useState(initialUf);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SefazData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset when modal opens with new initial values
  function resetForm() {
    setCpf(initialCpf);
    setIe(initialIe);
    setUf(initialUf);
    setResult(null);
    setError(null);
  }

  async function handleImport() {
    const cpfDigits = cpf.replace(/\D/g, "");
    if (!uf) { toast("Selecione o estado (UF).", "warning"); return; }
    if (cpfDigits.length < 11 && !ie.replace(/\D/g, "")) {
      toast("Preencha o CPF ou a Inscrição Estadual.", "warning");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({ uf });
      if (cpfDigits.length >= 11) params.set("cpf", cpfDigits);
      else if (ie.replace(/\D/g, "")) params.set("ie", ie.replace(/\D/g, ""));

      const data = await api.get(`/partners/sefaz-lookup?${params}`) as SefazData;
      setResult(data);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Erro ao consultar SEFAZ. Tente novamente.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (!result) return;
    onConfirm(result);
    onClose();
  }

  if (!open) return null;

  const inputClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 w-full";
  const labelClass = "text-sm text-slate-600 text-right whitespace-nowrap";

  const statusColor = result?.ieStatus === "ATIVA"
    ? "text-green-700 bg-green-50 border-green-200"
    : result?.ieStatus === "INATIVA"
      ? "text-red-700 bg-red-50 border-red-200"
      : "text-amber-700 bg-amber-50 border-amber-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Importar dados da SEFAZ</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-4 border-b border-slate-200">
          <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">Filtros</p>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <span className={labelClass + " w-32"}>CNPJ / CPF:</span>
              <input
                value={cpf}
                onChange={(e) => setCpf(maskCpf(e.target.value))}
                placeholder="000.000.000-00"
                className={inputClass}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className={labelClass + " w-32"}>Insc. Estadual:</span>
              <input
                value={ie}
                onChange={(e) => setIe(e.target.value)}
                placeholder="Opcional"
                className={inputClass}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className={labelClass + " w-32"}>UF:</span>
              <select value={uf} onChange={(e) => setUf(e.target.value)} className={inputClass}>
                <option value="">Selecione...</option>
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={handleImport}
            disabled={loading || !uf}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" className="opacity-75" /></svg>
                Consultando...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Importar
              </>
            )}
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Dados Importados</p>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor}`}>
                  {result.ieStatus === "ATIVA" ? "IE Ativa" : result.ieStatus === "INATIVA" ? "IE Inativa" : "Não habilitado"}
                </span>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
                <Row label="Nome:" value={result.name ? toTitleCase(result.name) : "—"} />
                <Row label="Insc. Estadual:" value={result.ie || "—"} />
                <Row label="Situação:" value={result.ieStatus === "ATIVA" ? "Ativa" : result.ieStatus === "INATIVA" ? "Inativa" : "Não habilitado"} highlight={result.ieStatus !== "ATIVA"} />
                {result.cnae && <Row label="CNAE:" value={result.cnae} />}
                {result.regime && <Row label="Regime:" value={result.regime} />}
                {result.activityStartDate && <Row label="Início atividade:" value={result.activityStartDate} />}
                <div className="border-t border-slate-200 pt-2 mt-2" />
                <Row label="CEP:" value={result.cep ? maskCep(result.cep) : "—"} />
                <Row label="Endereço:" value={result.addressStreet ? toTitleCase(result.addressStreet) : "—"} />
                <Row label="Número:" value={result.addressNumber || "—"} />
                <Row label="Bairro:" value={result.neighborhood ? toTitleCase(result.neighborhood) : "—"} />
                <Row label="Cidade:" value={result.city ? toTitleCase(result.city) : "—"} />
                <Row label="UF:" value={result.state || "—"} />
              </div>
            </div>
          )}

          {!result && !error && !loading && (
            <div className="text-center py-8 text-sm text-slate-400">
              Preencha os filtros e clique em Importar para consultar os dados na SEFAZ.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-5 py-3">
          <p className="text-[11px] text-slate-400 mb-3">
            A SEFAZ não garante a integridade dos dados disponibilizados por este serviço. Verifique as informações antes de confirmar.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!result}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="text-slate-500 w-28 shrink-0 text-right">{label}</span>
      <span className={highlight ? "text-red-600 font-medium" : "text-slate-900"}>{value}</span>
    </div>
  );
}
