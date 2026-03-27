"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { CashAccount, BankStatementImport, BankStatementLine, StatementLineStatus } from "@/types/finance";

/* ── Helpers ────────────────────────────────────────────── */

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ── Actions Dropdown ──────────────────────────────────── */

function LineActionsDropdown({
  line,
  onConciliar,
  onIgnore,
  onUnignore,
  onUnmatch,
}: {
  line: BankStatementLine;
  onConciliar: () => void;
  onIgnore: () => void;
  onUnignore: () => void;
  onUnmatch: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 168) });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [open]);

  return (
    <div ref={wrapperRef}>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-slate-300 px-2 py-1 text-sm font-bold text-slate-700 hover:bg-slate-100"
      >
        &#x22EF;
      </button>
      {open && pos && (
        <div
          className="fixed z-50 min-w-[168px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-left"
          style={{ top: pos.top, left: pos.left }}
        >
          {line.status === "UNMATCHED" && (
            <>
              <button
                onClick={() => { setOpen(false); onConciliar(); }}
                className="block w-full text-left px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
              >
                Conciliar
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                onClick={() => { setOpen(false); onIgnore(); }}
                className="block w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
              >
                Ignorar
              </button>
            </>
          )}
          {line.status === "MATCHED" && (
            <button
              onClick={() => { setOpen(false); onUnmatch(); }}
              className="block w-full text-left px-3 py-2 text-sm text-amber-600 hover:bg-amber-50"
            >
              Desfazer conciliacao
            </button>
          )}
          {line.status === "IGNORED" && (
            <button
              onClick={() => { setOpen(false); onUnignore(); }}
              className="block w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
            >
              Restaurar (desfazer ignorar)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Conciliation Modal ───────────────────────────────── */

function ConciliationModal({
  open,
  line,
  onClose,
  onMatched,
}: {
  open: boolean;
  line: BankStatementLine | null;
  onClose: () => void;
  onMatched: () => void;
}) {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !line) return;
    setLoading(true);
    // Search for matching financial entries by approximate value
    const amountAbs = Math.abs(line.amountCents);
    const type = line.amountCents >= 0 ? "RECEIVABLE" : "PAYABLE";
    api.get<any>(`/finance/entries?status=PENDING&type=${type}&minValue=${(amountAbs - 100) / 100}&maxValue=${(amountAbs + 100) / 100}&limit=20`)
      .then((res) => {
        setCandidates(res.data || []);
      })
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, [open, line]);

  async function handleMatch(entryId: string) {
    if (!line) return;
    setMatching(entryId);
    try {
      await api.post(`/finance/reconciliation/lines/${line.id}/match`, { entryId });
      toast("Conciliado com sucesso!", "success");
      onMatched();
    } catch (err: any) {
      toast(err?.response?.data?.message || "Erro ao conciliar.", "error");
    } finally {
      setMatching(null);
    }
  }

  if (!open || !line) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">Conciliar Transacao</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {line.description} — <span className={line.amountCents >= 0 ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
              {formatCurrency(line.amountCents)}
            </span>
            {" "}em {formatDate(line.transactionDate)}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <p className="text-xs font-medium text-slate-500 mb-2">
            Lancamentos financeiros compativeis ({line.amountCents >= 0 ? "A Receber" : "A Pagar"}):
          </p>
          {loading ? (
            <div className="text-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center">
              <p className="text-xs text-slate-400">Nenhum lancamento compativel encontrado.</p>
              <p className="text-[10px] text-slate-400 mt-1">Verifique se existe um lancamento pendente com valor proximo.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{entry.code} — {entry.description}</p>
                    <p className="text-xs text-slate-400">{entry.partner?.name || "—"} • Venc: {formatDate(entry.dueDate)}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    <span className="text-sm font-semibold text-slate-800">{formatCurrency(entry.type === "RECEIVABLE" ? entry.grossCents : entry.netCents)}</span>
                    <button
                      onClick={() => handleMatch(entry.id)}
                      disabled={!!matching}
                      className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                    >
                      {matching === entry.id ? "..." : "Conciliar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_CONFIG: Record<StatementLineStatus, { label: string; color: string; bg: string; border: string }> = {
  UNMATCHED: { label: "Pendente", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  MATCHED: { label: "Conciliado", color: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
  IGNORED: { label: "Ignorado", color: "text-slate-500", bg: "bg-slate-50", border: "border-slate-200" },
};

/* ══════════════════════════════════════════════════════════
   RECONCILIATION TAB
   ══════════════════════════════════════════════════════════ */

export default function ReconciliationTab() {
  return (
    <div className="space-y-8">
      <ImportSection />
      <ImportsHistorySection />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SECTION 1: IMPORT
   ══════════════════════════════════════════════════════════ */

function ImportSection() {
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    api.get<CashAccount[]>("/finance/cash-accounts/active")
      .then(setAccounts)
      .catch(() => {});
  }, []);

  async function handleFileUpload(file: File) {
    if (!selectedAccountId) {
      toast("Selecione uma conta antes de importar.", "error");
      return;
    }

    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".ofx") && !ext.endsWith(".csv")) {
      toast("Formato invalido. Use arquivos .OFX ou .CSV.", "error");
      return;
    }

    setUploading(true);
    try {
      const content = await file.text();
      const result = await api.post<{ lineCount: number; skippedDuplicates: number }>(
        "/finance/reconciliation/import",
        {
          cashAccountId: selectedAccountId,
          fileName: file.name,
          fileContent: content,
        },
      );
      toast(
        `Importacao concluida! ${result.lineCount} transacao(es) importada(s)${result.skippedDuplicates > 0 ? `, ${result.skippedDuplicates} duplicada(s) ignorada(s)` : ""}.`,
        "success",
      );
      // Trigger reload of imports list by re-rendering
      window.dispatchEvent(new CustomEvent("reconciliation-imported"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao importar arquivo.";
      toast(msg, "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Importar Extrato</h3>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-600 mb-1">Conta *</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">Selecione a conta...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type === "CAIXA" ? "Caixa" : "Banco"})
                </option>
              ))}
            </select>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".ofx,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !selectedAccountId}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Importando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Importar OFX/CSV
                </>
              )}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Formatos aceitos: OFX (Open Financial Exchange) e CSV (com colunas Data, Descricao, Valor).
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SECTION 2: IMPORTS HISTORY + LINES
   ══════════════════════════════════════════════════════════ */

function ImportsHistorySection() {
  const [imports, setImports] = useState<BankStatementImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImport, setSelectedImport] = useState<BankStatementImport | null>(null);

  const loadImports = useCallback(async () => {
    try {
      const result = await api.get<BankStatementImport[]>("/finance/reconciliation/imports");
      setImports(result);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImports();
    // Listen for new imports
    const handler = () => { loadImports(); };
    window.addEventListener("reconciliation-imported", handler);
    return () => window.removeEventListener("reconciliation-imported", handler);
  }, [loadImports]);

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Importacoes</h3>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : imports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <div className="text-3xl mb-2">🔄</div>
          <p className="text-sm text-slate-500">Nenhuma importacao realizada.</p>
          <p className="text-xs text-slate-400 mt-1">Importe um extrato OFX ou CSV para iniciar a conciliacao.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {imports.map((imp) => (
            <div
              key={imp.id}
              onClick={() => setSelectedImport(selectedImport?.id === imp.id ? null : imp)}
              className={`rounded-xl border bg-white p-4 shadow-sm cursor-pointer transition-colors hover:shadow-md ${
                selectedImport?.id === imp.id ? "border-blue-400 ring-1 ring-blue-200" : "border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{imp.fileName}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                      imp.fileType === "OFX"
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                      {imp.fileType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>{formatDateTime(imp.importedAt)}</span>
                    <span>por {imp.importedByName}</span>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-medium text-slate-700">{imp.matchedCount}/{imp.lineCount}</p>
                  <p className="text-[10px] text-slate-400">conciliados</p>
                  {imp.lineCount > 0 && (
                    <div className="mt-1 h-1.5 w-20 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{ width: `${(imp.matchedCount / imp.lineCount) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lines detail */}
      {selectedImport && (
        <div className="mt-4">
          <LinesDetail importData={selectedImport} />
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   LINES DETAIL VIEW
   ══════════════════════════════════════════════════════════ */

function LinesDetail({ importData }: { importData: BankStatementImport }) {
  const [lines, setLines] = useState<BankStatementLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [matchLine, setMatchLine] = useState<BankStatementLine | null>(null);
  const { toast } = useToast();

  const loadLines = useCallback(async () => {
    try {
      setLoading(true);
      const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const result = await api.get<BankStatementLine[]>(
        `/finance/reconciliation/imports/${importData.id}/lines${qs}`,
      );
      setLines(result);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [importData.id, statusFilter]);

  useEffect(() => {
    loadLines();
  }, [loadLines]);

  async function handleIgnore(lineId: string) {
    setActionLoading(lineId);
    try {
      await api.post(`/finance/reconciliation/lines/${lineId}/ignore`);
      toast("Linha ignorada.", "success");
      await loadLines();
    } catch {
      toast("Erro ao ignorar linha.", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnignore(lineId: string) {
    setActionLoading(lineId);
    try {
      await api.post(`/finance/reconciliation/lines/${lineId}/unignore`);
      toast("Linha restaurada.", "success");
      await loadLines();
    } catch {
      toast("Erro ao restaurar linha.", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnmatch(lineId: string) {
    setActionLoading(lineId);
    try {
      await api.post(`/finance/reconciliation/lines/${lineId}/unmatch`);
      toast("Conciliacao desfeita.", "success");
      await loadLines();
    } catch {
      toast("Erro ao desfazer conciliacao.", "error");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-700">
          Transacoes — {importData.fileName}
        </h4>
        <div className="flex gap-1">
          {(["all", "UNMATCHED", "MATCHED", "IGNORED"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === f
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f === "all" ? "Todas" : STATUS_CONFIG[f as StatementLineStatus].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
          ))}
        </div>
      ) : lines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <p className="text-sm text-slate-400">
            {statusFilter !== "all" ? "Nenhuma transacao com este status." : "Nenhuma transacao nesta importacao."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="py-3 px-4 text-xs font-semibold uppercase text-slate-600 text-left">Data</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase text-slate-600 text-left">Descricao</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase text-slate-600 text-right">Valor</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase text-slate-600 text-center">Status</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase text-slate-600 text-center w-[120px]">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const cfg = STATUS_CONFIG[line.status];
                return (
                  <tr key={line.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{formatDate(line.transactionDate)}</td>
                    <td className="py-3 px-4 text-slate-700 truncate max-w-[300px]" title={line.description}>
                      {line.description}
                      {line.fitId && <span className="ml-1 text-[10px] text-slate-400">[{line.fitId}]</span>}
                    </td>
                    <td className={`py-3 px-4 text-right font-semibold ${line.amountCents >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {formatCurrency(line.amountCents)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {actionLoading === line.id ? (
                        <span className="text-xs text-slate-400 animate-pulse">...</span>
                      ) : (
                        <LineActionsDropdown
                          line={line}
                          onConciliar={() => setMatchLine(line)}
                          onIgnore={() => handleIgnore(line.id)}
                          onUnignore={() => handleUnignore(line.id)}
                          onUnmatch={() => handleUnmatch(line.id)}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Conciliation Modal */}
      <ConciliationModal
        open={!!matchLine}
        line={matchLine}
        onClose={() => setMatchLine(null)}
        onMatched={() => { setMatchLine(null); loadLines(); }}
      />
    </div>
  );
}
