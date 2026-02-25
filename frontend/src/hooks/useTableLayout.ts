"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { ColumnDefinition, TableLayoutState } from "@/lib/types/table";

const LAYOUT_VERSION = 1;

export function useTableLayout<T>(
  tableId: string,
  defaultColumns: ColumnDefinition<T>[],
) {
  const storageKey = `table-layout-${tableId}`;
  const isInitRef = useRef(false);

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return defaultColumns.map((c) => c.id);
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: TableLayoutState = JSON.parse(stored);
        if (parsed.version === LAYOUT_VERSION) {
          const defaultIds = new Set(defaultColumns.map((c) => c.id));
          const validStored = parsed.columnOrder.filter((id) =>
            defaultIds.has(id),
          );
          const storedSet = new Set(validStored);
          const newCols = defaultColumns
            .filter((c) => !storedSet.has(c.id))
            .map((c) => c.id);
          return [...validStored, ...newCols];
        }
      }
    } catch {
      /* ignore corrupted localStorage */
    }
    return defaultColumns.map((c) => c.id);
  });

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: TableLayoutState = JSON.parse(stored);
        if (parsed.version === LAYOUT_VERSION && parsed.columnWidths) {
          return parsed.columnWidths;
        }
      }
    } catch {
      /* ignore */
    }
    return {};
  });

  // Persist to localStorage on any layout change
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip initial render to avoid overwriting stored data before hydration
    if (!isInitRef.current) {
      isInitRef.current = true;
      return;
    }
    const state: TableLayoutState = {
      version: LAYOUT_VERSION,
      columnOrder,
      columnWidths,
    };
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [columnOrder, columnWidths, storageKey]);

  const reorderColumns = useCallback(
    (fromIndex: number, toIndex: number) => {
      setColumnOrder((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
    },
    [],
  );

  const setColumnWidth = useCallback(
    (columnId: string, width: number) => {
      setColumnWidths((prev) => ({
        ...prev,
        [columnId]: Math.max(60, Math.round(width)),
      }));
    },
    [],
  );

  const resetColumnWidths = useCallback(() => {
    setColumnWidths({});
  }, []);

  const orderedColumns: ColumnDefinition<T>[] = columnOrder
    .map((id) => defaultColumns.find((c) => c.id === id))
    .filter(Boolean) as ColumnDefinition<T>[];

  return {
    orderedColumns,
    columnOrder,
    reorderColumns,
    columnWidths,
    setColumnWidth,
    resetColumnWidths,
  };
}
