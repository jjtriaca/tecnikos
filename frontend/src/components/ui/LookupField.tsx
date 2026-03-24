"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
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
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

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

  // Debounced search
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

  function handleSelect(item: T) {
    onChange(item);
    setInputValue("");
    setShowDropdown(false);
    setSuggestions([]);
  }

  function handleClear() {
    onChange(null);
    setInputValue("");
    setSuggestions([]);
  }

  return (
    <div className={className} ref={containerRef}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}

      {value ? (
        /* Selected state */
        <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <span className="flex-1 truncate text-slate-900">{displayValue(value)}</span>
          {!disabled && (
            <button type="button" onClick={handleClear} className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Limpar">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      ) : (
        /* Input state */
        <div className="relative">
          <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => { if (inputValue.length >= 2) setShowDropdown(true); }}
              placeholder={placeholder}
              disabled={disabled}
              className="flex-1 outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
            />
            {!disabled && (
              <button type="button" onClick={() => setModalOpen(true)} className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="Buscar avancado">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </button>
            )}
          </div>

          {/* Dropdown */}
          {showDropdown && (
            <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-slate-300 rounded-lg shadow-lg">
              {searching && <div className="px-3 py-2 text-xs text-slate-400">Buscando...</div>}
              {!searching && suggestions.length === 0 && inputValue.length >= 2 && (
                <div className="px-3 py-2 text-xs text-slate-400">Nenhum resultado</div>
              )}
              {suggestions.map((item) => (
                <button
                  key={keyExtractor(item)}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full text-left px-3 py-2 text-sm text-slate-900 hover:bg-blue-50 border-b border-slate-100 last:border-0"
                >
                  {renderItem(item)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fallback: Search Modal */}
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
