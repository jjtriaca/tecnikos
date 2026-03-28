"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import type { PaymentInstrument, PaymentMethod, CashAccount } from "@/types/finance";

/* ── Form data ────────────────────────────────────────── */

interface PIFormData {
  name: string;
  paymentMethodId: string;
  cardLast4: string;
  cardBrand: string;
  bankName: string;
  cashAccountId: string;
  details: string;
  isActive: boolean;
  sortOrder: string;
}

const EMPTY_FORM: PIFormData = {
  name: "",
  paymentMethodId: "",
  cardLast4: "",
  cardBrand: "",
  bankName: "",
  cashAccountId: "",
  details: "",
  isActive: true,
  sortOrder: "0",
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

  function openNewForm() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(pi: PaymentInstrument) {
    setEditingId(pi.id);
    setFormData({
      name: pi.name,
      paymentMethodId: pi.paymentMethodId,
      cardLast4: pi.cardLast4 || "",
      cardBrand: pi.cardBrand || "",
      bankName: pi.bankName || "",
      cashAccountId: pi.cashAccountId || "",
      details: pi.details || "",
      isActive: pi.isActive,
      sortOrder: String(pi.sortOrder),
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

    setSaving(true);
    const payload: Record<string, unknown> = {
      name: formData.name.trim(),
      paymentMethodId: formData.paymentMethodId,
      cardLast4: formData.cardLast4.trim() || null,
      cardBrand: formData.cardBrand || null,
      bankName: formData.bankName.trim() || null,
      cashAccountId: formData.cashAccountId || null,
      details: formData.details.trim() || null,
      isActive: formData.isActive,
      sortOrder: parseInt(formData.sortOrder, 10) || 0,
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
          <h3 className="text-sm font-semibold text-slate-700">Instrumentos de Pagamento</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cadastre os meios de pagamento especificos da empresa (cartoes, contas PIX, etc.)
          </p>
        </div>
        <button
          onClick={openNewForm}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + Novo Instrumento
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
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                    {pi.cardBrand && <span>Bandeira: {pi.cardBrand}</span>}
                    {pi.cardLast4 && <span>Final: {pi.cardLast4}</span>}
                    {pi.bankName && <span>Banco: {pi.bankName}</span>}
                    {pi.cashAccount && <span>Conta: {pi.cashAccount.name}</span>}
                    {pi.details && <span className="text-slate-400">{pi.details}</span>}
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
          <div className="relative mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {editingId ? "Editar Instrumento" : "Novo Instrumento de Pagamento"}
            </h3>
            <div className="space-y-4">
              {/* Forma de Pagamento (tipo generico) */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Forma de Pagamento *</label>
                <select
                  value={formData.paymentMethodId}
                  onChange={(e) => setFormData({ ...formData, paymentMethodId: e.target.value, cardBrand: "", cardLast4: "" })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Selecione...</option>
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>{pm.name}</option>
                  ))}
                </select>
              </div>

              {/* Nome */}
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
                  placeholder="Ex: Mastercard Final 9767"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  autoFocus
                />
              </div>

              {/* Card fields (only if payment method requires brand) */}
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
                      placeholder="9767"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Bank / Cash account */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Banco</label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="Ex: Bradesco"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Vincular Conta</label>
                  <select
                    value={formData.cashAccountId}
                    onChange={(e) => setFormData({ ...formData, cashAccountId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="">Nenhuma</option>
                    {cashAccounts.map((ca) => (
                      <option key={ca.id} value={ca.id}>
                        {ca.name} ({ca.type === "BANCO" ? "Banco" : ca.type === "TRANSITO" ? "Transito" : "Caixa"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Details + Order */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Detalhes</label>
                  <input
                    type="text"
                    value={formData.details}
                    onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                    placeholder="Informacoes adicionais..."
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

              {/* Ativo */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Ativo</span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-6">
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
                  "Criar Instrumento"
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
