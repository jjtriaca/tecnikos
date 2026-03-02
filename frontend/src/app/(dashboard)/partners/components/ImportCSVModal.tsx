"use client";

import { useState, useRef } from "react";
import { parseCSV, parseXLSX, autoMapColumns, mapRowsToPartners, FIELD_LABELS } from "@/lib/csv-parser";
import { api } from "@/lib/api";

interface ImportCSVModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "select" | "preview" | "importing" | "result";

interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; name: string; message: string }[];
}

export default function ImportCSVModal({ open, onClose, onSuccess }: ImportCSVModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("select");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [partners, setPartners] = useState<Record<string, unknown>[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  function reset() {
    setStep("select");
    setFileName("");
    setHeaders([]);
    setMapping({});
    setPartners([]);
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setFileName(file.name);

    try {
      const isExcel = /\.xlsx?$/i.test(file.name);
      let parsed;

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        parsed = parseXLSX(buffer);
      } else {
        const text = await file.text();
        parsed = parseCSV(text);
      }

      if (parsed.rows.length === 0) {
        setError("Arquivo vazio ou formato inválido.");
        return;
      }

      setHeaders(parsed.headers);

      const autoMapping = autoMapColumns(parsed.headers);
      setMapping(autoMapping);

      const mapped = mapRowsToPartners(parsed.rows, autoMapping);
      setPartners(mapped);
      setStep("preview");
    } catch (err) {
      console.error("Parse error:", err);
      setError("Erro ao ler o arquivo. Verifique se é um CSV ou Excel válido.");
    }
  }

  async function handleImport() {
    setStep("importing");
    try {
      const res = await api.post<ImportResult>("/partners/import", { partners });
      setResult(res);
      setStep("result");
      if (res.created > 0) onSuccess();
    } catch {
      setError("Erro ao importar. Tente novamente.");
      setStep("preview");
    }
  }

  // Campos mapeados para exibição (com labels amigáveis)
  const mappedFields = Object.entries(mapping)
    .map(([csv, field]) => ({ csv, field, label: FIELD_LABELS[field] || field }));
  const unmappedHeaders = headers.filter((h) => !mapping[h]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Importar Parceiros</h2>
              <p className="text-xs text-slate-400">Excel (.xlsx) ou CSV exportado do Sankhya</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto max-h-[calc(85vh-140px)]">
          {/* ── Step 1: Select File ── */}
          {step === "select" && (
            <div className="space-y-5">
              <div
                className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all"
                onClick={() => fileRef.current?.click()}
              >
                <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                <p className="text-sm font-medium text-slate-700">Clique para selecionar o arquivo</p>
                <p className="text-xs text-slate-400 mt-1">Formatos aceitos: .xlsx, .xls, .csv, .txt</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,.CSV,.TXT,.xlsx,.xls,.XLSX,.XLS"
                className="hidden"
                onChange={handleFileChange}
              />
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
              )}
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === "preview" && (
            <div className="space-y-5">
              {/* File info */}
              <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3">
                <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{fileName}</p>
                  <p className="text-xs text-slate-400">{partners.length} parceiros encontrados</p>
                </div>
                <button onClick={reset} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Trocar arquivo</button>
              </div>

              {/* Mapped columns */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Colunas mapeadas ({mappedFields.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {mappedFields.map(({ csv, label }) => (
                    <span key={csv} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 border border-green-200 text-xs">
                      <span className="text-slate-500 max-w-[120px] truncate">{csv}</span>
                      <svg className="w-3 h-3 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                      <span className="font-medium text-green-700">{label}</span>
                    </span>
                  ))}
                </div>
                {unmappedHeaders.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
                      {unmappedHeaders.length} colunas ignoradas
                    </summary>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {unmappedHeaders.map((h) => (
                        <span key={h} className="px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-400">{h}</span>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {/* Preview table */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Preview (primeiros 5 registros)</h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">#</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Nome</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Documento</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Tipo</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Cidade/UF</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-500">Telefone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partners.slice(0, 5).map((p, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                          <td className="px-3 py-2 text-slate-800 font-medium max-w-[200px] truncate">{String(p.name || "—")}</td>
                          <td className="px-3 py-2 text-slate-600 font-mono">{String(p.document || "—")}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${p.personType === "PJ" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                              {String(p.personType)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-600">{[p.city, p.state].filter(Boolean).join("/") || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{String(p.phone || "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {partners.length > 5 && (
                  <p className="text-xs text-slate-400 mt-1.5">...e mais {partners.length - 5} registros</p>
                )}
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
              )}
            </div>
          )}

          {/* ── Step 3: Importing ── */}
          {step === "importing" && (
            <div className="flex flex-col items-center py-12 gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              <p className="text-sm text-slate-600">Importando {partners.length} parceiros...</p>
              <p className="text-xs text-slate-400">Isso pode levar alguns minutos para arquivos grandes.</p>
            </div>
          )}

          {/* ── Step 4: Result ── */}
          {step === "result" && result && (
            <div className="space-y-5">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{result.created}</p>
                  <p className="text-xs text-green-600 mt-1">Criados</p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
                  <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
                  <p className="text-xs text-amber-600 mt-1">Duplicados</p>
                </div>
                <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-center">
                  <p className="text-2xl font-bold text-red-700">{result.errors.length}</p>
                  <p className="text-xs text-red-600 mt-1">Erros</p>
                </div>
              </div>

              {result.created > 0 && (
                <div className="flex items-center gap-2 bg-green-50 rounded-xl px-4 py-3">
                  <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <p className="text-sm text-green-700">{result.created} parceiro(s) importado(s) com sucesso!</p>
                </div>
              )}

              {/* Error details */}
              {result.errors.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-700 mb-2">Detalhes dos erros</h3>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs bg-red-50 rounded-lg px-3 py-2">
                        <span className="text-red-400 shrink-0">Linha {err.row}:</span>
                        <span className="text-red-700 font-medium">{err.name}</span>
                        <span className="text-red-500">— {err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          {step === "preview" && (
            <>
              <button onClick={handleClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleImport}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-600/20 hover:shadow-lg transition-all"
              >
                Importar {partners.length} parceiros
              </button>
            </>
          )}
          {step === "result" && (
            <button
              onClick={handleClose}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-600/20 hover:shadow-lg transition-all"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
