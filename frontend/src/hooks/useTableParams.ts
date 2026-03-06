"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { SortState, FilterValues } from "@/lib/types/table";

interface UseTableParamsOptions {
  defaultSortBy?: string;
  defaultSortOrder?: "asc" | "desc";
  defaultLimit?: number;
  defaultFilters?: FilterValues;
  /** When set, persists search/sort/filters to localStorage under this key */
  persistKey?: string;
}

interface PersistedState {
  search?: string;
  sort?: SortState;
  filters?: FilterValues;
}

function loadPersistedState(persistKey: string | undefined): PersistedState | null {
  if (!persistKey || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`table-filters-${persistKey}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function useTableParams(opts?: UseTableParamsOptions) {
  const storageKey = opts?.persistKey ? `table-filters-${opts.persistKey}` : null;
  const persistedRef = useRef<PersistedState | null>(loadPersistedState(opts?.persistKey));
  const isInitRef = useRef(false);

  const [page, setPageRaw] = useState(1);
  const [limit] = useState(opts?.defaultLimit ?? 20);
  const [search, setSearchRaw] = useState(persistedRef.current?.search ?? "");
  const [sort, setSortRaw] = useState<SortState>(
    persistedRef.current?.sort ?? {
      column: opts?.defaultSortBy ?? null,
      order: opts?.defaultSortOrder ?? null,
    },
  );
  const [filters, setFiltersRaw] = useState<FilterValues>(
    persistedRef.current?.filters ?? opts?.defaultFilters ?? {},
  );

  // Persist changes to localStorage
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    if (!isInitRef.current) {
      isInitRef.current = true;
      return;
    }
    const state: PersistedState = { search, sort, filters };
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [search, sort, filters, storageKey]);

  const setPage = useCallback((p: number) => setPageRaw(p), []);

  const setSearch = useCallback((s: string) => {
    setSearchRaw(s);
    setPageRaw(1);
  }, []);

  const toggleSort = useCallback((column: string) => {
    setSortRaw((prev) => {
      if (prev.column !== column) return { column, order: "asc" };
      if (prev.order === "asc") return { column, order: "desc" };
      return { column: null, order: null };
    });
    setPageRaw(1);
  }, []);

  const setFilter = useCallback((key: string, value: string | undefined) => {
    setFiltersRaw((prev) => {
      const next = { ...prev };
      if (value === undefined || value === "") delete next[key];
      else next[key] = value;
      return next;
    });
    setPageRaw(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersRaw({});
    setSearchRaw("");
    setSortRaw({
      column: opts?.defaultSortBy ?? null,
      order: opts?.defaultSortOrder ?? null,
    });
    setPageRaw(1);
    if (storageKey) {
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    }
  }, [opts?.defaultSortBy, opts?.defaultSortOrder, storageKey]);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (search) params.set("search", search);
    if (sort.column && sort.order) {
      params.set("sortBy", sort.column);
      params.set("sortOrder", sort.order);
    }
    for (const [k, v] of Object.entries(filters)) {
      if (v) params.set(k, v);
    }
    return params.toString();
  }, [page, limit, search, sort, filters]);

  return {
    page,
    limit,
    search,
    sort,
    filters,
    setPage,
    setSearch,
    toggleSort,
    setFilter,
    resetFilters,
    buildQueryString,
  };
}
