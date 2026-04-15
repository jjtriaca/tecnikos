"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import type { PaymentInstrument, PaymentMethod, CashAccount } from "@/types/finance";

/* ── Form data ────────────────────────────────────────── */

type AccountOption = "none" | "existing" | "exclusive";

/** Faixa de taxa de parcelamento (v1.09.04) */
interface FeeRateRow {
  installmentFrom: string; // string pra input controlado
  installmentTo: string;
  feePercent: string;
  receivingDays: string;
}

interface PIFormData {
  name: string;
  paymentMethodId: string;
  cardLast4: string;
  cardBrand: string;
  bankName: string;
  cashAccountId: string;
  details: string;
  billingClosingDay: string;
  billingDueDay: string;
  isActive: boolean;
  sortOrder: string;
  // Direcao (v1.08.100)
  showInReceivables: boolean;
  showInPayables: boolean;
  // Comportamento (v1.08.100)
  autoMarkPaid: boolean;
  feePercent: string;
  receivingDays: string;
  // Conta (v1.08.100)
  accountOption: AccountOption;
  // Taxas embutidas (v1.09.04)
  feeRates: FeeRateRow[];
}

const EMPTY_FORM: PIFormData = {
  name: "",
  paymentMethodId: "",
  cardLast4: "",
  cardBrand: "",
  bankName: "",
  cashAccountId: "",
  details: "",
  billingClosingDay: "",
  billingDueDay: "",
  isActive: true,
  sortOrder: "0",
  showInReceivables: true,
  showInPayables: true,
  autoMarkPaid: false,
  feePercent: "",
  receivingDays: "",
  accountOption: "none",
  feeRates: [],
};

const CARD_BRANDS = ["Visa", "Mastercard", "Elo", "Hipercard", "American Express", "Outros"];

/* ══════════════════════════════════════════════════════════
   PAYMENT INSTRUMENTS TAB
   ══════════════════════════════════════════════════════════ */

export default function PaymentInstrumentsTab() {
  const [instruments, setInstruments] = useState<PaymentInstrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PIFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaymentInstrument | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Lookup data
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);

  const { toast } = useToast();

  const loadInstruments = useCallback(async () => {
    try {
      const result = await api.get<PaymentInstrument[]>("/finance/payment-instruments");
      setInstruments(result);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    try {
      const [pms, cas] = await Promise.all([
        api.get<PaymentMethod[]>("/finance/payment-methods/active"),
        api.get<CashAccount[]>("/finance/cash-accounts/active"),
      ]);
      setPaymentMethods(pms);
      setCashAccounts(cas);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadInstruments();
    loadLookups();
  }, [loadInstruments, loadLookups]);

  // Determine if selected payment method requires brand (card)
  const selectedPM = paymentMethods.find((p) => p.id === formData.paymentMethodId);
  const isCard = !!selectedPM?.requiresBrand;
  const isCreditCard = !!selectedPM && /CREDITO|CREDIT/i.test(selectedPM.code || "");

  function openNewForm() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(pi: PaymentInstrument) {
    setEditingId(pi.id);
    // Determinar accountOption: se pi tem cashAccount e e CARTAO_CREDITO = exclusive; se tem = existing; senao = none
    const caType = (pi.cashAccount as any)?.type;
    const accountOption: AccountOption = caType === "CARTAO_CREDITO" ? "exclusive" : pi.cashAccountId ? "existing" : "none";
    setFormData({
      name: pi.name,
      paymentMethodId: pi.paymentMethodId,
      cardLast4: pi.cardLast4 || "",
      cardBrand: pi.cardBrand || "",
      bankName: pi.bankName || "",
      cashAccountId: pi.cashAccountId || "",
      details: pi.details || "",
      billingClosingDay: pi.billingClosingDay ? String(pi.billingClosingDay) : "",
      billingDueDay: pi.billingDueDay ? String(pi.billingDueDay) : "",
      isActive: pi.isActive,
      sortOrder: String(pi.sortOrder),
      showInReceivables: (pi as any).showInReceivables ?? true,
      showInPayables: (pi as any).showInPayables ?? true,
      autoMarkPaid: (pi as any).autoMarkPaid ?? false,
      feePercent: (pi as any).feePercent != null ? String((pi as any).feePercent) : "",
      receivingDays: (pi as any).receivingDays != null ? String((pi as any).receivingDays) : "",
      accountOption,
      feeRates: Array.isArray((pi as any).feeRates)
        ? (pi as any).feeRates.map((r: any) => ({
            installmentFrom: String(r.installmentFrom ?? 1),
            installmentTo: String(r.installmentTo ?? 1),
            feePercent: r.feePercent != null ? String(r.feePercent).replace(".", ",") : "",
            receivingDays: r.receivingDays != null ? String(r.receivingDays) : "",
          }))
        : [],
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  }

  // Auto-generate name based on selections
  function autoName() {
    const pm = paymentMethods.find((p) => p.id === formData.paymentMethodId);
    if (!pm) return;
    const parts: string[] = [];
    if (formData.cardBrand) parts.push(formData.cardBrand);
    else parts.push(pm.name);
    if (formData.cardLast4) parts.push(`Final ${formData.cardLast4}`);
    if (formData.bankName) parts.push(formData.bankName);
    const ca = cashAccounts.find((a) => a.id === formData.cashAccountId);
    if (ca && !formData.bankName) parts.push(ca.name);
    setFormData({ ...formData, name: parts.join(" ") });
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast("Informe o nome do instrumento.", "error");
      return;
    }
    if (!formData.paymentMethodId) {
      toast("Selecione a forma de pagamento.", "error");
      return;
    }
    if (!formData.showInReceivables && !formData.showInPayables) {
      toast("Marque ao menos uma direcao: recebimento ou pagamento.", "error");
      return;
    }

    // Valida faixas de taxa preenchidas
    const validFeeRates = formData.feeRates
      .map((r) => {
        const from = parseInt(r.installmentFrom, 10);
        const to = parseInt(r.installmentTo, 10);
        const pct = parseFloat((r.feePercent || "").replace(",", "."));
        const days = r.receivingDays ? parseInt(r.receivingDays, 10) : null;
        if (!from || !to || isNaN(pct)) return null;
        return { installmentFrom: from, installmentTo: to, feePercent: pct, receivingDays: days };
      })
      .filter((r): r is NonNullable<typeof r> => !!r);

    // Valida sobreposicao local (frontend) antes de enviar
    const sortedRates = [...validFeeRates].sort((a, b) => a.installmentFrom - b.installmentFrom);
    for (let i = 0; i < sortedRates.length; i++) {
      const r = sortedRates[i];
      if (r.installmentFrom > r.installmentTo) {
        toast(`Faixa ${r.installmentFrom}-${r.installmentTo}: inicio maior que fim.`, "error");
        return;
      }
      if (i > 0 && r.installmentFrom <= sortedRates[i - 1].installmentTo) {
        toast(`Faixas de taxa se sobrepoem (${sortedRates[i - 1].installmentFrom}-${sortedRates[i - 1].installmentTo} e ${r.installmentFrom}-${r.installmentTo}).`, "error");
        return;
      }
    }

    setSaving(true);
    const effectiveCashAccountId = formData.accountOption === "existing" ? (formData.cashAccountId || null) : null;
    const createExclusive = formData.accountOption === "exclusive";
    const payload: Record<string, unknown> = {
      name: formData.name.trim(),
      paymentMethodId: formData.paymentMethodId,
      cardLast4: formData.cardLast4.trim() || null,
      cardBrand: formData.cardBrand || null,
      bankName: formData.bankName.trim() || null,
      cashAccountId: effectiveCashAccountId,
      createExclusiveAccount: createExclusive,
      details: formData.details.trim() || null,
      billingClosingDay: formData.billingClosingDay ? parseInt(formData.billingClosingDay, 10) : null,
      billingDueDay: formData.billingDueDay ? parseInt(formData.billingDueDay, 10) : null,
      isActive: formData.isActive,
      sortOrder: parseInt(formData.sortOrder, 10) || 0,
      showInReceivables: formData.showInReceivables,
      showInPayables: formData.showInPayables,
      autoMarkPaid: formData.autoMarkPaid,
      feePercent: formData.feePercent ? parseFloat(formData.feePercent.replace(",", ".")) : null,
      receivingDays: formData.receivingDays ? parseInt(formData.receivingDays, 10) : null,
      feeRates: validFeeRates,
    };

    try {
      if (editingId) {
        await api.patch(`/finance/payment-instruments/${editingId}`, payload);
        toast("Instrumento atualizado!", "success");
      } else {
        await api.post("/finance/payment-instruments", payload);
        toast("Instrumento criado!", "success");
      }
      closeForm();
      await loadInstruments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar.";
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(pi: PaymentInstrument) {
    try {
      await api.patch(`/finance/payment-instruments/${pi.id}`, { isActive: !pi.isActive });
      toast(pi.isActive ? "Instrumento desativado." : "Instrumento ativado.", "success");
      await loadInstruments();
    } catch {
      toast("Erro ao alterar status.", "error");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/finance/payment-instruments/${deleteTarget.id}`);
      toast("Instrumento excluido!", "success");
      setDeleteTarget(null);
      await loadInstruments();
    } catch {
      toast("Erro ao excluir.", "error");
    } finally {
      setDeleting(false);
    }
  }

  function instrumentIcon(pi: PaymentInstrument) {
    const code = pi.paymentMethod?.code || "";
    if (code.includes("CARTAO") || code.includes("CREDITO") || code.includes("DEBITO")) return "💳";
    if (code === "PIX") return "⚡";
    if (code === "DINHEIRO") return "💵";
    if (code === "BOLETO") return "📄";
    if (code === "TRANSFERENCIA") return "🔄";
    if (code === "CHEQUE") return "📝";
    return "💰";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Meios de Pagamento e Recebimento</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cadastre aqui tudo que a empresa usa para receber ou pagar (cartoes, PIX, contas, cheques, boletos...)
          </p>
        </div>
        <button
          onClick={openNewForm}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + Novo Meio
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : instruments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <div className="text-3xl mb-2">🏷️</div>
          <p className="text-sm text-slate-500 mb-3">
            Nenhum instrumento de pagamento cadastrado.
          </p>
          <p className="text-xs text-slate-400">
            Cadastre seus cartoes, contas PIX, contas bancarias para facilitar a conciliacao.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {instruments.map((pi) => (
            <div
              key={pi.id}
              className={`rounded-xl border bg-white p-4 shadow-sm transition-colors ${
                pi.isActive ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg">{instrumentIcon(pi)}</span>
                    <span className="text-sm font-semibold text-slate-900">{pi.name}</span>
                    {pi.paymentMethod && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        {pi.paymentMethod.name}
                      </span>
                    )}
                    {!pi.isActive && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
                        Inativo
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-slate-500">
                    {(pi as any).showInReceivables && (
                      <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-1.5 py-0.5 text-[9px] font-semibold text-green-700">
                        ↓ Recebe
                      </span>
                    )}
                    {(pi as any).showInPayables && (
                      <span className="inline-flex items-center rounded-full bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700">
                        ↑ Paga
                      </span>
                    )}
                    {(pi as any).autoMarkPaid && (
                      <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700" title="Lancamento nasce PAGO">
                        ⚡ Baixa auto
                      </span>
                    )}
                    {pi.cardBrand && <span>Bandeira: {pi.cardBrand}</span>}
                    {pi.cardLast4 && <span>Final: {pi.cardLast4}</span>}
                    {pi.bankName && <span>Banco: {pi.bankName}</span>}
                    {pi.cashAccount && <span>Conta: {pi.cashAccount.name}</span>}
                    {(pi as any).feePercent != null && <span>Taxa: {(pi as any).feePercent}%</span>}
                    {(pi as any).receivingDays != null && <span>D+{(pi as any).receivingDays}</span>}
                    {pi.details && <span className="text-slate-400 truncate max-w-[200px]">{pi.details}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggleActive(pi)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      pi.isActive ? "bg-blue-600" : "bg-slate-300"
                    }`}
                    title={pi.isActive ? "Desativar" : "Ativar"}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        pi.isActive ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  {/* Edit */}
                  <button
                    onClick={() => openEditForm(pi)}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                    title="Editar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => setDeleteTarget(pi)}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-red-600 hover:border-red-300 transition-colors"
                    title="Excluir"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative mx-4 w-full max-w-2xl rounded-2xl bg-white shadow-xl animate-scale-in max-h-[92vh] flex flex-col">
            <div className="px-6 pt-5 pb-3 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">
                {editingId ? "Editar Meio" : "Novo Meio de Pagamento/Recebimento"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure como este meio deve se comportar nos lancamentos financeiros.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* ═══ SECAO 1: Tipo e identificacao ═══ */}
              <section>
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Identificacao
                </h4>
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Tipo *</label>
                    <select
                      value={formData.paymentMethodId}
                      onChange={(e) => setFormData({ ...formData, paymentMethodId: e.target.value, cardBrand: "", cardLast4: "" })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                    >
                      <option value="">Selecione o tipo (PIX, Cartao Credito, Boleto, ...)</option>
                      {paymentMethods.map((pm) => (
                        <option key={pm.id} value={pm.id}>{pm.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-600">Nome *</label>
                      {formData.paymentMethodId && (
                        <button
                          type="button"
                          onClick={autoName}
                          className="text-[10px] text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Gerar nome automatico
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Master Ueslei, PIX CNPJ da empresa, Conta Sicredi"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      autoFocus
                    />
                  </div>

                  {isCard && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Bandeira</label>
                        <select
                          value={formData.cardBrand}
                          onChange={(e) => setFormData({ ...formData, cardBrand: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                        >
                          <option value="">Selecione...</option>
                          {CARD_BRANDS.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Ultimos 4 digitos</label>
                        <input
                          type="text"
                          maxLength={4}
                          value={formData.cardLast4}
                          onChange={(e) => setFormData({ ...formData, cardLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                          placeholder="0104"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* ═══ SECAO 2: Direcao de uso ═══ */}
              <section>
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Direcao de uso
                </h4>
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                  <p className="text-[11px] text-slate-500 mb-1">
                    Em quais tipos de lancamento este meio aparece nos dropdowns:
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showInReceivables}
                      onChange={(e) => setFormData({ ...formData, showInReceivables: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-slate-700">
                      <span className="font-medium text-green-700">Recebimentos</span>
                      <span className="text-xs text-slate-500 ml-1">— cliente paga a empresa</span>
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showInPayables}
                      onChange={(e) => setFormData({ ...formData, showInPayables: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-sm text-slate-700">
                      <span className="font-medium text-rose-700">Pagamentos</span>
                      <span className="text-xs text-slate-500 ml-1">— empresa paga fornecedor</span>
                    </span>
                  </label>
                </div>
              </section>

              {/* ═══ SECAO 3: Comportamento ═══ */}
              <section>
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Comportamento ao lancar
                </h4>
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.autoMarkPaid}
                      onChange={(e) => setFormData({ ...formData, autoMarkPaid: e.target.checked })}
                      className="h-4 w-4 mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm text-slate-700">
                      <span className="font-medium">Baixa automatica ao usar</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Lancamento ja nasce como PAGO (recomendado para Dinheiro e PIX instantaneo). Desmarcar para cartoes e boletos que precisam conciliar com extrato.
                      </p>
                    </span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Taxa padrao (%)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formData.feePercent}
                        onChange={(e) => setFormData({ ...formData, feePercent: e.target.value.replace(/[^0-9.,]/g, "") })}
                        placeholder="Ex: 2,5"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">Atalho para taxas simples (cartoes).</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Prazo recebimento (dias)</label>
                      <input
                        type="number"
                        min={0}
                        value={formData.receivingDays}
                        onChange={(e) => setFormData({ ...formData, receivingDays: e.target.value })}
                        placeholder="Ex: 30"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">D+N para cartoes/cheques.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* ═══ SECAO 4: Conta vinculada ═══ */}
              <section>
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  Conta Caixa/Banco vinculada
                </h4>
                {isCreditCard && formData.showInPayables && !formData.showInReceivables ? (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    <span className="font-medium">💳 Cartao de credito de pagamento — conta virtual automatica:</span>
                    <p className="mt-0.5">
                      O sistema cria e gerencia uma conta "Cartao {formData.name || "..."}" para acumular o saldo devedor da fatura. Voce paga a fatura depois via transferencia da sua conta bancaria.
                    </p>
                    <p className="mt-1 text-[10px] italic">
                      Para mudar: desmarque o checkbox "Pagamentos" ou marque "Recebimentos" na secao Direcao de uso.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="accountOption"
                        checked={formData.accountOption === "none"}
                        onChange={() => setFormData({ ...formData, accountOption: "none", cashAccountId: "" })}
                        className="h-4 w-4 mt-0.5 border-slate-300 text-slate-600 focus:ring-slate-500"
                      />
                      <span className="text-sm text-slate-700">
                        <span className="font-medium">Nenhuma conta</span>
                        <p className="text-[11px] text-slate-500">Apenas identifica o meio; saldo fica em "Valores em Transito" do sistema.</p>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="accountOption"
                        checked={formData.accountOption === "existing"}
                        onChange={() => setFormData({ ...formData, accountOption: "existing" })}
                        className="h-4 w-4 mt-0.5 border-slate-300 text-slate-600 focus:ring-slate-500"
                      />
                      <span className="text-sm text-slate-700 flex-1">
                        <span className="font-medium">Usar conta existente</span>
                        {formData.accountOption === "existing" && (
                          <select
                            value={formData.cashAccountId}
                            onChange={(e) => setFormData({ ...formData, cashAccountId: e.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                          >
                            <option value="">Selecione a conta...</option>
                            {cashAccounts.filter((ca: any) => ca.type !== "CARTAO_CREDITO").map((ca) => (
                              <option key={ca.id} value={ca.id}>
                                {ca.name} ({ca.type === "BANCO" ? "Banco" : ca.type === "TRANSITO" ? "Transito" : "Caixa"})
                              </option>
                            ))}
                          </select>
                        )}
                      </span>
                    </label>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="accountOption"
                        checked={formData.accountOption === "exclusive"}
                        onChange={() => setFormData({ ...formData, accountOption: "exclusive", cashAccountId: "" })}
                        className="h-4 w-4 mt-0.5 border-slate-300 text-slate-600 focus:ring-slate-500"
                      />
                      <span className="text-sm text-slate-700">
                        <span className="font-medium">Criar conta exclusiva</span>
                        <p className="text-[11px] text-slate-500">Sistema cria uma nova conta dedicada, vinculada a este meio. Uso recomendado quando quer rastrear o saldo individualmente.</p>
                      </span>
                    </label>
                  </div>
                )}
              </section>

              {/* ═══ SECAO 4.5: Taxas de parcelamento (cartoes) ═══ */}
              {selectedPM?.requiresBrand && (
                <section>
                  <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    Taxas de parcelamento
                  </h4>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                    <p className="text-[11px] text-slate-500">
                      Adicione faixas de parcelamento com taxa e prazo (D+N). Ex: 1x a 1x (2,29% D+30), 2x a 6x (2,77% D+30).
                    </p>

                    {formData.feeRates.length > 0 && (
                      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 text-[10px] font-medium text-slate-500 uppercase pb-1 border-b border-slate-200">
                        <span>De (parcela)</span>
                        <span>Até</span>
                        <span>Taxa %</span>
                        <span>Prazo D+</span>
                        <span></span>
                      </div>
                    )}

                    {formData.feeRates.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                        <input
                          type="number"
                          min={1}
                          max={48}
                          value={row.installmentFrom}
                          onChange={(e) => {
                            const next = [...formData.feeRates];
                            next[idx] = { ...next[idx], installmentFrom: e.target.value };
                            setFormData({ ...formData, feeRates: next });
                          }}
                          placeholder="1"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                        <input
                          type="number"
                          min={1}
                          max={48}
                          value={row.installmentTo}
                          onChange={(e) => {
                            const next = [...formData.feeRates];
                            next[idx] = { ...next[idx], installmentTo: e.target.value };
                            setFormData({ ...formData, feeRates: next });
                          }}
                          placeholder="1"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.feePercent}
                          onChange={(e) => {
                            const next = [...formData.feeRates];
                            next[idx] = { ...next[idx], feePercent: e.target.value.replace(/[^0-9.,]/g, "") };
                            setFormData({ ...formData, feeRates: next });
                          }}
                          placeholder="2,77"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                        <input
                          type="number"
                          min={0}
                          max={120}
                          value={row.receivingDays}
                          onChange={(e) => {
                            const next = [...formData.feeRates];
                            next[idx] = { ...next[idx], receivingDays: e.target.value };
                            setFormData({ ...formData, feeRates: next });
                          }}
                          placeholder="30"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const next = formData.feeRates.filter((_, i) => i !== idx);
                            setFormData({ ...formData, feeRates: next });
                          }}
                          className="rounded border border-slate-200 p-1 text-slate-400 hover:text-red-600 hover:border-red-300 transition-colors"
                          title="Remover faixa"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        const lastTo = formData.feeRates.length > 0
                          ? parseInt(formData.feeRates[formData.feeRates.length - 1].installmentTo || "0", 10)
                          : 0;
                        const nextFrom = isNaN(lastTo) ? 1 : lastTo + 1;
                        setFormData({
                          ...formData,
                          feeRates: [
                            ...formData.feeRates,
                            { installmentFrom: String(nextFrom), installmentTo: String(nextFrom), feePercent: "", receivingDays: "30" },
                          ],
                        });
                      }}
                      className="w-full rounded-lg border border-dashed border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                    >
                      + Adicionar faixa
                    </button>
                  </div>
                </section>
              )}

              {/* ═══ SECAO 5: Cartao de credito — ciclo de fatura ═══ */}
              {selectedPM?.requiresBrand && (
                <section>
                  <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    Ciclo de fatura do cartao
                  </h4>
                  <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Banco emissor</label>
                        <input
                          type="text"
                          value={formData.bankName}
                          onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                          placeholder="Ex: Sicredi"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Dia fechamento</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={formData.billingClosingDay}
                          onChange={(e) => setFormData({ ...formData, billingClosingDay: e.target.value })}
                          placeholder="15"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Dia vencimento</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={formData.billingDueDay}
                          onChange={(e) => setFormData({ ...formData, billingDueDay: e.target.value })}
                          placeholder="25"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* ═══ SECAO 6: Outros ═══ */}
              <section>
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  Outros
                </h4>
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-3">
                  {!isCard && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Banco (opcional)</label>
                      <input
                        type="text"
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        placeholder="Ex: Sicredi"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Detalhes</label>
                      <input
                        type="text"
                        value={formData.details}
                        onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                        placeholder="Observacao interna..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Ordem</label>
                      <input
                        type="number"
                        value={formData.sortOrder}
                        onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Ativo (aparece nos dropdowns)</span>
                  </label>
                </div>
              </section>
            </div>

            {/* Actions */}
            <div className="border-t border-slate-200 px-6 py-3 flex justify-end gap-2">
              <button
                onClick={closeForm}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Salvando...
                  </span>
                ) : editingId ? (
                  "Salvar Alteracoes"
                ) : (
                  "Criar Meio"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir Instrumento"
        message={
          deleteTarget
            ? `Deseja excluir o instrumento "${deleteTarget.name}"? Esta acao nao pode ser desfeita.`
            : ""
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
