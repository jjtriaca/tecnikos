"use client";

import type { FilterDefinition, FilterValues } from "@/lib/types/table";

interface FilterBarProps {
  filters: FilterDefinition[];
  values: FilterValues;
  onChange: (key: string, value: string | undefined) => void;
  onReset: () => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
}

export default function FilterBar({
  filters,
  values,
  onChange,
  onReset,
  search,
  onSearchChange,
  searchPlaceholder = "Buscar...",
}: FilterBarProps) {
  const hasActiveFilters =
    Object.values(values).some((v) => v !== undefined && v !== "") ||
    (search !== undefined && search !== "");

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        {onSearchChange !== undefined && (
          <div className="relative flex-1 min-w-0">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <FilterControl
              key={f.key}
              def={f}
              value={values[f.key]}
              onChange={(v) => onChange(f.key, v)}
            />
          ))}
        </div>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 whitespace-nowrap"
          >
            Limpar Filtros
          </button>
        )}
      </div>
    </div>
  );
}

function FilterControl({
  def,
  value,
  onChange,
}: {
  def: FilterDefinition;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const baseClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

  switch (def.type) {
    case "select":
      return (
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={baseClass}
        >
          <option value="">{def.placeholder ?? def.label}</option>
          {def.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );

    case "date":
      return (
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 whitespace-nowrap">
            {def.label}
          </label>
          <input
            type="date"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={`${baseClass} w-36`}
          />
        </div>
      );

    case "month":
      return (
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 whitespace-nowrap">
            {def.label}
          </label>
          <input
            type="month"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={`${baseClass} w-40`}
          />
        </div>
      );

    case "numberRange":
      return (
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500 whitespace-nowrap">
            {def.label}
          </label>
          <input
            type="number"
            placeholder={def.placeholder ?? "0"}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={`${baseClass} w-28`}
          />
        </div>
      );

    default:
      return (
        <input
          type="text"
          placeholder={def.placeholder ?? def.label}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={baseClass}
        />
      );
  }
}
