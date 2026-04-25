"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

/* ══════════════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════════════ */

interface SpedFileInfo {
  type: string;
  name: string;
  applicable: boolean;
  reason: string;
  deadline: string;
  note?: string;
}

interface SpedInfoResponse {
  taxRegime: string;
  cnae: string | null;
  fiscalProfile: string | null;
  files: SpedFileInfo[];
}

/* ══════════════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════════════ */

const MONTH_NAMES = ["", "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const REGIME_LABELS: Record<string, string> = {
  SN: "Simples Nacional",
  LP: "Lucro Presumido",
  LR: "Lucro Real",
};

/* ══════════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════════ */

export default function SpedPage() {
  const { toast } = useToast();
  const now = new Date();
  // Default to previous month (most common use case)
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [year, setYear] = useState(prevYear);
  const [month, setMonth] = useState(prevMonth);
  const [info, setInfo] = useState<SpedInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ type: string; content: string; lines: number } | null>(null);

  const fetchInfo = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<SpedInfoResponse>("/sped/info");
      setInfo(result);
    } catch {
      toast("Erro ao carregar informacoes SPED", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchInfo(); }, [fetchInfo]);

  const handlePrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const handleGenerate = async (fileType: string, previewMode: boolean) => {
    const endpoint = fileType === "EFD_ICMS_IPI"
      ? "/sped/efd-icms-ipi"
      : "/sped/efd-contribuicoes";

    setGenerating(fileType);
    try {
      if (previewMode) {
        const result = await api.get<{ content: string; lines: number }>(
          `${endpoint}?year=${year}&month=${month}&preview=true`
        );
        setPreview({ type: fileType, content: result.content, lines: result.lines });
      } else {
        // Download the file
        const response = await fetch(`/api${endpoint}?year=${year}&month=${month}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        if (!response.ok) {
          const err = await response.json().catch(() => null);
          throw new Error(err?.message || "Erro ao gerar arquivo");
        }
        const blob = await response.blob();
        const filename = fileType === "EFD_ICMS_IPI"
          ? `EFD_ICMS_IPI_${year}${String(month).padStart(2, "0")}.txt`
          : `EFD_CONTRIBUICOES_${year}${String(month).padStart(2, "0")}.txt`;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast(`Arquivo ${filename} gerado com sucesso!`, "success");
      }
    } catch (e: any) {
      toast(e.message || "Erro ao gerar arquivo SPED", "error");
    } finally {
      setGenerating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Geracao SPED</h1>
          <p className="text-sm text-slate-500 mt-1">
            Escrituracao Fiscal Digital — Gere os arquivos SPED para transmissao
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-lg font-bold text-slate-800 min-w-[180px] text-center">{MONTH_NAMES[month]}/{year}</span>
          <button onClick={handleNextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Regime Info */}
      {info && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-xl">
              <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-800">
                Regime Tributario: {REGIME_LABELS[info.taxRegime] || info.taxRegime}
              </p>
              {info.cnae && (
                <p className="text-xs text-blue-600 mt-0.5">CNAE: {info.cnae}</p>
              )}
              {info.fiscalProfile && (
                <p className="text-xs text-blue-600 mt-0.5">Perfil EFD: {info.fiscalProfile}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SPED Files Grid */}
      <div className="grid gap-6">
        {info?.files.map((file) => (
          <div
            key={file.type}
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
              file.applicable ? "border-slate-200" : "border-slate-100 opacity-60"
            }`}
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {/* Icon based on type */}
                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${
                      file.applicable
                        ? file.type === "EFD_ICMS_IPI"
                          ? "bg-emerald-100"
                          : file.type === "EFD_CONTRIBUICOES"
                            ? "bg-purple-100"
                            : "bg-orange-100"
                        : "bg-slate-100"
                    }`}>
                      <svg
                        className={`h-5 w-5 ${
                          file.applicable
                            ? file.type === "EFD_ICMS_IPI"
                              ? "text-emerald-600"
                              : file.type === "EFD_CONTRIBUICOES"
                                ? "text-purple-600"
                                : "text-orange-600"
                            : "text-slate-400"
                        }`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">{file.name}</h3>
                      <p className="text-sm text-slate-500">{file.reason}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Prazo: {file.deadline}
                    </span>
                    {file.applicable && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Obrigatorio
                      </span>
                    )}
                    {!file.applicable && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                        Dispensado
                      </span>
                    )}
                  </div>

                  {file.note && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mt-3">
                      {file.note}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                {file.applicable && file.type !== "DESTDA" && (
                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => handleGenerate(file.type, false)}
                      disabled={generating !== null}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {generating === file.type ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      ) : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      )}
                      Gerar e Baixar
                    </button>
                    <button
                      onClick={() => handleGenerate(file.type, true)}
                      disabled={generating !== null}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Visualizar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  {preview.type === "EFD_ICMS_IPI" ? "EFD ICMS/IPI" : "EFD-Contribuicoes"} — {MONTH_NAMES[month]}/{year}
                </h3>
                <p className="text-sm text-slate-500">{preview.lines} registros</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleGenerate(preview.type, false)}
                  disabled={generating !== null}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Baixar .txt
                </button>
                <button
                  onClick={() => setPreview(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-xs font-mono text-slate-700 bg-slate-50 rounded-xl p-4 whitespace-pre overflow-x-auto leading-5">
                {preview.content}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Instrucoes de uso</h3>
        <div className="space-y-2 text-sm text-slate-600">
          <p>1. Selecione o periodo (mes/ano) de referencia no seletor acima.</p>
          <p>2. Clique em <strong>Visualizar</strong> para conferir o conteudo antes de gerar.</p>
          <p>3. Clique em <strong>Gerar e Baixar</strong> para baixar o arquivo .txt.</p>
          <p>4. Importe o arquivo no <strong>PVA SPED</strong> (Programa Validador e Assinador) da Receita Federal.</p>
          <p>5. Valide, assine com certificado digital e transmita pelo PVA.</p>
        </div>
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          <strong>Importante:</strong> Os arquivos gerados sao um ponto de partida baseado nos dados importados no Tecnikos.
          Sempre valide no PVA e faca os ajustes necessarios com auxilio do seu contador antes da transmissao oficial.
        </div>
      </div>
    </div>
  );
}
