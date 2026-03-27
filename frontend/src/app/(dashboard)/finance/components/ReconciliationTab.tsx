"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { CashAccount, BankStatementImport, BankStatementLine, StatementLineStatus } from "@/types/finance";
import DraggableHeader from "@/components/ui/DraggableHeader";
import { useTableLayout } from "@/hooks/useTableLayout";
import type { ColumnDefinition } from "@/lib/types/table";

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

const CARD_KEYWORDS = ["MASTER", "VISA", "ELO", "SICREDI DEBITO", "CREDITO", "DEBITO", "MASTERCARD", "HIPERCARD", "AMEX"];

function isCardTransaction(description: string): boolean {
  const upper = description.toUpperCase();
  return CARD_KEYWORDS.some((kw) => upper.includes(kw));
}

/** Check if two amounts match within 1 cent tolerance */
function amountsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1;
}

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
  const [cardFeeRates, setCardFeeRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Card transaction breakdown state
  const [liquidCents, setLiquidCents] = useState(0);
  const [taxCents, setTaxCents] = useState(0);
  const [detectedBrand, setDetectedBrand] = useState("");
  const [detectedType, setDetectedType] = useState("");

  const isCard = line ? isCardTransaction(line.description) : false;

  // Detect brand from description
  function detectCardBrand(desc: string): { brand: string; type: string } {
    const upper = desc.toUpperCase();
    let brand = "";
    if (upper.includes("MASTER")) brand = "MASTERCARD";
    else if (upper.includes("VISA")) brand = "VISA";
    else if (upper.includes("ELO")) brand = "ELO";
    else if (upper.includes("HIPER")) brand = "HIPERCARD";
    else if (upper.includes("AMEX")) brand = "AMEX";
    else brand = "OUTRO";

    let type = "CREDITO";
    if (upper.includes("DEBITO") || upper.includes("DEBIT")) type = "DEBITO";

    return { brand, type };
  }

  useEffect(() => {
    if (!open || !line) return;
    setSearch("");
    setLoading(true);

    const isCardTx = isCardTransaction(line.description);

    // For card transactions, detect brand and fetch fee rates
    if (isCardTx) {
      const { brand, type: cardType } = detectCardBrand(line.description);
      setDetectedBrand(brand);
      setDetectedType(cardType);
      setLiquidCents(Math.abs(line.amountCents));
      setTaxCents(0);
    }

    // Fetch entries, card fee rates in parallel
    const type = line.amountCents >= 0 ? "RECEIVABLE" : "PAYABLE";
    Promise.all([
      api.get<any>(`/finance/entries?status=PAID&type=${type}&limit=50`).catch(() => ({ data: [] })),
      api.get<any>(`/finance/entries?status=PENDING&type=${type}&limit=50`).catch(() => ({ data: [] })),
      isCardTx ? api.get<any[]>("/finance/card-fee-rates").catch(() => []) : Promise.resolve([]),
    ])
      .then(([paidRes, pendingRes, feeRates]) => {
        const paid = (paidRes.data || paidRes || []).map((e: any) => ({ ...e, _fromStatus: "PAID" }));
        const pending = (pendingRes.data || pendingRes || []).map((e: any) => ({ ...e, _fromStatus: "PENDING" }));
        const map = new Map<string, any>();
        [...paid, ...pending].forEach((e) => { if (!map.has(e.id)) map.set(e.id, e); });
        setCandidates(Array.from(map.values()));
        setCardFeeRates(feeRates || []);

        // Auto-calculate tax from fee rates if card
        if (isCardTx && feeRates && feeRates.length > 0) {
          const { brand, type: cardType } = detectCardBrand(line.description);
          const rate = (feeRates as any[]).find((r: any) =>
            r.brand?.toUpperCase() === brand.toUpperCase() &&
            r.type?.toUpperCase() === cardType.toUpperCase() &&
            r.isActive
          );
          if (rate) {
            const bankAmount = Math.abs(line.amountCents);
            // Bank deposited = bruto * (1 - fee/100), so bruto = deposited / (1 - fee/100)
            const feePercent = rate.feePercent || 0;
            const bruto = Math.round(bankAmount / (1 - feePercent / 100));
            const tax = bruto - bankAmount;
            setLiquidCents(bankAmount);
            setTaxCents(tax);
          }
        }
      })
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, [open, line]);

  /** Get the display amount for an entry (what would appear in the bank) */
  function entryDisplayAmount(entry: any): number {
    if (entry.type === "RECEIVABLE") {
      // For receivables, bank shows net (after deductions) or gross
      return entry.netCents || entry.grossCents;
    }
    return entry.netCents || entry.grossCents;
  }

  /** Sort candidates: exact matches first, then by date proximity */
  function getSortedCandidates() {
    if (!line) return candidates;
    const lineAbs = Math.abs(line.amountCents);

    let filtered = candidates;
    if (search.trim()) {
      const terms = search.toLowerCase().trim().split(/\s+/);
      filtered = candidates.filter((e) => {
        const haystack = `${e.code || ""} ${e.description || ""} ${e.partner?.name || ""}`.toLowerCase();
        return terms.every((t) => haystack.includes(t));
      });
    }

    return [...filtered].sort((a, b) => {
      const aAmt = entryDisplayAmount(a);
      const bAmt = entryDisplayAmount(b);
      const aExact = amountsMatch(aAmt, lineAbs) ? 0 : 1;
      const bExact = amountsMatch(bAmt, lineAbs) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      // Then by amount difference
      return Math.abs(aAmt - lineAbs) - Math.abs(bAmt - lineAbs);
    });
  }

  async function handleMatch(entryId: string) {
    if (!line) return;
    setMatching(entryId);
    try {
      const body: any = { entryId };
      if (isCard && (liquidCents > 0 || taxCents > 0)) {
        body.liquidCents = liquidCents;
        body.taxCents = taxCents;
      }
      await api.post(`/finance/reconciliation/lines/${line.id}/match`, body);
      toast("Conciliado com sucesso!", "success");
      onMatched();
    } catch (err: any) {
      toast(err?.response?.data?.message || "Erro ao conciliar.", "error");
    } finally {
      setMatching(null);
    }
  }

  if (!open || !line) return null;

  const lineAbs = Math.abs(line.amountCents);
  const sorted = getSortedCandidates();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-800">Conciliar Transacao</h3>
            {isCard && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                Cartao
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {line.description} — <span className={line.amountCents >= 0 ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
              {formatCurrency(line.amountCents)}
            </span>
            {" "}em {formatDate(line.transactionDate)}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {/* Card breakdown section */}
          {isCard && (
            <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-purple-800">Detalhamento Cartao</p>
                {detectedBrand && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
                    {detectedBrand} {detectedType}
                  </span>
                )}
                {taxCents > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                    Taxa: {((taxCents / (liquidCents + taxCents)) * 100).toFixed(2)}%
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">Valor Liquido (depositado)</label>
                  <input
                    type="text"
                    value={(liquidCents / 100).toFixed(2).replace(".", ",")}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value.replace(",", ".")) || 0;
                      const cents = Math.round(val * 100);
                      setLiquidCents(cents);
                      // Recalculate tax if we have a bruto reference
                      const bruto = liquidCents + taxCents;
                      if (bruto > 0) setTaxCents(Math.max(0, bruto - cents));
                    }}
                    className="w-full rounded-lg border border-purple-300 px-2.5 py-1.5 text-sm font-semibold text-green-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">Taxa do Cartao</label>
                  <input
                    type="text"
                    value={(taxCents / 100).toFixed(2).replace(".", ",")}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value.replace(",", ".")) || 0;
                      setTaxCents(Math.round(val * 100));
                    }}
                    className="w-full rounded-lg border border-purple-300 px-2.5 py-1.5 text-sm font-semibold text-amber-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">Valor Bruto Original</label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-semibold text-slate-800">
                    {formatCurrency(liquidCents + taxCents)}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-purple-600 mt-2">
                O valor liquido deve corresponder ao valor do extrato ({formatCurrency(lineAbs)}). Ajuste a taxa se necessario.
              </p>
            </div>
          )}

          {/* Search bar */}
          <div className="mb-3">
            <input
              type="text"
              placeholder="Buscar lancamento por codigo, descricao ou parceiro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          <p className="text-xs font-medium text-slate-500 mb-2">
            Lancamentos financeiros ({line.amountCents >= 0 ? "A Receber" : "A Pagar"}) — PAGOS e PENDENTES:
          </p>
          {loading ? (
            <div className="text-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center">
              <p className="text-xs text-slate-400">Nenhum lancamento compativel encontrado.</p>
              <p className="text-[10px] text-slate-400 mt-1">Verifique se existe um lancamento com valor proximo.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((entry: any) => {
                const amt = entryDisplayAmount(entry);
                const isExactMatch = amountsMatch(amt, isCard ? (liquidCents + taxCents) : lineAbs);
                const isPending = entry.status === "PENDING" || entry._fromStatus === "PENDING";
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-slate-50 transition-colors ${
                      isExactMatch
                        ? "border-green-400 bg-green-50/50 ring-1 ring-green-200"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-700 truncate">{entry.code} — {entry.description}</p>
                        {isExactMatch && (
                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700 border border-green-300 whitespace-nowrap">
                            Sugerido
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                            Pendente
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {entry.partner?.name || "—"} • Venc: {formatDate(entry.dueDate)}
                        {entry.paymentMethod && <span className="ml-1 text-slate-500">• {entry.paymentMethod.replace(/_/g, " ")}</span>}
                        {entry.cardBrand && <span className="ml-1 px-1 py-0.5 rounded bg-purple-100 text-purple-700 text-[9px] font-medium">{entry.cardBrand}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <div className="text-right">
                        <span className="text-sm font-semibold text-slate-800">{formatCurrency(amt)}</span>
                        {isCard && entry.grossCents !== amt && (
                          <p className="text-[10px] text-slate-400">Bruto: {formatCurrency(entry.grossCents)}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleMatch(entry.id)}
                        disabled={!!matching}
                        className={`px-3 py-1 text-xs font-medium text-white rounded-lg disabled:opacity-50 ${
                          isExactMatch
                            ? "bg-green-600 hover:bg-green-700"
                            : "bg-blue-600 hover:bg-blue-700"
                        }`}
                      >
                        {matching === entry.id ? "..." : "Conciliar"}
                      </button>
                    </div>
                  </div>
                );
              })}
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

  const RECON_COLUMNS: ColumnDefinition<BankStatementLine>[] = [
    { id: "actions", label: "Ações", render: () => null as any },
    { id: "date", label: "Data", sortable: true, render: (l) => <span className="text-slate-700 whitespace-nowrap">{formatDate(l.transactionDate)}</span> },
    { id: "description", label: "Descrição", render: (l) => (
      <span className="text-slate-700 truncate block max-w-[300px]" title={l.description}>
        {l.description}
        {l.fitId && <span className="ml-1 text-[10px] text-slate-400">[{l.fitId}]</span>}
      </span>
    )},
    { id: "value", label: "Valor", sortable: true, align: "right", render: (l) => (
      <span className={`font-semibold ${l.amountCents >= 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(l.amountCents)}</span>
    )},
    { id: "status", label: "Status", align: "center", render: (l) => {
      const c = STATUS_CONFIG[l.status];
      return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.color} border ${c.border}`}>{c.label}</span>;
    }},
  ];

  const { orderedColumns, reorderColumns } = useTableLayout("reconciliation-lines", RECON_COLUMNS);

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

  const [unmatchLine, setUnmatchLine] = useState<BankStatementLine | null>(null);
  const [unmatchLoading, setUnmatchLoading] = useState(false);

  async function confirmUnmatch() {
    if (!unmatchLine) return;
    setUnmatchLoading(true);
    try {
      await api.post(`/finance/reconciliation/lines/${unmatchLine.id}/unmatch`);
      toast("Conciliacao desfeita. Saldos revertidos.", "success");
      setUnmatchLine(null);
      await loadLines();
    } catch {
      toast("Erro ao desfazer conciliacao.", "error");
    } finally {
      setUnmatchLoading(false);
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
                {orderedColumns.map((col, idx) => (
                  <DraggableHeader
                    key={col.id}
                    index={idx}
                    columnId={col.id}
                    onReorder={reorderColumns}
                  >
                    <div className={`py-3 px-4 text-xs font-semibold uppercase text-slate-600 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""}`}>
                      {col.label}
                    </div>
                  </DraggableHeader>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  {orderedColumns.map((col) => (
                    <td key={col.id} className={`py-3 px-4 text-sm ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}>
                      {col.id === "actions" ? (
                        actionLoading === line.id ? (
                          <span className="text-xs text-slate-400 animate-pulse">...</span>
                        ) : (
                          <LineActionsDropdown
                            line={line}
                            onConciliar={() => setMatchLine(line)}
                            onIgnore={() => handleIgnore(line.id)}
                            onUnignore={() => handleUnignore(line.id)}
                            onUnmatch={() => setUnmatchLine(line)}
                          />
                        )
                      ) : col.render ? col.render(line) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Unmatch Confirmation Modal */}
      {unmatchLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-amber-700">Desfazer Conciliacao</h3>
              <p className="text-xs text-slate-500 mt-1">Tem certeza que deseja desfazer a conciliacao desta transacao?</p>
            </div>
            <div className="px-5 py-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                <p className="text-sm font-medium text-slate-800 truncate">{unmatchLine.description}</p>
                <p className="text-xs text-slate-500">{formatDate(unmatchLine.transactionDate)}</p>
                <p className={`text-sm font-bold ${unmatchLine.amountCents >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {formatCurrency(unmatchLine.amountCents)}
                </p>
              </div>
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Acoes que serao revertidas:</p>
                <ul className="text-xs text-slate-600 space-y-1">
                  <li>• Transferencia automatica sera desfeita</li>
                  <li>• Saldo do banco sera decrementado</li>
                  <li>• Valor retorna para Valores em Transito</li>
                  <li>• Lancamento volta para conta original</li>
                </ul>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setUnmatchLine(null)} disabled={unmatchLoading}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
                Cancelar
              </button>
              <button onClick={confirmUnmatch} disabled={unmatchLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50">
                {unmatchLoading ? "Desfazendo..." : "Confirmar"}
              </button>
            </div>
          </div>
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
