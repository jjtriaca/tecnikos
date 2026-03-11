"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth, hasRole } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

type AddOn = {
  id: string;
  name: string;
  description: string | null;
  osQuantity: number;
  priceCents: number;
  isActive: boolean;
  sortOrder: number;
};

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AddOnsAdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AddOn | null>(null);
  const [form, setForm] = useState({ name: "", description: "", osQuantity: 50, priceCents: 4900, sortOrder: 0 });

  useEffect(() => {
    if (!hasRole(user, "ADMIN")) { router.push("/dashboard"); return; }
    loadAddOns();
  }, [user, router]);

  async function loadAddOns() {
    try {
      const data = await api.get<AddOn[]>("/admin/tenants/addons/list");
      setAddOns(data);
    } catch {}
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", osQuantity: 50, priceCents: 4900, sortOrder: 0 });
    setShowForm(true);
  }

  function openEdit(a: AddOn) {
    setEditing(a);
    setForm({ name: a.name, description: a.description || "", osQuantity: a.osQuantity, priceCents: a.priceCents, sortOrder: a.sortOrder });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/admin/tenants/addons/${editing.id}`, form);
      } else {
        await api.post("/admin/tenants/addons", form);
      }
      setShowForm(false);
      loadAddOns();
    } catch (err: any) {
      alert(err?.message || "Erro ao salvar");
    }
  }

  async function handleDeactivate(id: string) {
    await api.del(`/admin/tenants/addons/${id}`);
    loadAddOns();
  }

  if (loading) return <div className="animate-pulse h-40 bg-slate-200 rounded-xl" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pacotes Add-on</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie pacotes extras de OS para venda</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          + Novo Pacote
        </button>
      </div>

      {/* Add-on List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {addOns.map((a) => (
          <div key={a.id} className={`rounded-xl border p-5 shadow-sm ${a.isActive ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-800">{a.name}</h3>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${a.isActive ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>
                {a.isActive ? "Ativo" : "Inativo"}
              </span>
            </div>
            {a.description && <p className="text-xs text-slate-500 mb-3">{a.description}</p>}
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-2xl font-bold text-slate-900">+{a.osQuantity}</p>
                <p className="text-xs text-slate-500">OS extras</p>
              </div>
              <p className="text-lg font-bold text-blue-600">{formatCurrency(a.priceCents)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(a)} className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Editar
              </button>
              {a.isActive && (
                <button onClick={() => handleDeactivate(a.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                  Desativar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {addOns.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">Nenhum pacote cadastrado. Clique em "+ Novo Pacote" para criar.</p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              {editing ? "Editar Pacote" : "Novo Pacote"}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Pacote 50 OS"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descricao</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="50 ordens de servico adicionais"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Qtd OS *</label>
                  <input
                    type="number"
                    min={1}
                    value={form.osQuantity}
                    onChange={(e) => setForm({ ...form, osQuantity: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Preco (centavos) *</label>
                  <input
                    type="number"
                    min={0}
                    value={form.priceCents}
                    onChange={(e) => setForm({ ...form, priceCents: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">{formatCurrency(form.priceCents)}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ordem</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button type="submit" className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                {editing ? "Salvar" : "Criar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
