"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

type TemplateSectionItem = { catalogConfigId: string; sortOrder?: number; required?: boolean };
type TemplateSection = { section: string; sortOrder?: number; items: TemplateSectionItem[] };
type Template = {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  sections: TemplateSection[];
  isActive: boolean;
};
type CatalogConfig = {
  id: string;
  poolSection: string;
  product: { id: string; description: string } | null;
  service: { id: string; name: string } | null;
};

const SECTION_LABEL: Record<string, string> = {
  CONSTRUCAO: "Construcao", FILTRO: "Filtro", CASCATA: "Cascata", SPA: "SPA",
  AQUECIMENTO: "Aquecimento", ILUMINACAO: "Iluminacao", CASA_MAQUINAS: "Casa de Maquinas",
  DISPOSITIVOS: "Dispositivos", ACIONAMENTOS: "Acionamentos", BORDA_CALCADA: "Borda/Calcada",
  EXECUCAO: "Execucao", OUTROS: "Outros",
};

export default function PoolTemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [catalog, setCatalog] = useState<CatalogConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Template[] }>("/pool-budget-templates?limit=100");
      setTemplates(res.data || []);
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao carregar templates", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    api.get<{ data: CatalogConfig[] }>("/pool-catalog-config?limit=200")
      .then((r) => setCatalog(r.data || [])).catch(() => {});
  }, [load]);

  async function save(payload: any, id?: string) {
    try {
      if (id) await api.put(`/pool-budget-templates/${id}`, payload);
      else await api.post(`/pool-budget-templates`, payload);
      toast(id ? "Atualizado" : "Template criado", "success");
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  async function remove(id: string) {
    if (!confirm("Remover este template?")) return;
    try {
      await api.del(`/pool-budget-templates/${id}`);
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
          <h1 className="text-2xl font-bold text-slate-900">Templates de Etapas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Modelos pre-prontos de orcamento. Ao criar um orcamento, escolher um template gera os items automaticamente.
          </p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700">
          + Novo template
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Carregando...</div>
      ) : templates.length === 0 ? (
        <div className="py-16 text-center text-slate-400 rounded-xl border border-dashed border-slate-300 bg-white">
          Nenhum template ainda. Crie um pra acelerar a criacao de orcamentos.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => {
            const totalItems = (t.sections || []).reduce((s, sec) => s + (sec.items?.length || 0), 0);
            return (
              <div key={t.id} className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{t.name}</h3>
                      {t.isDefault && <span className="rounded-full bg-cyan-100 text-cyan-700 text-[10px] px-2 py-0.5">padrao</span>}
                      {!t.isActive && <span className="rounded-full bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5">inativo</span>}
                    </div>
                    {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                  </div>
                </div>
                <div className="text-xs text-slate-500 space-y-0.5 mt-2">
                  <div>{(t.sections || []).length} secao(oes), {totalItems} item(s)</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(t.sections || []).map((s, idx) => (
                      <span key={idx} className="rounded-full bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5">
                        {SECTION_LABEL[s.section] || s.section}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => { setEditing(t); setShowForm(true); }}
                    className="text-xs text-cyan-600 hover:text-cyan-800 font-medium">
                    Editar
                  </button>
                  <button onClick={() => remove(t.id)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium">
                    Remover
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <TemplateForm
          editing={editing}
          catalog={catalog}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSubmit={(payload) => save(payload, editing?.id)}
        />
      )}
    </div>
  );
}

function TemplateForm({ editing, catalog, onClose, onSubmit }: {
  editing: Template | null;
  catalog: CatalogConfig[];
  onClose: () => void;
  onSubmit: (payload: any) => void;
}) {
  const [name, setName] = useState(editing?.name || "");
  const [description, setDescription] = useState(editing?.description || "");
  const [isDefault, setIsDefault] = useState(editing?.isDefault || false);
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [sections, setSections] = useState<TemplateSection[]>(editing?.sections || []);

  function addSection(sectionKey: string) {
    if (sections.find((s) => s.section === sectionKey)) return;
    setSections([...sections, { section: sectionKey, sortOrder: sections.length, items: [] }]);
  }

  function removeSection(idx: number) {
    setSections(sections.filter((_, i) => i !== idx));
  }

  function toggleItem(secIdx: number, catalogId: string) {
    const sec = sections[secIdx];
    const exists = sec.items.find((i) => i.catalogConfigId === catalogId);
    let newItems: TemplateSectionItem[];
    if (exists) {
      newItems = sec.items.filter((i) => i.catalogConfigId !== catalogId);
    } else {
      newItems = [...sec.items, { catalogConfigId: catalogId, sortOrder: sec.items.length, required: false }];
    }
    setSections(sections.map((s, i) => i === secIdx ? { ...s, items: newItems } : s));
  }

  function toggleRequired(secIdx: number, catalogId: string) {
    setSections(sections.map((s, i) => {
      if (i !== secIdx) return s;
      return {
        ...s,
        items: s.items.map((it) => it.catalogConfigId === catalogId ? { ...it, required: !it.required } : it),
      };
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sections.length === 0 || sections.every((s) => s.items.length === 0)) {
      alert("Adicione pelo menos uma secao com items");
      return;
    }
    onSubmit({
      name,
      description: description || undefined,
      isDefault,
      isActive,
      sections,
    });
  }

  // Catalog grouped by section
  const catalogBySection: Record<string, CatalogConfig[]> = {};
  catalog.forEach((c) => {
    if (!catalogBySection[c.poolSection]) catalogBySection[c.poolSection] = [];
    catalogBySection[c.poolSection].push(c);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {editing ? "Editar template" : "Novo template"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Nome *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Descricao</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              Padrao do tenant
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Ativo
            </label>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-700 mb-2">Secoes do template</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.keys(SECTION_LABEL).filter((k) => !sections.find((s) => s.section === k)).map((k) => (
                <button key={k} type="button" onClick={() => addSection(k)}
                  className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-600 hover:border-cyan-400 hover:text-cyan-700">
                  + {SECTION_LABEL[k]}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {sections.map((sec, secIdx) => {
                const items = catalogBySection[sec.section] || [];
                return (
                  <div key={sec.section} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-sm text-slate-700">{SECTION_LABEL[sec.section]}</div>
                      <button type="button" onClick={() => removeSection(secIdx)}
                        className="text-xs text-red-500 hover:text-red-700">
                        Remover secao
                      </button>
                    </div>
                    {items.length === 0 ? (
                      <div className="text-xs text-slate-400">
                        Sem items no catalogo desta secao. <Link href="/pool/catalog" className="text-cyan-600 hover:underline">Adicionar</Link>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {items.map((c) => {
                          const itemInTpl = sec.items.find((i) => i.catalogConfigId === c.id);
                          return (
                            <div key={c.id} className="flex items-center gap-3 rounded bg-white border border-slate-200 px-3 py-1.5">
                              <input type="checkbox" checked={!!itemInTpl}
                                onChange={() => toggleItem(secIdx, c.id)} />
                              <div className="flex-1 text-sm text-slate-800">
                                {c.product?.description || c.service?.name || "(sem nome)"}
                                <span className="ml-2 text-[10px] text-slate-400">
                                  {c.product ? "Produto" : "Servico"}
                                </span>
                              </div>
                              {itemInTpl && (
                                <label className="flex items-center gap-1 text-xs text-slate-600">
                                  <input type="checkbox" checked={!!itemInTpl.required}
                                    onChange={() => toggleRequired(secIdx, c.id)} />
                                  obrigatorio
                                </label>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-white pt-4">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit"
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">
              {editing ? "Salvar alteracoes" : "Criar template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
