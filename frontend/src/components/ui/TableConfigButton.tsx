"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type {
  ColumnDefinition,
  TableConfigState,
  ColumnConfig,
  ConditionalRuleConfig,
  TableFontSize,
  CellOverflow,
} from "@/lib/types/table";

/** Subconjunto do retorno de useTableConfig que o painel usa (o render usa o resto). */
interface TableConfigPanelApi {
  config: TableConfigState;
  signals: { key: string; label: string; defaultBg?: string }[];
  setColumnConfig: (colId: string, patch: Partial<ColumnConfig>) => void;
  setRule: (key: string, patch: Partial<ConditionalRuleConfig>) => void;
  setRowFontSize: (s: TableFontSize) => void;
  setOverflowDefault: (o: CellOverflow) => void;
  resetConfig: () => void;
  isColumnHidden: (colId: string) => boolean;
  isCustomized: boolean;
}

interface Props {
  columns: ColumnDefinition[];
  cfg: TableConfigPanelApi;
}

const FONT_OPTS: { value: TableFontSize; label: string }[] = [
  { value: "xs", label: "Pequena" },
  { value: "sm", label: "Normal" },
  { value: "base", label: "Média" },
  { value: "lg", label: "Grande" },
];

const OVERFLOW_OPTS: { value: CellOverflow; label: string }[] = [
  { value: "truncate", label: "Esconder (…)" },
  { value: "wrap", label: "Quebrar" },
  { value: "scroll", label: "Rolar" },
];

const DEFAULT_BG = "#fee2e2";

export default function TableConfigButton({ columns, cfg }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Configurar tabela (so esta aba)"
        className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-sm whitespace-nowrap transition-colors ${
          cfg.isCustomized
            ? "border-blue-400 bg-blue-50 text-blue-700"
            : "border-slate-300 text-slate-600 hover:bg-slate-100"
        }`}
      >
        <span aria-hidden>&#9881;</span>
        <span className="hidden sm:inline">Tabela</span>
        {cfg.isCustomized && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          onClick={() => setOpen(false)}
        >
          <div
            className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Configurar tabela</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                &#10005;
              </button>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              Os ajustes valem so para esta aba e ficam salvos neste navegador.
            </p>

            {/* Cores condicionais de linha */}
            {cfg.signals.length > 0 && (
              <Section title="Cores de linha">
                {cfg.signals.map((sig) => {
                  const rule = cfg.config.rules[sig.key] || ({} as ConditionalRuleConfig);
                  const color = rule.bg || sig.defaultBg || DEFAULT_BG;
                  return (
                    <div key={sig.key} className="flex items-center justify-between gap-2 py-1.5">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={!!rule.on}
                          onChange={(e) => cfg.setRule(sig.key, { on: e.target.checked, bg: color })}
                          className="accent-blue-600"
                        />
                        {sig.label}
                      </label>
                      <input
                        type="color"
                        value={color}
                        disabled={!rule.on}
                        onChange={(e) => cfg.setRule(sig.key, { bg: e.target.value })}
                        className="h-7 w-10 rounded border border-slate-300 disabled:opacity-40"
                        title="Cor de fundo"
                      />
                    </div>
                  );
                })}
              </Section>
            )}

            {/* Colunas: mostrar/esconder + overflow + fonte */}
            <Section title="Colunas">
              {columns.map((col) => {
                const cc = cfg.config.columns[col.id] || {};
                const hidden = cfg.isColumnHidden(col.id);
                return (
                  <div key={col.id} className="border-b border-slate-100 py-1.5 last:border-0">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={!hidden}
                        onChange={(e) => cfg.setColumnConfig(col.id, { hidden: !e.target.checked })}
                        className="accent-blue-600"
                      />
                      <span className="font-medium">{col.label || col.id}</span>
                    </label>
                    {!hidden && (
                      <div className="ml-6 mt-1 flex flex-wrap gap-2">
                        <MiniSelect
                          label="Texto"
                          value={cc.overflow || ""}
                          placeholder="Padrao"
                          opts={OVERFLOW_OPTS}
                          onChange={(v) =>
                            cfg.setColumnConfig(col.id, {
                              overflow: (v || undefined) as CellOverflow | undefined,
                            })
                          }
                        />
                        <MiniSelect
                          label="Fonte"
                          value={cc.fontSize || ""}
                          placeholder="Padrao"
                          opts={FONT_OPTS}
                          onChange={(v) =>
                            cfg.setColumnConfig(col.id, {
                              fontSize: (v || undefined) as TableFontSize | undefined,
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </Section>

            {/* Linhas e texto (globais) */}
            <Section title="Linhas e texto">
              <LabeledRow label="Tamanho da fonte (linhas)">
                <MiniSelect
                  value={cfg.config.rowFontSize || "sm"}
                  opts={FONT_OPTS}
                  onChange={(v) => cfg.setRowFontSize((v || "sm") as TableFontSize)}
                />
              </LabeledRow>
              <LabeledRow label="Ao estreitar a coluna (padrao)">
                <MiniSelect
                  value={cfg.config.overflowDefault || "truncate"}
                  opts={OVERFLOW_OPTS}
                  onChange={(v) => cfg.setOverflowDefault((v || "truncate") as CellOverflow)}
                />
              </LabeledRow>
            </Section>

            <button
              type="button"
              onClick={cfg.resetConfig}
              className="mt-5 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              Restaurar padrao desta aba
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <div>{children}</div>
    </div>
  );
}

function LabeledRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-sm text-slate-700">{label}</span>
      {children}
    </div>
  );
}

function MiniSelect({
  label,
  value,
  placeholder,
  opts,
  onChange,
}: {
  label?: string;
  value: string;
  placeholder?: string;
  opts: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-slate-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-500"
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
