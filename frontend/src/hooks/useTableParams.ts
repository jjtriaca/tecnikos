"use client";

import { useState, useCallback } from "react";
import type { SortState, FilterValues } from "@/lib/types/table";

interface UseTableParamsOptions {
  defaultSortBy?: string;
  defaultSortOrder?: "asc" | "desc";
  defaultLimit?: number;
}

export function useTableParams(opts?: UseTableParamsOptions) {
  const [page, setPageRaw] = useState(1);
  const [limit] = useState(opts?.defaultLimit ?? 20);
  const [search, setSearchRaw] = useState("");
  const [sort, setSortRaw] = useState<SortState>({
    column: opts?.defaultSortBy ?? null,
    order: opts?.defaultSortOrder ?? null,
  });
  const [filters, setFiltersRaw] = useState<FilterValues>({});

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
  }, [opts?.defaultSortBy, opts?.defaultSortOrder]);

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
