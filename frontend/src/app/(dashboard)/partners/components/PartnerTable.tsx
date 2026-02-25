"use client";

import React, { useState } from "react";
import { maskCnpj, maskCpf, maskPhone } from "@/lib/brazil-utils";
import SortableHeader from "@/components/ui/SortableHeader";
import DraggableHeader from "@/components/ui/DraggableHeader";
import AuditLogDrawer from "@/components/ui/AuditLogDrawer";
import { useTableLayout } from "@/hooks/useTableLayout";
import type { SortState, ColumnDefinition } from "@/lib/types/table";

type Specialization = { id: string; name: string; isDefault: boolean };
type PartnerSpec = { id: string; specializationId: string; specialization: Specialization };

export type Partner = {
  id: string;
  partnerTypes: string[];
  personType: "PF" | "PJ";
  name: string;
  tradeName: string | null;
  document: string | null;
  documentType: string | null;
  ie: string | null;
  im: string | null;
  ieStatus: string | null;
  isRuralProducer: boolean;
  rating: number;
  phone: string | null;
  email: string | null;
  cep: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComp: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  status: string;
  specializations: PartnerSpec[];
  createdAt: string;
};

const TYPE_COLORS: Record<string, string> = {
  CLIENTE: "bg-blue-100 text-blue-800",
  FORNECEDOR: "bg-purple-100 text-purple-800",
  TECNICO: "bg-amber-100 text-amber-800",
};

const TYPE_LABELS: Record<string, string> = {
  CLIENTE: "Cliente",
  FORNECEDOR: "Fornecedor",
  TECNICO: "Técnico",
};

const STATUS_COLORS: Record<string, string> = {
  ATIVO: "bg-green-100 text-green-800",
  INATIVO: "bg-red-100 text-red-800",
  EM_TREINAMENTO: "bg-amber-100 text-amber-800",
};

const STATUS_LABELS: Record<string, string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  EM_TREINAMENTO: "Em Treinamento",
};

function formatDocument(p: Partner) {
  if (!p.document) return "\u2014";
  if (p.personType === "PF") return maskCpf(p.document);
  return maskCnpj(p.document);
}

function renderStars(rating: number) {
  const full = Math.round(rating);
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`h-3.5 w-3.5 ${i <= full ? "text-amber-400" : "text-slate-200"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-xs text-slate-500">{rating.toFixed(1)}</span>
    </span>
  );
}

interface PartnerTableProps {
  partners: Partner[];
  canEdit: boolean;
  onEdit: (partner: Partner) => void;
  onDelete: (id: string, name: string) => void;
  sort: SortState;
  onToggleSort: (column: string) => void;
}

function makePartnerColumns(
  canEdit: boolean,
  onEdit: (p: Partner) => void,
  onDelete: (id: string, name: string) => void,
  expandedAuditId: string | null,
  onToggleAudit: (id: string) => void,
): ColumnDefinition<Partner>[] {
  const cols: ColumnDefinition<Partner>[] = [
    {
      id: "name",
      label: "Nome",
      sortable: true,
      render: (p) => (
        <div>
          <div className="font-medium text-slate-900">{p.name}</div>
          {p.tradeName && <div className="text-xs text-slate-400">{p.tradeName}</div>}
        </div>
      ),
    },
    {
      id: "types",
      label: "Tipo(s)",
      render: (p) => (
        <div className="flex flex-wrap gap-1">
          {(p.partnerTypes || []).map((type) => (
            <span key={type} className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[type] || "bg-slate-100 text-slate-600"}`}>
              {TYPE_LABELS[type] || type}
            </span>
          ))}
        </div>
      ),
    },
    {
      id: "document",
      label: "Documento",
      sortable: true,
      render: (p) => <span className="text-slate-600">{formatDocument(p)}</span>,
    },
    {
      id: "phone",
      label: "Telefone",
      sortable: true,
      render: (p) => (
        <span className="text-slate-600">
          {p.phone ? maskPhone(p.phone.replace(/\D/g, "")) : "\u2014"}
        </span>
      ),
    },
    {
      id: "rating",
      label: "Rating",
      sortable: true,
      render: (p) =>
        (p.partnerTypes || []).includes("TECNICO") ? (
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1">
              {(p.specializations || []).slice(0, 3).map((s) => (
                <span key={s.id} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                  {s.specialization.name}
                </span>
              ))}
              {(p.specializations || []).length > 3 && (
                <span className="text-xs text-slate-400">+{p.specializations.length - 3}</span>
              )}
            </div>
            {renderStars(p.rating)}
          </div>
        ) : (
          <span className="text-xs text-slate-400">{"\u2014"}</span>
        ),
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      render: (p) => (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] || "bg-slate-100 text-slate-600"}`}>
          {STATUS_LABELS[p.status] || p.status}
        </span>
      ),
    },
  ];

  // Actions column — always present (audit for all, edit/delete for editors)
  cols.push({
    id: "actions",
    label: "Ações",
    align: "right",
    render: (p) => (
      <div className="flex justify-end gap-1.5">
        <button
          onClick={() => onToggleAudit(p.id)}
          title="Histórico de alterações"
          className={`rounded border px-1.5 py-1 text-xs transition-colors ${expandedAuditId === p.id ? "border-blue-300 bg-blue-50 text-blue-600" : "border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600"}`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        {canEdit && (
          <>
            <button
              onClick={() => onEdit(p)}
              className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              Editar
            </button>
            <button
              onClick={() => onDelete(p.id, p.name)}
              className="rounded border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              Excluir
            </button>
          </>
        )}
      </div>
    ),
  });

  return cols;
}

export default function PartnerTable({ partners, canEdit, onEdit, onDelete, sort, onToggleSort }: PartnerTableProps) {
  if (partners.length === 0) return null;

  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  const columns = makePartnerColumns(
    canEdit,
    onEdit,
    onDelete,
    expandedAuditId,
    (id) => setExpandedAuditId((prev) => (prev === id ? null : id)),
  );
  const { orderedColumns, reorderColumns, columnWidths, setColumnWidth } = useTableLayout("partners", columns);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm" style={{ overflowX: "auto", overflowY: "hidden" }}>
      <table className="text-sm" style={{ tableLayout: "fixed", minWidth: "800px", width: "max-content" }}>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {orderedColumns.map((col, idx) => (
              <DraggableHeader
                key={col.id}
                index={idx}
                columnId={col.id}
                onReorder={reorderColumns}
                onResize={setColumnWidth}
                width={columnWidths[col.id]}
                className={col.headerClassName || ""}
              >
                {col.sortable ? (
                  <SortableHeader
                    as="div"
                    label={col.label}
                    column={col.sortKey || col.id}
                    currentColumn={sort.column}
                    currentOrder={sort.order}
                    onToggle={onToggleSort}
                    align={col.align}
                  />
                ) : (
                  <div className={`py-3 px-4 text-xs font-semibold uppercase text-slate-600 ${col.align === "right" ? "text-right" : ""}`}>
                    {col.label}
                  </div>
                )}
              </DraggableHeader>
            ))}
          </tr>
        </thead>
        <tbody>
          {partners.map((p) => (
            <React.Fragment key={p.id}>
              <tr className="border-b border-slate-100 hover:bg-slate-50">
                {orderedColumns.map((col) => {
                  const w = columnWidths[col.id];
                  const tdStyle: React.CSSProperties = w ? { width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px`, overflow: "hidden" } : {};
                  return (
                    <td
                      key={col.id}
                      style={tdStyle}
                      className={`py-3 px-4 ${col.className || ""} ${col.align === "right" ? "text-right" : ""}`}
                    >
                      {col.render(p)}
                    </td>
                  );
                })}
              </tr>
              <AuditLogDrawer
                entityType="PARTNER"
                entityId={p.id}
                open={expandedAuditId === p.id}
                colSpan={orderedColumns.length}
              />
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
