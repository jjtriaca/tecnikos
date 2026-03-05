"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

/* ── Types ────────────────────────────────────────────── */

type AccountType = "REVENUE" | "EXPENSE" | "COST";

interface FinanceAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  level: number;
  allowPosting: boolean;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  parentId: string | null;
  children: FinanceAccount[];
  _count?: { entries: number };
}

interface AccountFormData {
  name: string;
  code: string;
  type: AccountType;
  parentId: string | null;
  sortOrder: string;
}

const EMPTY_FORM: AccountFormData = {
  name: "",
  code: "",
  type: "EXPENSE",
  parentId: null,
  sortOrder: "0",
};

/* ── Type color map ───────────────────────────────────── */

const TYPE_CONFIG: Record<AccountType, { label: string; bg: string; text: string; border: string; dot: string }> = {
  REVENUE: { label: "Receita", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-500" },
  COST:    { label: "Custo",   bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  EXPENSE: { label: "Despesa", bg: "bg-red-50",   text: "text-red-700",   border: "border-red-200",   dot: "bg-red-500" },
};

/* ── SVG Icons (inline) ──────────────────────────────── */

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function SeedIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════
   ACCOUNTS TAB (Chart of Accounts / Plano de Contas)
   ══════════════════════════════════════════════════════════ */

export default function AccountsTab() {
  const [groups, setGroups] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(null);
  const [formData, setFormData] = useState<AccountFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FinanceAccount | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  /* ── Load ────────────────────────────────────────────── */

  const loadAccounts = useCallback(async () => {
    try {
      const result = await api.get<FinanceAccount[]>("/finance/accounts");
      setGroups(result);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  /* ── Expand / Collapse ──────────────────────────────── */

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function expandAll() {
    setExpandedIds(new Set(groups.map((g) => g.id)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  /* ── Form helpers ───────────────────────────────────── */

  function openNewGroupForm() {
    setEditingAccount(null);
    setFormData({ ...EMPTY_FORM, parentId: null });
    setShowForm(true);
  }

  function openNewSubgroupForm(parentGroup: FinanceAccount) {
    setEditingAccount(null);
    setFormData({
      ...EMPTY_FORM,
      type: parentGroup.type,
      parentId: parentGroup.id,
    });
    setShowForm(true);
  }

  function openEditForm(account: FinanceAccount) {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      code: account.code,
      type: account.type,
      parentId: account.parentId,
      sortOrder: String(account.sortOrder),
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingAccount(null);
    setFormData(EMPTY_FORM);
  }

  /* ── Save ───────────────────────────────────────────── */

  async function handleSave() {
    if (!formData.name.trim()) {
      toast("Informe o nome da conta.", "error");
      return;
    }
    if (!formData.code.trim() && !editingAccount) {
      toast("Informe o codigo da conta.", "error");
      return;
    }

    setSaving(true);
    try {
      if (editingAccount) {
        await api.patch(`/finance/accounts/${editingAccount.id}`, {
          name: formData.name.trim(),
          isActive: editingAccount.isActive,
          sortOrder: parseInt(formData.sortOrder, 10) || 0,
        });
        toast("Conta atualizada!", "success");
      } else {
        const payload: Record<string, unknown> = {
          code: formData.code.trim(),
          name: formData.name.trim(),
          type: formData.type,
          sortOrder: parseInt(formData.sortOrder, 10) || 0,
        };
        if (formData.parentId) {
          payload.parentId = formData.parentId;
        }
        await api.post("/finance/accounts", payload);
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

  /* ── Toggle active ──────────────────────────────────── */

  async function handleToggleActive(account: FinanceAccount) {
    try {
      await api.patch(`/finance/accounts/${account.id}`, { isActive: !account.isActive });
      toast(account.isActive ? "Conta desativada." : "Conta ativada.", "success");
      await loadAccounts();
    } catch {
      toast("Erro ao alterar status.", "error");
    }
  }

  /* ── Delete ─────────────────────────────────────────── */

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/finance/accounts/${deleteTarget.id}`);
      toast("Conta excluida!", "success");
      setDeleteTarget(null);
      await loadAccounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir.";
      toast(msg, "error");
    } finally {
      setDeleting(false);
    }
  }

  /* ── Seed defaults ──────────────────────────────────── */

  async function handleSeed() {
    setSeeding(true);
    try {
      const result = await api.post<{ created: number; message: string }>("/finance/accounts/seed");
      toast(result.message || "Plano de contas padrao criado!", "success");
      await loadAccounts();
    } catch {
      toast("Erro ao criar plano de contas padrao.", "error");
    } finally {
      setSeeding(false);
    }
  }

  /* ── Helpers ────────────────────────────────────────── */

  function canDelete(account: FinanceAccount): boolean {
    if (account.isSystem) return false;
    const entryCount = account._count?.entries ?? 0;
    if (entryCount > 0) return false;
    // Groups with children can't be deleted either
    if (account.children && account.children.length > 0) return false;
    return true;
  }

  const formTitle = editingAccount
    ? "Editar Conta"
    : formData.parentId
      ? "Novo Subgrupo"
      : "Novo Grupo";

  /* ── Render ─────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Plano de Contas</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Organize receitas, custos e despesas em grupos e subgrupos.
          </p>
        </div>
        <div className="flex gap-2">
          {groups.length === 0 && !loading && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {seeding ? <SpinnerIcon /> : <SeedIcon />}
              {seeding ? "Criando..." : "Gerar Padrao"}
            </button>
          )}
          <button
            onClick={openNewGroupForm}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          >
            <PlusIcon />
            Adicionar Grupo
          </button>
        </div>
      </div>

      {/* Expand / Collapse controls */}
      {groups.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={expandAll}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            Expandir tudo
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            Recolher tudo
          </button>
          <span className="flex-1" />
          <span className="text-xs text-slate-400">
            {groups.length} grupo{groups.length !== 1 ? "s" : ""},{" "}
            {groups.reduce((acc, g) => acc + (g.children?.length || 0), 0)} subgrupos
          </span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <p className="text-sm font-medium text-slate-600 mb-1">
            Nenhuma conta cadastrada
          </p>
          <p className="text-xs text-slate-400 mb-4">
            Comece gerando o plano de contas padrao ou crie grupos manualmente.
          </p>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {seeding ? <SpinnerIcon /> : <SeedIcon />}
            {seeding ? "Criando..." : "Gerar Plano Padrao"}
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {groups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              expanded={expandedIds.has(group.id)}
              onToggleExpand={() => toggleExpand(group.id)}
              onEdit={openEditForm}
              onDelete={setDeleteTarget}
              onToggleActive={handleToggleActive}
              onAddSubgroup={() => openNewSubgroupForm(group)}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{formTitle}</h3>
            <div className="space-y-4">
              {/* Codigo + Tipo (only for new) */}
              {!editingAccount && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Codigo *</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="Ex: 1100"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Tipo *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as AccountType })}
                      disabled={!!formData.parentId}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      <option value="REVENUE">Receita</option>
                      <option value="COST">Custo</option>
                      <option value="EXPENSE">Despesa</option>
                    </select>
                    {formData.parentId && (
                      <p className="mt-0.5 text-[10px] text-slate-400">Herdado do grupo pai</p>
                    )}
                  </div>
                </div>
              )}

              {/* Nome */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Receitas de Servicos"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  autoFocus={!!editingAccount}
                />
              </div>

              {/* Ordem */}
              <div className="w-32">
                <label className="block text-xs font-medium text-slate-600 mb-1">Ordem</label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
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
                    <SpinnerIcon />
                    Salvando...
                  </span>
                ) : editingAccount ? (
                  "Salvar Alteracoes"
                ) : (
                  "Criar"
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
            ? `Deseja excluir a conta "${deleteTarget.code} - ${deleteTarget.name}"? Esta acao nao pode ser desfeita.`
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
   GROUP ROW (level 1 — expandable)
   ══════════════════════════════════════════════════════════ */

interface GroupRowProps {
  group: FinanceAccount;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: (account: FinanceAccount) => void;
  onDelete: (account: FinanceAccount) => void;
  onToggleActive: (account: FinanceAccount) => void;
  onAddSubgroup: () => void;
  canDelete: (account: FinanceAccount) => boolean;
}

function GroupRow({
  group,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onToggleActive,
  onAddSubgroup,
  canDelete,
}: GroupRowProps) {
  const tc = TYPE_CONFIG[group.type];
  const childCount = group.children?.length || 0;
  const isInactive = !group.isActive;

  return (
    <div className={`rounded-xl border bg-white shadow-sm transition-colors ${isInactive ? "opacity-60" : ""} ${tc.border}`}>
      {/* Group header */}
      <div
        className={`flex items-center gap-2 px-4 py-3 cursor-pointer select-none hover:bg-slate-50/50 rounded-t-xl transition-colors ${
          expanded && childCount > 0 ? "" : "rounded-b-xl"
        }`}
        onClick={onToggleExpand}
      >
        {/* Chevron */}
        <span className={`shrink-0 ${childCount === 0 ? "invisible" : ""}`}>
          <ChevronIcon open={expanded} />
        </span>

        {/* Type dot */}
        <span className={`w-2 h-2 rounded-full shrink-0 ${tc.dot}`} />

        {/* Code badge */}
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-mono font-semibold ${tc.bg} ${tc.text}`}>
          {group.code}
        </span>

        {/* Name */}
        <span className="text-sm font-semibold text-slate-800 truncate">
          {group.name}
        </span>

        {/* System lock */}
        {group.isSystem && (
          <span title="Conta do sistema (nao pode ser excluida)">
            <LockIcon />
          </span>
        )}

        {/* Type label */}
        <span className={`ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${tc.bg} ${tc.text} ${tc.border}`}>
          {tc.label}
        </span>

        {/* Child count */}
        {childCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            {childCount}
          </span>
        )}

        {/* Inactive badge */}
        {isInactive && (
          <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            Inativo
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Toggle active */}
          <button
            onClick={() => onToggleActive(group)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
              group.isActive ? "bg-blue-600" : "bg-slate-300"
            }`}
            title={group.isActive ? "Desativar" : "Ativar"}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                group.isActive ? "translate-x-[18px]" : "translate-x-[3px]"
              }`}
            />
          </button>
          {/* Edit */}
          <button
            onClick={() => onEdit(group)}
            className="rounded-lg p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Editar"
          >
            <EditIcon />
          </button>
          {/* Delete */}
          {canDelete(group) && (
            <button
              onClick={() => onDelete(group)}
              className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Excluir"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      {/* Children (level 2 subgroups) */}
      {expanded && (
        <div className={`border-t ${tc.border}`}>
          {group.children && group.children.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {group.children.map((child) => (
                <SubgroupRow
                  key={child.id}
                  account={child}
                  parentType={group.type}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleActive={onToggleActive}
                  canDelete={canDelete}
                />
              ))}
            </div>
          ) : (
            <div className="px-10 py-3 text-xs text-slate-400 italic">
              Nenhum subgrupo cadastrado
            </div>
          )}
          {/* Add subgroup button */}
          <div className="px-4 py-2 border-t border-slate-100">
            <button
              onClick={onAddSubgroup}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
            >
              <PlusIcon />
              Adicionar Subgrupo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SUBGROUP ROW (level 2 — leaf)
   ══════════════════════════════════════════════════════════ */

interface SubgroupRowProps {
  account: FinanceAccount;
  parentType: AccountType;
  onEdit: (account: FinanceAccount) => void;
  onDelete: (account: FinanceAccount) => void;
  onToggleActive: (account: FinanceAccount) => void;
  canDelete: (account: FinanceAccount) => boolean;
}

function SubgroupRow({ account, parentType, onEdit, onDelete, onToggleActive, canDelete }: SubgroupRowProps) {
  const tc = TYPE_CONFIG[parentType];
  const entryCount = account._count?.entries ?? 0;
  const isInactive = !account.isActive;

  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 pl-10 hover:bg-slate-50/50 transition-colors ${isInactive ? "opacity-60" : ""}`}>
      {/* Indent line */}
      <span className="w-4 h-px bg-slate-200 shrink-0" />

      {/* Code badge */}
      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-mono font-medium ${tc.bg} ${tc.text}`}>
        {account.code}
      </span>

      {/* Name */}
      <span className="text-sm text-slate-700 truncate">
        {account.name}
      </span>

      {/* System lock */}
      {account.isSystem && (
        <span title="Conta do sistema">
          <LockIcon />
        </span>
      )}

      {/* Entry count badge */}
      {entryCount > 0 && (
        <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500" title={`${entryCount} lancamento${entryCount !== 1 ? "s" : ""}`}>
          {entryCount}
        </span>
      )}

      {/* Inactive badge */}
      {isInactive && (
        <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
          Inativo
        </span>
      )}

      {/* Spacer */}
      <span className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Toggle active */}
        <button
          onClick={() => onToggleActive(account)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
            account.isActive ? "bg-blue-600" : "bg-slate-300"
          }`}
          title={account.isActive ? "Desativar" : "Ativar"}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
              account.isActive ? "translate-x-[18px]" : "translate-x-[3px]"
            }`}
          />
        </button>
        {/* Edit */}
        <button
          onClick={() => onEdit(account)}
          className="rounded-lg p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title="Editar"
        >
          <EditIcon />
        </button>
        {/* Delete */}
        {canDelete(account) && (
          <button
            onClick={() => onDelete(account)}
            className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Excluir"
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
}
