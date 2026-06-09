export type SortOrder = 'asc' | 'desc' | null;

export interface SortState {
  column: string | null;
  order: SortOrder;
}

export interface FilterDefinition {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'month' | 'numberRange';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface FilterValues {
  [key: string]: string | undefined;
}

export interface ColumnDefinition<T = any> {
  id: string;
  label: string;
  sortable?: boolean;
  sortKey?: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
  headerClassName?: string;
  render: (row: T) => React.ReactNode;
}

export interface TableLayoutState {
  version: number;
  columnOrder: string[];
  columnWidths?: Record<string, number>;
}

/* ── Configuracao rica de tabela (per-aba) — ver memory/feature_config_rica_tabela.md ── */
export type CellOverflow = 'wrap' | 'truncate' | 'scroll';
export type TableFontSize = 'xs' | 'sm' | 'base' | 'lg';

export interface ColumnConfig {
  hidden?: boolean;
  fontSize?: TableFontSize;
  overflow?: CellOverflow;
}

/** Estilo aplicado quando o sinal (signal) de uma regra condicional casa com a linha. */
export interface ConditionalRuleConfig {
  on: boolean;
  bg?: string | null;
  text?: string | null;
  bold?: boolean;
}

export interface TableConfigState {
  version: number;
  columns: Record<string, ColumnConfig>;
  rowFontSize?: TableFontSize;
  overflowDefault?: CellOverflow;
  rules: Record<string, ConditionalRuleConfig>;
}

/** Sinal de dados que a tabela EXPOE pro motor de cores condicionais (data-aware, zero fantasma). */
export interface TableSignal<T = any> {
  key: string;
  label: string;
  test: (row: T) => boolean;
  defaultBg?: string;
}
