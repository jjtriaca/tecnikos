"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
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
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced inline search
  function handleInputChange(val: string) {
    setInputValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    setShowDropdown(true);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      try {
        const result = await fetcher(val, 1, controller.signal);
        setSuggestions(result.data.slice(0, 10));
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  const removeItem = (key: string) => {
    onChange(values.filter((v) => keyExtractor(v) !== key));
  };

  const handleSelectInline = (item: T) => {
    const key = keyExtractor(item);
    const exists = values.some((v) => keyExtractor(v) === key);
    if (exists) {
      onChange(values.filter((v) => keyExtractor(v) !== key));
    } else {
      onChange([...values, item]);
    }
    // Clear input and close dropdown after selection
    setInputValue("");
    setSuggestions([]);
    setShowDropdown(false);
  };

  const handleModalSelect = (item: T) => {
    const key = keyExtractor(item);
    const exists = values.some((v) => keyExtractor(v) === key);
    if (exists) {
      onChange(values.filter((v) => keyExtractor(v) !== key));
    } else {
      onChange([...values, item]);
    }
    // Don't close modal — allow multiple selections
  };

  return (
    <div className={className} ref={containerRef}>
      {/* Label */}
      {label && (
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}

      {/* Field container */}
      <div className="relative">
        <div
          className={`flex items-center gap-1 rounded-lg border bg-white px-2 py-1.5 text-sm transition-colors min-h-[38px] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 ${
            disabled
              ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
              : "border-slate-300 hover:border-slate-400"
          }`}
        >
          {/* Chips + Input area */}
          <div className="flex flex-1 flex-wrap gap-1 min-w-0 items-center">
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
            {/* Inline search input */}
            {!disabled && (
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => { if (inputValue.length >= 2) setShowDropdown(true); }}
                placeholder={values.length === 0 ? placeholder : "Buscar..."}
                className="flex-1 min-w-[80px] outline-none bg-transparent text-slate-900 placeholder:text-slate-400 text-sm py-0.5"
              />
            )}
            {values.length === 0 && disabled && (
              <span className="px-1 text-slate-400 text-sm">{placeholder}</span>
            )}
          </div>

          {/* Search button (opens modal for advanced search) */}
          {!disabled && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="shrink-0 rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              title="Buscar avancado"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          )}
        </div>

        {/* Inline dropdown */}
        {showDropdown && (
          <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-slate-300 rounded-lg shadow-lg">
            {searching && <div className="px-3 py-2 text-xs text-slate-400">Buscando...</div>}
            {!searching && suggestions.length === 0 && inputValue.length >= 2 && (
              <div className="px-3 py-2 text-xs text-slate-400">Nenhum resultado</div>
            )}
            {suggestions.map((item) => {
              const key = keyExtractor(item);
              const isSelected = values.some((v) => keyExtractor(v) === key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectInline(item)}
                  className={`w-full text-left px-3 py-2 text-sm border-b border-slate-100 last:border-0 transition-colors ${
                    isSelected ? "bg-blue-50 text-blue-800" : "hover:bg-blue-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                        isSelected ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300"
                      }`}
                    >
                      {isSelected && (
                        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">{renderItem(item)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Search Modal (advanced) */}
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
        onSelect={handleModalSelect}
        onClose={() => setModalOpen(false)}
        showConfirmButton
        selectedCount={values.length}
      />
    </div>
  );
}
