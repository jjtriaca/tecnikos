"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

type Layout = {
  id: string;
  name: string;
  isDefault: boolean;
  branding: any;
  isActive: boolean;
  createdAt: string;
  _count?: { pages: number };
};

export default function PoolPrintLayoutsListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Layout[] }>("/pool-print-layouts?limit=100");
      setLayouts(res.data || []);
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao carregar layouts", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const created: Layout = await api.post("/pool-print-layouts", { name: name.trim() });
      toast("Layout criado", "success");
      router.push(`/pool/print-layouts/${created.id}`);
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remover este layout?")) return;
    try {
      await api.del(`/pool-print-layouts/${id}`);
      toast("Removido", "success");
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/settings" className="text-xs text-slate-500 hover:text-slate-700">← Configuracoes</Link>
          <h1 className="text-2xl font-bold text-slate-900">Layouts de Impressao</h1>
          <p className="mt-1 text-sm text-slate-500">
            Page builder dos PDFs de orcamento. Cria paginas FIXED (HTML com placeholders) ou DYNAMIC (capa, lista de items, fotos, condicoes).
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700">
          + Novo layout
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Carregando...</div>
      ) : layouts.length === 0 ? (
        <div className="py-16 text-center text-slate-400 rounded-xl border border-dashed border-slate-300 bg-white">
          Nenhum layout ainda. Crie o primeiro pra ter o PDF do orcamento personalizado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {layouts.map((l) => (
            <div key={l.id} className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-slate-900">{l.name}</h3>
                {l.isDefault && <span className="rounded-full bg-cyan-100 text-cyan-700 text-[10px] px-2 py-0.5">padrao</span>}
                {!l.isActive && <span className="rounded-full bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5">inativo</span>}
              </div>
              <div className="text-xs text-slate-500">
                {l._count?.pages || 0} pagina(s) configurada(s)
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Link href={`/pool/print-layouts/${l.id}`}
                  className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700">
                  Editar paginas
                </Link>
                <button onClick={() => remove(l.id)}
                  className="text-xs text-red-500 hover:text-red-700 font-medium">
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Novo layout</h3>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do layout (ex: Padrao)"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm mb-4" autoFocus />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={create} disabled={creating || !name.trim()}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50">
                {creating ? "Criando..." : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
