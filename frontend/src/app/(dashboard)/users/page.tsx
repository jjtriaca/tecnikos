"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import AuditLogDrawer from "@/components/ui/AuditLogDrawer";
import PasswordInput from "@/components/ui/PasswordInput";
import SortableHeader from "@/components/ui/SortableHeader";
import DraggableHeader from "@/components/ui/DraggableHeader";
import { useTableParams } from "@/hooks/useTableParams";
import { useTableLayout } from "@/hooks/useTableLayout";
import type { ColumnDefinition } from "@/lib/types/table";
import { toTitleCase } from "@/lib/brazil-utils";

type User = {
  id: string;
  code: string | null;
  name: string;
  email: string;
  roles: string[];
  chatIAEnabled: boolean;
  invitedAt: string | null;
  passwordSetAt: string | null;
  createdAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  DESPACHO: "Despacho",
  FINANCEIRO: "Financeiro",
  FISCAL: "Fiscal",
  LEITURA: "Somente Leitura",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-800",
  DESPACHO: "bg-blue-100 text-blue-800",
  FINANCEIRO: "bg-green-100 text-green-800",
  FISCAL: "bg-amber-100 text-amber-800",
  LEITURA: "bg-slate-100 text-slate-600",
};

const ALL_ROLES = ["ADMIN", "DESPACHO", "FINANCEIRO", "FISCAL", "LEITURA"];

/* ── Actions Dropdown ─────────────────────────────────── */

function ActionsDropdown({
  items,
}: {
  items: { label: string; onClick: () => void; danger?: boolean; hidden?: boolean; separator?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    if (open) {
      setOpen(false);
      return;
    }
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = 180;
      const fitsBelow = rect.bottom + menuHeight < window.innerHeight;
      setPos({
        top: fitsBelow ? rect.bottom + 4 : rect.top - menuHeight - 4,
        left: rect.right,
      });
      setOpen(true);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleScroll() {
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  const visibleItems = items.filter((i) => !i.hidden);

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        className="rounded border border-slate-300 px-2 py-1 text-sm font-bold text-slate-700 hover:bg-slate-100"
      >
        &#x22EF;
      </button>
      {open && pos && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          style={{ top: pos.top, left: pos.left, transform: "translateX(-100%)" }}
        >
          {visibleItems.map((item, idx) => {
            const showSep = item.separator || (item.danger && idx > 0 && !visibleItems[idx - 1].danger);
            return (
              <React.Fragment key={idx}>
                {showSep && <div className="my-1 border-t border-slate-200" />}
                <button
                  onClick={() => { setOpen(false); item.onClick(); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 ${
                    item.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700"
                  }`}
                >
                  {item.label}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Column definitions ───────────────────────────────── */

function buildUserColumns(
  expandedAuditId: string | null,
  setExpandedAuditId: React.Dispatch<React.SetStateAction<string | null>>,
  startEdit: (user: User) => void,
  handleDeleteClick: (id: string, name: string) => void,
  handleResendInvite: (id: string) => void,
  resendingId: string | null,
): ColumnDefinition<User>[] {
  return [
    {
      id: "acoes",
      label: "Acoes",
      sortable: false,
      align: "center" as const,
      render: (u) => (
        <div className="flex items-center justify-center">
          <ActionsDropdown
            items={[
              { label: "Editar", onClick: () => startEdit(u) },
              { label: "Reenviar convite", onClick: () => handleResendInvite(u.id), hidden: !(u.invitedAt && !u.passwordSetAt) },
              { label: "Historico de alteracoes", onClick: () => setExpandedAuditId((prev) => (prev === u.id ? null : u.id)), separator: true },
              { label: "Desativar", onClick: () => handleDeleteClick(u.id, u.name), danger: true },
            ]}
          />
        </div>
      ),
    },
    {
      id: "code",
      label: "Codigo",
      sortable: true,
      sortKey: "code",
      render: (u) => <span className="font-mono text-xs text-slate-500">{u.code || "\u2014"}</span>,
    },
    {
      id: "nome",
      label: "Nome",
      sortable: true,
      sortKey: "name",
      render: (u) => (
        <span className="font-medium text-slate-900">{u.name}</span>
      ),
    },
    {
      id: "email",
      label: "Email",
      sortable: true,
      sortKey: "email",
      render: (u) => (
        <span className="text-slate-600">{u.email}</span>
      ),
    },
    {
      id: "status",
      label: "Status",
      sortable: false,
      render: (u) => {
        if (u.passwordSetAt) {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Ativo
            </span>
          );
        }
        if (u.invitedAt) {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Convite enviado
            </span>
          );
        }
        return (
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            Ativo
          </span>
        );
      },
    },
    {
      id: "papeis",
      label: "Papeis",
      sortable: false,
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles.map((r) => (
            <span
              key={r}
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                ROLE_COLORS[r] || "bg-slate-100 text-slate-600"
              }`}
            >
              {ROLE_LABELS[r] || r}
            </span>
          ))}
        </div>
      ),
    },
  ];
}

export default function UsersPage() {
  const { toast } = useToast();
  const tp = useTableParams({ persistKey: "users", defaultSortBy: "name", defaultSortOrder: "asc" });
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
  const [resendingId, setResendingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    roles: ["DESPACHO"] as string[],
    chatIAEnabled: false,
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
    setForm({ name: "", email: "", password: "", roles: ["DESPACHO"], chatIAEnabled: false });
    setEditingId(null);
    setShowForm(false);
    setFormError(null);
  }

  function startEdit(user: User) {
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      roles: user.roles,
      chatIAEnabled: user.chatIAEnabled,
    });
    setEditingId(user.id);
    setShowForm(true);
    setFormError(null);
  }

  function toggleRole(role: string) {
    setForm((f) => {
      if (role === "LEITURA") {
        // LEITURA is exclusive: toggle it, clear all others
        return { ...f, roles: f.roles.includes("LEITURA") ? [] : ["LEITURA"] };
      }
      // Normal role toggle
      const has = f.roles.includes(role);
      const next = has
        ? f.roles.filter((r) => r !== role)
        : [...f.roles.filter((r) => r !== "LEITURA"), role];
      return { ...f, roles: next };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (form.roles.length === 0) {
      setFormError("Selecione pelo menos um papel");
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        const body: any = {
          name: form.name,
          email: form.email,
          roles: form.roles,
          chatIAEnabled: form.chatIAEnabled,
        };
        if (form.password) body.password = form.password;
        await api.put(`/users/${editingId}`, body);
      } else {
        // Create user — no password needed (invite flow sends email)
        await api.post("/users", {
          name: form.name,
          email: form.email,
          roles: form.roles,
          chatIAEnabled: form.chatIAEnabled,
        });
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

  async function handleResendInvite(userId: string) {
    setResendingId(userId);
    try {
      await api.post(`/users/${userId}/resend-invite`, {});
      toast("Convite reenviado com sucesso!", "success");
    } catch (err) {
      if (err instanceof ApiError) {
        toast(err.payload?.message || "Erro ao reenviar convite.", "error");
      } else {
        toast("Erro ao reenviar convite.", "error");
      }
    } finally {
      setResendingId(null);
    }
  }

  /* ── Table columns & layout ──────────────────────────── */

  const columnDefs = useMemo(
    () => buildUserColumns(expandedAuditId, setExpandedAuditId, startEdit, handleDeleteClick, handleResendInvite, resendingId),
    [expandedAuditId, resendingId],
  );

  const { orderedColumns, reorderColumns, columnWidths, setColumnWidth } =
    useTableLayout("users-v3", columnDefs);

  const COLUMN_COUNT = orderedColumns.length;

  /* ── Client-side sort ────────────────────────────────── */

  const sortedUsers = useMemo(() => {
    if (!tp.sort.column || !tp.sort.order) return users;
    const col = tp.sort.column as keyof User;
    const dir = tp.sort.order === "asc" ? 1 : -1;
    return [...users].sort((a, b) => {
      const va = (a[col] ?? "") as string;
      const vb = (b[col] ?? "") as string;
      return va.localeCompare(vb, "pt-BR", { sensitivity: "base" }) * dir;
    });
  }, [users, tp.sort.column, tp.sort.order]);

  const leituraSelected = form.roles.includes("LEITURA");
  const hasNonLeitura = form.roles.some((r) => r !== "LEITURA");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
          <p className="text-sm text-slate-500">
            Gerencie os usuarios do sistema.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + Novo Usuario
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            {editingId ? "Editar Usuario" : "Novo Usuario"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className={`grid grid-cols-1 ${editingId ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-3`}>
              <input
                placeholder="Nome"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onBlur={() => setForm((f) => ({ ...f, name: toTitleCase(f.name) }))}
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
              {editingId && (
                <PasswordInput
                  placeholder="Nova senha (opcional)"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              )}
            </div>
            {!editingId && (
              <p className="text-xs text-slate-500">
                Um email de convite sera enviado para o usuario definir sua propria senha.
              </p>
            )}

            {/* Roles multi-select checkboxes */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Papeis
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_ROLES.map((r) => {
                  const isLeitura = r === "LEITURA";
                  const disabled = isLeitura ? hasNonLeitura : leituraSelected;
                  const checked = form.roles.includes(r);

                  return (
                    <label
                      key={r}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all select-none ${
                        checked
                          ? "border-blue-300 bg-blue-50 text-blue-800 font-medium"
                          : disabled
                          ? "border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed"
                          : "border-slate-300 bg-white text-slate-700 hover:border-blue-200 cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleRole(r)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-30"
                      />
                      {ROLE_LABELS[r]}
                    </label>
                  );
                })}
              </div>
              {leituraSelected && (
                <p className="text-xs text-amber-600 mt-1.5">
                  Somente Leitura e exclusivo — desmarque para habilitar outros papeis.
                </p>
              )}
            </div>

            {/* Chat IA toggle — ADMIN always has access, this controls non-admin users */}
            {!form.roles.includes("ADMIN") && (
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.chatIAEnabled}
                    onChange={(e) => setForm((f) => ({ ...f, chatIAEnabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                </label>
                <div>
                  <span className="text-sm font-medium text-slate-700">Acesso ao Chat IA</span>
                  <p className="text-xs text-slate-500">Permite que este usuario use o assistente de IA. Administradores sempre tem acesso.</p>
                </div>
              </div>
            )}

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
          Nenhum usuario cadastrado.
        </div>
      ) : (
        <div
          className="rounded-xl border border-slate-200 bg-white shadow-sm"
          style={{ overflowX: "auto", overflowY: "hidden" }}
        >
          <table
            className="text-sm"
            style={{ tableLayout: "fixed", minWidth: "700px", width: "max-content" }}
          >
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {orderedColumns.map((col, idx) => (
                  <DraggableHeader
                    key={col.id}
                    index={idx}
                    columnId={col.id}
                    onReorder={reorderColumns}
                    onResize={setColumnWidth}
                    width={columnWidths[col.id]}
                  >
                    {col.sortable ? (
                      <SortableHeader
                        as="div"
                        label={col.label}
                        column={col.sortKey || col.id}
                        currentColumn={tp.sort.column}
                        currentOrder={tp.sort.order}
                        onToggle={tp.toggleSort}
                        align={col.align}
                      />
                    ) : (
                      <div
                        className={`py-3 px-4 text-xs font-semibold uppercase text-slate-600 ${
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                              ? "text-center"
                              : "text-left"
                        }`}
                      >
                        {col.label}
                      </div>
                    )}
                  </DraggableHeader>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((u) => (
                <React.Fragment key={u.id}>
                  <tr className="border-b border-slate-100 hover:bg-slate-50">
                    {orderedColumns.map((col) => {
                      const w = columnWidths[col.id];
                      const tdStyle: React.CSSProperties = w
                        ? {
                            width: `${w}px`,
                            minWidth: `${w}px`,
                            maxWidth: `${w}px`,
                            overflow: "hidden",
                          }
                        : {};
                      return (
                        <td
                          key={col.id}
                          style={tdStyle}
                          className={`py-3 px-4 ${
                            col.align === "right"
                              ? "text-right"
                              : col.align === "center"
                                ? "text-center"
                                : "text-left"
                          }`}
                        >
                          {col.render(u)}
                        </td>
                      );
                    })}
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
        title="Desativar Usuario"
        message={`Desativar o usuario "${deactivateTarget?.name}"?`}
        confirmLabel="Desativar"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDeactivate}
        onCancel={handleCancelDeactivate}
        variant="danger"
      />
    </div>
  );
}
