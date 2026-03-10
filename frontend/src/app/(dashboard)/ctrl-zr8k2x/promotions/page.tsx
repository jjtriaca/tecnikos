"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth, hasRole } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

interface Promotion {
  id: string;
  name: string;
  code: string | null;
  discountPercent: number | null;
  discountCents: number | null;
  durationMonths: number;
  applicablePlans: string[];
  maxUses: number | null;
  currentUses: number;
  isActive: boolean;
  skipPayment: boolean;
  startsAt: string;
  expiresAt: string | null;
}

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function PromotionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", code: "", discountPercent: 0, discountCents: 0,
    durationMonths: 1, maxUses: 0, isActive: true, expiresAt: "",
  });
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [error, setError] = useState<string | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [showVoucherForm, setShowVoucherForm] = useState(false);
  const [voucherForm, setVoucherForm] = useState({ name: "", durationMonths: 12 });
  const [generatedVoucher, setGeneratedVoucher] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Promotion[]>("/admin/tenants/promotions/list");
      setPromotions(data);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (user && !hasRole(user, "ADMIN")) { router.replace("/dashboard"); return; }
    load();
  }, [user, router, load]);

  function openCreate() {
    setEditingId(null);
    setForm({ name: "", code: "", discountPercent: 0, discountCents: 0, durationMonths: 1, maxUses: 0, isActive: true, expiresAt: "" });
    setDiscountType("percent");
    setError(null);
    setShowForm(true);
  }

  function openEdit(promo: Promotion) {
    setEditingId(promo.id);
    const type = promo.discountPercent ? "percent" : "fixed";
    setDiscountType(type);
    setForm({
      name: promo.name,
      code: promo.code || "",
      discountPercent: promo.discountPercent || 0,
      discountCents: promo.discountCents || 0,
      durationMonths: promo.durationMonths,
      maxUses: promo.maxUses || 0,
      isActive: promo.isActive,
      expiresAt: promo.expiresAt ? promo.expiresAt.split("T")[0] : "",
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const payload: any = {
        name: form.name,
        code: form.code || undefined,
        durationMonths: form.durationMonths,
        maxUses: form.maxUses || undefined,
        isActive: form.isActive,
        expiresAt: form.expiresAt || undefined,
      };
      if (discountType === "percent") {
        payload.discountPercent = form.discountPercent;
        payload.discountCents = undefined;
      } else {
        payload.discountCents = form.discountCents;
        payload.discountPercent = undefined;
      }

      if (editingId) {
        await api.put(`/admin/tenants/promotions/${editingId}`, payload);
      } else {
        await api.post("/admin/tenants/promotions", payload);
      }
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar promoção");
    }
  }

  async function handleGenerateVoucher(e: React.FormEvent) {
    e.preventDefault();
    setVoucherLoading(true);
    setError(null);
    try {
      const result = await api.post<Promotion>("/admin/tenants/promotions/generate-voucher", {
        name: voucherForm.name || undefined,
        durationMonths: voucherForm.durationMonths,
      });
      setGeneratedVoucher(result.code);
      await load();
    } catch (err: any) {
      setError(err.message || "Erro ao gerar voucher");
    } finally {
      setVoucherLoading(false);
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Promoções</h1>
          <p className="text-sm text-slate-500">Configure descontos e códigos promocionais</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowVoucherForm(true); setGeneratedVoucher(null); setVoucherForm({ name: "", durationMonths: 12 }); }}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
            Gerar Voucher
          </button>
          <button onClick={openCreate} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + Nova Promoção
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
        </div>
      ) : promotions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
          <p className="text-sm text-slate-400">Nenhuma promoção cadastrada.</p>
          <button onClick={openCreate} className="mt-2 text-sm font-medium text-blue-600 hover:underline">
            Criar primeira promoção
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Promoção</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Código</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Desconto</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Duração</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Uso</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {promotions.map((promo) => (
                <tr key={promo.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {promo.name}
                    {promo.skipPayment && (
                      <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">VOUCHER</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {promo.code ? (
                      <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{promo.code}</code>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {promo.discountPercent ? `${promo.discountPercent}%` : promo.discountCents ? formatBRL(promo.discountCents) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{promo.durationMonths} mês{promo.durationMonths > 1 ? "es" : ""}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {promo.currentUses}{promo.maxUses ? ` / ${promo.maxUses}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${promo.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {promo.isActive ? "Ativa" : "Inativa"}
                    </span>
                    {promo.expiresAt && new Date(promo.expiresAt) < new Date() && (
                      <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-600">Expirada</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(promo)}
                      className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate Voucher Modal */}
      {showVoucherForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">Gerar Voucher</h2>
            <p className="text-xs text-slate-500 mt-1">Cria um código de uso único que pula o pagamento</p>

            {generatedVoucher ? (
              <div className="mt-6 text-center">
                <p className="text-xs text-slate-500 mb-2">Voucher gerado com sucesso:</p>
                <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                  <code className="text-2xl font-bold text-green-700 tracking-wider">{generatedVoucher}</code>
                </div>
                <p className="text-xs text-slate-400 mt-3">Envie este código para o cliente. Uso único.</p>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => { navigator.clipboard.writeText(generatedVoucher); }}
                    className="flex-1 rounded-lg bg-slate-100 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200">
                    Copiar código
                  </button>
                  <button onClick={() => setShowVoucherForm(false)}
                    className="flex-1 rounded-lg bg-blue-600 py-2 text-xs font-medium text-white hover:bg-blue-700">
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleGenerateVoucher} className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Nome / Descrição</label>
                  <input className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                    value={voucherForm.name} onChange={(e) => setVoucherForm({ ...voucherForm, name: e.target.value })}
                    placeholder="Ex: Voucher SLS Obras" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Duração (meses)</label>
                  <input type="number" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                    value={voucherForm.durationMonths} onChange={(e) => setVoucherForm({ ...voucherForm, durationMonths: parseInt(e.target.value) || 12 })}
                    min="1" />
                </div>
                {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowVoucherForm(false)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
                  <button type="submit" disabled={voucherLoading}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                    {voucherLoading ? "Gerando..." : "Gerar Voucher"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">{editingId ? "Editar Promoção" : "Nova Promoção"}</h2>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Nome *</label>
                <input
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder='Ex: "Primeiro mês 50% OFF"'
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Código promocional</label>
                <input
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="Ex: PROMO50"
                />
              </div>

              {/* Discount type */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Tipo de desconto</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDiscountType("percent")}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${discountType === "percent" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                    Percentual (%)
                  </button>
                  <button type="button" onClick={() => setDiscountType("fixed")}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${discountType === "fixed" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                    Valor fixo (R$)
                  </button>
                </div>
              </div>
              {discountType === "percent" ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Desconto (%)</label>
                  <input type="number" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                    value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: parseFloat(e.target.value) || 0 })}
                    min="0" max="100" step="0.1" />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Desconto (R$)</label>
                  <input type="number" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                    value={form.discountCents / 100} onChange={(e) => setForm({ ...form, discountCents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                    min="0" step="0.01" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Duração (meses)</label>
                  <input type="number" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                    value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: parseInt(e.target.value) || 1 })}
                    min="1" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Limite de usos (0=ilimitado)</label>
                  <input type="number" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                    value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: parseInt(e.target.value) || 0 })}
                    min="0" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Expira em</label>
                <input type="date" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                  value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                <span className="text-xs text-slate-600">Promoção ativa</span>
              </label>

              {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancelar</button>
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  {editingId ? "Salvar" : "Criar Promoção"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
