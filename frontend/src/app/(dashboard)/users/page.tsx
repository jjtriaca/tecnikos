"use client";

import React, { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import AuditLogDrawer from "@/components/ui/AuditLogDrawer";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  DESPACHO: "Despacho",
  FINANCEIRO: "Financeiro",
  LEITURA: "Somente Leitura",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-800",
  DESPACHO: "bg-blue-100 text-blue-800",
  FINANCEIRO: "bg-green-100 text-green-800",
  LEITURA: "bg-slate-100 text-slate-600",
};

const ALL_ROLES = ["ADMIN", "DESPACHO", "FINANCEIRO", "LEITURA"];

const COLUMN_COUNT = 4; // name, email, role, actions

export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "DESPACHO",
  });

  async function loadUsers() {
    try {
      const data = await api.get<User[]>("/users");
      setUsers(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function resetForm() {
    setForm({ name: "", email: "", password: "", role: "DESPACHO" });
    setEditingId(null);
    setShowForm(false);
    setFormError(null);
  }

  function startEdit(user: User) {
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
    });
    setEditingId(user.id);
    setShowForm(true);
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      if (editingId) {
        const body: any = {
          name: form.name,
          email: form.email,
          role: form.role,
        };
        if (form.password) body.password = form.password;
        await api.put(`/users/${editingId}`, body);
      } else {
        if (!form.password) {
          setFormError("Senha obrigatória para novo usuário");
          setSaving(false);
          return;
        }
        await api.post("/users", form);
      }
      resetForm();
      await loadUsers();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.payload?.message || err.message);
      } else {
        setFormError("Erro ao salvar");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteClick(id: string, name: string) {
    setDeactivateTarget({ id, name });
    setShowConfirmModal(true);
  }

  async function handleConfirmDeactivate() {
    if (!deactivateTarget) return;
    try {
      await api.del(`/users/${deactivateTarget.id}`);
      toast("Usuário desativado.", "success");
      setShowConfirmModal(false);
      setDeactivateTarget(null);
      await loadUsers();
    } catch {
      toast("Erro ao desativar usuário.", "error");
    }
  }

  function handleCancelDeactivate() {
    setShowConfirmModal(false);
    setDeactivateTarget(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
          <p className="text-sm text-slate-500">
            Gerencie os usuários do sistema.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + Novo Usuário
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            {editingId ? "Editar Usuário" : "Novo Usuário"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                placeholder="Nome"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <input
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                required
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <input
                placeholder={editingId ? "Nova senha (opcional)" : "Senha"}
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({ ...f, role: e.target.value }))
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            {formError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving
                  ? "Salvando..."
                  : editingId
                  ? "Atualizar"
                  : "Criar"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
          Nenhum usuário cadastrado.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="py-3 px-4 text-left font-medium text-slate-600">
                  Nome
                </th>
                <th className="py-3 px-4 text-left font-medium text-slate-600">
                  Email
                </th>
                <th className="py-3 px-4 text-left font-medium text-slate-600">
                  Papel
                </th>
                <th className="py-3 px-4 text-right font-medium text-slate-600">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <React.Fragment key={u.id}>
                  <tr className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {u.name}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{u.email}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          ROLE_COLORS[u.role] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setExpandedAuditId((prev) => (prev === u.id ? null : u.id))}
                          title="Histórico de alterações"
                          className={`rounded border px-1.5 py-1 text-xs transition-colors ${expandedAuditId === u.id ? "border-blue-300 bg-blue-50 text-blue-600" : "border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600"}`}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => startEdit(u)}
                          className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteClick(u.id, u.name)}
                          className="rounded border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          Desativar
                        </button>
                      </div>
                    </td>
                  </tr>
                  <AuditLogDrawer
                    entityType="USER"
                    entityId={u.id}
                    open={expandedAuditId === u.id}
                    colSpan={COLUMN_COUNT}
                  />
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        open={showConfirmModal && !!deactivateTarget}
        title="Desativar Usuário"
        message={`Desativar o usuário "${deactivateTarget?.name}"?`}
        confirmLabel="Desativar"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDeactivate}
        onCancel={handleCancelDeactivate}
        variant="danger"
      />
    </div>
  );
}
