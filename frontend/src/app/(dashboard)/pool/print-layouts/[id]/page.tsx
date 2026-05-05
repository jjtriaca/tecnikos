"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

type Page = {
  id: string;
  order: number;
  type: "FIXED" | "DYNAMIC";
  htmlContent: string | null;
  dynamicType: string | null;
  pageConfig: any;
  isConditional: boolean;
  conditionRule: any;
  pageBreak: boolean;
  isActive: boolean;
};

type Layout = {
  id: string;
  name: string;
  isDefault: boolean;
  branding: any;
  isActive: boolean;
  pages: Page[];
};

const DYNAMIC_LABEL: Record<string, string> = {
  COVER: "Capa do orcamento",
  BUDGET_SUMMARY: "Resumo do orcamento",
  PRODUCTS_BY_SECTION: "Produtos por secao",
  PHOTOS_GALLERY: "Galeria de fotos",
  CALCULATIONS: "Memoria de calculo",
  TERMS_CONDITIONS: "Termos e condicoes",
  INSTALLMENTS: "Plano de pagamento",
  CUSTOM_TABLE: "Tabela personalizada",
};

const PLACEHOLDERS = [
  { key: "{clientName}", label: "Nome do cliente" },
  { key: "{clientDocument}", label: "CPF/CNPJ do cliente" },
  { key: "{budgetCode}", label: "Codigo do orcamento" },
  { key: "{budgetTitle}", label: "Titulo do orcamento" },
  { key: "{budgetTotal}", label: "Valor total" },
  { key: "{poolLength}", label: "Comprimento (m)" },
  { key: "{poolWidth}", label: "Largura (m)" },
  { key: "{poolDepth}", label: "Profundidade (m)" },
  { key: "{poolArea}", label: "Area (m²)" },
  { key: "{poolVolume}", label: "Volume (m³)" },
  { key: "{poolPerimeter}", label: "Perimetro (m)" },
  { key: "{validityDays}", label: "Validade (dias)" },
  { key: "{date}", label: "Data atual" },
];

export default function PoolPrintLayoutEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [layout, setLayout] = useState<Layout | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [showAddPage, setShowAddPage] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Layout>(`/pool-print-layouts/${id}`);
      setLayout(data);
      setName(data.name);
      setIsDefault(data.isDefault);
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao carregar layout", "error");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);

  async function saveMeta() {
    try {
      await api.put(`/pool-print-layouts/${id}`, { name, isDefault });
      toast("Layout salvo", "success");
      setEditingMeta(false);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  async function addPage(payload: any) {
    try {
      await api.post(`/pool-print-layouts/${id}/pages`, payload);
      setShowAddPage(false);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  async function updatePage(pageId: string, patch: any) {
    try {
      await api.put(`/pool-print-layouts/pages/${pageId}`, patch);
      setEditingPage(null);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  async function removePage(pageId: string) {
    if (!confirm("Remover esta pagina?")) return;
    try {
      await api.del(`/pool-print-layouts/pages/${pageId}`);
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro", "error");
    }
  }

  async function reorderPages(pageIds: string[]) {
    try {
      await api.post(`/pool-print-layouts/${id}/reorder-pages`, { pageIds });
      await load();
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao reordenar", "error");
    }
  }

  function handleDragStart(pageId: string) {
    setDraggingId(pageId);
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggingId || draggingId === targetId || !layout) return;
    const pages = [...layout.pages];
    const fromIdx = pages.findIndex((p) => p.id === draggingId);
    const toIdx = pages.findIndex((p) => p.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = pages.splice(fromIdx, 1);
    pages.splice(toIdx, 0, moved);
    setLayout({ ...layout, pages });
  }

  function handleDragEnd() {
    if (draggingId && layout) {
      reorderPages(layout.pages.map((p) => p.id));
    }
    setDraggingId(null);
  }

  if (loading) return <div className="p-6 text-slate-400">Carregando...</div>;
  if (!layout) return <div className="p-6 text-slate-400">Layout nao encontrado.</div>;

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/pool/print-layouts" className="text-xs text-slate-500 hover:text-slate-700">← Layouts</Link>
          {editingMeta ? (
            <div className="flex items-center gap-2 mt-1">
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="text-2xl font-bold text-slate-900 rounded border border-slate-300 px-2 py-1" />
              <label className="flex items-center gap-1 text-sm text-slate-700">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                padrao
              </label>
              <button onClick={saveMeta}
                className="rounded bg-cyan-600 px-3 py-1 text-sm text-white hover:bg-cyan-700">Salvar</button>
              <button onClick={() => { setEditingMeta(false); setName(layout.name); setIsDefault(layout.isDefault); }}
                className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50">Cancelar</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <h1 className="text-2xl font-bold text-slate-900">{layout.name}</h1>
              {layout.isDefault && <span className="rounded-full bg-cyan-100 text-cyan-700 text-xs px-2 py-0.5">padrao</span>}
              <button onClick={() => setEditingMeta(true)} className="text-xs text-cyan-600 hover:text-cyan-800">
                Editar nome
              </button>
            </div>
          )}
          <p className="mt-1 text-sm text-slate-500">
            Arraste as paginas pra reordenar. Clique em uma pagina pra editar.
          </p>
        </div>
        <button onClick={() => setShowAddPage(true)}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700">
          + Adicionar pagina
        </button>
      </div>

      {/* Pages list */}
      {layout.pages.length === 0 ? (
        <div className="py-16 text-center text-slate-400 rounded-xl border border-dashed border-slate-300 bg-white">
          Nenhuma pagina ainda. Adicione pelo menos uma capa pra comecar.
        </div>
      ) : (
        <div className="space-y-3">
          {layout.pages.map((p, idx) => (
            <div key={p.id}
              draggable
              onDragStart={() => handleDragStart(p.id)}
              onDragOver={(e) => handleDragOver(e, p.id)}
              onDragEnd={handleDragEnd}
              className={`rounded-xl border bg-white shadow-sm p-4 cursor-move transition ${
                draggingId === p.id ? "opacity-50 border-cyan-400" : "border-slate-200 hover:border-cyan-300"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center justify-center bg-slate-100 rounded-lg w-12 h-12 flex-shrink-0">
                  <div className="text-xs text-slate-400">PAG.</div>
                  <div className="text-lg font-bold text-slate-700">{idx + 1}</div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {p.type === "FIXED" ? (
                      <span className="rounded-full bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 font-semibold">HTML FIXO</span>
                    ) : (
                      <span className="rounded-full bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 font-semibold">DINAMICA</span>
                    )}
                    {p.isConditional && (
                      <span className="rounded-full bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 font-semibold">CONDICIONAL</span>
                    )}
                    {!p.isActive && (
                      <span className="rounded-full bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5">inativa</span>
                    )}
                  </div>
                  <div className="font-medium text-slate-900">
                    {p.type === "DYNAMIC"
                      ? (DYNAMIC_LABEL[p.dynamicType || ""] || p.dynamicType || "Pagina dinamica")
                      : p.htmlContent
                        ? <span className="text-slate-700">{p.htmlContent.slice(0, 80).replace(/<[^>]+>/g, "").trim() || "(sem conteudo)"}{p.htmlContent.length > 80 ? "..." : ""}</span>
                        : "(sem conteudo)"}
                  </div>
                  {p.isConditional && (
                    <div className="text-xs text-orange-600 mt-1">
                      Aparece apenas se: {JSON.stringify(p.conditionRule)}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => setEditingPage(p)}
                    className="text-xs text-cyan-600 hover:text-cyan-800 font-medium">
                    Editar
                  </button>
                  <button onClick={() => removePage(p.id)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium">
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modais */}
      {(showAddPage || editingPage) && (
        <PageEditor
          editing={editingPage}
          onClose={() => { setShowAddPage(false); setEditingPage(null); }}
          onSubmit={(payload) => editingPage ? updatePage(editingPage.id, payload) : addPage(payload)}
        />
      )}
    </div>
  );
}

function PageEditor({ editing, onClose, onSubmit }: {
  editing: Page | null;
  onClose: () => void;
  onSubmit: (payload: any) => void;
}) {
  const [type, setType] = useState<"FIXED" | "DYNAMIC">(editing?.type || "DYNAMIC");
  const [dynamicType, setDynamicType] = useState(editing?.dynamicType || "COVER");
  const [htmlContent, setHtmlContent] = useState(editing?.htmlContent || "");
  const [pageConfig, setPageConfig] = useState(editing?.pageConfig ? JSON.stringify(editing.pageConfig, null, 2) : "{}");
  const [isConditional, setIsConditional] = useState(editing?.isConditional || false);
  const [conditionRequires, setConditionRequires] = useState(
    (editing?.conditionRule as any)?.requires?.join(",") || ""
  );
  const [pageBreak, setPageBreak] = useState(editing?.pageBreak ?? true);
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);

  function insertPlaceholder(ph: string) {
    setHtmlContent(htmlContent + ph);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      type,
      pageBreak,
      isActive,
      isConditional,
    };
    if (type === "FIXED") {
      payload.htmlContent = htmlContent;
      payload.dynamicType = null;
    } else {
      payload.dynamicType = dynamicType;
      payload.htmlContent = null;
      try {
        payload.pageConfig = JSON.parse(pageConfig || "{}");
      } catch {
        alert("JSON de configuracao invalido");
        return;
      }
    }
    if (isConditional && conditionRequires.trim()) {
      payload.conditionRule = {
        requires: conditionRequires.split(",").map((s) => s.trim()).filter(Boolean),
      };
    } else if (!isConditional) {
      payload.conditionRule = null;
    }
    onSubmit(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          {editing ? "Editar pagina" : "Nova pagina"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => setType("DYNAMIC")}
              className={`px-4 py-2 rounded text-sm ${type === "DYNAMIC" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700"}`}>
              Pagina dinamica
            </button>
            <button type="button" onClick={() => setType("FIXED")}
              className={`px-4 py-2 rounded text-sm ${type === "FIXED" ? "bg-cyan-600 text-white" : "bg-slate-100 text-slate-700"}`}>
              HTML fixo (placeholders)
            </button>
          </div>

          {type === "DYNAMIC" ? (
            <>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Tipo de pagina dinamica *</label>
                <select value={dynamicType} onChange={(e) => setDynamicType(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                  {Object.entries(DYNAMIC_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Configuracao (JSON)</label>
                <textarea value={pageConfig} onChange={(e) => setPageConfig(e.target.value)} rows={6}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
                  placeholder='{"sections": ["CONSTRUCAO"], "showImages": true}' />
                <p className="mt-1 text-xs text-slate-500">
                  Ex: <code>{`{"sections": ["FILTRO"], "showImages": true}`}</code>
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-slate-600">Conteudo HTML *</label>
                  <details className="relative">
                    <summary className="text-xs text-cyan-600 cursor-pointer hover:text-cyan-800">+ Inserir variavel</summary>
                    <div className="absolute right-0 top-6 z-10 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-y-auto w-64 p-2 grid grid-cols-1 gap-1">
                      {PLACEHOLDERS.map((ph) => (
                        <button key={ph.key} type="button"
                          onClick={() => insertPlaceholder(ph.key)}
                          className="text-left text-xs px-2 py-1 rounded hover:bg-slate-100">
                          <span className="font-mono text-cyan-600">{ph.key}</span>
                          <span className="text-slate-400 ml-2">{ph.label}</span>
                        </button>
                      ))}
                    </div>
                  </details>
                </div>
                <textarea value={htmlContent} onChange={(e) => setHtmlContent(e.target.value)} rows={12} required
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
                  placeholder='<h1>Orcamento {budgetCode}</h1>\n<p>Cliente: {clientName}</p>' />
                <p className="mt-1 text-xs text-slate-500">
                  HTML simples com placeholders. Placeholders disponiveis: {PLACEHOLDERS.map((p) => p.key).join(", ")}
                </p>
              </div>
            </>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isConditional} onChange={(e) => setIsConditional(e.target.checked)} />
              Pagina condicional (so aparece se requisito for atendido)
            </label>
            {isConditional && (
              <div>
                <label className="block text-xs text-slate-600 mb-1">Requer caracteristicas</label>
                <input value={conditionRequires} onChange={(e) => setConditionRequires(e.target.value)}
                  placeholder="Ex: AQUECIMENTO_SOLAR (separado por virgula)"
                  className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm" />
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={pageBreak} onChange={(e) => setPageBreak(e.target.checked)} />
              Quebra de pagina apos
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Ativa
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit"
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">
              {editing ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
