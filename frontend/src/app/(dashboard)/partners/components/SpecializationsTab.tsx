"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export type Specialization = { id: string; name: string; isDefault: boolean };

interface SpecializationsTabProps {
  specializations: Specialization[];
  isAdmin: boolean;
  onReload: () => void;
  onBackToPartners: () => void;
}

const inputClass =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500";

export default function SpecializationsTab({
  specializations,
  isAdmin,
  onReload,
  onBackToPartners,
}: SpecializationsTabProps) {
  const { toast } = useToast();
  const [newSpecName, setNewSpecName] = useState("");
  const [creatingSpec, setCreatingSpec] = useState(false);

  async function handleCreateSpec() {
    if (!newSpecName.trim() || creatingSpec) return;
    setCreatingSpec(true);
    try {
      await api.post("/specializations", { name: newSpecName.trim() });
      toast("Especialização criada.", "success");
      setNewSpecName("");
      onReload();
    } catch (err) {
      if (err instanceof ApiError) toast(err.payload?.message || "Erro", "error");
      else toast("Erro ao criar.", "error");
    } finally {
      setCreatingSpec(false);
    }
  }

  async function handleDeleteSpec(id: string) {
    try {
      await api.del(`/specializations/${id}`);
      toast("Especialização removida.", "success");
      onReload();
    } catch (err) {
      if (err instanceof ApiError) toast(err.payload?.message || "Erro", "error");
      else toast("Erro ao remover.", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Especializações cadastradas
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Especializações são atribuídas aos parceiros do tipo Técnico para filtragem inteligente de ordens de serviço.
        </p>

        {specializations.length === 0 ? (
          <p className="text-sm text-slate-400 mb-4">Nenhuma especialização cadastrada.</p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            {specializations.map((spec) => (
              <span
                key={spec.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-sm text-blue-800"
              >
                {spec.name}
                {spec.isDefault && (
                  <span className="text-xs text-blue-400">(padrão)</span>
                )}
                {!spec.isDefault && isAdmin && (
                  <button
                    onClick={() => handleDeleteSpec(spec.id)}
                    className="ml-1 rounded-full p-0.5 text-blue-400 hover:text-red-600 hover:bg-red-50"
                    title="Remover"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {isAdmin && (
          <div className="flex gap-2">
            <input
              placeholder="Nome da nova especialização"
              value={newSpecName}
              onChange={(e) => setNewSpecName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateSpec();
                }
              }}
              className={inputClass + " flex-1 sm:max-w-xs"}
            />
            <button
              onClick={handleCreateSpec}
              disabled={creatingSpec || !newSpecName.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creatingSpec ? "Criando..." : "Adicionar"}
            </button>
          </div>
        )}
      </div>

      <button
        onClick={onBackToPartners}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
      >
        ← Voltar para Parceiros
      </button>
    </div>
  );
}
