"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import LocationPickerModal from "@/components/ui/LocationPickerModal";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import NfseEmissionModal from "@/app/(dashboard)/finance/components/NfseEmissionModal";
import ApprovalConfirmModal from "@/components/os/ApprovalConfirmModal";

type AttachmentType = {
  id: string;
  type: string;
  fileName: string;
  mimeType: string;
  url: string;
  stepOrder?: number | null;
  createdAt: string;
};

type ServiceOrder = {
  id: string;
  title: string;
  description?: string;
  addressText: string;
  lat: number | null;
  lng: number | null;
  status: string;
  valueCents: number;
  techCommissionCents?: number | null;
  commissionBps?: number | null;
  deadlineAt: string;
  createdAt: string;
  updatedAt: string;
  assignedPartnerId?: string | null;
  acceptedAt?: string | null;
  workflowTemplateId?: string | null;
  assignedPartner?: { id: string; name: string; phone: string } | null;
  workflowTemplate?: { id: string; name: string; steps: any[] } | null;
  workflowStepLogs?: WorkflowStepLog[];
  events?: OrderEvent[];
  attachments?: AttachmentType[];
  // Endereço estruturado (v1.00.09)
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComp?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
  // Timestamps de execucao
  enRouteAt?: string | null;
  arrivedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  // Sistema de Pausas (v1.00.42)
  isPaused?: boolean;
  pausedAt?: string | null;
  pauseCount?: number;
  totalPausedMs?: number;
  // Finalizacao (v1.01.82)
  code?: string;
  clientPartnerId?: string | null;
  isReturn?: boolean;
  returnPaidToTech?: boolean;
  parentOrderId?: string | null;
  parentOrder?: { id: string; code: string; title: string } | null;
  returnOrders?: { id: string; code: string; title: string; status: string }[];
  financialEntries?: { id: string; status: string; type: string; grossCents: number }[];
  evaluations?: { id: string; evaluatorType: string; score: number; comment: string | null; createdAt: string }[];
  notifications?: { id: string; type: string; status: string; deliveryStatus?: string; recipientPhone: string | null; sentAt: string | null; createdAt: string }[];
};

type WorkflowStepLog = {
  id: string;
  stepOrder: number;
  stepName: string;
  partnerId: string;
  note?: string;
  photoUrl?: string;
  completedAt: string;
};

type OrderEvent = {
  id: string;
  type: string;
  actorType: string;
  actorId?: string;
  payload?: any;
  createdAt: string;
};

type EligiblePartner = {
  id: string;
  name: string;
  phone: string;
  specializations: string[];
  rating: number;
  totalOrders: number;
};

type WorkflowProgressV1 = {
  templateId: string;
  templateName: string;
  totalSteps: number;
  completedSteps: number;
  currentStep: any | null;
  steps: Array<{
    order: number;
    name: string;
    icon: string;
    requirePhoto: boolean;
    requireNote: boolean;
    completed: boolean;
    completedAt?: string;
    note?: string;
    photoUrl?: string;
  }>;
  isComplete: boolean;
};

type WorkflowProgressV2 = {
  templateId: string;
  templateName: string;
  version: 2;
  totalBlocks: number;
  completedBlocks: number;
  currentBlock: any | null;
  executionPath: Array<{
    id: string;
    type: string;
    name: string;
    icon: string;
    config: any;
    completed: boolean;
    completedAt?: string;
    note?: string;
    photoUrl?: string;
    responseData?: any;
  }>;
  isComplete: boolean;
};

type WorkflowProgress = WorkflowProgressV1 | WorkflowProgressV2;

function isWfV2(wf: WorkflowProgress): wf is WorkflowProgressV2 {
  return 'version' in wf && wf.version === 2;
}

/* Normalise V2 into same shape used by the timeline renderer */
type NormalisedStep = {
  order: number; name: string; type?: string; icon: string;
  requirePhoto: boolean; requireNote: boolean;
  completed: boolean; completedAt?: string;
  note?: string; photoUrl?: string; responseData?: any;
  config?: any;
};

function normaliseWfSteps(wf: WorkflowProgress): {
  templateName: string; totalSteps: number; completedSteps: number;
  isComplete: boolean; currentStep: any; steps: NormalisedStep[];
} {
  if (isWfV2(wf)) {
    return {
      templateName: wf.templateName,
      totalSteps: wf.totalBlocks,
      completedSteps: wf.completedBlocks,
      isComplete: wf.isComplete,
      currentStep: wf.currentBlock,
      steps: wf.executionPath.map((b, idx) => ({
        order: idx,
        name: b.name,
        type: b.type,
        icon: b.icon === 'start' ? '🚀' : b.icon === 'end' ? '🏁' : b.icon === 'location' ? '📍' : b.icon === 'camera' ? '📷' : b.icon === 'form' ? '📋' : b.icon === 'checklist' ? '✅' : b.icon === 'question' ? '❓' : b.icon === 'note' ? '📝' : b.icon === 'signature' ? '✍️' : b.icon === 'tools' ? '🔧' : b.icon,
        requirePhoto: false,
        requireNote: false,
        completed: b.completed,
        completedAt: b.completedAt,
        note: b.note,
        photoUrl: b.photoUrl,
        responseData: b.responseData,
        config: b.config,
      })),
    };
  }
  return {
    templateName: wf.templateName,
    totalSteps: wf.totalSteps,
    completedSteps: wf.completedSteps,
    isComplete: wf.isComplete,
    currentStep: wf.currentStep,
    steps: (wf.steps || []).map((s: any) => ({ ...s, type: undefined, responseData: undefined })),
  };
}

// Google Maps URL — prioriza coordenadas (mais confiável)
function buildMapsUrl(order: ServiceOrder): string {
  // Se tem coordenadas, usa diretamente (pin exato)
  if (order.lat != null && order.lng != null) {
    return `https://www.google.com/maps?q=${order.lat},${order.lng}`;
  }
  // Fallback: busca por endereço
  const streetNum = [order.addressStreet, order.addressNumber].filter(Boolean).join(", ");
  const addr = [
    streetNum,
    order.neighborhood,
  ].filter(Boolean).join(" - ")
    + (order.city ? `, ${order.city}` : "")
    + (order.state ? ` - ${order.state}` : "")
    + (order.cep ? `, ${order.cep}` : "");
  const q = addr.trim() || order.addressText;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

const STATUS_LABELS: Record<string, string> = {
  ABERTA: "Aberta",
  OFERTADA: "Ofertada",
  ATRIBUIDA: "Atribuída",
  EM_EXECUCAO: "Em Execução",
  CONCLUIDA: "Concluída",
  APROVADA: "Aprovada",
  AJUSTE: "Ajuste",
  CANCELADA: "Cancelada",
  RECUSADA: "Recusada",
};

const STATUS_COLORS: Record<string, string> = {
  ABERTA: "bg-yellow-100 text-yellow-800",
  OFERTADA: "bg-orange-100 text-orange-800",
  ATRIBUIDA: "bg-blue-100 text-blue-800",
  EM_EXECUCAO: "bg-indigo-100 text-indigo-800",
  CONCLUIDA: "bg-green-100 text-green-800",
  APROVADA: "bg-emerald-100 text-emerald-800",
  AJUSTE: "bg-amber-100 text-amber-800",
  CANCELADA: "bg-slate-100 text-slate-600",
  RECUSADA: "bg-red-100 text-red-800",
};

const EVENT_LABELS: Record<string, string> = {
  WORKFLOW_STEP_COMPLETED: "Passo do fluxo concluído",
  WORKFLOW_COMPLETED: "Fluxo concluído",
  STATUS_CHANGE: "Status alterado",
  ASSIGNED: "Técnico atribuído",
  CREATED: "OS criada",
  CHECKLIST_CONFIRMED: "Checklist confirmado",
  CHECKLIST_SKIPPED: "Checklist pulado",
  INCIDENT_REPORTED: "⚠️ Ocorrência",
};

const CHECKLIST_CLASS_LABELS: Record<string, { label: string; icon: string }> = {
  TOOLS_PPE: { label: "Ferramentas e EPI", icon: "🔧" },
  MATERIALS: { label: "Materiais", icon: "📦" },
  INITIAL_CHECK: { label: "Verificação Inicial", icon: "🔍" },
  FINAL_CHECK: { label: "Verificação Final", icon: "✅" },
  CUSTOM: { label: "Personalizado", icon: "📋" },
};

type ChecklistResponseData = {
  id: string;
  checklistClass: string;
  stage: string;
  mode: string;
  required: boolean;
  items: Array<{ text: string; checked: boolean; checkedAt?: string }>;
  observation?: string | null;
  confirmed: boolean;
  confirmedAt?: string | null;
  technicianName?: string | null;
  geolocation?: { lat: number; lng: number } | null;
  deviceInfo?: any | null;
  timeInStage?: number | null;
  skippedItems?: string[] | null;
  createdAt: string;
};

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("pt-BR");
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { toast } = useToast();

  // Gestor Evaluation state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [evalScore, setEvalScore] = useState(0);
  const [evalHover, setEvalHover] = useState(0);
  const [evalComment, setEvalComment] = useState("");
  const [evalSubmitting, setEvalSubmitting] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // NFS-e prompt state
  const [nfsePrompt, setNfsePrompt] = useState<{ show: boolean; financialEntryId?: string } | null>(null);
  const [nfseDismissed, setNfseDismissed] = useState(false);
  const [nfseEmissionEntryId, setNfseEmissionEntryId] = useState<string | null>(null);

  // Smart Routing state
  const [eligiblePartners, setEligiblePartners] = useState<EligiblePartner[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [showEligible, setShowEligible] = useState(false);
  const [selectedTechIds, setSelectedTechIds] = useState<Set<string>>(new Set());
  const [creatingOffer, setCreatingOffer] = useState(false);

  // Checklists
  const [checklistResponses, setChecklistResponses] = useState<ChecklistResponseData[]>([]);

  // Mapa interativo
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  // System config for conditional features
  const [sysConfig, setSysConfig] = useState<any>(null);
  useEffect(() => {
    api.get<any>("/companies/system-config").then(setSysConfig).catch(() => {});
  }, []);

  async function loadOrder() {
    try {
      const data = await api.get<ServiceOrder>(`/service-orders/${id}`);
      setOrder(data);
      // Load workflow progress
      try {
        const wf = await api.get<WorkflowProgress>(`/service-orders/${id}/workflow`);
        setWorkflow(wf);
      } catch {
        setWorkflow(null);
      }
      // Load checklist responses
      try {
        const clRes = await api.get<{ data: ChecklistResponseData[] }>(`/service-orders/${id}/checklists`);
        setChecklistResponses(clRes.data || []);
      } catch {
        setChecklistResponses([]);
      }
      // Check NFS-e prompt for completed orders
      if ((data.status === "CONCLUIDA" || data.status === "APROVADA") && !nfseDismissed) {
        try {
          const entries = await api.get<{ data: { id: string; nfseStatus?: string | null }[] }>(
            `/finance/entries?type=RECEIVABLE&serviceOrderId=${id}&limit=1`,
          );
          const entry = entries.data?.[0];
          if (entry && entry.nfseStatus !== "AUTHORIZED" && entry.nfseStatus !== "PROCESSING") {
            // Check if askOnFinishOS is enabled
            const config = await api.get<{ askOnFinishOS?: boolean } | null>("/nfse-emission/config").catch(() => null);
            if (config?.askOnFinishOS !== false) {
              setNfsePrompt({ show: true, financialEntryId: entry.id });
            }
          }
        } catch { /* NFS-e config not found or no entries */ }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Erro ao carregar OS");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrder();
  }, [id]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.del(`/service-orders/${id}`);
      toast("OS excluída com sucesso.", "success");
      router.push("/orders");
    } catch {
      toast("Erro ao excluir OS.", "error");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  // ── Location picker handler ──
  async function handleConfirmLocation(lat: number, lng: number) {
    setLocationPickerOpen(false);
    setSavingLocation(true);
    try {
      await api.put(`/service-orders/${id}`, { lat, lng });
      toast("Localização salva com sucesso.", "success");
      await loadOrder();
    } catch (err) {
      if (err instanceof ApiError) {
        toast(err.payload?.message || err.message, "error");
      } else {
        toast("Erro ao salvar localização.", "error");
      }
    } finally {
      setSavingLocation(false);
    }
  }

  // ── Gestor Evaluation handler — opens approval modal ──
  function handleEvaluation() {
    if (evalScore < 1) {
      toast("Selecione uma nota de 1 a 5.", "error");
      return;
    }
    if (!order?.assignedPartnerId) {
      toast("Nenhum técnico atribuído.", "error");
      return;
    }
    setShowApprovalModal(true);
  }

  // ── Smart Routing handlers ──
  async function handleLoadEligiblePartners() {
    if (!order) return;
    setLoadingEligible(true);
    setShowEligible(true);
    try {
      const data = await api.get<EligiblePartner[]>(
        `/public-offers/eligible-technicians/${order.id}`,
      );
      setEligiblePartners(data);
    } catch (err) {
      if (err instanceof ApiError) {
        toast(err.payload?.message || err.message, "error");
      } else {
        toast("Erro ao carregar técnicos elegíveis.", "error");
      }
      setShowEligible(false);
    } finally {
      setLoadingEligible(false);
    }
  }

  function toggleTechSelection(techId: string) {
    setSelectedTechIds((prev) => {
      const next = new Set(prev);
      if (next.has(techId)) {
        next.delete(techId);
      } else {
        next.add(techId);
      }
      return next;
    });
  }

  async function handleCreateOffer() {
    if (!order) return;
    setCreatingOffer(true);
    try {
      await api.post("/public-offers", { serviceOrderId: order.id });
      toast("Link de proposta gerado com sucesso!", "success");
      await loadOrder();
    } catch (err) {
      if (err instanceof ApiError) {
        toast(err.payload?.message || err.message, "error");
      } else {
        toast("Erro ao gerar link de proposta.", "error");
      }
    } finally {
      setCreatingOffer(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">{error || "OS não encontrada"}</p>
        <Link href="/orders" className="mt-3 inline-block text-sm font-medium text-blue-600">
          Voltar para lista
        </Link>
      </div>
    );
  }

  const isOverdue =
    new Date(order.deadlineAt) < new Date() &&
    !["CONCLUIDA", "APROVADA", "CANCELADA"].includes(order.status);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/orders" className="flex items-center gap-1 hover:text-blue-600">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">{order.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{order.title}</h1>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${order.isPaused ? "bg-orange-100 text-orange-800" : STATUS_COLORS[order.status] || "bg-slate-100 text-slate-600"}`}
            >
              {order.isPaused ? "⏸️ Pausada" : STATUS_LABELS[order.status] || order.status}
            </span>
            {isOverdue && !order.isPaused && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                Atrasada
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">ID: {order.id}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Editar — visivel em OS nao-terminal ou terminal com config habilitada */}
          {(() => {
            if (order.status === "CANCELADA") return null;
            if (!["CONCLUIDA", "APROVADA"].includes(order.status)) {
              return (
                <Link href={`/orders/${id}/edit`}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 transition-colors">
                  Editar
                </Link>
              );
            }
            // Terminal statuses: check sysConfig
            if (order.status === "CONCLUIDA" && sysConfig?.os?.allowEditConcluida) {
              return (
                <Link href={`/orders/${id}/edit`}
                  className="rounded-lg border border-orange-200 px-3 py-1.5 text-sm text-orange-600 hover:bg-orange-50 transition-colors">
                  Editar
                </Link>
              );
            }
            if (order.status === "APROVADA" && sysConfig?.os?.allowEditAprovada) {
              const hasPaid = (order.financialEntries || []).some(
                (e: any) => e.status === "PAID" || e.status === "CONFIRMED"
              );
              if (hasPaid) {
                return (
                  <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-400 cursor-not-allowed"
                    title="Estorne os recebimentos para liberar a edição">
                    Editar
                  </span>
                );
              }
              return (
                <Link href={`/orders/${id}/edit`}
                  className="rounded-lg border border-orange-200 px-3 py-1.5 text-sm text-orange-600 hover:bg-orange-50 transition-colors">
                  Editar
                </Link>
              );
            }
            return null;
          })()}

          {/* Retorno — visivel em OS finalizadas */}
          {["CONCLUIDA", "APROVADA"].includes(order.status) && (
            <button
              onClick={() => router.push(`/orders/new?returnFrom=${order.id}`)}
              className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
            >
              Retorno
            </button>
          )}

          {/* Excluir (ADMIN) */}
          {user?.roles?.includes("ADMIN") && (
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={deleting}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </button>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Detalhes */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Detalhes</h3>
          <dl className="space-y-2 text-sm">
            {order.description && (
              <>
                <dt className="text-slate-500">Descrição</dt>
                <dd className="text-slate-900">{order.description}</dd>
              </>
            )}
            <dt className="text-slate-500">Endereço</dt>
            <dd className="text-slate-900">{order.addressText}</dd>
            <dt className="text-slate-500">Localização</dt>
            <dd className="text-slate-900">
              {order.lat != null && order.lng != null ? (
                <span className="text-xs text-slate-500">
                  {order.lat.toFixed(6)}, {order.lng.toFixed(6)}
                </span>
              ) : (
                <span className="text-xs italic text-slate-400">Não definida</span>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setLocationPickerOpen(true)}
                  disabled={savingLocation}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                >
                  {savingLocation ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Definir localização
                    </>
                  )}
                </button>
                {(order.lat != null && order.lng != null || order.addressText) && (
                  <a
                    href={buildMapsUrl(order)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                  >
                    Ver no mapa
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </dd>
          </dl>
        </div>

        {/* Financeiro + Datas */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Financeiro e Datas</h3>
          <dl className="space-y-2 text-sm">
            <dt className="text-slate-500">Valor</dt>
            <dd className="text-xl font-bold text-slate-900">{formatCurrency(order.valueCents)}</dd>
            {(() => {
              const techCents = order.techCommissionCents
                ?? (order.commissionBps != null && order.valueCents ? Math.round((order.valueCents * order.commissionBps) / 10000) : null);
              return techCents != null && techCents > 0 ? (
                <>
                  <dt className="text-slate-500">Comissão Técnico</dt>
                  <dd className="text-lg font-bold text-green-700">{formatCurrency(techCents)}</dd>
                </>
              ) : null;
            })()}
            <dt className="text-slate-500">Prazo</dt>
            <dd className={isOverdue ? "text-red-600 font-medium" : "text-slate-900"}>
              {formatDateTime(order.deadlineAt)}
            </dd>
            <dt className="text-slate-500">Criada em</dt>
            <dd className="text-slate-900">{formatDateTime(order.createdAt)}</dd>
            {order.acceptedAt && (
              <>
                <dt className="text-slate-500">Aceita em</dt>
                <dd className="text-slate-900">{formatDateTime(order.acceptedAt)}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {/* Técnico */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
        {/* Retorno banner */}
        {order.parentOrder && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 mb-4 flex items-center gap-2">
            <span className="text-amber-600 text-sm">🔄</span>
            <p className="text-xs text-amber-700">
              Retorno de{" "}
              <a href={`/orders/${order.parentOrder.id}`} className="font-semibold underline hover:text-amber-900">
                {order.parentOrder.code} — {order.parentOrder.title}
              </a>
            </p>
          </div>
        )}
        {/* Return orders */}
        {order.returnOrders && order.returnOrders.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 mb-4">
            <p className="text-xs text-blue-700">
              📋 {order.returnOrders.length === 1 ? "Retorno criado" : `${order.returnOrders.length} retornos`}:{" "}
              {order.returnOrders.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && ", "}
                  <a href={`/orders/${r.id}`} className="font-semibold underline hover:text-blue-900">
                    {r.code}
                  </a>
                </span>
              ))}
            </p>
          </div>
        )}
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Técnico Atribuído</h3>
        {order.assignedPartner ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
              {order.assignedPartner.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{order.assignedPartner.name}</p>
              <p className="text-xs text-slate-500">{order.assignedPartner.phone}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Nenhum técnico atribuído.</p>
        )}
      </div>

      {/* Avaliação movida para depois das fotos */}

      {/* ── NFS-e Prompt (when OS is completed) ── */}
      {nfsePrompt?.show && nfsePrompt.financialEntryId && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-600 flex-shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-teal-900">Emitir NFS-e</h4>
              <p className="text-xs text-teal-700 mt-0.5">
                A OS foi concluida. Deseja emitir a Nota Fiscal de Servico agora?
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    setNfseEmissionEntryId(nfsePrompt.financialEntryId!);
                    setNfsePrompt(null);
                  }}
                  className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors"
                >
                  Emitir Agora
                </button>
                <button
                  onClick={() => { setNfsePrompt(null); setNfseDismissed(true); }}
                  className="rounded-lg border border-teal-300 bg-white px-4 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50 transition-colors"
                >
                  Depois
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NFS-e Emission Modal */}
      {nfseEmissionEntryId && (
        <NfseEmissionModal
          financialEntryId={nfseEmissionEntryId}
          open={true}
          onClose={() => setNfseEmissionEntryId(null)}
          onSuccess={() => { setNfseEmissionEntryId(null); toast("NFS-e enviada para processamento!", "success"); }}
        />
      )}

      {/* ── Smart Routing (only when ABERTA + workflowTemplateId) ── */}
      {order.status === "ABERTA" && order.workflowTemplateId && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12H8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5v14" />
            </svg>
            Roteamento Inteligente
          </h3>

          {!showEligible ? (
            <button
              onClick={handleLoadEligiblePartners}
              disabled={loadingEligible}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
            >
              {loadingEligible ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  Carregando...
                </>
              ) : (
                "Ver Técnicos Elegíveis"
              )}
            </button>
          ) : loadingEligible ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
            </div>
          ) : eligiblePartners.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum técnico elegível encontrado.</p>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {eligiblePartners.map((tech) => (
                  <div
                    key={tech.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer ${
                      selectedTechIds.has(tech.id)
                        ? "border-blue-300 bg-blue-50"
                        : "border-slate-200 bg-white hover:bg-slate-100"
                    }`}
                    onClick={() => toggleTechSelection(tech.id)}
                  >
                    {/* Checkbox */}
                    <div className={`flex h-5 w-5 items-center justify-center rounded border-2 flex-shrink-0 transition-colors ${
                      selectedTechIds.has(tech.id)
                        ? "border-blue-600 bg-blue-600"
                        : "border-slate-300 bg-white"
                    }`}>
                      {selectedTechIds.has(tech.id) && (
                        <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex-shrink-0">
                      {tech.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 truncate">{tech.name}</p>
                        <span className="text-xs text-slate-400">{tech.phone}</span>
                      </div>

                      {/* Specializations */}
                      {tech.specializations.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tech.specializations.map((spec) => (
                            <span
                              key={spec}
                              className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                            >
                              {spec}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Rating & Orders */}
                    <div className="flex flex-col items-end flex-shrink-0 gap-1">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <svg
                            key={star}
                            className={`h-3.5 w-3.5 ${
                              star <= Math.round(tech.rating)
                                ? "text-yellow-400"
                                : "text-slate-200"
                            }`}
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        ))}
                        <span className="ml-1 text-xs text-slate-500">
                          {tech.rating.toFixed(1)}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {tech.totalOrders} OS{tech.totalOrders !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Generate offer link */}
              <button
                onClick={handleCreateOffer}
                disabled={creatingOffer}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creatingOffer ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Gerando...
                  </>
                ) : (
                  "Gerar Link de Proposta"
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Fluxo + Historico (unificado - relatório) ── */}
      {workflow ? (() => {
        const wfn = normaliseWfSteps(workflow);

        // Helper: get detail text for a step
        function getStepDetail(step: NormalisedStep): string {
          if (!step.completed) return "";
          if (step.type === "STATUS") return step.config?.targetStatus || "";
          if (step.type === "ACTION_BUTTONS") {
            const btnId = step.responseData?.buttonId;
            const btns: Array<{ id: string; label: string }> = step.config?.buttons || [];
            const btn = btns.find((b: { id: string }) => b.id === btnId);
            return btn?.label || btnId || "";
          }
          if (step.type === "GPS" && step.responseData?.lat) return `${Number(step.responseData.lat).toFixed(5)}, ${Number(step.responseData.lng).toFixed(5)}`;
          if (step.type === "CHECKLIST" && step.responseData?.checkedItems) return `${step.responseData.checkedItems.length} verificados`;
          if (step.type === "FORM" && step.responseData?.fields) return `${Object.keys(step.responseData.fields).length} campos`;
          if ((step.type === "QUESTION" || step.type === "CONDITION") && step.responseData?.answer !== undefined) return String(step.responseData.answer);
          if (step.type === "PHOTO") return step.responseData?.count ? `${step.responseData.count} fotos` : "foto";
          if (step.type === "SIGNATURE") return "assinado";
          if (step.type === "MATERIALS" && step.responseData?.items) return `${step.responseData.items.length} itens`;
          if (step.note) return step.note.substring(0, 40);
          return "";
        }

        // Helper: get GPS from responseData or event
        function getStepGps(step: NormalisedStep): string {
          if (step.responseData?.lat) return `${Number(step.responseData.lat).toFixed(4)}, ${Number(step.responseData.lng).toFixed(4)}`;
          return "";
        }

        const STATUS_LABELS: Record<string, string> = {
          OFERTADA: "Ofertada", ATRIBUIDA: "Atribuída", A_CAMINHO: "A caminho",
          EM_EXECUCAO: "Em execução", CONCLUIDA: "Concluída", APROVADA: "Aprovada",
          AJUSTE: "Ajuste", CANCELADA: "Cancelada", RECUSADA: "Recusada",
        };

        return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {wfn.templateName}
            </h3>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              wfn.isComplete ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
            }`}>
              {wfn.completedSteps}/{wfn.totalSteps}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1 rounded-full bg-slate-100 mb-3 overflow-hidden">
            <div className={`h-full rounded-full ${wfn.isComplete ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: `${wfn.totalSteps > 0 ? (wfn.completedSteps / wfn.totalSteps) * 100 : 0}%` }} />
          </div>

          {/* Report table */}
          <div className="max-w-2xl">
            {/* Table header */}
            <div className="flex items-center gap-2 text-[9px] text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-200 mb-0.5">
              <span className="w-5 flex-shrink-0" />
              <span className="w-28 flex-shrink-0">Passo</span>
              <span className="flex-1 min-w-0">Detalhe</span>
              <span className="w-24 flex-shrink-0 text-right">Hora</span>
              <span className="w-32 flex-shrink-0 text-right hidden md:block">Coordenadas</span>
            </div>

            {/* Rows */}
            {wfn.steps.map((step, idx) => {
              const detail = getStepDetail(step);
              const gps = getStepGps(step);
              const hasMaterials = step.type === "MATERIALS" && step.completed && step.responseData?.items;
              const statusLabel = step.type === "STATUS" && detail ? (STATUS_LABELS[detail] || detail) : "";

              return (
                <div key={step.order}>
                  <div className={`flex items-center gap-2 py-1 border-b border-slate-50 ${
                    !step.completed && idx !== wfn.completedSteps ? "opacity-40" : ""
                  }`}>
                    {/* Status dot */}
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full flex-shrink-0 text-[8px] ${
                      step.completed ? "bg-green-100 text-green-600"
                        : idx === wfn.completedSteps ? "bg-blue-100 text-blue-600 ring-1 ring-blue-300"
                        : "bg-slate-50 text-slate-300"
                    }`}>
                      {step.completed ? "✓" : idx === wfn.completedSteps ? "▶" : "○"}
                    </span>
                    {/* Step name */}
                    <span className={`w-28 flex-shrink-0 text-[11px] font-medium truncate ${
                      step.completed ? "text-slate-700" : idx === wfn.completedSteps ? "text-blue-600" : "text-slate-400"
                    }`}>
                      {step.name}
                    </span>
                    {/* Detail column */}
                    <span className="flex-1 min-w-0 text-[10px] text-slate-500 truncate">
                      {step.type === "STATUS" ? (
                        <span className={`inline-block px-1.5 py-0 rounded text-[9px] font-medium ${STATUS_COLORS[statusLabel ? detail : ""] || "bg-slate-100 text-slate-600"}`}>
                          {statusLabel}
                        </span>
                      ) : step.type === "ACTION_BUTTONS" && detail ? (
                        <span className="inline-block px-1.5 py-0 rounded bg-blue-50 text-blue-700 text-[9px] font-medium">
                          {detail}
                        </span>
                      ) : step.note ? (
                        <span>📝 {step.note.substring(0, 50)}</span>
                      ) : (
                        detail
                      )}
                    </span>
                    {/* Time */}
                    <span className="w-24 flex-shrink-0 text-[10px] text-slate-400 text-right whitespace-nowrap">
                      {step.completed && step.completedAt
                        ? new Date(step.completedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                        : idx === wfn.completedSteps ? "aguardando" : ""}
                    </span>
                    {/* GPS */}
                    <span className="w-32 flex-shrink-0 text-[9px] text-slate-400 text-right hidden md:block truncate">
                      {gps && `📍 ${gps}`}
                    </span>
                  </div>
                  {/* MATERIALS expanded below */}
                  {hasMaterials && (
                    <div className="ml-7 my-1 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 max-w-xs">
                      {step.responseData.note && (
                        <p className="text-[10px] text-slate-600 mb-1">{step.responseData.note}</p>
                      )}
                      <div className="flex items-center gap-1 text-[9px] text-slate-400 uppercase tracking-wide mb-0.5">
                        <span className="flex-1">Item</span>
                        <span className="w-8 text-right">Qtd.</span>
                      </div>
                      {(step.responseData.items as Array<{ name: string; qty: number }>).map((item: { name: string; qty: number }, i: number) => (
                        <div key={i} className="flex items-center gap-1 text-[10px] py-0.5 border-t border-amber-100 first:border-0">
                          <span className="flex-1 text-slate-700 truncate">{item.name.length > 50 ? item.name.substring(0, 50) + '…' : item.name}</span>
                          <span className="w-8 text-right font-medium text-slate-600">{item.qty}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Post-workflow events (approval, etc.) */}
            {(() => {
              // Find events that happened AFTER the last workflow step
              const lastStepTime = wfn.steps.filter(s => s.completed && s.completedAt)
                .map(s => new Date(s.completedAt!).getTime())
                .sort((a, b) => b - a)[0] || 0;
              const postEvents = (order.events || [])
                .filter(e => {
                  if (new Date(e.createdAt).getTime() <= lastStepTime) return false;
                  // Exclude workflow step events (already shown as rows above)
                  if (e.type === "WORKFLOW_STEP_COMPLETED") return false;
                  if (e.type === "WORKFLOW_COMPLETED") return false;
                  return true;
                })
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

              const DELIVERY_LABELS: Record<string, { label: string; color: string }> = {
                SENT: { label: "Enviada", color: "text-slate-400" },
                DELIVERED: { label: "Entregue", color: "text-blue-500" },
                READ: { label: "Lida", color: "text-green-500" },
                FAILED: { label: "Falhou", color: "text-red-500" },
                PENDING: { label: "Pendente", color: "text-slate-400" },
              };

              const renderStars = (score: number) => (
                <span className="text-yellow-500 text-[10px]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i}>{i < score ? "★" : "☆"}</span>
                  ))}
                  <span className="ml-1 text-slate-600">{score}/5</span>
                </span>
              );

              // Pre-fetch evaluations to merge with status events
              const gestorEval = order.evaluations?.find(e => e.evaluatorType === "GESTOR" && e.score > 0);
              const clientEval = order.evaluations?.find(e => e.evaluatorType === "CLIENTE" && e.score > 0);

              const timelineRows = postEvents.map((ev) => {
                const p = ev.payload || {};
                const isApproval = ev.type === "STATUS_CHANGE" && p.to === "APROVADA";

                // If this is the approval status event AND there's a gestor eval, merge them into one row
                if (isApproval && gestorEval) {
                  return (
                    <div key={ev.id}>
                      <div className="flex items-center gap-2 py-1 border-b border-slate-50">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full flex-shrink-0 text-[8px] bg-yellow-100 text-yellow-600">★</span>
                        <span className="w-28 flex-shrink-0 text-[11px] font-medium text-yellow-700 truncate">
                          Aprovada
                        </span>
                        <span className="flex-1 min-w-0">{renderStars(gestorEval.score)}</span>
                        <span className="w-24 flex-shrink-0 text-[10px] text-slate-400 text-right whitespace-nowrap">
                          {new Date(ev.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="w-32 flex-shrink-0 hidden md:block" />
                      </div>
                      {gestorEval.comment && (
                        <div className="ml-6 pl-2 pb-1 border-b border-slate-50">
                          <p className="text-[10px] text-slate-500 italic">&ldquo;{gestorEval.comment}&rdquo;</p>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={ev.id}>
                    <div className="flex items-center gap-2 py-1 border-b border-slate-50">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full flex-shrink-0 text-[8px] bg-green-100 text-green-600">✓</span>
                      <span className="w-28 flex-shrink-0 text-[11px] font-medium text-slate-700 truncate">
                        {ev.type === "STATUS_CHANGE" ? "Status" : EVENT_LABELS[ev.type] || ev.type}
                      </span>
                      <span className="flex-1 min-w-0 text-[10px] text-slate-500 truncate">
                        {ev.type === "STATUS_CHANGE" && p.to ? (
                          <span className={`inline-block px-1.5 py-0 rounded text-[9px] font-medium ${STATUS_COLORS[p.to] || "bg-slate-100 text-slate-600"}`}>
                            {STATUS_LABELS[p.to] || p.to}
                          </span>
                        ) : p.blockName || ""}
                      </span>
                      <span className="w-24 flex-shrink-0 text-[10px] text-slate-400 text-right whitespace-nowrap">
                        {new Date(ev.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="w-32 flex-shrink-0 text-[9px] text-slate-400 text-right hidden md:block truncate">
                        {p.gps ? `📍 ${Number(p.gps.lat).toFixed(4)}, ${Number(p.gps.lng).toFixed(4)}` : ""}
                      </span>
                    </div>
                  </div>
                );
              });

              // Gestor evaluation row — only if NOT already merged into approval status event
              const hasApprovalEvent = postEvents.some(ev => ev.type === "STATUS_CHANGE" && ev.payload?.to === "APROVADA");
              if (gestorEval && !hasApprovalEvent) {
                timelineRows.push(
                  <div key={`gestor-eval-${gestorEval.id}`}>
                    <div className="flex items-center gap-2 py-1 border-b border-slate-50">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full flex-shrink-0 text-[8px] bg-yellow-100 text-yellow-600">★</span>
                      <span className="w-28 flex-shrink-0 text-[11px] font-medium text-yellow-700 truncate">
                        Aval. Gestor
                      </span>
                      <span className="flex-1 min-w-0">{renderStars(gestorEval.score)}</span>
                      <span className="w-24 flex-shrink-0 text-[10px] text-slate-400 text-right whitespace-nowrap">
                        {new Date(gestorEval.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="w-32 flex-shrink-0 hidden md:block" />
                    </div>
                    {gestorEval.comment && (
                      <div className="ml-6 pl-2 pb-1 border-b border-slate-50">
                        <p className="text-[10px] text-slate-500 italic">&ldquo;{gestorEval.comment}&rdquo;</p>
                      </div>
                    )}
                  </div>,
                );
              }

              // Client evaluation notification status + evaluation
              const evalNotif = order.notifications?.find(n => n.type === "EVALUATION_REQUEST");

              if (evalNotif) {
                const ds = DELIVERY_LABELS[(evalNotif as any).deliveryStatus || evalNotif.status] || DELIVERY_LABELS.PENDING;
                timelineRows.push(
                  <div key={`eval-notif-${evalNotif.id}`}>
                    <div className="flex items-center gap-2 py-1 border-b border-slate-50">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full flex-shrink-0 text-[8px] bg-teal-100 text-teal-600">📩</span>
                      <span className="w-28 flex-shrink-0 text-[11px] font-medium text-teal-700 truncate">
                        Aval. Cliente
                      </span>
                      <span className="flex-1 min-w-0 text-[10px] text-slate-500">
                        <span className={`font-medium ${ds.color}`}>{ds.label}</span>
                        {evalNotif.recipientPhone && (
                          <span className="ml-1.5 text-slate-400">→ {evalNotif.recipientPhone}</span>
                        )}
                      </span>
                      <span className="w-24 flex-shrink-0 text-[10px] text-slate-400 text-right whitespace-nowrap">
                        {evalNotif.sentAt ? new Date(evalNotif.sentAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                      <span className="w-32 flex-shrink-0 hidden md:block" />
                    </div>
                  </div>,
                );
              }

              if (clientEval) {
                timelineRows.push(
                  <div key={`client-eval-${clientEval.id}`}>
                    <div className="flex items-center gap-2 py-1 border-b border-slate-50">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full flex-shrink-0 text-[8px] bg-purple-100 text-purple-600">★</span>
                      <span className="w-28 flex-shrink-0 text-[11px] font-medium text-purple-700 truncate">
                        Nota Cliente
                      </span>
                      <span className="flex-1 min-w-0">{renderStars(clientEval.score)}</span>
                      <span className="w-24 flex-shrink-0 text-[10px] text-slate-400 text-right whitespace-nowrap">
                        {new Date(clientEval.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="w-32 flex-shrink-0 hidden md:block" />
                    </div>
                    {clientEval.comment && (
                      <div className="ml-6 pl-2 pb-1 border-b border-slate-50">
                        <p className="text-[10px] text-purple-500 italic">&ldquo;{clientEval.comment}&rdquo;</p>
                      </div>
                    )}
                  </div>,
                );
              } else if (evalNotif) {
                // Show "Aguardando avaliação" if notification was sent but no evaluation yet
                timelineRows.push(
                  <div key="eval-waiting" className="ml-6 pl-2 pb-1 border-b border-slate-50">
                    <p className="text-[10px] text-slate-400 italic">Aguardando avaliação do cliente...</p>
                  </div>,
                );
              }

              return timelineRows;
            })()}
          </div>
        </div>
        );
      })() : order.workflowTemplateId ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6 text-center">
          <p className="text-sm text-slate-400">Carregando fluxo...</p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 mb-6 text-center text-sm text-slate-400">
          Sem fluxo de atendimento.
        </div>
      )}

      {/* ── Resumo de Tempo ── */}
      {order.completedAt && (order.enRouteAt || order.startedAt) && (() => {
        const enRoute = order.enRouteAt ? new Date(order.enRouteAt).getTime() : null;
        const started = order.startedAt ? new Date(order.startedAt).getTime() : null;
        const completed = new Date(order.completedAt).getTime();
        const pausedMs = Number(order.totalPausedMs || 0);

        const totalMs = (enRoute || started) ? completed - (enRoute || started)! : 0;
        const travelMs = enRoute && started ? started - enRoute : 0;
        const execMs = started ? Math.max(0, completed - started - pausedMs) : 0;
        const netMs = Math.max(0, totalMs - pausedMs);

        function fmtMs(ms: number): string {
          if (ms <= 0) return "—";
          const mins = Math.round(ms / 60000);
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;
        }

        return (
          <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Tempo de Servico
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">{fmtMs(travelMs)}</p>
                <p className="text-[10px] text-slate-400">Deslocamento</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">{fmtMs(execMs)}</p>
                <p className="text-[10px] text-slate-400">Execucao</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">{fmtMs(pausedMs)}</p>
                <p className="text-[10px] text-slate-400">Pausas{order.pauseCount ? ` (${order.pauseCount}x)` : ""}</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">{fmtMs(totalMs)}</p>
                <p className="text-[10px] text-slate-400">Total bruto</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-blue-600">{fmtMs(netMs)}</p>
                <p className="text-[10px] text-blue-500 font-medium">Total liquido</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Checklists ── */}
      {checklistResponses.length > 0 && (() => {
        // Group by stage
        const byStage: Record<string, ChecklistResponseData[]> = {};
        for (const r of checklistResponses) {
          if (!byStage[r.stage]) byStage[r.stage] = [];
          byStage[r.stage].push(r);
        }
        const stageNames: Record<string, string> = {
          ABERTA: "Aberta", ATRIBUIDA: "Atribuída", EM_EXECUCAO: "Em Execução",
          CONCLUIDA: "Concluída", APROVADA: "Aprovada",
        };
        return (
          <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">📋 Checklists</h3>
            <div className="space-y-5">
              {Object.entries(byStage).map(([stage, responses]) => (
                <div key={stage}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Etapa: {stageNames[stage] || stage}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {responses.map((r) => {
                      const cls = CHECKLIST_CLASS_LABELS[r.checklistClass] || { label: r.checklistClass, icon: "📋" };
                      const items = Array.isArray(r.items) ? r.items : [];
                      const checked = items.filter((i: any) => i.checked).length;
                      const total = items.length;
                      return (
                        <div key={r.id} className="border border-slate-100 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-700">
                              {cls.icon} {cls.label}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              r.confirmed
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}>
                              {r.confirmed ? "Confirmado" : "Pendente"}
                            </span>
                          </div>
                          {/* Items */}
                          {total > 0 && (
                            <div className="space-y-1 mb-2">
                              {items.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                  <span className={item.checked ? "text-green-600" : "text-slate-400"}>
                                    {item.checked ? "✓" : "○"}
                                  </span>
                                  <span className={item.checked ? "text-slate-700" : "text-slate-500"}>
                                    {item.text}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Stats bar */}
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                            <span>{checked}/{total} itens</span>
                            {r.mode === "ITEM_BY_ITEM" && <span>Item a item</span>}
                            {r.mode === "FULL" && <span>Lista completa</span>}
                            {r.required ? <span className="text-red-400">Obrigatório</span> : <span>Recomendado</span>}
                            {r.technicianName && <span>Por: {r.technicianName}</span>}
                            {r.confirmedAt && <span>{formatDateTime(r.confirmedAt)}</span>}
                          </div>
                          {/* Observation */}
                          {r.observation && (
                            <p className="mt-1.5 text-[11px] text-slate-500 italic border-t border-slate-50 pt-1.5">
                              {r.observation}
                            </p>
                          )}
                          {/* Geolocation */}
                          {r.geolocation && (
                            <p className="text-[10px] text-slate-400 mt-1">
                              📍 {(r.geolocation as any).lat?.toFixed(4)}, {(r.geolocation as any).lng?.toFixed(4)}
                            </p>
                          )}
                          {/* Skipped items */}
                          {r.skippedItems && (r.skippedItems as string[]).length > 0 && (
                            <p className="text-[10px] text-amber-500 mt-1">
                              ⚠ Pulados: {(r.skippedItems as string[]).join(", ")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Fotos ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">📷 Fotos</h3>
        {(() => {
          const apiBase = "/api";
          const antes = (order.attachments || []).filter((a) => a.type === "ANTES");
          const depois = (order.attachments || []).filter((a) => a.type === "DEPOIS");
          const workflow = (order.attachments || []).filter((a) => a.type === "WORKFLOW_STEP");
          const hasAny = antes.length > 0 || depois.length > 0 || workflow.length > 0;
          const canDelete = user && user.roles?.some((r: string) => r === "ADMIN" || r === "DESPACHO");

          const handleDeletePhoto = async (attachmentId: string) => {
            if (!confirm("Excluir esta foto?")) return;
            try {
              await api.del(`/service-orders/${id}/attachments/${attachmentId}`);
              toast("Foto excluida", "success");
              loadOrder();
            } catch {
              toast("Erro ao excluir foto", "error");
            }
          };

          const PhotoThumb = ({ a, showStep }: { a: any; showStep?: boolean }) => (
            <div key={a.id} className="relative group">
              <img src={`${apiBase}${a.url}`} alt={a.fileName}
                onClick={() => setLightboxUrl(`${apiBase}${a.url}`)}
                className="h-24 w-24 rounded-xl object-cover border border-slate-200 cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all" />
              {showStep && a.stepOrder != null && (
                <span className="absolute bottom-1 right-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                  Passo {a.stepOrder}
                </span>
              )}
              {canDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeletePhoto(a.id); }}
                  className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600 transition-colors"
                  title="Excluir foto"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          );

          if (!hasAny) {
            return <p className="text-sm text-slate-400">Nenhuma foto registrada.</p>;
          }

          return (
            <div className="space-y-4">
              {antes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Antes ({antes.length})</p>
                  <div className="flex gap-2 flex-wrap">
                    {antes.map((a) => <PhotoThumb key={a.id} a={a} />)}
                  </div>
                </div>
              )}
              {depois.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Depois ({depois.length})</p>
                  <div className="flex gap-2 flex-wrap">
                    {depois.map((a) => <PhotoThumb key={a.id} a={a} />)}
                  </div>
                </div>
              )}
              {workflow.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Passos do fluxo ({workflow.length})</p>
                  <div className="flex gap-2 flex-wrap">
                    {workflow.map((a) => <PhotoThumb key={a.id} a={a} showStep />)}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Gestor Evaluation (only when CONCLUIDA — after fotos) ── */}
      {order.status === "CONCLUIDA" && order.assignedPartnerId && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <svg className="h-4 w-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Avaliação do Técnico
          </h3>
          <div className="mb-4">
            <label className="block text-xs text-slate-500 mb-2">Nota</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setEvalScore(star)}
                  onMouseEnter={() => setEvalHover(star)} onMouseLeave={() => setEvalHover(0)}
                  className="focus:outline-none transition-transform hover:scale-110"
                  aria-label={`${star} estrela${star > 1 ? "s" : ""}`}>
                  <svg className={`h-8 w-8 transition-colors ${star <= (evalHover || evalScore) ? "text-yellow-400" : "text-slate-200"}`}
                    fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              ))}
              {evalScore > 0 && <span className="ml-2 text-sm font-medium text-slate-600">{evalScore}/5</span>}
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-slate-500 mb-1">Comentário (opcional)</label>
            <textarea value={evalComment} onChange={(e) => setEvalComment(e.target.value)} rows={3}
              placeholder="Descreva sua experiência com o técnico..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none" />
          </div>
          <button onClick={handleEvaluation} disabled={evalSubmitting || evalScore < 1}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {evalSubmitting ? (
              <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Enviando...</>
            ) : "Aprovar e Avaliar"}
          </button>
        </div>
      )}

      <ConfirmModal
        open={showDeleteModal}
        title="Excluir Ordem de Serviço"
        message={`Tem certeza que deseja excluir a OS "${order.title}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />

      <LocationPickerModal
        open={locationPickerOpen}
        lat={order.lat}
        lng={order.lng}
        city={order.city}
        state={order.state}
        addressText={order.addressText}
        onConfirm={handleConfirmLocation}
        onClose={() => setLocationPickerOpen(false)}
      />

      {/* Lightbox — foto em tamanho real */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}>
          <button onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl font-light z-10">✕</button>
          <img src={lightboxUrl} alt="Foto ampliada"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl" />
        </div>
      )}

      {/* Approval Confirm Modal */}
      {order && (
        <ApprovalConfirmModal
          open={showApprovalModal}
          orderId={order.id}
          score={evalScore}
          comment={evalComment}
          onClose={() => setShowApprovalModal(false)}
          onApproved={() => {
            setShowApprovalModal(false);
            toast("OS aprovada com sucesso!", "success");
            loadOrder();
          }}
        />
      )}
    </div>
  );
}
