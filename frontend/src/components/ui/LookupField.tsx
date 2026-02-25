"use client";

import { useState, type ReactNode } from "react";
import SearchLookupModal, { type LookupFetcher } from "./SearchLookupModal";

export interface LookupFieldProps<T> {
  label?: string;
  placeholder?: string;
  modalTitle: string;
  modalPlaceholder?: string;
  value: T | null;
  displayValue: (item: T) => string;
  onChange: (item: T | null) => void;
  fetcher: LookupFetcher<T>;
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export default function LookupField<T>({
  label,
  placeholder = "Selecione...",
  modalTitle,
  modalPlaceholder,
  value,
  displayValue,
  onChange,
  fetcher,
  keyExtractor,
  renderItem,
  disabled = false,
  required = false,
  className = "",
}: LookupFieldProps<T>) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className={className}>
      {/* Label */}
      {label && (
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}

      {/* Field container */}
      <div
        className={`flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm transition-colors ${
          disabled
            ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
            : "border-slate-300 hover:border-slate-400"
        }`}
      >
        {/* Display value or placeholder */}
        <span
          className={`flex-1 truncate ${
            value ? "text-slate-900" : "text-slate-400"
          }`}
        >
          {value ? displayValue(value) : placeholder}
        </span>

        {/* Clear button */}
        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Limpar seleção"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Search button */}
        {!disabled && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="shrink-0 rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="Buscar"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        )}
      </div>

      {/* Search Modal */}
      <SearchLookupModal
        open={modalOpen}
        title={modalTitle}
        placeholder={modalPlaceholder}
        fetcher={fetcher}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onSelect={(item) => {
          onChange(item);
          setModalOpen(false);
        }}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
