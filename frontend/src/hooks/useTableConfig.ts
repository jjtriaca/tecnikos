"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { CSSProperties } from "react";
import type {
  TableConfigState,
  TableSignal,
  CellOverflow,
  TableFontSize,
  ColumnConfig,
  ConditionalRuleConfig,
} from "@/lib/types/table";

const CONFIG_VERSION = 1;

function defaultState(): TableConfigState {
  return {
    version: CONFIG_VERSION,
    columns: {},
    rules: {},
    rowFontSize: "sm",
    overflowDefault: "truncate",
  };
}

/**
 * Config rica de tabela PER-ABA (ver memory/feature_config_rica_tabela.md).
 * Persiste em localStorage["table-config-${tableId}"] — isolado por aba via tableId distinto.
 * NAO substitui useTableLayout (ordem/largura) — COMPLEMENTA (visibilidade, fonte, overflow,
 * cores condicionais por linha). Estende o mesmo padrao, sem hardcode paralelo.
 *
 * `signals`: lista de sinais que a tabela EXPOE (ex: semNF/vencida/paga) — o motor de cor de
 * linha so liga em sinais reais, garantindo "zero funcao fantasma".
 */
export function useTableConfig<T>(tableId: string, signals: TableSignal<T>[] = []) {
  const storageKey = `table-config-${tableId}`;
  const isInitRef = useRef(false);

  const [config, setConfig] = useState<TableConfigState>(() => {
    if (typeof window === "undefined") return defaultState();
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as TableConfigState;
        if (parsed.version === CONFIG_VERSION) {
          return {
            ...defaultState(),
            ...parsed,
            columns: parsed.columns || {},
            rules: parsed.rules || {},
          };
        }
      }
    } catch {
      /* ignore corrupted localStorage */
    }
    return defaultState();
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isInitRef.current) {
      isInitRef.current = true;
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(config));
  }, [config, storageKey]);

  /* ── setters ── */
  const setColumnConfig = useCallback((colId: string, patch: Partial<ColumnConfig>) => {
    setConfig((p) => ({
      ...p,
      columns: { ...p.columns, [colId]: { ...p.columns[colId], ...patch } },
    }));
  }, []);

  const setRule = useCallback((signalKey: string, patch: Partial<ConditionalRuleConfig>) => {
    setConfig((p) => ({
      ...p,
      rules: { ...p.rules, [signalKey]: { on: false, ...p.rules[signalKey], ...patch } },
    }));
  }, []);

  const setRowFontSize = useCallback(
    (s: TableFontSize) => setConfig((p) => ({ ...p, rowFontSize: s })),
    [],
  );

  const setOverflowDefault = useCallback(
    (o: CellOverflow) => setConfig((p) => ({ ...p, overflowDefault: o })),
    [],
  );

  const resetConfig = useCallback(() => setConfig(defaultState()), []);

  /* ── derived helpers ── */
  const isColumnHidden = useCallback(
    (colId: string) => !!config.columns[colId]?.hidden,
    [config.columns],
  );

  // 1a regra HABILITADA cujo sinal casa com a linha vence.
  const getRowStyle = useCallback(
    (row: T): CSSProperties => {
      for (const sig of signals) {
        const rule = config.rules[sig.key];
        if (rule?.on && sig.test(row)) {
          const s: CSSProperties = {};
          if (rule.bg) s.backgroundColor = rule.bg;
          if (rule.text) s.color = rule.text;
          if (rule.bold) s.fontWeight = 600;
          return s;
        }
      }
      return {};
    },
    [config.rules, signals],
  );

  // Fonte + overflow viram CLASSES (globals.css) com override forte — vencem as
  // classes internas das celulas (text-xs/truncate/max-w). Aplicadas so quando o
  // usuario muda do padrao (Normal/Esconder), pra nao alterar o visual default.
  const getCellClass = useCallback(
    (colId: string): string => {
      const cc = config.columns[colId] || {};
      const size = cc.fontSize || config.rowFontSize;
      const overflow = cc.overflow || config.overflowDefault;
      const fontCls = size && size !== "sm" ? `ttfs-${size}` : "";
      const ovCls = overflow === "wrap" ? "ttov-wrap" : overflow === "scroll" ? "ttov-scroll" : "";
      return [fontCls, ovCls].filter(Boolean).join(" ");
    },
    [config.columns, config.rowFontSize, config.overflowDefault],
  );

  const isCustomized = useMemo(
    () =>
      Object.values(config.columns).some((c) => c.hidden || c.fontSize || c.overflow) ||
      Object.values(config.rules).some((r) => r?.on) ||
      (config.rowFontSize && config.rowFontSize !== "sm") ||
      (config.overflowDefault && config.overflowDefault !== "truncate"),
    [config],
  );

  return {
    config,
    signals,
    setColumnConfig,
    setRule,
    setRowFontSize,
    setOverflowDefault,
    resetConfig,
    isColumnHidden,
    getRowStyle,
    getCellClass,
    isCustomized: !!isCustomized,
  };
}
