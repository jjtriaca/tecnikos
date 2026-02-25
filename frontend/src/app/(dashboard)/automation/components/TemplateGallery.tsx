"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

/* ═══════════════════════════════════════════════════════════════
   TEMPLATE GALLERY — Modal with pre-built automation templates
   ═══════════════════════════════════════════════════════════════ */

interface Template {
  id: string;
  name: string;
  description?: string;
  category: string;
  isBuiltIn: boolean;
  trigger: any;
  actions: any[];
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  FINANCEIRO:   { label: 'Financeiro',   icon: '💰', color: 'bg-green-100 text-green-800 border-green-200' },
  COMUNICACAO:  { label: 'Comunicação',  icon: '💬', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  GESTAO:       { label: 'Gestão',       icon: '📊', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  INTEGRACAO:   { label: 'Integração',   icon: '🔗', color: 'bg-violet-100 text-violet-800 border-violet-200' },
};

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: () => void; // callback to reload rules after applying
}

export default function TemplateGallery({ open, onClose, onApply }: Props) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<Template[]>("/automation-templates");
      setTemplates(res);
    } catch {
      toast("Erro ao carregar templates", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) loadTemplates();
  }, [open, loadTemplates]);

  const handleApply = async (templateId: string) => {
    try {
      setApplying(templateId);
      await api.post(`/automation-templates/${templateId}/apply`, {});
      toast("Template aplicado! Regra criada como inativa — revise e ative.", "success");
      onApply();
      onClose();
    } catch {
      toast("Erro ao aplicar template", "error");
    } finally {
      setApplying(null);
    }
  };

  if (!open) return null;

  const categories = ['ALL', ...Object.keys(CATEGORY_CONFIG)];
  const filtered = filterCategory === 'ALL'
    ? templates
    : templates.filter((t) => t.category === filterCategory);

  // Group by category
  const grouped = filtered.reduce<Record<string, Template[]>>((acc, t) => {
    const cat = t.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Templates de Automação</h2>
            <p className="text-sm text-slate-500">Modelos prontos para usar — clique em &quot;Usar&quot; para criar uma regra</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Category filter */}
        <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap gap-2">
          {categories.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  filterCategory === cat
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {cat === 'ALL' ? '📋 Todos' : `${cfg?.icon} ${cfg?.label}`}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400 text-sm">Nenhum template encontrado nesta categoria.</p>
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => {
              const cfg = CATEGORY_CONFIG[category] || { label: category, icon: '📋', color: 'bg-slate-100 text-slate-800 border-slate-200' };
              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${cfg.color}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                    <span className="text-xs text-slate-400">{items.length} template{items.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid gap-3">
                    {items.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow flex items-start justify-between gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-slate-900">{tpl.name}</h3>
                            {tpl.isBuiltIn && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 rounded">
                                Sistema
                              </span>
                            )}
                          </div>
                          {tpl.description && (
                            <p className="text-xs text-slate-500">{tpl.description}</p>
                          )}
                          <div className="mt-2 text-[10px] text-slate-400">
                            {tpl.actions.length} ação{tpl.actions.length > 1 ? 'ões' : ''}
                          </div>
                        </div>
                        <button
                          onClick={() => handleApply(tpl.id)}
                          disabled={applying === tpl.id}
                          className="px-4 py-2 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors shrink-0"
                        >
                          {applying === tpl.id ? "Aplicando..." : "Usar"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
