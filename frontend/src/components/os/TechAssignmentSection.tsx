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
  isDefault?: boolean;
}

export type TechAssignmentMode = "BY_SPECIALIZATION" | "DIRECTED" | "BY_WORKFLOW";

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

const MODES: { value: TechAssignmentMode; label: string }[] = [
  { value: "BY_SPECIALIZATION", label: "Todos com a seguinte especialização" },
  { value: "DIRECTED", label: "Técnicos direcionados" },
  { value: "BY_WORKFLOW", label: "Por fluxo de atendimento" },
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
}: TechAssignmentSectionProps) {
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

      {/* Radio options with inline lookup fields */}
      <div className="space-y-3 pl-1">
        {/* Option 1: By Specialization */}
        <div className="space-y-1.5">
          <label
            className={`flex items-center gap-2.5 cursor-pointer ${
              disabled ? "cursor-not-allowed opacity-60" : ""
            }`}
          >
            <input
              type="radio"
              name="techAssignmentMode"
              checked={mode === "BY_SPECIALIZATION"}
              onChange={() => handleModeChange("BY_SPECIALIZATION")}
              disabled={disabled}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <span className="text-sm text-slate-700">{MODES[0].label}</span>
          </label>
          {mode === "BY_SPECIALIZATION" && (
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
        </div>

        {/* Option 2: Directed Technicians */}
        <div className="space-y-1.5">
          <label
            className={`flex items-center gap-2.5 cursor-pointer ${
              disabled ? "cursor-not-allowed opacity-60" : ""
            }`}
          >
            <input
              type="radio"
              name="techAssignmentMode"
              checked={mode === "DIRECTED"}
              onChange={() => handleModeChange("DIRECTED")}
              disabled={disabled}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <span className="text-sm text-slate-700">{MODES[1].label}</span>
          </label>
          {mode === "DIRECTED" && (
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
        </div>

        {/* Option 3: By Workflow */}
        <div className="space-y-1.5">
          <label
            className={`flex items-center gap-2.5 cursor-pointer ${
              disabled ? "cursor-not-allowed opacity-60" : ""
            }`}
          >
            <input
              type="radio"
              name="techAssignmentMode"
              checked={mode === "BY_WORKFLOW"}
              onChange={() => handleModeChange("BY_WORKFLOW")}
              disabled={disabled}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300"
            />
            <span className="text-sm text-slate-700">{MODES[2].label}</span>
          </label>
          {mode === "BY_WORKFLOW" && (
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
                    {w.isDefault && (
                      <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-600 border border-green-200">
                        PADRÃO
                      </span>
                    )}
                  </div>
                )}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
