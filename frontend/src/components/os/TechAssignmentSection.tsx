"use client";

import { useCallback } from "react";
import MultiLookupField from "@/components/ui/MultiLookupField";
import LookupField from "@/components/ui/LookupField";
import { api } from "@/lib/api";
import type { LookupFetcherResult } from "@/components/ui/SearchLookupModal";

/* ── Types ── */

export interface SpecializationSummary {
  id: string;
  name: string;
  description?: string | null;
}

export interface TechnicianSummary {
  id: string;
  name: string;
  phone?: string | null;
  partnerTypes?: string[];
}

export interface WorkflowSummary {
  id: string;
  name: string;
}

export type TechAssignmentMode = "BY_SPECIALIZATION" | "DIRECTED" | "BY_WORKFLOW" | "BY_AGENDA" | "URGENT";

export interface TechAssignmentSectionProps {
  mode: TechAssignmentMode;
  onModeChange: (mode: TechAssignmentMode) => void;
  selectedSpecializations: SpecializationSummary[];
  onSpecializationsChange: (items: SpecializationSummary[]) => void;
  selectedTechnicians: TechnicianSummary[];
  onTechniciansChange: (items: TechnicianSummary[]) => void;
  selectedWorkflow: WorkflowSummary | null;
  onWorkflowChange: (wf: WorkflowSummary | null) => void;
  disabled?: boolean;
  /** Hide the section header (when wrapped in CollapsibleSection) */
  hideHeader?: boolean;
  /** Show agenda and urgent modes */
  showExtendedModes?: boolean;
}

/* ── Fetchers ── */

function specializationFetcher(
  search: string,
  page: number,
  signal: AbortSignal,
): Promise<LookupFetcherResult<SpecializationSummary>> {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("search", search);
  return api.get<LookupFetcherResult<SpecializationSummary>>(
    `/specializations?${params}`,
    { signal },
  );
}

function technicianFetcher(
  search: string,
  page: number,
  signal: AbortSignal,
): Promise<LookupFetcherResult<TechnicianSummary>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: "20",
    type: "TECNICO",
  });
  if (search) params.set("search", search);
  return api.get<LookupFetcherResult<TechnicianSummary>>(
    `/partners?${params}`,
    { signal },
  );
}

function workflowFetcher(
  search: string,
  page: number,
  signal: AbortSignal,
): Promise<LookupFetcherResult<WorkflowSummary>> {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("search", search);
  return api.get<LookupFetcherResult<WorkflowSummary>>(
    `/workflows?${params}`,
    { signal },
  );
}

/* ── Radio options ── */

const BASE_MODES: { value: TechAssignmentMode; label: string; description?: string }[] = [
  { value: "BY_SPECIALIZATION", label: "Todos com a seguinte especialização" },
  { value: "DIRECTED", label: "Técnicos direcionados" },
  { value: "BY_WORKFLOW", label: "Por fluxo de atendimento" },
];

const EXTENDED_MODES: { value: TechAssignmentMode; label: string; description?: string }[] = [
  { value: "BY_AGENDA", label: "Por agenda", description: "Selecione técnico, data e hora na grade de agenda" },
  { value: "URGENT", label: "Urgente", description: "Prioridade máxima — dispara fluxo de OS urgente" },
];

/* ── Component ── */

export default function TechAssignmentSection({
  mode,
  onModeChange,
  selectedSpecializations,
  onSpecializationsChange,
  selectedTechnicians,
  onTechniciansChange,
  selectedWorkflow,
  onWorkflowChange,
  disabled = false,
  hideHeader = false,
  showExtendedModes = false,
}: TechAssignmentSectionProps) {
  const MODES = showExtendedModes ? [...BASE_MODES, ...EXTENDED_MODES] : BASE_MODES;
  const handleModeChange = useCallback(
    (newMode: TechAssignmentMode) => {
      if (disabled) return;
      onModeChange(newMode);
    },
    [disabled, onModeChange],
  );

  return (
    <div className="space-y-3">
      {/* Section header */}
      {!hideHeader && (
        <div className="flex items-center gap-2 border-t border-slate-200 pt-4">
          <svg
            className="h-5 w-5 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
          <h3 className="text-sm font-semibold text-slate-700">Atribuir Técnico</h3>
        </div>
      )}

      {/* Radio options with inline lookup fields */}
      <div className="space-y-3 pl-1">
        {MODES.map((opt) => (
          <div key={opt.value} className="space-y-1.5">
            <label
              className={`flex items-center gap-2.5 cursor-pointer ${
                disabled ? "cursor-not-allowed opacity-60" : ""
              }`}
            >
              <input
                type="radio"
                name="techAssignmentMode"
                checked={mode === opt.value}
                onChange={() => handleModeChange(opt.value)}
                disabled={disabled}
                className={`h-4 w-4 border-slate-300 ${
                  opt.value === "URGENT"
                    ? "text-red-600 focus:ring-red-500"
                    : "text-blue-600 focus:ring-blue-500"
                }`}
              />
              <span className={`text-sm ${
                opt.value === "URGENT" && mode === "URGENT"
                  ? "text-red-700 font-semibold"
                  : "text-slate-700"
              }`}>
                {opt.value === "URGENT" ? "🚨 " : ""}{opt.label}
              </span>
            </label>
            {opt.description && mode === opt.value && (
              <p className={`text-xs ml-6 ${
                opt.value === "URGENT" ? "text-red-500" : "text-slate-400"
              }`}>
                {opt.description}
              </p>
            )}

            {/* BY_SPECIALIZATION inline */}
            {opt.value === "BY_SPECIALIZATION" && mode === "BY_SPECIALIZATION" && (
              <div className="ml-6">
                <MultiLookupField<SpecializationSummary>
                  placeholder="Selecione especialização..."
                  modalTitle="Buscar Especialização"
                  modalPlaceholder="Digite para buscar especialização..."
                  values={selectedSpecializations}
                  displayValue={(s) => s.name}
                  onChange={onSpecializationsChange}
                  fetcher={specializationFetcher}
                  keyExtractor={(s) => s.id}
                  renderItem={(s) => (
                    <div>
                      <p className="text-sm font-medium text-slate-900">{s.name}</p>
                      {s.description && (
                        <p className="text-xs text-slate-500">{s.description}</p>
                      )}
                    </div>
                  )}
                  disabled={disabled}
                />
              </div>
            )}

            {/* DIRECTED inline */}
            {opt.value === "DIRECTED" && mode === "DIRECTED" && (
              <div className="ml-6">
                <MultiLookupField<TechnicianSummary>
                  placeholder="Selecione técnicos..."
                  modalTitle="Buscar Técnico"
                  modalPlaceholder="Digite para buscar técnico..."
                  values={selectedTechnicians}
                  displayValue={(t) => t.name}
                  onChange={onTechniciansChange}
                  fetcher={technicianFetcher}
                  keyExtractor={(t) => t.id}
                  renderItem={(t) => (
                    <div>
                      <p className="text-sm font-medium text-slate-900">{t.name}</p>
                      {t.phone && (
                        <p className="text-xs text-slate-500">{t.phone}</p>
                      )}
                    </div>
                  )}
                  disabled={disabled}
                />
              </div>
            )}

            {/* BY_WORKFLOW inline */}
            {opt.value === "BY_WORKFLOW" && mode === "BY_WORKFLOW" && (
              <div className="ml-6">
                <LookupField<WorkflowSummary>
                  placeholder="Selecione fluxo..."
                  modalTitle="Buscar Fluxo de Atendimento"
                  modalPlaceholder="Digite para buscar fluxo..."
                  value={selectedWorkflow}
                  displayValue={(w) => w.name}
                  onChange={onWorkflowChange}
                  fetcher={workflowFetcher}
                  keyExtractor={(w) => w.id}
                  renderItem={(w) => (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{w.name}</p>
                    </div>
                  )}
                  disabled={disabled}
                />
              </div>
            )}

            {/* URGENT banner */}
            {opt.value === "URGENT" && mode === "URGENT" && (
              <div className="ml-6 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-xs text-red-600">
                  Esta OS será criada com prioridade máxima. O fluxo de atendimento configurado para
                  OS urgentes será disparado automaticamente.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
