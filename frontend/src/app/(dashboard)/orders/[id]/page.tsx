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
  // Sistema de Pausas (v1.00.42)
  isPaused?: boolean;
  pausedAt?: string | null;
  pauseCount?: number;
  totalPausedMs?: number;
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
function normaliseWfSteps(wf: WorkflowProgress) {
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
        icon: b.icon === 'start' ? '🚀' : b.icon === 'end' ? '🏁' : b.icon === 'location' ? '📍' : b.icon === 'camera' ? '📷' : b.icon === 'form' ? '📋' : b.icon === 'checklist' ? '✅' : b.icon === 'question' ? '❓' : b.icon === 'note' ? '📝' : b.icon === 'signature' ? '✍️' : b.icon === 'tools' ? '🔧' : b.icon,
        requirePhoto: false,
        requireNote: false,
        completed: b.completed,
        completedAt: b.completedAt,
        note: b.note,
        photoUrl: b.photoUrl,
      })),
    };
  }
  return {
    templateName: wf.templateName,
    totalSteps: wf.totalSteps,
    completedSteps: wf.completedSteps,
    isComplete: wf.isComplete,
    currentStep: wf.currentStep,
    steps: wf.steps,
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
};

const EVENT_LABELS: Record<string, string> = {
  WORKFLOW_STEP_COMPLETED: "Passo do fluxo concluído",
  WORKFLOW_COMPLETED: "Fluxo concluído",
  STATUS_CHANGE: "Status alterado",
  ASSIGNED: "Técnico atribuído",
  CREATED: "OS criada",
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
  const [evalScore, setEvalScore] = useState(0);
  const [evalHover, setEvalHover] = useState(0);
  const [evalComment, setEvalComment] = useState("");
  const [evalSubmitting, setEvalSubmitting] = useState(false);

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

  // Mapa interativo
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

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

  // ── Gestor Evaluation handler ──
  async function handleEvaluation() {
    if (evalScore < 1) {
      toast("Selecione uma nota de 1 a 5.", "error");
      return;
    }
    if (!order?.assignedPartnerId) {
      toast("Nenhum técnico atribuído.", "error");
      return;
    }
    setEvalSubmitting(true);
    try {
      await api.post("/evaluations/gestor", {
        serviceOrderId: order.id,
        partnerId: order.assignedPartnerId,
        score: evalScore,
        comment: evalComment || undefined,
      });
      toast("Avaliação enviada com sucesso!", "success");
      await loadOrder();
    } catch (err) {
      if (err instanceof ApiError) {
        toast(err.payload?.message || err.message, "error");
      } else {
        toast("Erro ao enviar avaliação.", "error");
      }
    } finally {
      setEvalSubmitting(false);
    }
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
        <Link href="/orders" className="hover:text-blue-600">
          Ordens de Serviço
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

      {/* ── Gestor Evaluation (only when CONCLUIDA) ── */}
      {order.status === "CONCLUIDA" && order.assignedPartnerId && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <svg className="h-4 w-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Avaliação do Técnico
          </h3>

          {/* Star rating */}
          <div className="mb-4">
            <label className="block text-xs text-slate-500 mb-2">Nota</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setEvalScore(star)}
                  onMouseEnter={() => setEvalHover(star)}
                  onMouseLeave={() => setEvalHover(0)}
                  className="focus:outline-none transition-transform hover:scale-110"
                  aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
                >
                  <svg
                    className={`h-8 w-8 transition-colors ${
                      star <= (evalHover || evalScore)
                        ? "text-yellow-400"
                        : "text-slate-200"
                    }`}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              ))}
              {evalScore > 0 && (
                <span className="ml-2 text-sm font-medium text-slate-600">
                  {evalScore}/5
                </span>
              )}
            </div>
          </div>

          {/* Comment */}
          <div className="mb-4">
            <label className="block text-xs text-slate-500 mb-1">
              Comentário (opcional)
            </label>
            <textarea
              value={evalComment}
              onChange={(e) => setEvalComment(e.target.value)}
              rows={3}
              placeholder="Descreva sua experiência com o técnico..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none"
            />
          </div>

          {/* Submit button */}
          <button
            onClick={handleEvaluation}
            disabled={evalSubmitting || evalScore < 1}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {evalSubmitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Enviando...
              </>
            ) : (
              "Aprovar e Avaliar"
            )}
          </button>
        </div>
      )}

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
                        : "border-slate-200 bg-white hover:bg-slate-50"
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

      {/* ── Workflow Progress ── */}
      {workflow ? (() => {
        const wfn = normaliseWfSteps(workflow);
        return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Fluxo: {wfn.templateName}
            </h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              wfn.isComplete ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
            }`}>
              {wfn.completedSteps}/{wfn.totalSteps} passos
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full bg-slate-100 mb-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                wfn.isComplete
                  ? "bg-green-500"
                  : "bg-gradient-to-r from-blue-500 to-blue-600"
              }`}
              style={{ width: `${wfn.totalSteps > 0 ? (wfn.completedSteps / wfn.totalSteps) * 100 : 0}%` }}
            />
          </div>

          {/* Steps timeline */}
          <div className="relative">
            {wfn.steps.map((step, idx) => {
              const isLast = idx === wfn.steps.length - 1;
              return (
                <div key={step.order} className="flex gap-3 relative">
                  {/* Vertical line */}
                  {!isLast && (
                    <div className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${
                      step.completed ? "bg-green-200" : "bg-slate-100"
                    }`} />
                  )}

                  {/* Circle / icon */}
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 text-sm z-10 ${
                    step.completed
                      ? "bg-green-100 text-green-600"
                      : !step.completed && idx === wfn.completedSteps
                        ? "bg-blue-100 text-blue-600 ring-2 ring-blue-300"
                        : "bg-slate-100 text-slate-400"
                  }`}>
                    {step.completed ? "✓" : step.icon || `${idx + 1}`}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 pb-4 ${isLast ? "" : ""}`}>
                    <p className={`text-sm font-medium ${
                      step.completed ? "text-slate-800" : "text-slate-500"
                    }`}>
                      {step.name}
                    </p>
                    {step.completed && step.completedAt && (
                      <p className="text-[11px] text-slate-400">
                        {new Date(step.completedAt).toLocaleString("pt-BR")}
                      </p>
                    )}
                    {step.note && (
                      <p className="text-[11px] text-slate-500 mt-0.5">📝 {step.note}</p>
                    )}
                    {!step.completed && idx === wfn.completedSteps && (
                      <p className="text-[11px] text-blue-500 font-medium">← Próximo passo</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        );
      })() : order.workflowTemplateId ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6 text-center">
          <p className="text-sm text-slate-400">Carregando fluxo de atendimento...</p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 mb-6 text-center text-sm text-slate-400">
          Esta OS não possui fluxo de atendimento configurado.
        </div>
      )}

      {/* ── Fotos ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">📷 Fotos</h3>
        {(() => {
          const apiBase = "/api";
          const antes = (order.attachments || []).filter((a) => a.type === "ANTES");
          const depois = (order.attachments || []).filter((a) => a.type === "DEPOIS");
          const workflow = (order.attachments || []).filter((a) => a.type === "WORKFLOW_STEP");
          const hasAny = antes.length > 0 || depois.length > 0 || workflow.length > 0;

          if (!hasAny) {
            return <p className="text-sm text-slate-400">Nenhuma foto registrada.</p>;
          }

          return (
            <div className="space-y-4">
              {antes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Antes ({antes.length})</p>
                  <div className="flex gap-2 flex-wrap">
                    {antes.map((a) => (
                      <img key={a.id} src={`${apiBase}${a.url}`} alt={a.fileName} className="h-24 w-24 rounded-xl object-cover border border-slate-200" />
                    ))}
                  </div>
                </div>
              )}
              {depois.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Depois ({depois.length})</p>
                  <div className="flex gap-2 flex-wrap">
                    {depois.map((a) => (
                      <img key={a.id} src={`${apiBase}${a.url}`} alt={a.fileName} className="h-24 w-24 rounded-xl object-cover border border-slate-200" />
                    ))}
                  </div>
                </div>
              )}
              {workflow.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Passos do fluxo ({workflow.length})</p>
                  <div className="flex gap-2 flex-wrap">
                    {workflow.map((a) => (
                      <div key={a.id} className="relative">
                        <img src={`${apiBase}${a.url}`} alt={a.fileName} className="h-24 w-24 rounded-xl object-cover border border-slate-200" />
                        {a.stepOrder != null && (
                          <span className="absolute bottom-1 right-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                            Passo {a.stepOrder}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Histórico de Eventos */}
      {order.events && order.events.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Histórico de Eventos</h3>
          <div className="space-y-2">
            {order.events.map((event) => (
              <div key={event.id} className="flex items-start gap-3 border-b border-slate-50 pb-2 last:border-0">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-500 flex-shrink-0 mt-0.5">
                  {event.actorType === "TECNICO" ? "🔧" : "👤"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700">
                    {EVENT_LABELS[event.type] || event.type}
                    {event.payload?.stepName && (
                      <span className="text-slate-500"> — {event.payload.stepName}</span>
                    )}
                    {event.payload?.completedSteps && event.payload?.totalSteps && (
                      <span className="text-slate-400"> ({event.payload.completedSteps}/{event.payload.totalSteps})</span>
                    )}
                  </p>
                  <p className="text-[10px] text-slate-400">{formatDateTime(event.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
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
    </div>
  );
}
