"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { CashAccount, BankStatement, BankStatementLine, StatementLineStatus } from "@/types/finance";
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
  onConciliarRefund,
  onIgnore,
  onUnignore,
  onUnmatch,
}: {
  line: BankStatementLine;
  onConciliar: () => void;
  onConciliarRefund: () => void;
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
              <button
                onClick={() => { setOpen(false); onConciliarRefund(); }}
                className="block w-full text-left px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50"
              >
                Conciliar como devolucao
                {line.suggestedPairLineId && (
                  <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">par detectado</span>
                )}
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
  const [configFeePercent, setConfigFeePercent] = useState(0);
  const [matchedRate, setMatchedRate] = useState<any>(null); // full CardFeeRate matched (id, feePercent, updatedAt, ...)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [manualOverride, setManualOverride] = useState(false);
  const [updatingRate, setUpdatingRate] = useState(false);

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
    setSelectedEntryId(null);
    setManualOverride(false);

    const isCardTx = isCardTransaction(line.description);
    const bankAmount = Math.abs(line.amountCents);

    // For card transactions, detect brand and fetch fee rates
    if (isCardTx) {
      const { brand, type: cardType } = detectCardBrand(line.description);
      setDetectedBrand(brand);
      setDetectedType(cardType);
      setLiquidCents(bankAmount);
      setTaxCents(0);
      setConfigFeePercent(0);
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
        const allCandidates = Array.from(map.values());
        setCandidates(allCandidates);
        setCardFeeRates(feeRates || []);

        // Card breakdown auto-setup
        if (isCardTx) {
          const { brand, type: cardType } = detectCardBrand(line.description);
          const rate = (feeRates as any[] || []).find((r: any) =>
            r.brand?.toUpperCase() === brand.toUpperCase() &&
            r.type?.toUpperCase() === cardType.toUpperCase() &&
            r.isActive
          );
          const configRate = rate?.feePercent || 0;
          setConfigFeePercent(configRate);
          setMatchedRate(rate || null);

          // Find best candidate: entry whose implied fee rate is closest to configured rate.
          // Implied rate = (entry.gross - bank.amount) / entry.gross * 100
          // This reflects what the card operator ACTUALLY withheld, not the theoretical value.
          let best: any = null;
          let bestScore = Infinity;
          for (const e of allCandidates) {
            const gross = e.grossCents || 0;
            if (gross <= bankAmount) continue;       // tax must be positive
            if (gross > bankAmount * 1.2) continue;  // reject entries with >20% implied fee (obviously not this one)
            const impliedRate = ((gross - bankAmount) / gross) * 100;
            const score = configRate > 0 ? Math.abs(impliedRate - configRate) : impliedRate;
            if (score < bestScore) {
              bestScore = score;
              best = e;
            }
          }

          // Auto-select best candidate if its implied rate is within 1.5% of configured rate.
          // This is the REAL fix: use the entry's gross as the source of truth, not the theoretical
          // bank.amount / (1 - configRate/100), which ignores the actual fee the operator charged.
          if (best && (configRate === 0 || bestScore <= 1.5)) {
            const realTax = best.grossCents - bankAmount;
            setLiquidCents(bankAmount);
            setTaxCents(realTax);
            setSelectedEntryId(best.id);
          } else if (configRate > 0) {
            // Fallback: no good candidate, use theoretical calc from configured rate
            const bruto = Math.round(bankAmount / (1 - configRate / 100));
            setLiquidCents(bankAmount);
            setTaxCents(bruto - bankAmount);
          }
        }
      })
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, [open, line]);

  /** Select a candidate entry: recompute breakdown from entry's gross (real fee). */
  function selectEntry(entry: any) {
    if (!line) return;
    const bank = Math.abs(line.amountCents);
    const gross = entry.grossCents || 0;
    if (gross <= 0) return;
    const tax = Math.max(0, gross - bank);
    setLiquidCents(bank);
    setTaxCents(tax);
    setSelectedEntryId(entry.id);
    setManualOverride(false);
  }

  /** Update the configured card fee rate to match the real implied rate. */
  async function updateConfiguredRate() {
    if (!matchedRate?.id) return;
    const bruto = liquidCents + taxCents;
    if (bruto <= 0 || taxCents <= 0) return;
    const newRate = Number(((taxCents / bruto) * 100).toFixed(4));
    if (!window.confirm(
      `Atualizar a taxa "${matchedRate.description || `${matchedRate.brand} ${matchedRate.type}`}" ` +
      `de ${matchedRate.feePercent.toFixed(2)}% para ${newRate.toFixed(2)}%?`
    )) return;
    setUpdatingRate(true);
    try {
      const updated = await api.patch<any>(`/finance/card-fee-rates/${matchedRate.id}`, {
        feePercent: newRate,
      });
      setMatchedRate(updated);
      setConfigFeePercent(updated.feePercent);
      toast(`Taxa atualizada para ${newRate.toFixed(2)}%`, "success");
    } catch (err: any) {
      toast(err?.response?.data?.message || "Erro ao atualizar taxa.", "error");
    } finally {
      setUpdatingRate(false);
    }
  }

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

    // Card transactions: sort by proximity of implied fee rate to configured rate.
    // This reflects the REAL fee the operator charged, not a theoretical value.
    if (isCard) {
      return [...filtered].sort((a, b) => {
        const aGross = a.grossCents || 0;
        const bGross = b.grossCents || 0;
        // Compute implied fee rate for each candidate (or 999 if invalid)
        const aImplied = aGross > lineAbs && aGross <= lineAbs * 1.2
          ? ((aGross - lineAbs) / aGross) * 100
          : 999;
        const bImplied = bGross > lineAbs && bGross <= lineAbs * 1.2
          ? ((bGross - lineAbs) / bGross) * 100
          : 999;
        // Score by distance to configured rate (or raw implied if no config)
        const aScore = configFeePercent > 0 ? Math.abs(aImplied - configFeePercent) : aImplied;
        const bScore = configFeePercent > 0 ? Math.abs(bImplied - configFeePercent) : bImplied;
        return aScore - bScore;
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
          {isCard && (() => {
            const bruto = liquidCents + taxCents;
            const realRate = bruto > 0 && taxCents > 0 ? (taxCents / bruto) * 100 : 0;
            const hasDivergence = configFeePercent > 0 && realRate > 0
              && Math.abs(realRate - configFeePercent) > 0.05;
            const rateUpdatedAt = matchedRate?.updatedAt ? new Date(matchedRate.updatedAt) : null;
            return (
              <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50/50 p-3">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <p className="text-xs font-semibold text-purple-800">Detalhamento Cartao</p>
                  {detectedBrand && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
                      {detectedBrand} {detectedType}
                    </span>
                  )}
                  {configFeePercent > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      hasDivergence ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"
                    }`}>
                      Config: {configFeePercent.toFixed(2)}%
                    </span>
                  )}
                  {realRate > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      hasDivergence ? "bg-red-100 text-red-700 border border-red-200" : "bg-green-100 text-green-700 border border-green-200"
                    }`}>
                      Real: {realRate.toFixed(2)}%
                    </span>
                  )}
                </div>

                {/* Divergence alert with last update + update button */}
                {hasDivergence && matchedRate?.id && (
                  <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 flex items-start gap-2">
                    <span className="text-amber-600 text-sm leading-none mt-0.5">&#9888;</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-amber-800">
                        Taxa real diverge da configurada em {Math.abs(realRate - configFeePercent).toFixed(2)} pontos.
                      </p>
                      {rateUpdatedAt && (
                        <p className="text-[10px] text-amber-700 mt-0.5">
                          Taxa cadastrada atualizada em {formatDateTime(rateUpdatedAt.toISOString())}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={updateConfiguredRate}
                      disabled={updatingRate}
                      className="text-[10px] font-semibold px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap"
                      title="Atualizar a taxa cadastrada para o valor real detectado"
                    >
                      {updatingRate ? "Salvando..." : `Atualizar para ${realRate.toFixed(2)}%`}
                    </button>
                  </div>
                )}

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
                        setManualOverride(true);
                        // Recalculate tax if we have a bruto reference
                        const currentBruto = liquidCents + taxCents;
                        if (currentBruto > 0) setTaxCents(Math.max(0, currentBruto - cents));
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
                        setManualOverride(true);
                      }}
                      className="w-full rounded-lg border border-purple-300 px-2.5 py-1.5 text-sm font-semibold text-amber-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1">Valor Bruto Original</label>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-semibold text-slate-800">
                      {formatCurrency(bruto)}
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-purple-600 mt-2">
                  {selectedEntryId
                    ? "Taxa calculada a partir do lancamento selecionado abaixo."
                    : `O valor liquido deve corresponder ao valor do extrato (${formatCurrency(lineAbs)}). Selecione o lancamento abaixo para calcular a taxa real.`}
                </p>
              </div>
            );
          })()}

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
                const isSelected = isCard && selectedEntryId === entry.id;
                const isPending = entry.status === "PENDING" || entry._fromStatus === "PENDING";
                return (
                  <div
                    key={entry.id}
                    onClick={() => isCard && selectEntry(entry)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-slate-50 transition-colors ${
                      isCard ? "cursor-pointer" : ""
                    } ${
                      isSelected
                        ? "border-blue-400 bg-blue-50/50 ring-1 ring-blue-200"
                        : isExactMatch
                        ? "border-green-400 bg-green-50/50 ring-1 ring-green-200"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-700 truncate">{entry.code} — {entry.description}</p>
                        {(isSelected || (!isCard && isExactMatch)) && (
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${
                            isSelected
                              ? "bg-blue-100 text-blue-700 border border-blue-300"
                              : "bg-green-100 text-green-700 border border-green-300"
                          }`}>
                            {isSelected ? "Selecionado" : "Sugerido"}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          // Card: always recompute breakdown from this entry's gross before matching
                          if (isCard && !manualOverride) selectEntry(entry);
                          handleMatch(entry.id);
                        }}
                        disabled={!!matching}
                        className={`px-3 py-1 text-xs font-medium text-white rounded-lg disabled:opacity-50 ${
                          isSelected || isExactMatch
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

/* ── Refund Pair Modal ────────────────────────────────── */

function RefundPairModal({
  open,
  line,
  allLines,
  onClose,
  onMatched,
}: {
  open: boolean;
  line: BankStatementLine | null;
  allLines: BankStatementLine[];
  onClose: () => void;
  onMatched: () => void;
}) {
  const { toast } = useToast();
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [matching, setMatching] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open && line) {
      setSelectedPairId(line.suggestedPairLineId || null);
      setNotes("");
      setSearch("");
    }
  }, [open, line]);

  if (!open || !line) return null;

  const lineAbs = Math.abs(line.amountCents);
  const wantPositive = line.amountCents < 0; // if this is a debit, we want a credit pair

  // Filter candidates: opposite sign, same absolute value (tolerance 1 cent), UNMATCHED
  const candidates = allLines
    .filter((l) => l.id !== line.id)
    .filter((l) => l.status === "UNMATCHED")
    .filter((l) => wantPositive ? l.amountCents > 0 : l.amountCents < 0)
    .filter((l) => Math.abs(Math.abs(l.amountCents) - lineAbs) <= 1)
    .filter((l) => {
      if (!search.trim()) return true;
      return l.description.toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => {
      // Suggested pair first, then by date proximity
      if (a.id === line.suggestedPairLineId) return -1;
      if (b.id === line.suggestedPairLineId) return 1;
      const aDays = Math.abs(new Date(a.transactionDate).getTime() - new Date(line.transactionDate).getTime());
      const bDays = Math.abs(new Date(b.transactionDate).getTime() - new Date(line.transactionDate).getTime());
      return aDays - bDays;
    });

  async function handleMatch() {
    if (!line || !selectedPairId) return;
    setMatching(true);
    try {
      await api.post(`/finance/reconciliation/lines/${line.id}/match-as-refund`, {
        pairedLineId: selectedPairId,
        notes: notes.trim() || undefined,
      });
      toast("Par de estorno conciliado! Lancamentos tecnicos criados.", "success");
      onMatched();
    } catch (err: any) {
      toast(err?.response?.data?.message || "Erro ao conciliar par.", "error");
    } finally {
      setMatching(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-800">Conciliar como devolucao (estorno)</h3>
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
              PIX indevido
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {line.description} — <span className={line.amountCents >= 0 ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
              {formatCurrency(line.amountCents)}
            </span>
            {" "}em {formatDate(line.transactionDate)}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="mb-3 rounded-lg border border-purple-200 bg-purple-50/50 p-3">
            <p className="text-xs text-purple-800">
              <strong>Como funciona:</strong> ao selecionar a linha par, o sistema cria automaticamente
              dois lancamentos tecnicos (1 Recebimento + 1 Devolucao) marcados como estorno,
              vinculados entre si. Efeito liquido no caixa: zero. Rastro contabil preservado.
            </p>
          </div>

          <div className="mb-3">
            <input
              type="text"
              placeholder="Buscar por descricao..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
            />
          </div>

          <p className="text-xs font-medium text-slate-500 mb-2">
            Linhas candidatas ({wantPositive ? "entradas" : "saidas"}) com mesmo valor:
          </p>

          {candidates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center">
              <p className="text-xs text-slate-400">Nenhuma linha compativel encontrada.</p>
              <p className="text-[10px] text-slate-400 mt-1">
                Precisa ser uma linha pendente, com sinal oposto e mesmo valor ({formatCurrency(lineAbs)}).
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => {
                const isSelected = selectedPairId === c.id;
                const isSuggested = c.id === line.suggestedPairLineId;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedPairId(c.id)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                      isSelected
                        ? "border-purple-400 bg-purple-50/70 ring-1 ring-purple-200"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-700 truncate">{c.description}</p>
                        {isSuggested && (
                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-300 whitespace-nowrap">
                            Par sugerido
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {formatDate(c.transactionDate)}
                      </p>
                    </div>
                    <div className="ml-3">
                      <span className={`text-sm font-semibold ${c.amountCents >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {formatCurrency(c.amountCents)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedPairId && (
            <div className="mt-3">
              <label className="block text-[10px] font-medium text-slate-500 mb-1">Observacao (opcional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Cliente pagou errado, devolvido conforme solicitado"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
              />
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={handleMatch}
            disabled={!selectedPairId || matching}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
          >
            {matching ? "Conciliando..." : "Conciliar par de estorno"}
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
      <StatementsSection />
    </div>
  );
}

const MONTH_NAMES_PT = [
  "", "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

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
                  {a.name} ({a.type === "BANCO" ? "Banco" : a.type === "TRANSITO" ? "Transito" : "Caixa"})
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
   SECTION 2: MONTHLY STATEMENTS + LINES
   ══════════════════════════════════════════════════════════ */

function StatementsSection() {
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatement, setSelectedStatement] = useState<BankStatement | null>(null);

  const loadStatements = useCallback(async () => {
    try {
      const result = await api.get<BankStatement[]>("/finance/reconciliation/statements");
      setStatements(result);
      // Keep the currently selected statement in sync with refreshed data (counts may change)
      setSelectedStatement((prev) => prev ? result.find((s) => s.id === prev.id) || null : null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatements();
    // Listen for new imports
    const handler = () => { loadStatements(); };
    window.addEventListener("reconciliation-imported", handler);
    return () => window.removeEventListener("reconciliation-imported", handler);
  }, [loadStatements]);

  // Group by account for display (account → list of statements ordered newest first)
  const byAccount = new Map<string, { accountName: string; statements: BankStatement[] }>();
  for (const s of statements) {
    const key = s.cashAccountId;
    if (!byAccount.has(key)) {
      byAccount.set(key, {
        accountName: s.cashAccount?.name || "Conta",
        statements: [],
      });
    }
    byAccount.get(key)!.statements.push(s);
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Extratos mensais</h3>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : statements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <div className="text-3xl mb-2">🔄</div>
          <p className="text-sm text-slate-500">Nenhum extrato importado.</p>
          <p className="text-xs text-slate-400 mt-1">Importe um OFX ou CSV para iniciar a conciliacao.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {[...byAccount.values()].map((group) => (
            <div key={group.statements[0].cashAccountId}>
              <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                {group.accountName}
              </h4>
              <div className="space-y-2">
                {group.statements.map((s) => {
                  const isSelected = selectedStatement?.id === s.id;
                  const pct = s.lineCount > 0 ? (s.matchedCount / s.lineCount) * 100 : 0;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedStatement(isSelected ? null : s)}
                      className={`rounded-xl border bg-white p-4 shadow-sm cursor-pointer transition-colors hover:shadow-md ${
                        isSelected ? "border-blue-400 ring-1 ring-blue-200" : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-900">
                              {MONTH_NAMES_PT[s.periodMonth]} / {s.periodYear}
                            </span>
                            {pct === 100 && (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
                                100% conciliado
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            {s.lastFileName && <span className="truncate max-w-[300px]">Ultimo arquivo: {s.lastFileName}</span>}
                            {s.lastImportAt && <span>{formatDateTime(s.lastImportAt)}</span>}
                            {s.lastImportByName && <span>por {s.lastImportByName}</span>}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-sm font-medium text-slate-700">{s.matchedCount}/{s.lineCount}</p>
                          <p className="text-[10px] text-slate-400">conciliados</p>
                          {s.lineCount > 0 && (
                            <div className="mt-1 h-1.5 w-20 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-green-500 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lines detail */}
      {selectedStatement && (
        <div className="mt-4">
          <LinesDetail statement={selectedStatement} onChanged={loadStatements} />
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   LINES DETAIL VIEW
   ══════════════════════════════════════════════════════════ */

function LinesDetail({ statement, onChanged }: { statement: BankStatement; onChanged?: () => void }) {
  const [lines, setLines] = useState<BankStatementLine[]>([]);
  const [allLinesForPair, setAllLinesForPair] = useState<BankStatementLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [matchLine, setMatchLine] = useState<BankStatementLine | null>(null);
  const [refundLine, setRefundLine] = useState<BankStatementLine | null>(null);
  const { toast } = useToast();

  const RECON_COLUMNS: ColumnDefinition<BankStatementLine>[] = [
    { id: "actions", label: "Ações", render: () => null as any },
    { id: "date", label: "Data", sortable: true, render: (l) => <span className="text-slate-700 whitespace-nowrap">{formatDate(l.transactionDate)}</span> },
    { id: "description", label: "Descrição", render: (l) => (
      <span className="text-[11px] text-slate-700 break-words block" title={l.description}>
        {l.description}
        {l.fitId && <span className="ml-1 text-[10px] text-slate-400">[{l.fitId}]</span>}
        {l.suggestedPairLineId && l.status === "UNMATCHED" && (
          <span className="ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-purple-100 text-purple-700 border border-purple-300 whitespace-nowrap align-middle">
            Possivel estorno
          </span>
        )}
        {l.isRefund && l.status === "MATCHED" && (
          <span className="ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-purple-100 text-purple-700 border border-purple-300 whitespace-nowrap align-middle">
            Estorno
          </span>
        )}
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
      const [result, allResult] = await Promise.all([
        api.get<BankStatementLine[]>(
          `/finance/reconciliation/statements/${statement.id}/lines${qs}`,
        ),
        statusFilter !== "all"
          ? api.get<BankStatementLine[]>(
              `/finance/reconciliation/statements/${statement.id}/lines`,
            )
          : Promise.resolve(null as any),
      ]);
      setLines(result);
      setAllLinesForPair(allResult || result);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [statement.id, statusFilter]);

  useEffect(() => {
    loadLines();
  }, [loadLines]);

  const refreshAll = useCallback(async () => {
    await loadLines();
    onChanged?.();
  }, [loadLines, onChanged]);

  async function handleIgnore(lineId: string) {
    setActionLoading(lineId);
    try {
      await api.post(`/finance/reconciliation/lines/${lineId}/ignore`);
      toast("Linha ignorada.", "success");
      await refreshAll();
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
      await refreshAll();
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
      await refreshAll();
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
          Transacoes — {MONTH_NAMES_PT[statement.periodMonth]} / {statement.periodYear}
          {statement.cashAccount?.name && (
            <span className="ml-2 text-xs font-normal text-slate-500">({statement.cashAccount.name})</span>
          )}
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
                            onConciliarRefund={() => setRefundLine(line)}
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
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                <p className="text-sm font-medium text-slate-800 truncate">{unmatchLine.description}</p>
                <p className="text-xs text-slate-500">{formatDate(unmatchLine.transactionDate)}</p>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-[10px] text-slate-500">Valor depositado</p>
                    <p className={`text-sm font-bold ${unmatchLine.amountCents >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {formatCurrency(unmatchLine.amountCents)}
                    </p>
                  </div>
                  {unmatchLine.matchedTaxCents > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500">Taxa cartao</p>
                      <p className="text-sm font-bold text-amber-600">
                        -{formatCurrency(unmatchLine.matchedTaxCents)}
                      </p>
                    </div>
                  )}
                  {unmatchLine.matchedLiquidCents > 0 && unmatchLine.matchedTaxCents > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500">Valor bruto</p>
                      <p className="text-sm font-bold text-slate-700">
                        {formatCurrency(unmatchLine.matchedLiquidCents + unmatchLine.matchedTaxCents)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Acoes que serao revertidas:</p>
                <ul className="text-xs text-slate-600 space-y-1">
                  <li>• Transferencia do banco sera revertida</li>
                  <li>• Saldo do banco sera decrementado em {formatCurrency(Math.abs(unmatchLine.amountCents))}</li>
                  <li>• Valor retorna para Valores em Transito</li>
                  <li>• Lancamento financeiro volta para conta original</li>
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
        onMatched={() => { setMatchLine(null); refreshAll(); }}
      />

      {/* Refund Pair Modal */}
      <RefundPairModal
        open={!!refundLine}
        line={refundLine}
        allLines={allLinesForPair}
        onClose={() => setRefundLine(null)}
        onMatched={() => { setRefundLine(null); refreshAll(); }}
      />
    </div>
  );
}
