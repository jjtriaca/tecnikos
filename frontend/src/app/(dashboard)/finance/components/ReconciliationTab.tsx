"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { CashAccount, BankStatement, BankStatementLine, StatementLineStatus } from "@/types/finance";
import DraggableHeader from "@/components/ui/DraggableHeader";
import { useTableLayout } from "@/hooks/useTableLayout";
import type { ColumnDefinition } from "@/lib/types/table";
import LookupField from "@/components/ui/LookupField";
import type { LookupFetcher, LookupFetcherResult } from "@/components/ui/SearchLookupModal";
import CardLast4Input, { isCardPayment } from "@/components/ui/CardLast4Input";

/* ── Partner Lookup (shared) ────────────────────────────── */

type PartnerSummary = { id: string; name: string; document: string | null };

const partnerFetcher: LookupFetcher<PartnerSummary> = async (search, page, signal) => {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("search", search);
  return api.get<LookupFetcherResult<PartnerSummary>>(`/partners?${params.toString()}`, { signal });
};

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
  onConciliarCardInvoice,
  onConciliarMultiple,
  onConciliarTransfer,
  onIgnore,
  onUnignore,
  onUnmatch,
}: {
  line: BankStatementLine;
  onConciliar: () => void;
  onConciliarRefund: () => void;
  onConciliarCardInvoice: () => void;
  onConciliarMultiple: () => void;
  onConciliarTransfer: () => void;
  onIgnore: () => void;
  onUnignore: () => void;
  onUnmatch: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Fatura de cartao so aparece para linhas de debito
  const isDebit = line.amountCents < 0;

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      // UNMATCHED: Conciliar + Devolucao + Transferencia + [Fatura cartao se debito] + sep + Ignorar
      const itemCount = line.status === "UNMATCHED" ? (isDebit ? 5 : 4) : 1;
      const hasSeparator = line.status === "UNMATCHED";
      const estHeight = 8 + itemCount * 36 + (hasSeparator ? 9 : 0);
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < estHeight + 12;
      setPos({
        top: openUp ? rect.top - estHeight - 4 : rect.bottom + 4,
        left: Math.max(8, rect.right - 200),
      });
    }
  }, [open, line.status, isDebit]);

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
          className="fixed z-50 min-w-[200px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-left"
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
              {isDebit && (
                <button
                  onClick={() => { setOpen(false); onConciliarCardInvoice(); }}
                  className="block w-full text-left px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                >
                  &#128179; Conciliar fatura de cartao
                </button>
              )}
              <button
                onClick={() => { setOpen(false); onConciliarMultiple(); }}
                className="block w-full text-left px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                title="1 pagamento PIX/boleto/transferencia cobre varios lancamentos"
              >
                &#128200; Conciliar multiplos lancamentos
              </button>
              <button
                onClick={() => { setOpen(false); onConciliarTransfer(); }}
                className="block w-full text-left px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                title="Deposito em dinheiro, saque, transferencia entre contas proprias"
              >
                &#8644; Conciliar como transferencia
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                onClick={() => { setOpen(false); onIgnore(); }}
                className="block w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
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

interface FinancialAccountOption {
  id: string;
  code: string | null;
  name: string;
  type?: string; // REVENUE | EXPENSE | COST
  isActive: boolean;
  allowPosting: boolean;
  parent?: { id: string; code: string | null; name: string } | null;
}

/** Renderiza <option>s agrupados por grupo pai (padrao system-wide). */
function renderAccountOptions(accounts: FinancialAccountOption[]) {
  const grouped = new Map<string, FinancialAccountOption[]>();
  for (const acc of accounts) {
    const parentName = acc.parent
      ? `${acc.parent.code ? acc.parent.code + " - " : ""}${acc.parent.name}`
      : "Sem grupo";
    if (!grouped.has(parentName)) grouped.set(parentName, []);
    grouped.get(parentName)!.push(acc);
  }
  return Array.from(grouped.entries()).map(([group, accs]) => (
    <optgroup key={group} label={group}>
      {accs.map((a) => (
        <option key={a.id} value={a.id}>
          {a.code ? `${a.code} — ` : ""}{a.name}
        </option>
      ))}
    </optgroup>
  ));
}

/* ── Quick Create Entry Modal (inline) ────────────────────
 * Abre sobre o ConciliationModal. Cria FinancialEntry com dados
 * pre-preenchidos do extrato e concilia automaticamente na sequencia.
 * ------------------------------------------------------------ */

interface PaymentInstrumentOption {
  id: string;
  name: string;
  cashAccountId: string | null;
  autoMarkPaid: boolean;
  paymentMethod?: { code: string; name: string; requiresBrand?: boolean } | null;
}

function QuickCreateEntryModal({
  open,
  line,
  financialAccounts: financialAccountsFromParent,
  onClose,
  onCreatedAndMatched,
}: {
  open: boolean;
  line: BankStatementLine | null;
  financialAccounts: FinancialAccountOption[];
  onClose: () => void;
  onCreatedAndMatched: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [partner, setPartner] = useState<PartnerSummary | null>(null);
  const [description, setDescription] = useState("");
  const [grossReais, setGrossReais] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [financialAccountId, setFinancialAccountId] = useState("");
  const [paymentInstrumentId, setPaymentInstrumentId] = useState("");
  const [paymentInstruments, setPaymentInstruments] = useState<PaymentInstrumentOption[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccountOption[]>(financialAccountsFromParent);
  const [duplicateCandidates, setDuplicateCandidates] = useState<any[]>([]);
  const [receivedCardLast4, setReceivedCardLast4] = useState("");

  const entryType: "RECEIVABLE" | "PAYABLE" = line && line.amountCents >= 0 ? "RECEIVABLE" : "PAYABLE";
  const isoDate = (d: string) => {
    // d: "2026-04-15" -> "2026-04-15T12:00:00" (timezone-safe: meio-dia local)
    if (!d) return undefined;
    return `${d}T12:00:00`;
  };

  // Pre-fill on open + load payment instruments + reload chart of accounts
  useEffect(() => {
    if (!open || !line) return;
    const abs = Math.abs(line.amountCents);
    setGrossReais((abs / 100).toFixed(2).replace(".", ","));
    setDescription(line.description || "");
    setDueDate(line.transactionDate.slice(0, 10));
    setPartner(null);
    setFinancialAccountId("");
    setPaymentInstrumentId("");
    setReceivedCardLast4("");

    // Load payment instruments for this direction
    // Endpoint espera direction=RECEIVABLE ou PAYABLE (bate com o entryType)
    api
      .get<PaymentInstrumentOption[]>(`/finance/payment-instruments/active?direction=${entryType}`)
      .then((list) => setPaymentInstruments(list || []))
      .catch(() => setPaymentInstruments([]));

    // Reload financial accounts directly (don't rely only on parent) to guarantee we have fresh data
    // Endpoint /finance/accounts/postable ja filtra allowPosting + isActive no backend
    api
      .get<FinancialAccountOption[]>("/finance/accounts/postable")
      .then((list) => {
        // Use parent's list if it has data; else use the just-loaded one
        setFinancialAccounts(financialAccountsFromParent.length > 0 ? financialAccountsFromParent : (list || []));
      })
      .catch(() => setFinancialAccounts(financialAccountsFromParent));

    // Reset duplicates on open
    setDuplicateCandidates([]);
  }, [open, line, entryType, financialAccountsFromParent]);

  // Check for possible duplicates whenever partner + value are set.
  // Criteria: same partner, same type, same grossCents, NAO conciliados com outra linha do extrato
  // (entries ja matched representam pagamentos resolvidos, nao sao risco de duplicacao).
  const grossCents = Math.round((parseFloat(grossReais.replace(",", ".")) || 0) * 100);
  useEffect(() => {
    if (!open || !partner || grossCents <= 0) {
      setDuplicateCandidates([]);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({
      type: entryType,
      partnerId: partner.id,
      limit: "10",
      excludeMatched: "true", // ignora entries ja conciliados — sao pagamentos resolvidos
    });
    api
      .get<any>(`/finance/entries?${params.toString()}`, { signal: controller.signal })
      .then((res) => {
        const list = res?.data || res || [];
        // Match by exact grossCents (tolerance 1 cent for rounding)
        const dups = list.filter((e: any) => Math.abs((e.grossCents || 0) - grossCents) <= 1);
        setDuplicateCandidates(dups);
      })
      .catch(() => setDuplicateCandidates([]));
    return () => controller.abort();
  }, [open, partner, grossCents, entryType]);

  if (!open || !line) return null;

  const needsChartAccount = financialAccounts.length > 0 && !financialAccountId;
  const canSave = partner && grossCents > 0 && !needsChartAccount && !saving;

  async function handleSave() {
    if (!line || !partner) return;
    setSaving(true);
    let createdEntryId: string | null = null;
    try {
      // 1. Cria o entry com status PENDING (nao PAID — o match vai marcar PAID com a data correta do banco)
      const createBody: any = {
        type: entryType,
        partnerId: partner.id,
        description: description || line.description,
        grossCents,
        dueDate: isoDate(dueDate),
      };
      if (financialAccountId) createBody.financialAccountId = financialAccountId;
      if (paymentInstrumentId) createBody.paymentInstrumentId = paymentInstrumentId;
      if (receivedCardLast4 && receivedCardLast4.length === 4) {
        createBody.receivedCardLast4 = receivedCardLast4;
      }

      const created = await api.post<any>("/finance/entries", createBody);
      createdEntryId = created?.id || created?.entry?.id || created?.data?.id;
      if (!createdEntryId) throw new Error("Nao recebi ID do lancamento criado");

      // 2. Concilia a linha com o entry recem-criado
      const matchBody: any = { entryId: createdEntryId };
      if (financialAccountId) matchBody.financialAccountId = financialAccountId;
      await api.post(`/finance/reconciliation/lines/${line.id}/match`, matchBody);

      toast("Lancamento criado e conciliado com sucesso!", "success");
      onCreatedAndMatched();
    } catch (err: any) {
      // Rollback: se criamos o entry mas falhou o match, deletamos o entry pra nao deixar orfao
      if (createdEntryId) {
        try {
          await api.del(`/finance/entries/${createdEntryId}`);
        } catch {
          // nao propaga erro do rollback — prioritario e mostrar o erro original
        }
      }
      toast(err?.response?.data?.message || err?.message || "Erro ao criar lancamento.", "error");
    } finally {
      setSaving(false);
    }
  }

  /** Conciliacao com um entry ja existente (botao "Usar este" na lista de duplicados) */
  async function handleMatchExisting(existingEntryId: string) {
    if (!line) return;
    setSaving(true);
    try {
      const matchBody: any = { entryId: existingEntryId };
      if (financialAccountId) matchBody.financialAccountId = financialAccountId;
      await api.post(`/finance/reconciliation/lines/${line.id}/match`, matchBody);
      toast("Linha conciliada com o lancamento existente!", "success");
      onCreatedAndMatched();
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || "Erro ao conciliar.", "error");
    } finally {
      setSaving(false);
    }
  }

  const lineAbs = Math.abs(line.amountCents);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">
            Novo lancamento a {entryType === "RECEIVABLE" ? "receber" : "pagar"}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Pre-preenchido do extrato. Ao salvar, o lancamento e criado e ja conciliado com a transacao.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Bank line preview */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
            <div className="flex items-center justify-between">
              <span className="truncate">{line.description}</span>
              <span className={`font-semibold ml-2 ${line.amountCents >= 0 ? "text-green-700" : "text-red-700"}`}>
                {formatCurrency(line.amountCents)}
              </span>
            </div>
            <div className="text-slate-400 mt-0.5">Data: {formatDate(line.transactionDate)}</div>
          </div>

          {/* Partner */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Parceiro <span className="text-red-500">*</span>
            </label>
            <LookupField<PartnerSummary>
              placeholder="Buscar parceiro (cliente/fornecedor)..."
              modalTitle="Selecionar parceiro"
              modalPlaceholder="Nome ou CNPJ/CPF"
              value={partner}
              displayValue={(p) => p.name}
              onChange={setPartner}
              fetcher={partnerFetcher}
              keyExtractor={(p) => p.id}
              renderItem={(p) => (
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-800">{p.name}</span>
                  {p.document && <span className="text-[11px] text-slate-500">{p.document}</span>}
                </div>
              )}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descricao</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descricao do lancamento"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Gross + Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Valor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={grossReais}
                onChange={(e) => setGrossReais(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
              {grossCents > 0 && grossCents !== lineAbs && (
                <p className="text-[10px] text-amber-600 mt-1">
                  Diferente do extrato ({formatCurrency(lineAbs)})
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vencimento</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Plano de contas — agrupado por grupo pai (padrao system-wide) */}
          {financialAccounts.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Plano de contas <span className="text-red-500">*</span>
              </label>
              <select
                value={financialAccountId}
                onChange={(e) => setFinancialAccountId(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                  needsChartAccount
                    ? "border-amber-400 bg-amber-50 focus:border-amber-500 focus:ring-amber-500"
                    : "border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                }`}
              >
                <option value="">Selecione um plano...</option>
                {renderAccountOptions(financialAccounts)}
              </select>
            </div>
          )}

          {/* Meio de pagamento (opcional) */}
          {paymentInstruments.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Meio de pagamento (opcional)</label>
              <select
                value={paymentInstrumentId}
                onChange={(e) => {
                  setPaymentInstrumentId(e.target.value);
                  // Se trocou pra um meio que nao e cartao, limpa os 4 digitos
                  const pi = paymentInstruments.find((p) => p.id === e.target.value);
                  if (pi && !isCardPayment({ paymentMethodCode: pi.paymentMethod?.code, requiresBrand: pi.paymentMethod?.requiresBrand })) {
                    setReceivedCardLast4("");
                  }
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                <option value="">—</option>
                {paymentInstruments.map((pi) => (
                  <option key={pi.id} value={pi.id}>{pi.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 4 ultimos digitos do cartao do cliente — so quando o meio selecionado e cartao e entryType=RECEIVABLE */}
          {entryType === "RECEIVABLE" && (() => {
            const pi = paymentInstruments.find((p) => p.id === paymentInstrumentId);
            const showCard4 = pi && isCardPayment({ paymentMethodCode: pi.paymentMethod?.code, requiresBrand: pi.paymentMethod?.requiresBrand });
            if (!showCard4) return null;
            return (
              <CardLast4Input
                value={receivedCardLast4}
                onChange={setReceivedCardLast4}
                hint="Os 4 últimos dígitos do cartão do cliente — ajuda a identificar o pagamento depois."
              />
            );
          })()}

          {/* Alerta de possiveis duplicados */}
          {duplicateCandidates.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-amber-800 mb-1.5">
                &#9888; Ja existem {duplicateCandidates.length} lancamento(s) com este parceiro e valor
              </p>
              <p className="text-[11px] text-amber-700 mb-2">
                Para evitar duplicacao, voce pode conciliar com um existente:
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {duplicateCandidates.map((e) => {
                  // Entry em conta diferente da linha do banco = incompativel pra conciliar diretamente
                  // (ex: ja foi pago em Caixa Interno quando a linha e de SICREDI).
                  const entryAccount = e.cashAccountRef || e.cashAccount;
                  const entryAccountId = e.cashAccountId || entryAccount?.id;
                  const entryAccountType = entryAccount?.type;
                  const isOtherAccount = entryAccountId && line && entryAccountId !== line.cashAccountId && entryAccountType !== "TRANSITO";
                  return (
                    <div key={e.id} className={`flex items-center justify-between gap-2 bg-white rounded px-2 py-1.5 border ${
                      isOtherAccount ? "border-red-200" : "border-amber-200"
                    }`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">
                          {e.code} — {e.description || "(sem descricao)"}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {e.status} • Venc: {e.dueDate ? formatDate(e.dueDate) : "—"} • {formatCurrency(e.grossCents || 0)}
                          {entryAccount?.name && (
                            <> • Conta: <span className={isOtherAccount ? "text-red-700 font-medium" : "text-slate-700"}>{entryAccount.name}</span></>
                          )}
                        </p>
                        {isOtherAccount && (
                          <p className="text-[10px] text-red-700 mt-0.5">
                            &#9888; Ja registrado em outra conta. Se for o mesmo pagamento, ajuste o lancamento original antes; senao, prossiga criando um novo.
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleMatchExisting(e.id)}
                        disabled={saving || !!isOtherAccount}
                        title={isOtherAccount ? "Entry em outra conta — nao pode ser conciliado diretamente com esta linha." : undefined}
                        className="text-[11px] font-medium px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        Usar este
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              !partner ? "Selecione um parceiro" :
              grossCents <= 0 ? "Informe o valor" :
              needsChartAccount ? "Escolha o plano de contas" :
              duplicateCandidates.length > 0 ? "Ha possiveis duplicados — confira a lista acima" :
              undefined
            }
          >
            {saving ? "Salvando..." : duplicateCandidates.length > 0 ? "Criar mesmo assim" : "Criar e conciliar"}
          </button>
        </div>
      </div>
    </div>
  );
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
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccountOption[]>([]);
  const [accountAssignments, setAccountAssignments] = useState<Record<string, string>>({});
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  // Auto-deteccao de diferenca: ao clicar "Conciliar" com entry de valor diferente da linha,
  // abre form de ajuste (juros/multa) e faz match-multiple [entry + ajuste].
  const [adjustEntry, setAdjustEntry] = useState<any>(null);
  const [adjustAccountId, setAdjustAccountId] = useState("");
  const [adjustDescription, setAdjustDescription] = useState("");
  const [adjustPaymentMethod, setAdjustPaymentMethod] = useState("");
  const [creatingAdjust, setCreatingAdjust] = useState(false);
  // v1.10.07 — descontos da operadora (diff NEGATIVO: entry > linha)
  type DiscountRow = { id: string; amountCents: number; description: string; financialAccountId: string };
  const [discountEntry, setDiscountEntry] = useState<any>(null);
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [creatingWithDiscounts, setCreatingWithDiscounts] = useState(false);

  // Card transaction breakdown state
  const [liquidCents, setLiquidCents] = useState(0);
  const [taxCents, setTaxCents] = useState(0);
  const [detectedBrand, setDetectedBrand] = useState("");
  const [detectedType, setDetectedType] = useState("");
  const [configFeePercent, setConfigFeePercent] = useState(0);
  // Taxa matcheada — fonte pode ser PaymentInstrumentFeeRate (nova) ou CardFeeRate (legado).
  // matchedRate.source = "PIF" | "CFR" indica qual endpoint usar pra atualizar.
  const [matchedRate, setMatchedRate] = useState<any>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [manualOverride, setManualOverride] = useState(false);
  const [updatingRate, setUpdatingRate] = useState(false);
  // Forma de pagamento auto-detectada/manual pra entries PENDING sem paymentMethod
  const [matchPaymentMethod, setMatchPaymentMethod] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<{ code: string; name: string }[]>([]);

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

    // Reset plano de contas e paymentMethod na abertura
    setAccountAssignments({});
    // Auto-detecta paymentMethod pela descricao da linha do extrato
    const desc = (line.description || "").toUpperCase();
    if (desc.includes("PIX")) setMatchPaymentMethod("PIX");
    else if (desc.includes("BOLETO") || desc.includes("LIQUIDAC") || desc.includes("DARF") || desc.includes("ARRECADAC")) setMatchPaymentMethod("BOLETO");
    else if (desc.includes("MASTER") || desc.includes("VISA") || desc.includes("ELO")) setMatchPaymentMethod("CARTAO_DEBITO");
    else if (desc.includes("TRANSF") || desc.includes("TARIFA") || desc.includes("CESTA")) setMatchPaymentMethod("TRANSFERENCIA");
    else setMatchPaymentMethod("");

    // Carrega meios de pagamento
    api.get<{ code: string; name: string }[]>("/finance/payment-methods/active")
      .then(setPaymentMethods).catch(() => setPaymentMethods([]));

    // Fetch entries, card fee rates, planos de contas in parallel
    const type = line.amountCents >= 0 ? "RECEIVABLE" : "PAYABLE";
    Promise.all([
      // excludeMatched=true remove entries ja conciliados com alguma linha do extrato (evita duplo match)
      // matchableForCashAccountId filtra entries em contas incompativeis: exclui pagos em dinheiro
      // (conta CAIXA) ou em outro banco. So aceita: (a) sem conta, (b) mesmo banco da linha, (c) TRANSITO.
      api.get<any>(`/finance/entries?status=PAID&type=${type}&limit=50&excludeMatched=true&matchableForCashAccountId=${line.cashAccountId}`).catch(() => ({ data: [] })),
      api.get<any>(`/finance/entries?status=PENDING&type=${type}&limit=50&excludeMatched=true&matchableForCashAccountId=${line.cashAccountId}`).catch(() => ({ data: [] })),
      isCardTx ? api.get<any[]>("/finance/card-fee-rates").catch(() => []) : Promise.resolve([]),
      // Endpoint correto: /finance/accounts/postable (ja filtra allowPosting + isActive no backend)
      api.get<FinancialAccountOption[]>("/finance/accounts/postable").catch(() => []),
    ])
      .then(([paidRes, pendingRes, feeRates, postableAccounts]) => {
        setFinancialAccounts(postableAccounts || []);
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

  /**
   * Busca a taxa configurada pra um entry.
   * 1) Preferencia: PaymentInstrumentFeeRate via entry.paymentInstrumentId (nova estrutura)
   * 2) Fallback: CardFeeRate legado por brand+type (compat com tenants sem migracao rodada)
   */
  async function fetchRateForEntry(entry: any, brand: string, type: string, installments = 1): Promise<any> {
    const piId = entry?.paymentInstrumentId || entry?.paymentInstrumentRef?.id;
    if (piId) {
      try {
        const pif = await api.get<any>(
          `/finance/payment-instruments/${piId}/fee-rate-lookup?installments=${installments}`,
        );
        if (pif && pif.id) {
          return { ...pif, source: "PIF", brand, type };
        }
      } catch { /* ignore, cai no fallback */ }
    }
    // Fallback: CardFeeRate legado
    const rate = (cardFeeRates || []).find((r: any) =>
      r.brand?.toUpperCase() === brand.toUpperCase() &&
      r.type?.toUpperCase() === type.toUpperCase() &&
      (!r.installmentFrom || r.installmentFrom <= installments) &&
      (!r.installmentTo || r.installmentTo >= installments) &&
      r.isActive,
    );
    if (rate) return { ...rate, source: "CFR" };
    return null;
  }

  /** Select a candidate entry: recompute breakdown from entry's gross (real fee) + re-busca taxa. */
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

    // Re-busca taxa se for cartao. Limpa a taxa antiga antes de buscar — evita residuo
    // do card anterior (alerta de divergencia baseado em config errado).
    if (isCard && detectedBrand) {
      setMatchedRate(null);
      setConfigFeePercent(0);
      const installments = entry.installmentCount || 1;
      fetchRateForEntry(entry, detectedBrand, detectedType, installments)
        .then((rate) => {
          if (rate) {
            setMatchedRate(rate);
            setConfigFeePercent(rate.feePercent);
          }
          // Se nao encontrou taxa pra este card, deixa vazio (sem divergencia)
        })
        .catch(() => {
          setMatchedRate(null);
          setConfigFeePercent(0);
        });
    }
  }

  /**
   * Atualiza a taxa configurada pra bater com a taxa real cobrada.
   * Usa o endpoint apropriado conforme origem (PIF = novo, CFR = legado).
   */
  async function updateConfiguredRate() {
    if (!matchedRate?.id) return;
    const bruto = liquidCents + taxCents;
    if (bruto <= 0 || taxCents <= 0) return;
    const newRate = Number(((taxCents / bruto) * 100).toFixed(4));
    const label = matchedRate.description
      || (matchedRate.brand && matchedRate.type ? `${matchedRate.brand} ${matchedRate.type}` : "taxa configurada");
    if (!window.confirm(
      `Atualizar a taxa "${label}" de ${matchedRate.feePercent.toFixed(2)}% para ${newRate.toFixed(2)}%?`
    )) return;
    setUpdatingRate(true);
    try {
      const endpoint = matchedRate.source === "PIF"
        ? `/finance/payment-instrument-fee-rates/${matchedRate.id}`
        : `/finance/card-fee-rates/${matchedRate.id}`;
      const updated = await api.patch<any>(endpoint, { feePercent: newRate });
      setMatchedRate({ ...matchedRate, ...updated });
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

  /** Sort candidates: exact matches first, then by date proximity.
   * Se a busca tem 4 digitos numericos, usa como filtro exato em receivedCardLast4
   * (criterio principal quando o usuario anotou os 4 digitos do cartao do cliente).
   */
  function getSortedCandidates() {
    if (!line) return candidates;
    const lineAbs = Math.abs(line.amountCents);

    let filtered = candidates;
    const trimmed = search.trim();

    // Filtro especial: 4 digitos numericos = busca direta por receivedCardLast4
    if (/^\d{4}$/.test(trimmed)) {
      filtered = candidates.filter((e) => e.receivedCardLast4 === trimmed);
    } else if (trimmed) {
      // Busca multi-palavra: bate TODAS em code+description+partner+last4.
      // Dedup de letras repetidas consecutivas tolera "royale" bater "royalle", "pizaria" bater "pizzaria" etc.
      const dedup = (s: string) => s.replace(/(.)\1+/g, "$1");
      const terms = trimmed.toLowerCase().split(/\s+/);
      const dedupedTerms = terms.map(dedup);
      filtered = candidates.filter((e) => {
        const haystack = `${e.code || ""} ${e.description || ""} ${e.partner?.name || ""} ${e.receivedCardLast4 || ""}`.toLowerCase();
        const dedupedHaystack = dedup(haystack);
        return terms.every((t, i) => haystack.includes(t) || dedupedHaystack.includes(dedupedTerms[i]));
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

  /** Entry precisa de plano: empresa usa plano e entry nao tem nem recebeu atribuicao. */
  function needsChartAccount(entry: any): boolean {
    if (financialAccounts.length === 0) return false;
    if (entry.financialAccountId) return false;
    if (entry.isRefundEntry) return false;
    return !accountAssignments[entry.id];
  }

  async function handleMatch(entryId: string) {
    if (!line) return;
    const entry = candidates.find((c) => c.id === entryId);
    if (entry && needsChartAccount(entry)) {
      toast("Escolha o plano de contas do lançamento antes de conciliar.", "error");
      return;
    }
    const wasPending = entry?.status === "PENDING" || entry?._fromStatus === "PENDING";
    // Se entry PENDING sem paymentMethod, exige que gestor selecione
    if (wasPending && !entry?.paymentMethod && !matchPaymentMethod) {
      toast("Selecione a forma de pagamento antes de conciliar.", "error");
      return;
    }

    // Auto-deteccao de diferenca:
    // - Nao-cartao: diff > 0 → juros/multa; diff < 0 → descontos
    // - Cartao: divergencia da taxa implicita > taxa configurada + 5pp → descontos
    //   (taxa unica auto so e segura quando bate com a config; alem disso eh aluguel/etc)
    if (entry && line) {
      const entryAmount = entry.netCents ?? entry.grossCents ?? 0;
      const lineAbs = Math.abs(line.amountCents);
      const diff = lineAbs - entryAmount;

      if (!isCard) {
        if (diff > 1) {
          // Juros/multa
          const direction = line.amountCents >= 0 ? "RECEIVABLE" : "PAYABLE";
          const tipoAjuste = direction === "RECEIVABLE" ? "Juros/Multa recebidos" : "Juros/Multa pagos";
          const partnerName = entry.partner?.name || "";
          setAdjustDescription(`${tipoAjuste}${partnerName ? ` — ${partnerName}` : ""}`);
          const jurosAcc = financialAccounts.find((a) =>
            a.code === "7100" || /juros|multa/i.test(a.name),
          );
          setAdjustAccountId(jurosAcc?.id || "");
          const inheritedMethod = entry.paymentMethod || matchPaymentMethod || "";
          setAdjustPaymentMethod(inheritedMethod);
          setAdjustEntry(entry);
          return;
        }
        if (diff < -1) {
          // Descontos da operadora (entry > linha) — v1.10.07
          if (!entry.cashAccountId || entry.cashAccountId === line.cashAccountId) {
            toast("Lançamento precisa estar PAGO em conta de origem (ex: VT) para aplicar descontos.", "error");
            return;
          }
          setDiscounts([]);
          setDiscountEntry(entry);
          return;
        }
      } else {
        // CARTAO — v1.10.09: deteccao de descontos extras (aluguel maquininha etc)
        // Taxa implicita (gross - liquido)/gross. Se bate com configFee (tol 1.5pp), eh
        // taxa pura → fluxo legado. Se excede config + 5pp, sao descontos extras.
        const impliedRate = entryAmount > 0 ? ((entryAmount - lineAbs) / entryAmount) * 100 : 0;
        const expectedRate = configFeePercent || 0;
        const divergence = impliedRate - expectedRate;
        if (diff < -1 && divergence > 5) {
          // Pre-requisitos
          if (!entry.cashAccountId || entry.cashAccountId === line.cashAccountId) {
            toast("Lançamento precisa estar PAGO em conta de origem (ex: VT) para aplicar descontos.", "error");
            return;
          }
          // Pre-popula primeira linha com a "taxa esperada" da config + segunda com "aluguel" (resto)
          const taxaCents = expectedRate > 0 ? Math.round(entryAmount * (expectedRate / 100)) : 0;
          const restoCents = (entryAmount - lineAbs) - taxaCents;
          const taxaAcc = financialAccounts.find((a) => a.code === "5200");
          const aluguelAcc = financialAccounts.find((a) => a.code === "3201");
          const initialDiscounts: DiscountRow[] = [];
          if (taxaCents > 0) {
            initialDiscounts.push({
              id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-1`,
              amountCents: taxaCents,
              description: `Taxa cartão ${expectedRate.toFixed(2)}%`,
              financialAccountId: taxaAcc?.id || "",
            });
          }
          if (restoCents > 0) {
            initialDiscounts.push({
              id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-2`,
              amountCents: restoCents,
              description: "Aluguel maquininha",
              financialAccountId: aluguelAcc?.id || "",
            });
          }
          setDiscounts(initialDiscounts);
          setDiscountEntry(entry);
          return;
        }
      }
    }

    setMatching(entryId);
    try {
      const body: any = { entryId };
      if (isCard && (liquidCents > 0 || taxCents > 0)) {
        body.liquidCents = liquidCents;
        body.taxCents = taxCents;
      }
      if (accountAssignments[entryId]) {
        body.financialAccountId = accountAssignments[entryId];
      }
      // Envia paymentMethod pra entries PENDING que não tinham
      if (wasPending && !entry?.paymentMethod && matchPaymentMethod) {
        body.paymentMethod = matchPaymentMethod;
      }
      await api.post(`/finance/reconciliation/lines/${line.id}/match`, body);
      toast(wasPending ? "Conciliado e marcado como PAGO!" : "Conciliado com sucesso!", "success");
      onMatched();
    } catch (err: any) {
      toast(err?.response?.data?.message || "Erro ao conciliar.", "error");
    } finally {
      setMatching(null);
    }
  }

  /**
   * Cria entry de ajuste (juros/multa) e concilia [entry original + ajuste] via match-multiple.
   */
  async function handleConciliarComAjuste() {
    if (!line || !adjustEntry) return;
    if (!adjustDescription.trim()) {
      toast("Descrição obrigatória.", "error");
      return;
    }
    const partnerId = adjustEntry.partner?.id || adjustEntry.partnerId;
    if (!partnerId) {
      toast("Lançamento sem parceiro — não é possível criar ajuste.", "error");
      return;
    }
    const direction: "RECEIVABLE" | "PAYABLE" = line.amountCents >= 0 ? "RECEIVABLE" : "PAYABLE";
    const lineAbs = Math.abs(line.amountCents);
    const entryAmount = adjustEntry.netCents ?? adjustEntry.grossCents ?? 0;
    const diff = lineAbs - entryAmount;
    setCreatingAdjust(true);
    try {
      // 1) Cria entry de ajuste — marker [AUTO_RECONCILIATION_ADJUST] em notes
      // permite que unmatchLine soft-delete o ajuste se a conciliacao for desfeita.
      const created = await api.post<{ id: string }>("/finance/entries", {
        type: direction,
        description: adjustDescription.trim(),
        grossCents: diff,
        dueDate: new Date(line.transactionDate).toISOString(),
        partnerId,
        financialAccountId: adjustAccountId || undefined,
        paymentMethod: adjustPaymentMethod || undefined,
        notes: `[AUTO_RECONCILIATION_ADJUST]`,
      });
      const adjustId = (created as any).id || (created as any).data?.id;
      if (!adjustId) throw new Error("Não foi possível recuperar ID do ajuste criado.");

      // 2) Concilia via match-multiple com [entry original + ajuste]
      await api.post(`/finance/reconciliation/lines/${line.id}/match-multiple`, {
        entryIds: [adjustEntry.id, adjustId],
      });
      toast(`Conciliado: ${adjustEntry.code || "lançamento"} + ajuste de ${formatCurrency(diff)}.`, "success");
      setAdjustEntry(null);
      onMatched();
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || "Erro ao conciliar com ajuste.", "error");
    } finally {
      setCreatingAdjust(false);
    }
  }

  // v1.10.07 — Descontos da operadora (diff NEGATIVO)
  function addDiscount(presetCode?: string, presetDesc?: string) {
    const acc = presetCode ? financialAccounts.find((a) => a.code === presetCode) : null;
    setDiscounts((prev) => [
      ...prev,
      {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        amountCents: 0,
        description: presetDesc || "",
        financialAccountId: acc?.id || "",
      },
    ]);
  }
  function updateDiscount(id: string, patch: Partial<DiscountRow>) {
    setDiscounts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }
  function removeDiscount(id: string) {
    setDiscounts((prev) => prev.filter((d) => d.id !== id));
  }

  /**
   * v1.10.07 — Cria N entries do tipo OPOSTO (descontos) PAID na conta do entry expected
   * (ex: VT) e concilia tudo via match-multiple. Backend valida sumExp - sumOpp = lineAbs.
   */
  async function handleConciliarComDescontos() {
    if (!line || !discountEntry) return;
    if (discounts.length === 0 || discounts.some((d) => d.amountCents <= 0 || !d.description.trim())) {
      toast("Preencha valor e descrição de cada desconto.", "error");
      return;
    }
    const direction: "RECEIVABLE" | "PAYABLE" = line.amountCents >= 0 ? "RECEIVABLE" : "PAYABLE";
    const oppositeType: "RECEIVABLE" | "PAYABLE" = direction === "RECEIVABLE" ? "PAYABLE" : "RECEIVABLE";
    const partnerId = discountEntry.partner?.id || discountEntry.partnerId;
    if (!partnerId) {
      toast("Lançamento sem parceiro — não é possível criar descontos.", "error");
      return;
    }
    const cashAccountId = discountEntry.cashAccountId;
    if (!cashAccountId || cashAccountId === line.cashAccountId) {
      toast("Lançamento precisa estar pago em conta diferente do banco.", "error");
      return;
    }
    setCreatingWithDiscounts(true);
    try {
      const newIds: string[] = [];
      for (const d of discounts) {
        // 1. Cria PENDING
        const created = await api.post<any>("/finance/entries", {
          type: oppositeType,
          description: d.description.trim(),
          grossCents: d.amountCents,
          dueDate: new Date(line.transactionDate).toISOString(),
          partnerId,
          financialAccountId: d.financialAccountId || undefined,
          notes: `[AUTO_RECONCILIATION_DESCONTO]`,
        });
        const newId = (created as any).id || (created as any).data?.id;
        if (!newId) throw new Error("Não foi possível recuperar ID do desconto criado.");
        // 2. PAID na mesma conta do entry expected
        await api.patch(`/finance/entries/${newId}/status`, {
          status: "PAID",
          paidAt: new Date(line.transactionDate).toISOString(),
          cashAccountId,
        });
        newIds.push(newId);
      }
      // 3. Match-multiple [entry original + descontos novos]
      await api.post(`/finance/reconciliation/lines/${line.id}/match-multiple`, {
        entryIds: [discountEntry.id, ...newIds],
      });
      const totalDiscount = discounts.reduce((acc, d) => acc + d.amountCents, 0);
      toast(`Conciliado: ${discountEntry.code || "lançamento"} − ${newIds.length} desconto(s) (${formatCurrency(totalDiscount)}).`, "success");
      setDiscountEntry(null);
      setDiscounts([]);
      onMatched();
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || "Erro ao conciliar com descontos.", "error");
    } finally {
      setCreatingWithDiscounts(false);
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
              placeholder="Buscar por codigo, descricao, parceiro ou 4 digitos do cartao..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Forma de Pagamento — pra entries PENDING sem paymentMethod */}
          {paymentMethods.length > 0 && (
            <div className="mb-3">
              <label className="block text-[10px] font-medium text-slate-500 mb-1">Forma de Pagamento (para lancamentos pendentes)</label>
              <select
                value={matchPaymentMethod}
                onChange={(e) => setMatchPaymentMethod(e.target.value)}
                className={`w-full rounded-lg border px-3 py-1.5 text-sm focus:ring-1 outline-none ${matchPaymentMethod ? "border-green-300 bg-green-50 focus:border-green-500 focus:ring-green-500" : "border-amber-300 bg-amber-50 focus:border-amber-500 focus:ring-amber-500"}`}
              >
                <option value="">Selecione...</option>
                {paymentMethods.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
              </select>
              {!matchPaymentMethod && <p className="mt-0.5 text-[10px] text-amber-600">Obrigatorio para conciliar lancamentos pendentes</p>}
            </div>
          )}

          <div className="flex items-center justify-between mb-2 gap-2">
            <p className="text-xs font-medium text-slate-500">
              Lancamentos financeiros ({line.amountCents >= 0 ? "A Receber" : "A Pagar"}) — PAGOS e PENDENTES:
            </p>
            <button
              onClick={() => setQuickCreateOpen(true)}
              className="text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md px-2 py-1 flex items-center gap-1 whitespace-nowrap"
              title="Criar um novo lancamento com os dados do extrato ja preenchidos"
            >
              <span className="text-base leading-none">+</span>
              Criar novo lancamento
            </button>
          </div>
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
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-slate-100 transition-colors ${
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
                        {entry.receivedCardLast4 && (
                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap font-mono tracking-wider">
                            &bull;&bull;&bull;&bull; {entry.receivedCardLast4}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {entry.partner?.name || "—"} • Venc: {formatDate(entry.dueDate)}
                        {(() => {
                          const pi = entry.paymentInstrumentRef;
                          if (pi) {
                            // Prioriza info do instrumento (bandeira + ultimos 4 digitos)
                            const brand = pi.cardBrand || entry.cardBrand;
                            const last4 = pi.cardLast4;
                            const methodLabel = pi.paymentMethod?.name || pi.name;
                            return (
                              <>
                                <span className="ml-1 text-slate-600 font-medium">• {pi.name}</span>
                                {brand && (
                                  <span className="ml-1 px-1 py-0.5 rounded bg-purple-100 text-purple-700 text-[9px] font-bold uppercase">
                                    {brand}
                                  </span>
                                )}
                                {last4 && (
                                  <span className="ml-1 px-1 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-mono">
                                    &bull;&bull;&bull;&bull; {last4}
                                  </span>
                                )}
                                {pi.paymentMethod?.code && pi.paymentMethod.code !== pi.name.toUpperCase() && (
                                  <span className="ml-1 text-[9px] text-slate-400">({methodLabel})</span>
                                )}
                              </>
                            );
                          }
                          // Fallback: entries antigos sem paymentInstrument
                          return (
                            <>
                              {entry.paymentMethod && <span className="ml-1 text-slate-500">• {entry.paymentMethod.replace(/_/g, " ")}</span>}
                              {entry.cardBrand && <span className="ml-1 px-1 py-0.5 rounded bg-purple-100 text-purple-700 text-[9px] font-medium">{entry.cardBrand}</span>}
                            </>
                          );
                        })()}
                      </p>
                      {/* Plano de Contas — campo so aparece quando a empresa usa plano e o entry precisa */}
                      {financialAccounts.length > 0 && !entry.isRefundEntry && (
                        <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                          {entry.financialAccountId ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                              <span className="w-1 h-1 rounded-full bg-green-500" />
                              Plano: {
                                (entry.financialAccount?.name) ||
                                (financialAccounts.find((a) => a.id === entry.financialAccountId)?.name) ||
                                "Definido"
                              }
                            </span>
                          ) : (
                            <select
                              value={accountAssignments[entry.id] || ""}
                              onChange={(ev) => setAccountAssignments((prev) => ({ ...prev, [entry.id]: ev.target.value }))}
                              className={`w-full text-[11px] rounded border px-2 py-1 focus:outline-none focus:ring-1 ${
                                accountAssignments[entry.id]
                                  ? "border-slate-300 bg-white focus:border-blue-500 focus:ring-blue-500"
                                  : "border-amber-400 bg-amber-50 focus:border-amber-500 focus:ring-amber-500"
                              }`}
                            >
                              <option value="">⚠ Escolha o plano de contas...</option>
                              {renderAccountOptions(financialAccounts)}
                            </select>
                          )}
                        </div>
                      )}
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
                        disabled={!!matching || needsChartAccount(entry)}
                        title={needsChartAccount(entry) ? "Escolha o plano de contas antes de conciliar" : undefined}
                        className={`px-3 py-1 text-xs font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
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

      {/* Sub-modal: criar lancamento com dados pre-preenchidos do extrato */}
      <QuickCreateEntryModal
        open={quickCreateOpen}
        line={line}
        financialAccounts={financialAccounts}
        onClose={() => setQuickCreateOpen(false)}
        onCreatedAndMatched={() => {
          setQuickCreateOpen(false);
          onMatched(); // fecha modal de conciliacao e recarrega a lista
        }}
      />

      {/* Overlay: form de ajuste quando entry tem valor diferente da linha (juros/multa) */}
      {adjustEntry && line && (() => {
        const lineAbs = Math.abs(line.amountCents);
        const entryAmount = adjustEntry.netCents ?? adjustEntry.grossCents ?? 0;
        const diff = lineAbs - entryAmount;
        const direction: "RECEIVABLE" | "PAYABLE" = line.amountCents >= 0 ? "RECEIVABLE" : "PAYABLE";
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col">
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="text-base font-semibold text-amber-700">⚠ Diferença detectada</h3>
                <p className="text-xs text-slate-500 mt-1">
                  O lançamento {adjustEntry.code} é de {formatCurrency(entryAmount)} mas a linha do extrato é {formatCurrency(lineAbs)}. Diferença de <strong>{formatCurrency(diff)}</strong>.
                </p>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm text-slate-700">
                  Deseja criar um lançamento separado de {direction === "RECEIVABLE" ? "juros/multa recebida" : "encargos pagos"} para esta diferença?
                </p>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Descrição *</label>
                  <input
                    type="text"
                    value={adjustDescription}
                    onChange={(e) => setAdjustDescription(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Plano de contas</label>
                  <select
                    value={adjustAccountId}
                    onChange={(e) => setAdjustAccountId(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="">— sem plano —</option>
                    {financialAccounts
                      .filter((a) => direction === "RECEIVABLE" ? a.type === "REVENUE" : a.type === "EXPENSE")
                      .map((a) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Forma de pagamento</label>
                  <select
                    value={adjustPaymentMethod}
                    onChange={(e) => setAdjustPaymentMethod(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="">— sem forma —</option>
                    {paymentMethods.map((m) => (
                      <option key={m.code} value={m.code}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  onClick={() => setAdjustEntry(null)}
                  disabled={creatingAdjust}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  Não, cancelar
                </button>
                <button
                  onClick={handleConciliarComAjuste}
                  disabled={creatingAdjust || !adjustDescription.trim()}
                  className="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                >
                  {creatingAdjust ? "Conciliando..." : "Sim, criar e conciliar"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* v1.10.07 — Overlay descontos da operadora (entry > linha) */}
      {discountEntry && line && (() => {
        const lineAbs = Math.abs(line.amountCents);
        const entryAmount = discountEntry.netCents ?? discountEntry.grossCents ?? 0;
        const negDiff = entryAmount - lineAbs;
        const direction: "RECEIVABLE" | "PAYABLE" = line.amountCents >= 0 ? "RECEIVABLE" : "PAYABLE";
        const oppositeType: "RECEIVABLE" | "PAYABLE" = direction === "RECEIVABLE" ? "PAYABLE" : "RECEIVABLE";
        const discountsTotal = discounts.reduce((acc, d) => acc + (d.amountCents || 0), 0);
        const remainder = negDiff - discountsTotal;
        const cobersDiff = Math.abs(remainder) <= 1 && discounts.length > 0
          && discounts.every((d) => d.amountCents > 0 && d.description.trim().length > 0);
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="text-base font-semibold text-rose-700">⚠ Descontos detectados</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Lançamento {discountEntry.code} é de <strong>{formatCurrency(entryAmount)}</strong> mas a linha do extrato é <strong>{formatCurrency(lineAbs)}</strong>. Diferença: <strong className="text-rose-700">{formatCurrency(negDiff)}</strong> em descontos.
                </p>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                <div className="rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-slate-700">A operadora descontou:</span>
                  <div className="text-right">
                    <p className="text-[10px] text-rose-600">Faltam</p>
                    <p className={`text-sm font-bold ${cobersDiff ? "text-emerald-700" : "text-rose-700"}`}>
                      {formatCurrency(Math.max(0, remainder))}
                    </p>
                  </div>
                </div>

                {discounts.map((d, idx) => (
                  <div key={d.id} className="flex items-start gap-2 bg-white rounded border border-slate-200 p-2">
                    <span className="text-[10px] text-slate-400 mt-2 w-4">{idx + 1}.</span>
                    <div className="flex-1 grid grid-cols-12 gap-2">
                      <input
                        type="text"
                        value={d.description}
                        onChange={(e) => updateDiscount(d.id, { description: e.target.value })}
                        placeholder="Descrição (ex: Taxa cartão MASTER)"
                        className="col-span-6 rounded border border-slate-300 px-2 py-1.5 text-xs"
                      />
                      <select
                        value={d.financialAccountId}
                        onChange={(e) => updateDiscount(d.id, { financialAccountId: e.target.value })}
                        className="col-span-4 rounded border border-slate-300 px-1.5 py-1.5 text-xs bg-white"
                      >
                        <option value="">— plano —</option>
                        {financialAccounts
                          .filter((a) => oppositeType === "PAYABLE" ? a.type === "EXPENSE" : a.type === "REVENUE")
                          .map((a) => (
                            <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                          ))}
                      </select>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={d.amountCents > 0 ? (d.amountCents / 100).toFixed(2).replace(".", ",") : ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value.replace(/\./g, "").replace(",", ".")) || 0;
                          updateDiscount(d.id, { amountCents: Math.round(val * 100) });
                        }}
                        placeholder="0,00"
                        className="col-span-2 rounded border border-slate-300 px-2 py-1.5 text-xs text-right font-medium"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDiscount(d.id)}
                      className="text-rose-500 hover:text-rose-700 text-base leading-none mt-1.5"
                      title="Remover"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => addDiscount("5200", "Taxa cartão")}
                    className="text-[11px] px-2.5 py-1.5 rounded bg-rose-100 text-rose-800 hover:bg-rose-200 font-medium"
                  >
                    + Taxa cartão
                  </button>
                  <button
                    type="button"
                    onClick={() => addDiscount("3201", "Aluguel maquininha")}
                    className="text-[11px] px-2.5 py-1.5 rounded bg-rose-100 text-rose-800 hover:bg-rose-200 font-medium"
                  >
                    + Aluguel maquininha
                  </button>
                  <button
                    type="button"
                    onClick={() => addDiscount()}
                    className="text-[11px] px-2.5 py-1.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"
                  >
                    + Outro desconto
                  </button>
                  {remainder !== 0 && discountsTotal > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const last = discounts[discounts.length - 1];
                        if (!last) return;
                        const v = last.amountCents + remainder;
                        if (v > 0) updateDiscount(last.id, { amountCents: v });
                      }}
                      className="text-[11px] px-2.5 py-1.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 font-medium"
                      title="Ajusta a última linha pra zerar a diferença"
                    >
                      ⚖ Fechar diferença
                    </button>
                  )}
                </div>
              </div>
              <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  onClick={() => { setDiscountEntry(null); setDiscounts([]); }}
                  disabled={creatingWithDiscounts}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConciliarComDescontos}
                  disabled={creatingWithDiscounts || !cobersDiff}
                  className="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={cobersDiff ? "" : "Adicione descontos que somem o valor faltante"}
                >
                  {creatingWithDiscounts ? "Conciliando..." : "Conciliar com descontos"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
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
                        : "border-slate-200 hover:bg-slate-100"
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

/* ── Card Invoice Match Modal (fatura de cartao N-para-1) ── */

interface CardInstrument {
  id: string;
  name: string;
  cardLast4?: string | null;
  cardBrand?: string | null;
  billingClosingDay?: number | null;
  showInPayables?: boolean;
  showInReceivables?: boolean;
  paymentMethod?: { code?: string | null; name?: string | null } | null;
}

interface CardInvoiceEntry {
  id: string;
  code: string | null;
  description: string | null;
  netCents: number;
  grossCents: number;
  paidAt: string | null;
  dueDate: string | null;
  status?: string | null;
  cashAccountId: string | null;
  paymentInstrumentId: string | null;
  invoiceMatchLineId: string | null;
  financialAccountId: string | null;
  isRefundEntry?: boolean;
  partner: { id: string; name: string } | null;
  paymentInstrumentRef: { id: string; name: string; cardLast4: string | null } | null;
  financialAccount?: { id: string; name: string } | null;
}

function CardInvoiceMatchModal({
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
  const [instruments, setInstruments] = useState<CardInstrument[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccountOption[]>([]);
  const [accountAssignments, setAccountAssignments] = useState<Record<string, string>>({});
  const [bulkAccountId, setBulkAccountId] = useState("");
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [candidates, setCandidates] = useState<CardInvoiceEntry[]>([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [matching, setMatching] = useState(false);

  // Load credit card instruments + plano de contas when modal opens
  useEffect(() => {
    if (!open) return;
    setSelectedEntryIds(new Set());
    setCandidates([]);
    setNotes("");
    setAccountAssignments({});
    setBulkAccountId("");
    Promise.all([
      api.get<CardInstrument[]>("/finance/payment-instruments").catch(() => []),
      api.get<FinancialAccountOption[]>("/finance/accounts/postable").catch(() => []),
    ])
      .then(([instrumentsData, accountsData]) => {
        // Filtra apenas cartoes de CREDITO que estejam marcados como PAGAMENTO
        const credit = (instrumentsData || []).filter((i) => {
          const code = (i.paymentMethod?.code || "").toUpperCase();
          const isCredit = code === "CARTAO_CREDITO" || code === "CREDITO" || code === "CREDIT_CARD" || code === "CREDIT";
          return isCredit && i.showInPayables !== false;
        });
        setInstruments(credit);
        setSelectedCardIds(new Set(credit.map((i) => i.id)));
        setFinancialAccounts(accountsData || []);

        // Range baseado no billingClosingDay do primeiro cartao encontrado
        // Ex: fechamento dia 25 → fatura abril cobre compras de ~22/02 a 25/03
        // Usa margem de 3 dias antes do fechamento anterior pra pegar compras de final de mes
        if (line) {
          const closingDay = credit.find((i) => i.billingClosingDay)?.billingClosingDay || 25;
          const lineDate = new Date(line.transactionDate);
          // Dia de fechamento mais recente ANTES da data da linha
          const toD = new Date(lineDate.getFullYear(), lineDate.getMonth(), closingDay);
          if (toD >= lineDate) toD.setMonth(toD.getMonth() - 1);
          // Dia de inicio = fechamento anterior - 3 dias de margem (compras que entram na fatura)
          const fromD = new Date(toD.getFullYear(), toD.getMonth() - 1, closingDay - 3);
          setFromDate(fromD.toISOString().substring(0, 10));
          setToDate(toD.toISOString().substring(0, 10));
        }
      })
      .catch(() => toast("Erro ao carregar dados", "error"));
  }, [open, line, toast]);

  // Auto-load candidates when filter changes
  useEffect(() => {
    if (!open || !line || selectedCardIds.size === 0 || !fromDate || !toDate) {
      setCandidates([]);
      return;
    }
    setLoadingCandidates(true);
    const ids = Array.from(selectedCardIds).join(",");
    api.get<{ entries: CardInvoiceEntry[]; totalCents: number }>(
      `/finance/reconciliation/card-invoice-candidates?paymentInstrumentIds=${ids}&fromDate=${fromDate}&toDate=${toDate}`,
    )
      .then((data) => setCandidates(data.entries || []))
      .catch(() => toast("Erro ao buscar compras", "error"))
      .finally(() => setLoadingCandidates(false));
  }, [open, line, selectedCardIds, fromDate, toDate, toast]);

  if (!open || !line) return null;

  const lineAbs = Math.abs(line.amountCents);
  const selectedEntries = candidates.filter((e) => selectedEntryIds.has(e.id));
  const selectedTotal = selectedEntries.reduce((acc, e) => acc + (e.netCents || e.grossCents || 0), 0);
  const diff = lineAbs - selectedTotal;
  const matches = Math.abs(diff) <= 1;

  function toggleCard(id: string) {
    const next = new Set(selectedCardIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCardIds(next);
  }

  function toggleEntry(id: string) {
    const next = new Set(selectedEntryIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedEntryIds(next);
  }

  function selectAll() {
    const available = candidates.filter((e) => !e.invoiceMatchLineId);
    setSelectedEntryIds(new Set(available.map((e) => e.id)));
  }

  function clearAll() {
    setSelectedEntryIds(new Set());
  }

  // Quais entries selecionados ainda precisam de plano (empresa usa + entry nao tem + sem atribuicao)
  const entriesMissingAccount = selectedEntries.filter(
    (e) => financialAccounts.length > 0 && !e.isRefundEntry && !e.financialAccountId && !accountAssignments[e.id],
  );
  // Entries selecionados que ainda estao PENDING — serao auto-pagos
  const pendingCount = selectedEntries.filter((e) => e.status === "PENDING" || e.status === "CONFIRMED").length;

  function applyBulkAccount() {
    if (!bulkAccountId) return;
    const nextAssign = { ...accountAssignments };
    for (const e of selectedEntries) {
      if (!e.isRefundEntry && !e.financialAccountId && !accountAssignments[e.id]) {
        nextAssign[e.id] = bulkAccountId;
      }
    }
    setAccountAssignments(nextAssign);
  }

  async function handleMatch() {
    if (!line || !matches || selectedEntryIds.size === 0) return;
    if (entriesMissingAccount.length > 0) {
      toast(`Faltam planos de contas em ${entriesMissingAccount.length} lançamento(s).`, "error");
      return;
    }
    setMatching(true);
    try {
      const assignmentsPayload = Object.entries(accountAssignments)
        .filter(([entryId, accId]) => selectedEntryIds.has(entryId) && accId)
        .map(([entryId, financialAccountId]) => ({ entryId, financialAccountId }));
      await api.post(`/finance/reconciliation/lines/${line.id}/match-card-invoice`, {
        entryIds: Array.from(selectedEntryIds),
        notes: notes || undefined,
        entryAccountAssignments: assignmentsPayload.length > 0 ? assignmentsPayload : undefined,
      });
      const msg = pendingCount > 0
        ? `Fatura conciliada: ${selectedEntryIds.size} compra(s), ${pendingCount} marcada(s) como PAGAS.`
        : `Fatura conciliada: ${selectedEntryIds.size} compra(s) vinculada(s).`;
      toast(msg, "success");
      onMatched();
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || "Erro ao conciliar fatura.", "error");
    } finally {
      setMatching(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-rose-700">&#128179; Conciliar fatura de cartao</h3>
          <p className="text-xs text-slate-500 mt-1">
            Selecione o(s) cartao(oes) e as compras que compoem esta fatura. A soma precisa bater com o valor do extrato.
          </p>
        </div>

        {/* Linha do extrato */}
        <div className="px-5 py-3 bg-rose-50/50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 truncate">{line.description}</p>
              <p className="text-xs text-slate-500">{formatDate(line.transactionDate)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500">Valor da fatura</p>
              <p className="text-lg font-bold text-rose-700">{formatCurrency(lineAbs)}</p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="px-5 py-3 border-b border-slate-200 space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1.5">Cartoes que compoem a fatura</label>
            {instruments.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nenhum cartao de credito cadastrado.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {instruments.map((inst) => (
                  <button
                    key={inst.id}
                    onClick={() => toggleCard(inst.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selectedCardIds.has(inst.id)
                        ? "bg-rose-100 border-rose-300 text-rose-800"
                        : "bg-white border-slate-300 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    &#128179; {inst.name}{inst.cardLast4 ? ` \u2022\u2022\u2022\u2022 ${inst.cardLast4}` : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">De</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Ate</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Lista de candidatos */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-medium text-slate-600 uppercase">Compras no periodo ({candidates.length})</p>
            <div className="flex items-center gap-2">
              <button onClick={selectAll} className="text-[11px] text-rose-600 hover:text-rose-700 font-medium">Selecionar todas</button>
              <span className="text-slate-300">|</span>
              <button onClick={clearAll} className="text-[11px] text-slate-500 hover:text-slate-700">Limpar</button>
            </div>
          </div>

          {/* Bulk: aplicar plano a todos os selecionados sem categoria */}
          {financialAccounts.length > 0 && entriesMissingAccount.length > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
              <span className="text-[11px] text-amber-800 whitespace-nowrap">⚠ {entriesMissingAccount.length} sem plano:</span>
              <select
                value={bulkAccountId}
                onChange={(e) => setBulkAccountId(e.target.value)}
                className="flex-1 text-[11px] rounded border border-amber-400 bg-white px-2 py-1 focus:outline-none focus:ring-1 focus:border-amber-500"
              >
                <option value="">Escolha um plano...</option>
                {renderAccountOptions(financialAccounts)}
              </select>
              <button
                onClick={applyBulkAccount}
                disabled={!bulkAccountId}
                className="text-[11px] font-medium text-white bg-amber-600 hover:bg-amber-700 rounded px-3 py-1 disabled:opacity-50 whitespace-nowrap"
              >
                Aplicar a todos
              </button>
            </div>
          )}

          {loadingCandidates ? (
            <p className="text-center text-xs text-slate-400 py-6">Carregando...</p>
          ) : candidates.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6">
              {selectedCardIds.size === 0
                ? "Selecione ao menos um cartao."
                : "Nenhuma compra encontrada no periodo."}
            </p>
          ) : (
            <div className="space-y-1">
              {candidates.map((entry) => {
                const amount = entry.netCents || entry.grossCents || 0;
                const alreadyMatched = !!entry.invoiceMatchLineId;
                const selected = selectedEntryIds.has(entry.id);
                const isPending = entry.status === "PENDING" || entry.status === "CONFIRMED";
                const needsAccount = financialAccounts.length > 0 && !entry.isRefundEntry && !entry.financialAccountId && !accountAssignments[entry.id];
                return (
                  <div
                    key={entry.id}
                    className={`rounded-lg border transition-colors ${
                      alreadyMatched
                        ? "opacity-50 bg-slate-50 border-slate-200"
                        : selected
                        ? (needsAccount ? "bg-amber-50 border-amber-400" : "bg-rose-50 border-rose-300")
                        : "bg-white border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <label className={`flex items-center gap-3 px-3 py-2 ${alreadyMatched ? "cursor-not-allowed" : "cursor-pointer"}`}>
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={alreadyMatched}
                        onChange={() => toggleEntry(entry.id)}
                        className="w-4 h-4 accent-rose-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {entry.code && <span className="text-[10px] font-mono text-slate-400">{entry.code}</span>}
                          <span className="text-sm font-medium text-slate-800 truncate">
                            {entry.partner?.name || entry.description || "—"}
                          </span>
                          {isPending && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">sera marcado como pago</span>
                          )}
                          {alreadyMatched && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">ja conciliado</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                          {entry.paidAt && <span>Pago: {formatDate(entry.paidAt)}</span>}
                          {!entry.paidAt && entry.dueDate && <span>Vence: {formatDate(entry.dueDate)}</span>}
                          {entry.paymentInstrumentRef && (
                            <span>
                              &#128179; {entry.paymentInstrumentRef.name}
                              {entry.paymentInstrumentRef.cardLast4 ? ` \u2022\u2022\u2022\u2022 ${entry.paymentInstrumentRef.cardLast4}` : ""}
                            </span>
                          )}
                          {entry.financialAccount && (
                            <span className="text-green-600">Plano: {entry.financialAccount.name}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-slate-700 tabular-nums">{formatCurrency(amount)}</span>
                    </label>
                    {selected && needsAccount && (
                      <div className="px-3 pb-2 pl-10">
                        <select
                          value={accountAssignments[entry.id] || ""}
                          onChange={(ev) => setAccountAssignments((prev) => ({ ...prev, [entry.id]: ev.target.value }))}
                          className="w-full text-[11px] rounded border border-amber-400 bg-amber-50 px-2 py-1 focus:outline-none focus:ring-1 focus:border-amber-500 focus:ring-amber-500"
                        >
                          <option value="">⚠ Escolha o plano de contas...</option>
                          {renderAccountOptions(financialAccounts)}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Resumo e soma */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Selecionados</p>
              <p className="text-sm font-bold text-slate-800">{selectedEntryIds.size}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Soma</p>
              <p className="text-sm font-bold text-slate-800">{formatCurrency(selectedTotal)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Diferenca</p>
              <p className={`text-sm font-bold ${matches && selectedEntryIds.size > 0 ? "text-green-700" : "text-red-600"}`}>
                {diff === 0 ? "R$ 0,00 \u2713" : formatCurrency(diff)}
              </p>
            </div>
          </div>
          {!matches && selectedEntryIds.size > 0 && (
            <p className="text-[11px] text-center text-red-600 mt-2">
              {diff > 0
                ? `Faltam ${formatCurrency(diff)} — selecione mais compras.`
                : `Excede em ${formatCurrency(-diff)} — remova alguma(s).`}
            </p>
          )}
        </div>

        {/* Observacao */}
        <div className="px-5 py-2 border-t border-slate-200">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observacao (opcional)"
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none"
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} disabled={matching}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={handleMatch}
            disabled={matching || !matches || selectedEntryIds.size === 0 || entriesMissingAccount.length > 0}
            title={entriesMissingAccount.length > 0 ? `Faltam planos de contas em ${entriesMissingAccount.length} lançamento(s)` : undefined}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {matching ? "Conciliando..." : "Conciliar fatura"}
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
   TRANSFER MATCH MODAL
   Concilia linha como transferencia entre contas (deposito em dinheiro, saque, etc).
   Pede apenas a outra conta (origem ou destino, conforme o sinal).
   ══════════════════════════════════════════════════════════ */

interface CashAccountOption {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  currentBalanceCents?: number;
}

function MultipleMatchModal({
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
  const [candidates, setCandidates] = useState<CardInvoiceEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [notes, setNotes] = useState("");
  // Estados pro fluxo "criar lancamento de juros/multa pra diferenca"
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccountOption[]>([]);
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustAccountId, setAdjustAccountId] = useState("");
  const [adjustDescription, setAdjustDescription] = useState("");
  const [creatingAdjust, setCreatingAdjust] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // v1.10.07: descontos da operadora (linha credito + RECEIVABLE - N PAYABLE = lineAbs)
  type DiscountRow = { id: string; amountCents: number; description: string; financialAccountId: string };
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [creatingWithDiscounts, setCreatingWithDiscounts] = useState(false);

  const direction: "RECEIVABLE" | "PAYABLE" = line && line.amountCents >= 0 ? "RECEIVABLE" : "PAYABLE";
  const oppositeType: "RECEIVABLE" | "PAYABLE" = direction === "RECEIVABLE" ? "PAYABLE" : "RECEIVABLE";
  const lineAbs = line ? Math.abs(line.amountCents) : 0;

  // Pre-fill search com nome provavel do parceiro extraido da descricao da linha.
  // Ex: "RECEBIMENTO PIX SICREDI-CX774665 08583806000161 ROYALLE PIZZARIA E CHOPERIA LTDA" → "ROYALLE"
  useEffect(() => {
    if (!open || !line) return;
    setSelectedIds(new Set());
    setNotes("");
    setShowAdjustForm(false);
    setDiscounts([]);
    // Extrai maior palavra com 5+ letras (heuristica simples)
    const tokens = (line.description || "").split(/\s+/).filter((t) => /^[A-Za-zÀ-ÿ]{5,}$/.test(t));
    const prefill = tokens[0] || "";
    setSearch(prefill);
    // Carrega planos de contas ativos pra escolher na criacao do ajuste
    api.get<FinancialAccountOption[]>("/finance/accounts/postable")
      .then((accounts) => {
        setFinancialAccounts(accounts || []);
        // Tenta pre-selecionar "Juros e Multas Recebidos" (code 7100) ou variacoes
        const jurosAcc = (accounts || []).find((a) =>
          a.code === "7100" || /juros|multa/i.test(a.name),
        );
        if (jurosAcc) setAdjustAccountId(jurosAcc.id);
      })
      .catch(() => setFinancialAccounts([]));
  }, [open, line]);

  // Debounced fetch: busca PENDING + PAID em paralelo (endpoint aceita 1 status por vez)
  useEffect(() => {
    if (!open || !line) return;
    setLoading(true);
    const t = setTimeout(() => {
      const mkParams = (status: string) => {
        const p = new URLSearchParams({
          type: direction,
          status,
          excludeMatched: "true",
          matchableForCashAccountId: line.cashAccountId,
          limit: "100",
        });
        if (search.trim()) p.set("search", search.trim());
        return p.toString();
      };
      Promise.all([
        api.get<any>(`/finance/entries?${mkParams("PENDING")}`).catch(() => ({ data: [] })),
        api.get<any>(`/finance/entries?${mkParams("PAID")}`).catch(() => ({ data: [] })),
      ])
        .then(([pendingRes, paidRes]) => {
          const pending = (pendingRes.data || pendingRes || []) as CardInvoiceEntry[];
          const paid = (paidRes.data || paidRes || []) as CardInvoiceEntry[];
          const map = new Map<string, CardInvoiceEntry>();
          [...pending, ...paid].forEach((e) => { if (!map.has(e.id)) map.set(e.id, e); });
          setCandidates(Array.from(map.values()));
        })
        .catch(() => setCandidates([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [open, line, direction, search, reloadKey]);

  if (!open || !line) return null;

  const selected = candidates.filter((e) => selectedIds.has(e.id));
  const total = selected.reduce((acc, e) => acc + (e.netCents || e.grossCents || 0), 0);
  const diff = lineAbs - total;
  // v1.10.07: descontos cobrem diferenca quando entries somam mais que linha
  const discountsTotal = discounts.reduce((acc, d) => acc + (d.amountCents || 0), 0);
  const negDiff = diff < 0 ? Math.abs(diff) : 0;
  const discountsCoverDiff = negDiff > 0 && Math.abs(discountsTotal - negDiff) <= 1 && discounts.length > 0
    && discounts.every((d) => d.amountCents > 0 && d.description.trim().length > 0);
  const matches = (Math.abs(diff) <= 1 || discountsCoverDiff) && selectedIds.size > 0;
  const pendingCount = selected.filter((e) => e.status === "PENDING" || e.status === "CONFIRMED").length;

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  }

  // v1.10.07 — descontos da operadora
  function addDiscount(presetCode?: string, presetDesc?: string) {
    const acc = presetCode ? financialAccounts.find((a) => a.code === presetCode) : null;
    setDiscounts((prev) => [
      ...prev,
      {
        id: (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
        amountCents: 0,
        description: presetDesc || "",
        financialAccountId: acc?.id || "",
      },
    ]);
  }
  function updateDiscount(id: string, patch: Partial<DiscountRow>) {
    setDiscounts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }
  function removeDiscount(id: string) {
    setDiscounts((prev) => prev.filter((d) => d.id !== id));
  }

  function openAdjustForm() {
    if (!line) return;
    // Sugere descricao baseada no parceiro mais comum dos selecionados
    const partnerNames = selected.map((e) => e.partner?.name).filter(Boolean) as string[];
    const partnerName = partnerNames[0] || "";
    const tipoAjuste = direction === "RECEIVABLE" ? "Juros/Multa recebidos" : "Juros/Multa pagos";
    setAdjustDescription(`${tipoAjuste}${partnerName ? ` — ${partnerName}` : ""}`);
    setShowAdjustForm(true);
  }

  async function handleCreateAdjust() {
    if (!line || diff <= 0) return;
    if (!adjustDescription.trim()) {
      toast("Descrição obrigatória.", "error");
      return;
    }
    // partnerId e obrigatorio no backend — pega do primeiro entry selecionado com parceiro
    const partnerId = selected.find((e) => e.partner?.id)?.partner?.id;
    if (!partnerId) {
      toast("Selecione ao menos 1 lançamento com parceiro antes de criar ajuste.", "error");
      return;
    }
    setCreatingAdjust(true);
    try {
      const created = await api.post<{ id: string }>("/finance/entries", {
        type: direction,
        description: adjustDescription.trim(),
        grossCents: diff,
        dueDate: new Date(line.transactionDate).toISOString(),
        partnerId,
        financialAccountId: adjustAccountId || undefined,
        notes: `[AUTO_RECONCILIATION_ADJUST]`,
      });
      toast(`Ajuste criado: ${formatCurrency(diff)}`, "success");
      setShowAdjustForm(false);
      // Recarrega candidates e auto-seleciona o novo entry
      const newId = (created as any).id || (created as any).data?.id;
      setReloadKey((k) => k + 1);
      if (newId) {
        // Adiciona ao set de selecionados — proxima carga vai trazer o entry
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.add(newId);
          return next;
        });
      }
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || "Erro ao criar ajuste.", "error");
    } finally {
      setCreatingAdjust(false);
    }
  }

  /**
   * v1.10.07 — Concilia com descontos: cria N entries do tipo oposto PAID na conta do
   * primeiro entry expected (geralmente VT) + chama match-multiple com tudo junto.
   * Backend valida sumExp - sumOpp = lineAbs.
   */
  async function handleMatchWithDiscounts() {
    if (!line || !discountsCoverDiff) return;
    // Pega o primeiro entry expected (RECEIVABLE quando linha credito) que esteja em outra conta.
    // Despesas vao na MESMA conta (preserva fluxo VT). Fallback: cashAccountId do primeiro selecionado.
    const expectedSelected = selected.find((e) => e.cashAccountId && e.cashAccountId !== line.cashAccountId);
    const cashAccountId = expectedSelected?.cashAccountId;
    if (!cashAccountId) {
      toast("Não foi possível identificar conta de origem (VT). Selecione um lançamento PAGO em conta diferente do banco.", "error");
      return;
    }
    const partnerId = selected.find((e) => e.partner?.id)?.partner?.id;
    if (!partnerId) {
      toast("Selecione ao menos um lançamento com parceiro identificado.", "error");
      return;
    }
    setCreatingWithDiscounts(true);
    try {
      const newIds: string[] = [];
      for (const d of discounts) {
        // 1. Cria PENDING
        const created = await api.post<any>("/finance/entries", {
          type: oppositeType,
          description: d.description.trim(),
          grossCents: d.amountCents,
          dueDate: new Date(line.transactionDate).toISOString(),
          partnerId,
          financialAccountId: d.financialAccountId || undefined,
          notes: `[AUTO_RECONCILIATION_DESCONTO]`,
        });
        const newId = (created as any).id || (created as any).data?.id;
        if (!newId) throw new Error("Não foi possível recuperar ID do desconto criado.");
        // 2. PAID na mesma conta do entry expected (decrementa saldo da conta)
        await api.patch(`/finance/entries/${newId}/status`, {
          status: "PAID",
          paidAt: new Date(line.transactionDate).toISOString(),
          cashAccountId,
        });
        newIds.push(newId);
      }
      // 3. Match-multiple [selecionados + descontos novos]
      await api.post(`/finance/reconciliation/lines/${line.id}/match-multiple`, {
        entryIds: [...Array.from(selectedIds), ...newIds],
        notes: notes || undefined,
      });
      toast(`Conciliado: ${selectedIds.size} lançamento(s) + ${newIds.length} desconto(s) (${formatCurrency(discountsTotal)}).`, "success");
      onMatched();
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || "Erro ao conciliar com descontos.", "error");
    } finally {
      setCreatingWithDiscounts(false);
    }
  }

  async function handleMatch() {
    if (!matches) return;
    // Caso descontos: rota separada (cria entries auxiliares antes de match-multiple)
    if (discountsCoverDiff) {
      return handleMatchWithDiscounts();
    }
    setMatching(true);
    try {
      await api.post(`/finance/reconciliation/lines/${line!.id}/match-multiple`, {
        entryIds: Array.from(selectedIds),
        notes: notes || undefined,
      });
      const msg = pendingCount > 0
        ? `Conciliado: ${selectedIds.size} lançamento(s), ${pendingCount} marcada(s) como PAGO.`
        : `Conciliado: ${selectedIds.size} lançamento(s) vinculado(s).`;
      toast(msg, "success");
      onMatched();
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || "Erro ao conciliar.", "error");
    } finally {
      setMatching(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-emerald-700">📈 Conciliar múltiplos lançamentos</h3>
          <p className="text-xs text-slate-500 mt-1">
            Selecione os lançamentos cuja soma bata com o valor do extrato. Todos {direction === "RECEIVABLE" ? "A Receber" : "A Pagar"}.
          </p>
        </div>

        <div className="px-5 py-3 bg-emerald-50/50 border-b border-slate-200 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800 truncate">{line.description}</p>
            <p className="text-xs text-slate-500">{formatDate(line.transactionDate)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500">Valor da linha</p>
            <p className="text-lg font-bold text-emerald-700">{formatCurrency(lineAbs)}</p>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-slate-200">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por parceiro, código ou descrição..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading && <p className="text-xs text-slate-400 italic">Carregando...</p>}
          {!loading && candidates.length === 0 && (
            <p className="text-xs text-slate-400 italic">Nenhum lançamento encontrado. Ajuste a busca.</p>
          )}
          {!loading && candidates.map((e) => {
            const checked = selectedIds.has(e.id);
            const amount = e.netCents || e.grossCents || 0;
            return (
              <label key={e.id} className={`flex items-center gap-3 py-2 px-2 rounded border-b border-slate-50 cursor-pointer ${checked ? "bg-emerald-50" : "hover:bg-slate-100"}`}>
                <input type="checkbox" checked={checked} onChange={() => toggle(e.id)} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">
                    {e.code} — {e.description}
                    {e.status === "PENDING" && <span className="ml-2 text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700">Pendente</span>}
                    {e.status === "PAID" && <span className="ml-2 text-[9px] px-1 py-0.5 rounded bg-slate-100 text-slate-600">Pago</span>}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">{e.partner?.name || "—"}</p>
                </div>
                <p className="text-xs font-semibold text-slate-800 whitespace-nowrap">{formatCurrency(amount)}</p>
              </label>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 space-y-2">
          <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${matches ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50 border border-slate-200"}`}>
            <span className="text-xs text-slate-600">Soma ({selectedIds.size} selecionado{selectedIds.size === 1 ? "" : "s"})</span>
            <div className="text-right">
              <p className={`text-sm font-bold ${matches ? "text-emerald-700" : "text-slate-700"}`}>{formatCurrency(total)}</p>
              {!matches && selectedIds.size > 0 && (
                <p className="text-[10px] text-amber-600">Diferença: {formatCurrency(Math.abs(diff))}</p>
              )}
            </div>
          </div>

          {/* Criar lancamento de ajuste pra diferenca positiva (juros/multa em RECEIVABLE; encargos em PAYABLE) */}
          {!matches && diff > 0 && selectedIds.size > 0 && !showAdjustForm && (
            <button
              type="button"
              onClick={openAdjustForm}
              className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
            >
              + Criar lançamento de ajuste para diferença {formatCurrency(diff)}
              {direction === "RECEIVABLE" ? " (juros/multa recebida)" : " (encargos)"}
            </button>
          )}
          {showAdjustForm && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800">
                Ajuste de {formatCurrency(diff)} — {direction === "RECEIVABLE" ? "Juros/Multa recebida" : "Encargos pagos"}
              </p>
              <div>
                <label className="block text-[10px] font-medium text-slate-600 mb-1">Descrição *</label>
                <input
                  type="text"
                  value={adjustDescription}
                  onChange={(e) => setAdjustDescription(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                  placeholder="Juros/Multa..."
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-600 mb-1">Plano de contas</label>
                <select
                  value={adjustAccountId}
                  onChange={(e) => setAdjustAccountId(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs bg-white"
                >
                  <option value="">— sem plano —</option>
                  {financialAccounts
                    .filter((a) => direction === "RECEIVABLE" ? a.type === "REVENUE" : a.type === "EXPENSE")
                    .map((a) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdjustForm(false)}
                  disabled={creatingAdjust}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateAdjust}
                  disabled={creatingAdjust || !adjustDescription.trim()}
                  className="px-3 py-1.5 text-xs font-semibold text-white rounded bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                >
                  {creatingAdjust ? "Criando..." : "Criar e adicionar"}
                </button>
              </div>
            </div>
          )}

          {/* v1.10.07 — Descontos da operadora (diff NEGATIVO: entries somam mais que linha) */}
          {diff < 0 && selectedIds.size > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-rose-800">
                    Diferença de {formatCurrency(Math.abs(diff))} — descontos sobre o valor recebido
                  </p>
                  <p className="text-[10px] text-rose-700 mt-0.5">
                    {direction === "RECEIVABLE"
                      ? "Operadora descontou taxa, aluguel da maquininha ou outros encargos. Adicione cada desconto abaixo."
                      : "Linha maior que pagamento. Adicione lançamentos auxiliares."}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-rose-600">Faltam</p>
                  <p className={`text-sm font-bold ${discountsCoverDiff ? "text-emerald-700" : "text-rose-700"}`}>
                    {formatCurrency(Math.max(0, negDiff - discountsTotal))}
                  </p>
                </div>
              </div>

              {discounts.map((d, idx) => (
                <div key={d.id} className="flex items-start gap-2 bg-white rounded border border-rose-200 p-2">
                  <span className="text-[10px] text-slate-400 mt-2 w-4">{idx + 1}.</span>
                  <div className="flex-1 grid grid-cols-12 gap-2">
                    <input
                      type="text"
                      value={d.description}
                      onChange={(e) => updateDiscount(d.id, { description: e.target.value })}
                      placeholder="Descrição (ex: Taxa cartão MASTER 1,55%)"
                      className="col-span-6 rounded border border-slate-300 px-2 py-1 text-[11px]"
                    />
                    <select
                      value={d.financialAccountId}
                      onChange={(e) => updateDiscount(d.id, { financialAccountId: e.target.value })}
                      className="col-span-4 rounded border border-slate-300 px-1.5 py-1 text-[11px] bg-white"
                    >
                      <option value="">— plano —</option>
                      {financialAccounts
                        .filter((a) => oppositeType === "PAYABLE" ? a.type === "EXPENSE" : a.type === "REVENUE")
                        .map((a) => (
                          <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                        ))}
                    </select>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={d.amountCents > 0 ? (d.amountCents / 100).toFixed(2).replace(".", ",") : ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(/\./g, "").replace(",", ".")) || 0;
                        updateDiscount(d.id, { amountCents: Math.round(val * 100) });
                      }}
                      placeholder="0,00"
                      className="col-span-2 rounded border border-slate-300 px-2 py-1 text-[11px] text-right font-medium"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDiscount(d.id)}
                    className="text-rose-500 hover:text-rose-700 text-sm leading-none mt-1"
                    title="Remover"
                  >
                    ×
                  </button>
                </div>
              ))}

              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => addDiscount("5200", "Taxa cartão")}
                  className="text-[10px] px-2 py-1 rounded bg-rose-100 text-rose-800 hover:bg-rose-200 font-medium"
                >
                  + Taxa cartão
                </button>
                <button
                  type="button"
                  onClick={() => addDiscount("3201", "Aluguel maquininha")}
                  className="text-[10px] px-2 py-1 rounded bg-rose-100 text-rose-800 hover:bg-rose-200 font-medium"
                >
                  + Aluguel maquininha
                </button>
                <button
                  type="button"
                  onClick={() => addDiscount()}
                  className="text-[10px] px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"
                >
                  + Outro desconto
                </button>
                {discountsTotal !== negDiff && discountsTotal > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      // Auto-ajusta a ULTIMA linha pra fechar a diferenca
                      const last = discounts[discounts.length - 1];
                      if (!last) return;
                      const remainder = last.amountCents + (negDiff - discountsTotal);
                      if (remainder > 0) updateDiscount(last.id, { amountCents: remainder });
                    }}
                    className="text-[10px] px-2 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 font-medium"
                    title="Ajusta a última linha pra zerar a diferença"
                  >
                    ⚖ Fechar diferença
                  </button>
                )}
              </div>
            </div>
          )}

          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações (opcional)"
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs"
          />
          <div className="flex justify-end gap-2">
            <button onClick={onClose} disabled={matching || creatingWithDiscounts} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
            <button
              onClick={handleMatch}
              disabled={!matches || matching || creatingWithDiscounts}
              className="px-5 py-2 text-sm font-semibold text-white rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={matches ? "" : (diff < 0 ? "Adicione descontos que somem o valor faltante" : "A soma precisa bater com o valor da linha")}
            >
              {creatingWithDiscounts ? "Criando descontos..." : matching ? "Conciliando..." : (discountsCoverDiff ? "Conciliar com descontos" : "Conciliar")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TransferMatchModal({
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
  const [accounts, setAccounts] = useState<CashAccountOption[]>([]);
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [matching, setMatching] = useState(false);

  const isCredit = line ? line.amountCents > 0 : false;
  const amount = line ? Math.abs(line.amountCents) : 0;

  useEffect(() => {
    if (!open || !line) return;
    setSourceAccountId("");
    setDescription(isCredit
      ? `Depósito em ${line.description}`
      : `Saque de ${line.description}`);

    // Carrega contas ativas EXCETO a propria conta do extrato
    api
      .get<CashAccountOption[]>("/finance/cash-accounts")
      .then((list) => {
        const filtered = (list || []).filter((a) => a.isActive && a.id !== line.cashAccountId);
        setAccounts(filtered);
      })
      .catch(() => setAccounts([]));
  }, [open, line, isCredit]);

  if (!open || !line) return null;

  async function handleMatch() {
    if (!line || !sourceAccountId) return;
    setMatching(true);
    try {
      await api.post(`/finance/reconciliation/lines/${line.id}/match-as-transfer`, {
        sourceAccountId,
        description: description.trim() || undefined,
      });
      toast("Transferencia criada e linha conciliada!", "success");
      onMatched();
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || "Erro ao conciliar transferencia.", "error");
    } finally {
      setMatching(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">
            &#8644; Conciliar como transferência
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Use para depósitos em dinheiro, saques e transferências entre suas próprias contas. Cria uma transferência entre contas e não gera receita/despesa.
          </p>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Bank line preview */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
            <div className="flex items-center justify-between">
              <span className="truncate">{line.description}</span>
              <span className={`font-semibold ml-2 ${isCredit ? "text-green-700" : "text-red-700"}`}>
                {formatCurrency(line.amountCents)}
              </span>
            </div>
            <div className="text-slate-400 mt-0.5">{formatDate(line.transactionDate)}</div>
          </div>

          {/* Explicacao da direcao */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">
            {isCredit ? (
              <>
                <strong>Dinheiro entrou</strong> na conta do extrato. Selecione de qual outra conta ele saiu
                (ex: Caixa, quando você depositou dinheiro físico no banco).
              </>
            ) : (
              <>
                <strong>Dinheiro saiu</strong> da conta do extrato. Selecione para qual outra conta foi
                (ex: Caixa, quando você sacou dinheiro do banco).
              </>
            )}
          </div>

          {/* Source account */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {isCredit ? "Conta de origem (de onde saiu)" : "Conta de destino (para onde foi)"} <span className="text-red-500">*</span>
            </label>
            <select
              value={sourceAccountId}
              onChange={(e) => setSourceAccountId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="">Selecione uma conta...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {typeof a.currentBalanceCents === "number"
                    ? ` (${formatCurrency(a.currentBalanceCents)})`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição da transferência"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Valor preview */}
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 border border-slate-200">
            Valor da transferência: <strong>{formatCurrency(amount)}</strong>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={matching}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleMatch}
            disabled={!sourceAccountId || matching}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {matching ? "Salvando..." : "Criar transferência e conciliar"}
          </button>
        </div>
      </div>
    </div>
  );
}

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

interface BalanceCompare {
  hasBalance: boolean;
  cashAccountName: string;
  bankBalanceCents: number | null;
  bankBalanceDate: string | null;
  systemBalanceCents: number | null;
  diffCents: number | null;
  matches: boolean | null;
}

function LinesDetail({ statement, onChanged }: { statement: BankStatement; onChanged?: () => void }) {
  const [lines, setLines] = useState<BankStatementLine[]>([]);
  const [allLinesForPair, setAllLinesForPair] = useState<BankStatementLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [matchLine, setMatchLine] = useState<BankStatementLine | null>(null);
  const [refundLine, setRefundLine] = useState<BankStatementLine | null>(null);
  const [cardInvoiceLine, setCardInvoiceLine] = useState<BankStatementLine | null>(null);
  const [multipleLine, setMultipleLine] = useState<BankStatementLine | null>(null);
  const [transferLine, setTransferLine] = useState<BankStatementLine | null>(null);
  const [balanceCompare, setBalanceCompare] = useState<BalanceCompare | null>(null);
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [balanceInputValue, setBalanceInputValue] = useState("");
  const [balanceInputDate, setBalanceInputDate] = useState("");
  const [balanceSaving, setBalanceSaving] = useState(false);
  const { toast } = useToast();

  // Carrega o comparativo de saldo (banco vs sistema) quando o statement muda
  const loadBalanceCompare = useCallback(() => {
    if (!statement?.id) return;
    api
      .get<BalanceCompare>(`/finance/reconciliation/statements/${statement.id}/balance-compare`)
      .then(setBalanceCompare)
      .catch(() => setBalanceCompare(null));
  }, [statement?.id]);

  useEffect(() => {
    loadBalanceCompare();
  }, [loadBalanceCompare]);

  // Abre o modal de informar saldo manual. Pre-preenche com valor atual (se houver)
  // e data do ultimo dia do mes do extrato como padrao.
  function openBalanceModal() {
    if (balanceCompare?.bankBalanceCents != null) {
      setBalanceInputValue((balanceCompare.bankBalanceCents / 100).toFixed(2).replace(".", ","));
    } else {
      setBalanceInputValue("");
    }
    if (balanceCompare?.bankBalanceDate) {
      setBalanceInputDate(balanceCompare.bankBalanceDate.slice(0, 10));
    } else {
      // Default: ultimo dia do mes do extrato
      const lastDay = new Date(statement.periodYear, statement.periodMonth, 0).getDate();
      setBalanceInputDate(
        `${statement.periodYear}-${String(statement.periodMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      );
    }
    setBalanceModalOpen(true);
  }

  async function saveManualBalance() {
    const cents = Math.round((parseFloat(balanceInputValue.replace(",", ".")) || 0) * 100);
    if (!balanceInputDate) {
      toast("Informe a data de referencia.", "error");
      return;
    }
    setBalanceSaving(true);
    try {
      await api.patch(`/finance/reconciliation/statements/${statement.id}/balance`, {
        balanceCents: cents,
        balanceDate: `${balanceInputDate}T23:59:59.999-03:00`,
      });
      toast("Saldo do banco salvo!", "success");
      setBalanceModalOpen(false);
      loadBalanceCompare();
    } catch (err: any) {
      toast(err?.response?.data?.message || "Erro ao salvar saldo.", "error");
    } finally {
      setBalanceSaving(false);
    }
  }

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
      {/* Card comparativo: saldo do banco (OFX ou manual) vs saldo calculado pelo sistema */}
      {balanceCompare?.hasBalance && balanceCompare.bankBalanceDate ? (
        <div className={`mb-3 rounded-xl border p-3 ${
          balanceCompare.matches
            ? "border-green-200 bg-green-50/50"
            : "border-amber-300 bg-amber-50/70"
        }`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">
                {balanceCompare.matches ? "\u2705" : "\u26A0\uFE0F"} Conferencia de saldo
              </span>
              <span className="text-[10px] text-slate-500">
                Data de referencia: {formatDate(balanceCompare.bankBalanceDate)}
              </span>
            </div>
            <button
              onClick={openBalanceModal}
              className="text-[10px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
              title="Corrigir o saldo informado"
            >
              Editar
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-[10px] text-slate-500 mb-0.5">Saldo no banco</p>
              <p className="font-semibold text-slate-800">{formatCurrency(balanceCompare.bankBalanceCents!)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 mb-0.5">Saldo no sistema (calculado)</p>
              <p className="font-semibold text-slate-800">{formatCurrency(balanceCompare.systemBalanceCents!)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 mb-0.5">Diferenca</p>
              <p className={`font-semibold ${
                balanceCompare.matches
                  ? "text-green-700"
                  : Math.abs(balanceCompare.diffCents || 0) > 0
                  ? "text-red-700"
                  : "text-slate-800"
              }`}>
                {formatCurrency(balanceCompare.diffCents || 0)}
              </p>
            </div>
          </div>
          {!balanceCompare.matches && (
            <p className="text-[11px] text-amber-800 mt-2">
              O saldo do sistema nao bate com o banco. Verifique se todos os lancamentos foram registrados e conciliados corretamente.
            </p>
          )}
        </div>
      ) : (
        // Nao tem saldo cadastrado — oferece botao pra informar manualmente
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-700">Conferir saldo com o banco</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Informe o saldo oficial do banco na data de fechamento do mes para comparar com o sistema.
            </p>
          </div>
          <button
            onClick={openBalanceModal}
            className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 whitespace-nowrap"
          >
            Informar saldo
          </button>
        </div>
      )}

      {/* Modal de informar saldo manual */}
      {balanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-800">Informar saldo do banco</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Digite o saldo que o banco mostra no final do dia de referencia.
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Data de referencia</label>
                <input
                  type="date"
                  value={balanceInputDate}
                  onChange={(e) => setBalanceInputDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Saldo no banco (R$)</label>
                <input
                  type="text"
                  value={balanceInputValue}
                  onChange={(e) => setBalanceInputValue(e.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Valor positivo: dinheiro em conta. Negativo: conta em aberto.
                </p>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setBalanceModalOpen(false)}
                disabled={balanceSaving}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveManualBalance}
                disabled={balanceSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {balanceSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <tr key={line.id} className="border-b border-slate-100 hover:bg-slate-100 transition-colors">
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
                            onConciliarCardInvoice={() => setCardInvoiceLine(line)}
                            onConciliarMultiple={() => setMultipleLine(line)}
                            onConciliarTransfer={() => setTransferLine(line)}
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

      {/* Card Invoice Modal (fatura de cartao N-para-1) */}
      <CardInvoiceMatchModal
        open={!!cardInvoiceLine}
        line={cardInvoiceLine}
        onClose={() => setCardInvoiceLine(null)}
        onMatched={() => { setCardInvoiceLine(null); refreshAll(); }}
      />

      {/* Multiple Match Modal (PIX/boleto/transferencia N-para-1) */}
      <MultipleMatchModal
        open={!!multipleLine}
        line={multipleLine}
        onClose={() => setMultipleLine(null)}
        onMatched={() => { setMultipleLine(null); refreshAll(); }}
      />

      {/* Transfer Match Modal (deposito em dinheiro, transferencia entre contas) */}
      <TransferMatchModal
        open={!!transferLine}
        line={transferLine}
        onClose={() => setTransferLine(null)}
        onMatched={() => { setTransferLine(null); refreshAll(); }}
      />
    </div>
  );
}
