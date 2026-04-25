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
  userQuantity: number;
  technicianQuantity: number;
  aiMessageQuantity: number;
  nfseImportQuantity: number;
  priceCents: number;
  isActive: boolean;
  sortOrder: number;
};

type FormState = {
  name: string;
  description: string;
  osQuantity: number;
  userQuantity: number;
  technicianQuantity: number;
  aiMessageQuantity: number;
  nfseImportQuantity: number;
  priceDisplay: string;
  sortOrder: number;
};

const emptyForm: FormState = {
  name: "", description: "", osQuantity: 0, userQuantity: 0,
  technicianQuantity: 0, aiMessageQuantity: 0, nfseImportQuantity: 0, priceDisplay: "", sortOrder: 0,
};

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function displayToCents(display: string): number {
  const cleaned = display.replace(/[^\d,.-]/g, "").replace(",", ".");
  return Math.round(parseFloat(cleaned) * 100) || 0;
}

function centsToDisplay(cents: number): string {
  if (!cents) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Describe what the add-on gives */
function describeAddOn(a: AddOn): string[] {
  const parts: string[] = [];
  if (a.osQuantity > 0) parts.push(`+${a.osQuantity} OS/mes`);
  if (a.userQuantity > 0) parts.push(`+${a.userQuantity} usuario${a.userQuantity > 1 ? "s" : ""}`);
  if (a.technicianQuantity > 0) parts.push(`+${a.technicianQuantity} tecnico${a.technicianQuantity > 1 ? "s" : ""}`);
  if (a.aiMessageQuantity > 0) parts.push(`+${a.aiMessageQuantity} msgs IA`);
  if (a.nfseImportQuantity > 0) parts.push(`+${a.nfseImportQuantity} import. NFS-e`);
  return parts;
}

export default function AddOnsAdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AddOn | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

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
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  }

  function openEdit(a: AddOn) {
    setEditing(a);
    setForm({
      name: a.name,
      description: a.description || "",
      osQuantity: a.osQuantity,
      userQuantity: a.userQuantity,
      technicianQuantity: a.technicianQuantity,
      aiMessageQuantity: a.aiMessageQuantity,
      nfseImportQuantity: a.nfseImportQuantity,
      priceDisplay: centsToDisplay(a.priceCents),
      sortOrder: a.sortOrder,
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const priceCents = displayToCents(form.priceDisplay);
    if (priceCents <= 0) { setError("Preco deve ser maior que zero"); return; }
    if (form.osQuantity <= 0 && form.userQuantity <= 0 && form.technicianQuantity <= 0 && form.aiMessageQuantity <= 0 && form.nfseImportQuantity <= 0) {
      setError("Pelo menos uma quantidade deve ser maior que zero");
      return;
    }
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        osQuantity: form.osQuantity,
        userQuantity: form.userQuantity,
        technicianQuantity: form.technicianQuantity,
        aiMessageQuantity: form.aiMessageQuantity,
        nfseImportQuantity: form.nfseImportQuantity,
        priceCents,
        sortOrder: form.sortOrder,
      };
      if (editing) {
        await api.put(`/admin/tenants/addons/${editing.id}`, payload);
      } else {
        await api.post("/admin/tenants/addons", payload);
      }
      setShowForm(false);
      loadAddOns();
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar");
    }
  }

  function handleDuplicate(a: AddOn) {
    setEditing(null); // Create mode, not edit
    setForm({
      name: a.name + " (copia)",
      description: a.description || "",
      osQuantity: a.osQuantity,
      userQuantity: a.userQuantity,
      technicianQuantity: a.technicianQuantity,
      aiMessageQuantity: a.aiMessageQuantity,
      nfseImportQuantity: a.nfseImportQuantity,
      priceDisplay: centsToDisplay(a.priceCents),
      sortOrder: Math.max(0, ...addOns.map(x => x.sortOrder)) + 1,
    });
    setError(null);
    setShowForm(true);
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Desativar este pacote?")) return;
    await api.del(`/admin/tenants/addons/${id}`);
    loadAddOns();
  }

  async function handleReactivate(id: string) {
    await api.put(`/admin/tenants/addons/${id}`, { isActive: true });
    loadAddOns();
  }

  if (loading) return <div className="animate-pulse h-40 bg-slate-200 rounded-xl" />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pacotes Add-on</h1>
          <p className="text-sm text-slate-500 mt-1">Pacotes avulsos que o cliente pode comprar para expandir limites</p>
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
        {addOns.map((a) => {
          const benefits = describeAddOn(a);
          return (
            <div key={a.id} className={`rounded-xl border p-5 shadow-sm ${a.isActive ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-800">{a.name}</h3>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${a.isActive ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>
                  {a.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>
              {a.description && <p className="text-xs text-slate-500 mb-3">{a.description}</p>}

              <div className="space-y-1 mb-3">
                {benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-sm">
                    <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <span className="text-slate-700 font-medium">{b}</span>
                  </div>
                ))}
              </div>

              <p className="text-xl font-bold text-blue-600 mb-3">{formatCurrency(a.priceCents)}<span className="text-xs font-normal text-slate-400">/avulso</span></p>

              <div className="flex gap-2">
                <button onClick={() => openEdit(a)} className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                  Editar
                </button>
                <button onClick={() => handleDuplicate(a)} className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50">
                  Duplicar
                </button>
                {a.isActive ? (
                  <button onClick={() => handleDeactivate(a.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                    Desativar
                  </button>
                ) : (
                  <button onClick={() => handleReactivate(a.id)} className="rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-50">
                    Reativar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {addOns.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-500">Nenhum pacote cadastrado. Clique em &quot;+ Novo Pacote&quot; para criar.</p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              {editing ? "Editar Pacote" : "Novo Pacote"}
            </h2>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <div className="space-y-4">
              {/* Name + Description */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="+100 OS/mes"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descricao</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="100 ordens de servico adicionais por mes"
                />
              </div>

              {/* Quantities */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Quantidades (preencha os que se aplicam)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">OS extras</label>
                    <input
                      type="number" min={0}
                      value={form.osQuantity}
                      onChange={(e) => setForm({ ...form, osQuantity: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Usuarios gestores extras</label>
                    <input
                      type="number" min={0}
                      value={form.userQuantity}
                      onChange={(e) => setForm({ ...form, userQuantity: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Tecnicos extras</label>
                    <input
                      type="number" min={0}
                      value={form.technicianQuantity}
                      onChange={(e) => setForm({ ...form, technicianQuantity: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Msgs IA extras</label>
                    <input
                      type="number" min={0}
                      value={form.aiMessageQuantity}
                      onChange={(e) => setForm({ ...form, aiMessageQuantity: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Import. NFS-e extras</label>
                    <input
                      type="number" min={0}
                      value={form.nfseImportQuantity}
                      onChange={(e) => setForm({ ...form, nfseImportQuantity: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Price + Sort */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Preco (R$) *</label>
                  <input
                    value={form.priceDisplay}
                    onChange={(e) => setForm({ ...form, priceDisplay: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 outline-none"
                    placeholder="127,00"
                    required
                  />
                  {form.priceDisplay && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatCurrency(displayToCents(form.priceDisplay))}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Ordem de exibicao</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Ultima posicao: {Math.max(0, ...addOns.map(a => a.sortOrder))} — use {Math.max(0, ...addOns.map(a => a.sortOrder)) + 1} para exibir por ultimo
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-400">O pacote vale para o ciclo de cobranca vigente. O cliente pode optar por nao renovar.</p>
            </div>

            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
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
