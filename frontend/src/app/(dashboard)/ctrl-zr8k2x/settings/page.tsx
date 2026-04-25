"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";

type ConfigItem = {
  key: string;
  maskedValue: string;
  encrypted: boolean;
  label: string | null;
  group: string;
};

const GROUP_LABELS: Record<string, string> = {
  INTEGRATION: "Integracoes",
  PUSH: "Push Notifications",
  GENERAL: "Geral",
};

const PREDEFINED_CONFIGS = [
  { key: "FOCUS_NFE_RESELLER_TOKEN", label: "Token Revenda Focus NFe", group: "INTEGRATION", encrypted: true },
];

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [generatingVapid, setGeneratingVapid] = useState(false);

  const loadConfigs = useCallback(async () => {
    try {
      const data = await api.get<ConfigItem[]>("/admin/config");
      setConfigs(data);
    } catch {
      toast("Erro ao carregar configuracoes", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const handleSave = async (key: string, encrypted: boolean, label: string, group: string) => {
    if (!editValue.trim()) return;
    try {
      await api.put(`/admin/config/${key}`, { value: editValue, encrypted, label, group });
      toast(`${key} atualizado com sucesso`, "success");
      setEditing(null);
      setEditValue("");
      loadConfigs();
    } catch {
      toast("Erro ao salvar", "error");
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`Remover ${key}?`)) return;
    try {
      await api.del(`/admin/config/${key}`);
      toast(`${key} removido`, "success");
      loadConfigs();
    } catch {
      toast("Erro ao remover", "error");
    }
  };

  const handleGenerateVapid = async () => {
    setGeneratingVapid(true);
    try {
      const res = await api.post<{ publicKey: string; generated: boolean }>("/admin/config/generate-vapid");
      toast("VAPID keys geradas com sucesso!", "success");
      loadConfigs();
    } catch {
      toast("Erro ao gerar VAPID keys", "error");
    } finally {
      setGeneratingVapid(false);
    }
  };

  if (!user || !user.roles?.includes("ADMIN")) return null;

  const grouped = new Map<string, ConfigItem[]>();
  for (const c of configs) {
    const list = grouped.get(c.group) || [];
    list.push(c);
    grouped.set(c.group, list);
  }

  // Add missing predefined configs
  for (const pre of PREDEFINED_CONFIGS) {
    if (!configs.find(c => c.key === pre.key)) {
      const list = grouped.get(pre.group) || [];
      list.push({ key: pre.key, maskedValue: "(nao configurado)", encrypted: pre.encrypted, label: pre.label, group: pre.group });
      grouped.set(pre.group, list);
    }
  }

  const hasVapid = configs.some(c => c.key === "VAPID_PUBLIC_KEY");

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-slate-900">Configuracoes do Sistema</h1>
      <p className="mt-1 text-sm text-slate-500">Configuracoes globais do SaaS Tecnikos</p>

      {loading ? (
        <div className="mt-8 text-center text-slate-400">Carregando...</div>
      ) : (
        <div className="mt-6 space-y-8">
          {/* Integration Section */}
          <section>
            <h2 className="text-lg font-semibold text-slate-800 border-b pb-2">🔗 Integracoes</h2>
            <div className="mt-4 space-y-3">
              {(grouped.get("INTEGRATION") || []).map((cfg) => (
                <ConfigRow
                  key={cfg.key}
                  config={cfg}
                  isEditing={editing === cfg.key}
                  editValue={editValue}
                  onEditStart={() => { setEditing(cfg.key); setEditValue(""); }}
                  onEditChange={setEditValue}
                  onSave={() => handleSave(cfg.key, cfg.encrypted, cfg.label || cfg.key, cfg.group)}
                  onCancel={() => setEditing(null)}
                  onDelete={() => handleDelete(cfg.key)}
                />
              ))}
            </div>
          </section>

          {/* Push Notifications Section */}
          <section>
            <h2 className="text-lg font-semibold text-slate-800 border-b pb-2">🔔 Push Notifications</h2>
            <div className="mt-4 space-y-3">
              {hasVapid ? (
                <>
                  {(grouped.get("PUSH") || []).map((cfg) => (
                    <ConfigRow
                      key={cfg.key}
                      config={cfg}
                      isEditing={editing === cfg.key}
                      editValue={editValue}
                      onEditStart={() => { setEditing(cfg.key); setEditValue(""); }}
                      onEditChange={setEditValue}
                      onSave={() => handleSave(cfg.key, cfg.encrypted, cfg.label || cfg.key, cfg.group)}
                      onCancel={() => setEditing(null)}
                      onDelete={() => handleDelete(cfg.key)}
                    />
                  ))}
                  <p className="text-xs text-green-600 mt-2">✅ VAPID keys configuradas — Push Notifications habilitadas</p>
                </>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-800">
                    VAPID keys nao geradas. Push Notifications estao desabilitadas.
                  </p>
                  <button
                    onClick={handleGenerateVapid}
                    disabled={generatingVapid}
                    className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {generatingVapid ? "Gerando..." : "Gerar VAPID Keys"}
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* General Section */}
          {(grouped.get("GENERAL") || []).length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-slate-800 border-b pb-2">⚙️ Geral</h2>
              <div className="mt-4 space-y-3">
                {(grouped.get("GENERAL") || []).map((cfg) => (
                  <ConfigRow
                    key={cfg.key}
                    config={cfg}
                    isEditing={editing === cfg.key}
                    editValue={editValue}
                    onEditStart={() => { setEditing(cfg.key); setEditValue(""); }}
                    onEditChange={setEditValue}
                    onSave={() => handleSave(cfg.key, cfg.encrypted, cfg.label || cfg.key, cfg.group)}
                    onCancel={() => setEditing(null)}
                    onDelete={() => handleDelete(cfg.key)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ConfigRow({
  config, isEditing, editValue, onEditStart, onEditChange, onSave, onCancel, onDelete,
}: {
  config: ConfigItem;
  isEditing: boolean;
  editValue: string;
  onEditStart: () => void;
  onEditChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-700">{config.label || config.key}</div>
        <div className="text-xs text-slate-400 font-mono">{config.key}</div>
        {!isEditing && (
          <div className="mt-1 text-sm text-slate-500 font-mono truncate">
            {config.maskedValue}
          </div>
        )}
        {isEditing && (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              placeholder="Novo valor..."
              className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm font-mono focus:border-blue-500 outline-none"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && onSave()}
            />
            <button onClick={onSave} className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700">
              Salvar
            </button>
            <button onClick={onCancel} className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
          </div>
        )}
      </div>
      {!isEditing && (
        <div className="flex gap-1">
          <button onClick={onEditStart} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">
            Editar
          </button>
          {config.maskedValue !== "(nao configurado)" && (
            <button onClick={onDelete} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">
              Remover
            </button>
          )}
        </div>
      )}
    </div>
  );
}
