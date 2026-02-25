"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type AuditLog = {
  id: string;
  action: string;
  actorName: string | null;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  createdAt: string;
};

/* ---- Translation maps ---- */

const ACTION_LABELS: Record<string, string> = {
  CREATED: "Criado",
  UPDATED: "Atualizado",
  DELETED: "Excluído",
  STATUS_CHANGED: "Status alterado",
  ASSIGNED: "Técnico atribuído",
  CANCELLED: "Cancelado",
  DUPLICATED: "Duplicado",
};

const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  description: "Descrição",
  addressText: "Endereço",
  lat: "Latitude",
  lng: "Longitude",
  valueCents: "Valor",
  deadlineAt: "Prazo",
  clientPartnerId: "Cliente",
  assignedPartnerId: "Técnico",
  status: "Status",
  name: "Nome",
  tradeName: "Nome Fantasia",
  email: "Email",
  phone: "Telefone",
  document: "Documento",
  personType: "Tipo Pessoa",
  partnerTypes: "Tipos",
  role: "Perfil",
  password: "Senha",
  specializationIds: "Especializações",
  ie: "Inscrição Estadual",
  im: "Inscrição Municipal",
  cep: "CEP",
  addressStreet: "Rua",
  addressNumber: "Número",
  addressComp: "Complemento",
  neighborhood: "Bairro",
  city: "Cidade",
  state: "Estado",
  rating: "Avaliação",
};

const STATUS_LABELS: Record<string, string> = {
  ABERTA: "Aberta",
  OFERTADA: "Ofertada",
  ATRIBUIDA: "Atribuída",
  EM_EXECUCAO: "Em Execução",
  CONCLUIDA: "Concluída",
  APROVADA: "Aprovada",
  AJUSTE: "Ajuste",
  CANCELADA: "Cancelada",
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  EM_TREINAMENTO: "Em Treinamento",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  DESPACHO: "Despacho",
  FINANCEIRO: "Financeiro",
  LEITURA: "Leitura",
};

function formatFieldValue(key: string, value: any): string {
  if (value === null || value === undefined) return "\u2014";
  if (key === "status") return STATUS_LABELS[value] || value;
  if (key === "role") return ROLE_LABELS[value] || value;
  if (key === "valueCents" && typeof value === "number") {
    return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (key === "deadlineAt" && typeof value === "string") {
    return new Date(value).toLocaleDateString("pt-BR");
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function describeLog(log: AuditLog): string {
  const actionLabel = ACTION_LABELS[log.action] || log.action;

  if (log.action === "STATUS_CHANGED" && log.after?.status) {
    return `Status \u2192 ${STATUS_LABELS[log.after.status] || log.after.status}`;
  }

  if (log.action === "UPDATED" && log.after) {
    const fields = Object.keys(log.after)
      .map((k) => FIELD_LABELS[k] || k)
      .join(", ");
    return `Alterou ${fields}`;
  }

  if (log.action === "ASSIGNED" && log.after?.assignedPartnerId) {
    return "Técnico atribuído";
  }

  if (log.action === "DUPLICATED" && log.after?.title) {
    return `Duplicado \u2192 ${log.after.title}`;
  }

  return actionLabel;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d atrás`;
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

/* ---- Component ---- */

interface AuditLogDrawerProps {
  entityType: string;
  entityId: string;
  open: boolean;
  colSpan: number;
}

export default function AuditLogDrawer({ entityType, entityId, open, colSpan }: AuditLogDrawerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (open && !fetched) {
      setLoading(true);
      api
        .get<AuditLog[]>(`/audit?entityType=${entityType}&entityId=${entityId}&limit=10`)
        .then((data) => {
          setLogs(data);
          setFetched(true);
        })
        .catch(() => setLogs([]))
        .finally(() => setLoading(false));
    }
  }, [open, fetched, entityType, entityId]);

  if (!open) return null;

  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className="border-t border-blue-100 bg-blue-50/50 px-6 py-3">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-semibold text-blue-700 uppercase">Histórico de Alterações</span>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-5 w-3/4 animate-pulse rounded bg-blue-100" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhum registro encontrado.</p>
          ) : (
            <div className="space-y-1.5">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2">
                  <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-400" />
                  <div className="text-xs leading-relaxed">
                    <span className="font-medium text-slate-800">{describeLog(log)}</span>
                    {log.actorName && (
                      <span className="text-slate-500"> &mdash; {log.actorName}</span>
                    )}
                    <span className="ml-2 text-slate-400">{relativeTime(log.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
