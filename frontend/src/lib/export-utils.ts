/**
 * Utilitário de exportação — CSV e impressão PDF
 * Zero dependências externas
 */

// ── CSV ──────────────────────────────────────────────────────────────

export interface ExportColumn<T = any> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCSV(val: string | number | null | undefined): string {
  if (val == null) return "";
  const str = String(val);
  // Escape if contains comma, quote, newline, or semicolon (PT-BR uses ; as separator sometimes)
  if (/[",;\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Gera CSV a partir de dados e colunas, e dispara o download.
 * Usa BOM UTF-8 para compatibilidade com Excel (acentos PT-BR).
 */
export function exportToCSV<T>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
) {
  const separator = ";"; // Excel BR default
  const header = columns.map((c) => escapeCSV(c.header)).join(separator);
  const rows = data.map((row) =>
    columns.map((c) => escapeCSV(c.value(row))).join(separator),
  );
  const csv = [header, ...rows].join("\r\n");

  // BOM for UTF-8 — garante acentos no Excel
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Print / PDF ──────────────────────────────────────────────────────

/**
 * Abre janela de impressão do navegador.
 * O CSS @media print cuida do layout (esconde sidebar, header, etc.).
 */
export function printPage() {
  window.print();
}

// ── Formatters reutilizáveis ─────────────────────────────────────────

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtMoney(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function fmtStatus(status: string | null | undefined): string {
  const map: Record<string, string> = {
    ABERTA: "Aberta",
    AGUARDANDO_ACEITE: "Aguardando Aceite",
    ACEITA: "Aceita",
    EM_EXECUCAO: "Em Execução",
    CONCLUIDA: "Concluída",
    APROVADA: "Aprovada",
    REJEITADA: "Rejeitada",
    CANCELADA: "Cancelada",
    ATIVO: "Ativo",
    INATIVO: "Inativo",
    EM_TREINAMENTO: "Em Treinamento",
    PENDENTE: "Pendente",
    CONFIRMADO: "Confirmado",
  };
  return map[status || ""] || status || "";
}
