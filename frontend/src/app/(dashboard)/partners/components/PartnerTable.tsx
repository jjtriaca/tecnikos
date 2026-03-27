"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
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
  code: string | null;
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
  regime: string | null;
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
  PENDENTE_CONTRATO: "bg-orange-100 text-orange-800",
};

const STATUS_LABELS: Record<string, string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  EM_TREINAMENTO: "Em Treinamento",
  PENDENTE_CONTRATO: "Pendente Contrato",
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

/* ---- Actions dropdown (fixed positioning to escape overflow clip) ---- */
function ActionsDropdown({
  partner,
  canEdit,
  onEdit,
  onDelete,
  onToggleAudit,
  expandedAuditId,
}: {
  partner: Partner;
  canEdit: boolean;
  onEdit: (p: Partner) => void;
  onDelete: (id: string, name: string) => void;
  onToggleAudit: (id: string) => void;
  expandedAuditId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = 160;
      const fitsBelow = rect.bottom + menuHeight < window.innerHeight;
      setPos({
        top: fitsBelow ? rect.bottom + 4 : rect.top - menuHeight - 4,
        left: Math.max(8, rect.right - 168),
      });
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [open]);

  return (
    <div ref={wrapperRef} className="flex justify-end">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-slate-300 px-2 py-1 text-sm font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
      >
        &#x22EF;
      </button>
      {open && pos && (
        <div
          className="fixed z-50 min-w-[168px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-left"
          style={{ top: pos.top, left: pos.left }}
        >
          <Link
            href={`/partners/${partner.id}`}
            className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Ver detalhes
          </Link>
          {canEdit && (
            <>
              <button
                onClick={() => { onEdit(partner); setOpen(false); }}
                className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                Editar
              </button>
              <button
                onClick={() => { onDelete(partner.id, partner.name); setOpen(false); }}
                className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                Excluir
              </button>
            </>
          )}
          <div className="my-1 border-t border-slate-100" />
          <button
            onClick={() => { onToggleAudit(partner.id); setOpen(false); }}
            className={`block w-full px-4 py-2 text-left text-sm ${expandedAuditId === partner.id ? "text-blue-600" : "text-slate-700"} hover:bg-slate-50`}
          >
            Histórico
          </button>
        </div>
      )}
    </div>
  );
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
      id: "code",
      label: "Código",
      sortable: true,
      render: (p) => <span className="font-mono text-xs text-slate-500">{p.code || "—"}</span>,
    },
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

  // Actions column — dropdown menu
  cols.unshift({
    id: "actions",
    label: "Ações",
    align: "right",
    render: (p) => (
      <ActionsDropdown
        partner={p}
        canEdit={canEdit}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleAudit={onToggleAudit}
        expandedAuditId={expandedAuditId}
      />
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
  const { orderedColumns, reorderColumns, columnWidths, setColumnWidth } = useTableLayout("partners-v3", columns);

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
