"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/contexts/AuthContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { fmtCurrency } from "@/components/ui/CurrencyInput";
import type { CashAccount, AccountTransfer } from "@/types/finance";

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

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  CAIXA: "Caixa",
  BANCO: "Banco",
};

const BANK_ACCOUNT_TYPE_LABEL: Record<string, string> = {
  CORRENTE: "Corrente",
  POUPANCA: "Poupanca",
};

const PIX_KEY_TYPE_LABEL: Record<string, string> = {
  CPF: "CPF",
  CNPJ: "CNPJ",
  EMAIL: "E-mail",
  TELEFONE: "Telefone",
  ALEATORIA: "Chave Aleatoria",
};

/* ── Form data ────────────────────────────────────────── */

interface AccountFormData {
  name: string;
  type: "CAIXA" | "BANCO";
  bankCode: string;
  bankName: string;
  agency: string;
  accountNumber: string;
  accountType: string;
  pixKeyType: string;
  pixKey: string;
  initialBalanceCents: string;
  isActive: boolean;
}

const EMPTY_FORM: AccountFormData = {
  name: "",
  type: "CAIXA",
  bankCode: "",
  bankName: "",
  agency: "",
  accountNumber: "",
  accountType: "",
  pixKeyType: "",
  pixKey: "",
  initialBalanceCents: "0",
  isActive: true,
};

/* ── Transfer form ────────────────────────────────────── */

interface TransferFormData {
  fromAccountId: string;
  toAccountId: string;
  amountCents: string;
  description: string;
}

const EMPTY_TRANSFER: TransferFormData = {
  fromAccountId: "",
  toAccountId: "",
  amountCents: "",
  description: "",
};

/* ══════════════════════════════════════════════════════════
   CASH ACCOUNTS TAB
   ══════════════════════════════════════════════════════════ */

export default function CashAccountsTab() {
  return (
    <div className="space-y-8">
      <BalanceSummary />
      <AccountsSection />
      <TransfersSection />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SECTION 1: BALANCE SUMMARY
   ══════════════════════════════════════════════════════════ */

function BalanceSummary() {
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<CashAccount[]>("/finance/cash-accounts")
      .then(setAccounts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        ))}
      </div>
    );
  }

  const activeAccounts = accounts.filter((a) => a.isActive);
  const totalBalance = activeAccounts.reduce((acc, a) => acc + a.currentBalanceCents, 0);
  const caixaBalance = activeAccounts.filter((a) => a.type === "CAIXA").reduce((acc, a) => acc + a.currentBalanceCents, 0);
  const bancoBalance = activeAccounts.filter((a) => a.type === "BANCO").reduce((acc, a) => acc + a.currentBalanceCents, 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
        <span className="text-xs font-medium text-green-700">Saldo Total</span>
        <p className={`mt-1 text-2xl font-bold ${totalBalance >= 0 ? "text-green-900" : "text-red-700"}`}>
          {formatCurrency(totalBalance)}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">{activeAccounts.length} conta{activeAccounts.length !== 1 ? "s" : ""} ativa{activeAccounts.length !== 1 ? "s" : ""}</p>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <span className="text-xs font-medium text-amber-700">Caixas</span>
        <p className={`mt-1 text-2xl font-bold ${caixaBalance >= 0 ? "text-amber-900" : "text-red-700"}`}>
          {formatCurrency(caixaBalance)}
        </p>
      </div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
        <span className="text-xs font-medium text-blue-700">Bancos</span>
        <p className={`mt-1 text-2xl font-bold ${bancoBalance >= 0 ? "text-blue-900" : "text-red-700"}`}>
          {formatCurrency(bancoBalance)}
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SECTION 2: ACCOUNTS CRUD
   ══════════════════════════════════════════════════════════ */

function AccountsSection() {
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCurrentBalance, setEditingCurrentBalance] = useState(0);
  const [formData, setFormData] = useState<AccountFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CashAccount | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const loadAccounts = useCallback(async () => {
    try {
      const result = await api.get<CashAccount[]>("/finance/cash-accounts");
      setAccounts(result);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  function openNewForm() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(acc: CashAccount) {
    setEditingId(acc.id);
    setEditingCurrentBalance(acc.currentBalanceCents);
    setFormData({
      name: acc.name,
      type: acc.type,
      bankCode: acc.bankCode || "",
      bankName: acc.bankName || "",
      agency: acc.agency || "",
      accountNumber: acc.accountNumber || "",
      accountType: acc.accountType || "",
      pixKeyType: acc.pixKeyType || "",
      pixKey: acc.pixKey || "",
      initialBalanceCents: (acc.initialBalanceCents / 100).toFixed(2).replace(".", ","),
      isActive: acc.isActive,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast("Informe o nome da conta.", "error");
      return;
    }

    setSaving(true);
    const payload: Record<string, unknown> = {
      name: formData.name.trim(),
      type: formData.type,
      isActive: formData.isActive,
    };

    if (formData.type === "BANCO") {
      payload.bankCode = formData.bankCode.trim() || null;
      payload.bankName = formData.bankName.trim() || null;
      payload.agency = formData.agency.trim() || null;
      payload.accountNumber = formData.accountNumber.trim() || null;
      payload.accountType = formData.accountType || null;
    }

    if (formData.pixKeyType) {
      payload.pixKeyType = formData.pixKeyType;
      payload.pixKey = formData.pixKey.trim() || null;
    } else {
      payload.pixKeyType = null;
      payload.pixKey = null;
    }

    if (!editingId || editingCurrentBalance === 0) {
      const val = parseFloat(formData.initialBalanceCents.replace(",", ".")) || 0;
      payload.initialBalanceCents = Math.round(val * 100);
    }

    try {
      if (editingId) {
        await api.patch(`/finance/cash-accounts/${editingId}`, payload);
        toast("Conta atualizada!", "success");
      } else {
        await api.post("/finance/cash-accounts", payload);
        toast("Conta criada!", "success");
      }
      closeForm();
      await loadAccounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar.";
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(acc: CashAccount) {
    try {
      await api.patch(`/finance/cash-accounts/${acc.id}`, { isActive: !acc.isActive });
      toast(acc.isActive ? "Conta desativada." : "Conta ativada.", "success");
      await loadAccounts();
    } catch {
      toast("Erro ao alterar status.", "error");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/finance/cash-accounts/${deleteTarget.id}`);
      toast("Conta excluida!", "success");
      setDeleteTarget(null);
      await loadAccounts();
    } catch {
      toast("Erro ao excluir.", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Contas</h3>
        <button
          onClick={openNewForm}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + Nova Conta
        </button>
      </div>

      {/* Accounts list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <div className="text-3xl mb-2">🏦</div>
          <p className="text-sm text-slate-500">Nenhuma conta cadastrada.</p>
          <p className="text-xs text-slate-400 mt-1">Crie caixas e contas bancarias para controlar seu saldo.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className={`rounded-xl border bg-white p-4 shadow-sm transition-colors ${
                acc.isActive ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{acc.name}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                      acc.type === "CAIXA"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}>
                      {ACCOUNT_TYPE_LABEL[acc.type]}
                    </span>
                    {!acc.isActive && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
                        Inativo
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    {acc.type === "BANCO" && acc.bankName && (
                      <span>{acc.bankName}{acc.bankCode ? ` (${acc.bankCode})` : ""}</span>
                    )}
                    {acc.agency && <span>Ag: {acc.agency}</span>}
                    {acc.accountNumber && (
                      <span>CC: {acc.accountNumber}{acc.accountType ? ` (${BANK_ACCOUNT_TYPE_LABEL[acc.accountType] || acc.accountType})` : ""}</span>
                    )}
                    {acc.pixKeyType && (
                      <span className="text-indigo-600">
                        PIX {PIX_KEY_TYPE_LABEL[acc.pixKeyType]}: {acc.pixKey || "—"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Balance */}
                  <div className="text-right">
                    <p className={`text-lg font-bold ${acc.currentBalanceCents >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {formatCurrency(acc.currentBalanceCents)}
                    </p>
                    <p className="text-[10px] text-slate-400">Saldo atual</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleActive(acc)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        acc.isActive ? "bg-blue-600" : "bg-slate-300"
                      }`}
                      title={acc.isActive ? "Desativar" : "Ativar"}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          acc.isActive ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => openEditForm(acc)}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                      title="Editar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteTarget(acc)}
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
            </div>
          ))}
        </div>
      )}

      {/* Account form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative mx-4 w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {editingId ? "Editar Conta" : "Nova Conta"}
            </h3>
            <div className="space-y-4">
              {/* Nome + Tipo */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Caixa Principal, Bradesco CC"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tipo *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as "CAIXA" | "BANCO" })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="CAIXA">Caixa</option>
                    <option value="BANCO">Banco</option>
                  </select>
                </div>
              </div>

              {/* Bank fields (only for BANCO) */}
              {formData.type === "BANCO" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Codigo do Banco</label>
                      <input
                        type="text"
                        value={formData.bankCode}
                        onChange={(e) => setFormData({ ...formData, bankCode: e.target.value })}
                        placeholder="Ex: 237"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Nome do Banco</label>
                      <input
                        type="text"
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        placeholder="Ex: Bradesco"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Agencia</label>
                      <input
                        type="text"
                        value={formData.agency}
                        onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
                        placeholder="Ex: 1234"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Numero da Conta</label>
                      <input
                        type="text"
                        value={formData.accountNumber}
                        onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                        placeholder="Ex: 12345-6"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Tipo Conta</label>
                      <select
                        value={formData.accountType}
                        onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                      >
                        <option value="">Selecione...</option>
                        <option value="CORRENTE">Corrente</option>
                        <option value="POUPANCA">Poupanca</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* PIX */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tipo Chave PIX</label>
                  <select
                    value={formData.pixKeyType}
                    onChange={(e) => setFormData({ ...formData, pixKeyType: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="">Nenhuma</option>
                    <option value="CPF">CPF</option>
                    <option value="CNPJ">CNPJ</option>
                    <option value="EMAIL">E-mail</option>
                    <option value="TELEFONE">Telefone</option>
                    <option value="ALEATORIA">Chave Aleatoria</option>
                  </select>
                </div>
                {formData.pixKeyType && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Chave PIX</label>
                    <input
                      type="text"
                      value={formData.pixKey}
                      onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
                      placeholder="Informe a chave PIX"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Saldo inicial (only on create) + Ativo */}
              <div className="grid grid-cols-2 gap-3">
                {(!editingId || editingCurrentBalance === 0) && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Saldo Inicial (R$)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.initialBalanceCents}
                      onChange={(e) => setFormData({ ...formData, initialBalanceCents: e.target.value })}
                      onBlur={(e) => setFormData({ ...formData, initialBalanceCents: fmtCurrency(e.target.value) })}
                      placeholder="0,00"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                )}
                <div className={`flex items-end pb-1 ${editingId ? "col-span-2" : ""}`}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Ativa</span>
                  </label>
                </div>
              </div>
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
                  "Criar Conta"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir Conta"
        message={
          deleteTarget
            ? `Deseja excluir a conta "${deleteTarget.name}"? Esta acao nao pode ser desfeita.`
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

/* ══════════════════════════════════════════════════════════
   SECTION 3: TRANSFERS
   ══════════════════════════════════════════════════════════ */

function TransfersSection() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [transfers, setTransfers] = useState<AccountTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<TransferFormData>(EMPTY_TRANSFER);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    try {
      const [accs, txs] = await Promise.all([
        api.get<CashAccount[]>("/finance/cash-accounts/active"),
        api.get<AccountTransfer[]>("/finance/transfers"),
      ]);
      setAccounts(accs);
      setTransfers(txs);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleTransfer() {
    if (!formData.fromAccountId || !formData.toAccountId) {
      toast("Selecione as contas de origem e destino.", "error");
      return;
    }
    if (formData.fromAccountId === formData.toAccountId) {
      toast("Origem e destino devem ser diferentes.", "error");
      return;
    }
    const amount = Math.round(Number(formData.amountCents.replace(",", ".")) * 100);
    if (!amount || amount <= 0) {
      toast("Informe um valor valido.", "error");
      return;
    }

    setSaving(true);
    try {
      await api.post("/finance/transfers", {
        fromAccountId: formData.fromAccountId,
        toAccountId: formData.toAccountId,
        amountCents: amount,
        description: formData.description.trim() || undefined,
      });
      toast("Transferencia realizada!", "success");
      setShowForm(false);
      setFormData(EMPTY_TRANSFER);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao transferir.";
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Transferencias</h3>
        <button
          onClick={() => setShowForm(true)}
          disabled={accounts.length < 2}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
          title={accounts.length < 2 ? "Necessario pelo menos 2 contas" : ""}
        >
          + Nova Transferencia
        </button>
      </div>

      {/* Transfer history */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
          ))}
        </div>
      ) : transfers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">Nenhuma transferencia realizada.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="py-3 px-4 text-xs font-semibold uppercase text-slate-600 text-left">Data</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase text-slate-600 text-left">Origem</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase text-slate-600 text-center">→</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase text-slate-600 text-left">Destino</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase text-slate-600 text-right">Valor</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase text-slate-600 text-left">Descricao</th>
                <th className="py-3 px-4 text-xs font-semibold uppercase text-slate-600 text-left">Por</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((tx) => (
                <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{formatDateTime(tx.transferDate)}</td>
                  <td className="py-3 px-4 text-slate-700">{tx.fromAccount?.name || "—"}</td>
                  <td className="py-3 px-4 text-center text-slate-400">→</td>
                  <td className="py-3 px-4 text-slate-700">{tx.toAccount?.name || "—"}</td>
                  <td className="py-3 px-4 text-right font-semibold text-indigo-700">{formatCurrency(tx.amountCents)}</td>
                  <td className="py-3 px-4 text-slate-500 truncate max-w-[200px]">{tx.description || "—"}</td>
                  <td className="py-3 px-4 text-xs text-slate-400">{tx.createdByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transfer form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowForm(false); setFormData(EMPTY_TRANSFER); }} />
          <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Nova Transferencia</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Conta Origem *</label>
                <select
                  value={formData.fromAccountId}
                  onChange={(e) => setFormData({ ...formData, fromAccountId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Selecione...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({ACCOUNT_TYPE_LABEL[a.type]}) — {formatCurrency(a.currentBalanceCents)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Conta Destino *</label>
                <select
                  value={formData.toAccountId}
                  onChange={(e) => setFormData({ ...formData, toAccountId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Selecione...</option>
                  {accounts
                    .filter((a) => a.id !== formData.fromAccountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({ACCOUNT_TYPE_LABEL[a.type]}) — {formatCurrency(a.currentBalanceCents)}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Valor (R$) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.amountCents}
                  onChange={(e) => setFormData({ ...formData, amountCents: e.target.value })}
                  onBlur={(e) => setFormData({ ...formData, amountCents: fmtCurrency(e.target.value) })}
                  placeholder="Ex: 500,00"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descricao</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex: Suprimento de caixa"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setShowForm(false); setFormData(EMPTY_TRANSFER); }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleTransfer}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Transferindo...
                  </span>
                ) : (
                  "Transferir"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
