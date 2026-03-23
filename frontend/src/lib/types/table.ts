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
