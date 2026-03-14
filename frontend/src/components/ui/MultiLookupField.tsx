"use client";

import { useState, type ReactNode } from "react";
import SearchLookupModal, { type LookupFetcher } from "./SearchLookupModal";

export interface MultiLookupFieldProps<T> {
  label?: string;
  placeholder?: string;
  modalTitle: string;
  modalPlaceholder?: string;
  values: T[];
  displayValue: (item: T) => string;
  onChange: (items: T[]) => void;
  fetcher: LookupFetcher<T>;
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  disabled?: boolean;
  className?: string;
}

export default function MultiLookupField<T>({
  label,
  placeholder = "Selecione...",
  modalTitle,
  modalPlaceholder,
  values,
  displayValue,
  onChange,
  fetcher,
  keyExtractor,
  renderItem,
  disabled = false,
  className = "",
}: MultiLookupFieldProps<T>) {
  const [modalOpen, setModalOpen] = useState(false);

  const removeItem = (key: string) => {
    onChange(values.filter((v) => keyExtractor(v) !== key));
  };

  const handleSelect = (item: T) => {
    const key = keyExtractor(item);
    const exists = values.some((v) => keyExtractor(v) === key);

    if (exists) {
      // Toggle off
      onChange(values.filter((v) => keyExtractor(v) !== key));
    } else {
      // Add
      onChange([...values, item]);
    }

    // Don't close modal — allow multiple selections
  };

  return (
    <div className={className}>
      {/* Label */}
      {label && (
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}

      {/* Field container */}
      <div
        className={`flex items-center gap-1 rounded-lg border bg-white px-2 py-1.5 text-sm transition-colors min-h-[38px] ${
          disabled
            ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
            : "border-slate-300 hover:border-slate-400"
        }`}
      >
        {/* Chips area */}
        <div className="flex flex-1 flex-wrap gap-1 min-w-0">
          {values.length === 0 && (
            <span className="px-1 text-slate-400 text-sm">{placeholder}</span>
          )}
          {values.map((item) => {
            const key = keyExtractor(item);
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200"
              >
                <span className="max-w-[120px] truncate">{displayValue(item)}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(key);
                    }}
                    className="ml-0.5 rounded text-blue-400 hover:text-blue-700 hover:bg-blue-100 transition-colors"
                    title="Remover"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </span>
            );
          })}
        </div>

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
        renderItem={(item) => {
          const key = keyExtractor(item);
          const isSelected = values.some((v) => keyExtractor(v) === key);
          return (
            <div className="flex items-center gap-3">
              {/* Checkbox indicator */}
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  isSelected
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-slate-300"
                }`}
              >
                {isSelected && (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">{renderItem(item)}</div>
            </div>
          );
        }}
        onSelect={handleSelect}
        onClose={() => setModalOpen(false)}
        showConfirmButton
        selectedCount={values.length}
      />
    </div>
  );
}
