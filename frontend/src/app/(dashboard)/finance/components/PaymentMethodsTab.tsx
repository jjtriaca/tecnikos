"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import type { PaymentMethod } from "@/types/finance";

/* ── Form data ────────────────────────────────────────── */

interface PMFormData {
  name: string;
  code: string;
  isActive: boolean;
  feePercent: string;
  receivingDays: string;
  requiresBrand: boolean;
  requiresCheckData: boolean;
  sortOrder: string;
}

const EMPTY_FORM: PMFormData = {
  name: "",
  code: "",
  isActive: true,
  feePercent: "",
  receivingDays: "",
  requiresBrand: false,
  requiresCheckData: false,
  sortOrder: "0",
};

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/* ══════════════════════════════════════════════════════════
   PAYMENT METHODS TAB
   ══════════════════════════════════════════════════════════ */

export default function PaymentMethodsTab() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PMFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethod | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const loadMethods = useCallback(async () => {
    try {
      const result = await api.get<PaymentMethod[]>("/finance/payment-methods");
      setMethods(result);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  function openNewForm() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(pm: PaymentMethod) {
    setEditingId(pm.id);
    setFormData({
      name: pm.name,
      code: pm.code,
      isActive: pm.isActive,
      feePercent: pm.feePercent != null ? String(pm.feePercent) : "",
      receivingDays: pm.receivingDays != null ? String(pm.receivingDays) : "",
      requiresBrand: pm.requiresBrand,
      requiresCheckData: pm.requiresCheckData,
      sortOrder: String(pm.sortOrder),
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  }

  function handleNameChange(name: string) {
    if (!editingId) {
      setFormData({ ...formData, name, code: slugify(name) });
    } else {
      setFormData({ ...formData, name });
    }
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast("Informe o nome da forma de pagamento.", "error");
      return;
    }
    if (!formData.code.trim()) {
      toast("Informe o codigo da forma de pagamento.", "error");
      return;
    }

    setSaving(true);
    const payload: Record<string, unknown> = {
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      isActive: formData.isActive,
      requiresBrand: formData.requiresBrand,
      requiresCheckData: formData.requiresCheckData,
      sortOrder: parseInt(formData.sortOrder, 10) || 0,
    };

    if (formData.feePercent.trim()) {
      payload.feePercent = parseFloat(formData.feePercent.replace(",", "."));
    } else {
      payload.feePercent = null;
    }
    if (formData.receivingDays.trim()) {
      payload.receivingDays = parseInt(formData.receivingDays, 10);
    } else {
      payload.receivingDays = null;
    }

    try {
      if (editingId) {
        await api.patch(`/finance/payment-methods/${editingId}`, payload);
        toast("Forma de pagamento atualizada!", "success");
      } else {
        await api.post("/finance/payment-methods", payload);
        toast("Forma de pagamento criada!", "success");
      }
      closeForm();
      await loadMethods();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar.";
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(pm: PaymentMethod) {
    try {
      await api.patch(`/finance/payment-methods/${pm.id}`, { isActive: !pm.isActive });
      toast(pm.isActive ? "Forma desativada." : "Forma ativada.", "success");
      await loadMethods();
    } catch {
      toast("Erro ao alterar status.", "error");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/finance/payment-methods/${deleteTarget.id}`);
      toast("Forma de pagamento excluida!", "success");
      setDeleteTarget(null);
      await loadMethods();
    } catch {
      toast("Erro ao excluir.", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      const result = await api.post<{ created: number; message: string }>("/finance/payment-methods/seed");
      toast(result.message, "success");
      await loadMethods();
    } catch {
      toast("Erro ao criar formas padrao.", "error");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Formas de Pagamento</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cadastre e gerencie as formas de pagamento aceitas.
          </p>
        </div>
        <div className="flex gap-2">
          {methods.length === 0 && !loading && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {seeding ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Criando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Criar Padrao
                </>
              )}
            </button>
          )}
          <button
            onClick={openNewForm}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            + Nova Forma
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : methods.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <div className="text-3xl mb-2">💳</div>
          <p className="text-sm text-slate-500 mb-3">
            Nenhuma forma de pagamento cadastrada.
          </p>
          <p className="text-xs text-slate-400">
            Clique em &quot;Criar Padrao&quot; para criar PIX, Cartao, Dinheiro, Boleto, Cheque e mais.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {methods.map((pm) => (
            <div
              key={pm.id}
              className={`rounded-xl border bg-white p-4 shadow-sm transition-colors ${
                pm.isActive ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{pm.name}</span>
                    <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-mono text-slate-500">
                      {pm.code}
                    </span>
                    {pm.requiresBrand && (
                      <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                        Bandeira
                      </span>
                    )}
                    {pm.requiresCheckData && (
                      <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                        Cheque
                      </span>
                    )}
                    {!pm.isActive && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
                        Inativo
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                    {pm.feePercent != null && pm.feePercent > 0 && (
                      <span>Taxa: {pm.feePercent.toFixed(2)}%</span>
                    )}
                    {pm.receivingDays != null && pm.receivingDays > 0 && (
                      <span>Prazo: {pm.receivingDays} dia{pm.receivingDays !== 1 ? "s" : ""}</span>
                    )}
                    {pm.sortOrder > 0 && (
                      <span className="text-slate-400">Ordem: {pm.sortOrder}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggleActive(pm)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      pm.isActive ? "bg-blue-600" : "bg-slate-300"
                    }`}
                    title={pm.isActive ? "Desativar" : "Ativar"}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        pm.isActive ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  {/* Edit */}
                  <button
                    onClick={() => openEditForm(pm)}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                    title="Editar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => setDeleteTarget(pm)}
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
          <div className="relative mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {editingId ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}
            </h3>
            <div className="space-y-4">
              {/* Nome + Codigo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Ex: Cartao Credito"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Codigo *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="Ex: CARTAO_CREDITO"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <p className="mt-0.5 text-[10px] text-slate-400">Identificador unico (gerado do nome)</p>
                </div>
              </div>

              {/* Taxa + Prazo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Taxa (%)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.feePercent}
                    onChange={(e) => setFormData({ ...formData, feePercent: e.target.value })}
                    placeholder="Ex: 2.5"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Prazo recebimento (dias)</label>
                  <input
                    type="number"
                    value={formData.receivingDays}
                    onChange={(e) => setFormData({ ...formData, receivingDays: e.target.value })}
                    placeholder="Ex: 30"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Ordem */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Ordem</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requiresBrand}
                      onChange={(e) => setFormData({ ...formData, requiresBrand: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Exige bandeira</span>
                  </label>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requiresCheckData}
                      onChange={(e) => setFormData({ ...formData, requiresCheckData: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Dados cheque</span>
                  </label>
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
                <span className="text-sm text-slate-700">Ativa</span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeForm}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
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
                  "Criar Forma"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir Forma de Pagamento"
        message={
          deleteTarget
            ? `Deseja excluir a forma de pagamento "${deleteTarget.name}"? Esta acao nao pode ser desfeita.`
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
