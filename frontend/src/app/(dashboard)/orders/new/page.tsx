"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useDispatch } from "@/contexts/DispatchContext";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import LookupField from "@/components/ui/LookupField";
import type { LookupFetcher, LookupFetcherResult } from "@/components/ui/SearchLookupModal";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import TechAssignmentSection, {
  type TechAssignmentMode,
  type SpecializationSummary,
  type TechnicianSummary,
  type WorkflowSummary,
} from "@/components/os/TechAssignmentSection";
import AgendaSelector, { type AgendaSelection } from "@/components/os/AgendaSelector";
import TechReviewModal, { type TechCandidate } from "@/components/os/TechReviewModal";
import ServiceItemsSection, { type ServiceItemRow } from "@/components/os/ServiceItemsSection";
import DateTimePicker from "@/components/ui/DateTimePicker";
import {
  STATES,
  STATE_NAMES,
  maskCep,
  lookupCep,
  fetchCitiesByState,
  geocodeAddress,
  composeAddressText,
  toTitleCase,
  type IBGECity,
} from "@/lib/brazil-utils";

/* ---- Types ---- */
type PartnerSummary = {
  id: string; name: string; document: string | null; phone: string | null;
  cep: string | null; addressStreet: string | null; addressNumber: string | null;
  addressComp: string | null; neighborhood: string | null; city: string | null; state: string | null;
  ie: string | null; ieStatus: string | null; isRuralProducer: boolean;
};
type ObraSummary = { id: string; name: string; cno: string; city: string; state: string; active: boolean };
type ServiceAddressSummary = {
  id: string; label: string;
  cep: string | null; addressStreet: string; addressNumber: string | null;
  addressComp: string | null; neighborhood: string | null; city: string; state: string;
};

/* ---- Fetcher (module-level, stable ref) ---- */
const clientFetcher: LookupFetcher<PartnerSummary> = async (search, page, signal) => {
  const params = new URLSearchParams({ type: "CLIENTE", page: String(page), limit: "20" });
  if (search) params.set("search", search);
  return api.get<LookupFetcherResult<PartnerSummary>>(
    `/partners?${params.toString()}`,
    { signal },
  );
};

/* ---- Input class ---- */
const inputClass =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

const STATUS_LABELS: Record<string, string> = {
  ABERTA: "Aberta", OFERTADA: "Ofertada", ATRIBUIDA: "Atribuída",
  EM_EXECUCAO: "Em Execução", CONCLUIDA: "Concluída", APROVADA: "Aprovada",
  AJUSTE: "Ajuste", CANCELADA: "Cancelada", RECUSADA: "Recusada",
};
const STATUS_COLORS: Record<string, string> = {
  ABERTA: "bg-yellow-100 text-yellow-800 border-yellow-200",
  OFERTADA: "bg-orange-100 text-orange-800 border-orange-200",
  ATRIBUIDA: "bg-blue-100 text-blue-800 border-blue-200",
  EM_EXECUCAO: "bg-indigo-100 text-indigo-800 border-indigo-200",
  CONCLUIDA: "bg-green-100 text-green-800 border-green-200",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  AJUSTE: "bg-amber-100 text-amber-800 border-amber-200",
  CANCELADA: "bg-slate-100 text-slate-600 border-slate-200",
  RECUSADA: "bg-red-100 text-red-800 border-red-200",
};
const TERMINAL_STATUSES = ["CONCLUIDA", "APROVADA", "CANCELADA", "RECUSADA"];

function formatDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewOrderPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><svg className="h-8 w-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>}>
      <NewOrderPage />
    </Suspense>
  );
}

/** Shared order form — used for both create and edit */
export function OrderForm({ editId }: { editId?: string }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><svg className="h-8 w-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>}>
      <NewOrderPage editId={editId} />
    </Suspense>
  );
}

function NewOrderPage({ editId }: { editId?: string } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addDispatch } = useDispatch();
  const { toast } = useToast();
  const returnFromId = searchParams.get("returnFrom");
  const fromQuoteId = searchParams.get("fromQuote");
  const [returnLoading, setReturnLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tech Review Modal
  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    orderId: string;
    orderCode: string;
    orderTitle: string;
    candidates: TechCandidate[];
    allowEdit: boolean;
  }>({ open: false, orderId: "", orderCode: "", orderTitle: "", candidates: [], allowEdit: false });
  const [selectedClient, setSelectedClient] = useState<PartnerSummary | null>(null);
  const [ieWarning, setIeWarning] = useState<{ type: "error" | "warning" | "success"; message: string } | null>(null);
  const [obras, setObras] = useState<ObraSummary[]>([]);
  const [selectedObraId, setSelectedObraId] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<IBGECity | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [geocodingMsg, setGeocodingMsg] = useState<string | null>(null);

  // Tech assignment states
  const [techMode, setTechMode] = useState<TechAssignmentMode>("BY_SPECIALIZATION");
  const [selectedSpecs, setSelectedSpecs] = useState<SpecializationSummary[]>([]);
  const [selectedTechs, setSelectedTechs] = useState<TechnicianSummary[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowSummary | null>(null);

  // Agenda CLT — triggered only when workflow has scheduleConfig enabled
  const [agendaSelection, setAgendaSelection] = useState<AgendaSelection | null>(null);
  const [scheduleConfig, setScheduleConfig] = useState<{
    defaultDurationMinutes: number;
    workingHours: { start: string; end: string };
    workingDays: number[];
  } | null>(null);

  // Fetch schedule config from selected workflow
  useEffect(() => {
    if (techMode !== "BY_WORKFLOW" || !selectedWorkflow) {
      setScheduleConfig(null);
      setAgendaSelection(null);
      return;
    }
    let cancelled = false;
    api.get<{ definition: string }>(`/workflows/${selectedWorkflow.id}`)
      .then(res => {
        if (cancelled) return;
        try {
          const def = typeof res.definition === "string" ? JSON.parse(res.definition) : res.definition;
          if (def?.version === 2 && Array.isArray(def.blocks)) {
            const schedBlock = def.blocks.find((b: { type: string }) => b.type === "SCHEDULE_CONFIG");
            if (schedBlock?.data?.enabled) {
              setScheduleConfig({
                defaultDurationMinutes: schedBlock.data.defaultDurationMinutes || 60,
                workingHours: schedBlock.data.workingHours || { start: "08:00", end: "18:00" },
                workingDays: schedBlock.data.workingDays || [1, 2, 3, 4, 5],
              });
              return;
            }
          }
        } catch { /* ignore parse errors */ }
        setScheduleConfig(null);
        setAgendaSelection(null);
      })
      .catch(() => {
        if (!cancelled) setScheduleConfig(null);
      });
    return () => { cancelled = true; };
  }, [techMode, selectedWorkflow]);
  const hasAgendaFromWorkflow = techMode === "BY_WORKFLOW" && !!scheduleConfig;

  // Service items
  const [serviceItems, setServiceItems] = useState<ServiceItemRow[]>([]);

  // Agendamento toggle
  const [agendamentoEnabled, setAgendamentoEnabled] = useState(false);

  // Service address states
  const [serviceAddresses, setServiceAddresses] = useState<ServiceAddressSummary[]>([]);
  const [addressSource, setAddressSource] = useState<"main" | "saved" | "new">("new");
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [newAddressLabel, setNewAddressLabel] = useState("");

  // Return states
  const [isReturn, setIsReturn] = useState(false);
  const [returnPaidToTech, setReturnPaidToTech] = useState(true);
  const [isEvaluation, setIsEvaluation] = useState(false);
  const [showZeroValueConfirm, setShowZeroValueConfirm] = useState(false);

  // Helper: parse BRL string "150,00" → 150.00
  function parseBRL(s: string): number { return parseFloat((s || "0").replace(/[^\d,]/g, "").replace(",", ".")); }

  // Buscar obras + enderecos de atendimento do cliente selecionado
  useEffect(() => {
    setObras([]);
    setSelectedObraId("");
    setServiceAddresses([]);
    setAddressSource("new");
    setSelectedAddressId("");
    setNewAddressLabel("");
    if (!selectedClient) return;
    let cancelled = false;
    api.get<ObraSummary[]>(`/obras?partnerId=${selectedClient.id}&activeOnly=true`)
      .then(res => { if (!cancelled) setObras(Array.isArray(res) ? res : []); })
      .catch(() => {});
    api.get<ServiceAddressSummary[]>(`/service-addresses?partnerId=${selectedClient.id}&activeOnly=true`)
      .then(res => {
        if (cancelled) return;
        const addrs = Array.isArray(res) ? res : [];
        setServiceAddresses(addrs);
        if (addrs.length > 0) {
          const last = addrs[0];
          setAddressSource("saved");
          setSelectedAddressId(last.id);
          fillAddress(last);
        } else if (selectedClient.addressStreet) {
          setAddressSource("main");
          fillAddress(selectedClient);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedClient]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    state: "",
    cep: "",
    addressStreet: "",
    addressNumber: "",
    addressComp: "",
    neighborhood: "",
    contactPersonName: "",
    deadlineAt: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T17:00`; })(),
    scheduledStartAt: "",
    estimatedDurationMinutes: "",
  });

  // ── Edit-mode states ──
  const isEditMode = !!editId;
  const [editLoading, setEditLoading] = useState(!!editId);
  const [status, setStatus] = useState("");
  const [isTerminal, setIsTerminal] = useState(false);
  const [editSysConfig, setEditSysConfig] = useState<any>(null);
  const [acceptTimeoutMode, setAcceptTimeoutMode] = useState<'minutes' | 'hours' | 'from_flow'>('from_flow');
  const [acceptTimeoutValue, setAcceptTimeoutValue] = useState<number>(60);
  const [enRouteTimeoutMode, setEnRouteTimeoutMode] = useState<'minutes' | 'hours' | 'from_flow'>('from_flow');
  const [enRouteTimeoutValue, setEnRouteTimeoutValue] = useState<number>(30);

  // Field restrictions by status
  const lockedFields = (() => {
    if (!isEditMode || !status) return { client: false, address: false, services: false, techMode: false, title: false };
    switch (status) {
      case "OFERTADA":
        return { client: false, address: false, services: false, techMode: true, title: false };
      case "ATRIBUIDA":
      case "AJUSTE":
        return { client: true, address: true, services: false, techMode: true, title: false };
      case "EM_EXECUCAO":
        return { client: true, address: true, services: false, techMode: true, title: false };
      default: // ABERTA
        return { client: false, address: false, services: false, techMode: false, title: false };
    }
  })();

  // Load existing OS for edit mode
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      try {
        const order = await api.get<any>(`/service-orders/${editId}`);
        if (cancelled) return;

        setStatus(order.status);
        // Check if terminal status is editable via system config
        if (TERMINAL_STATUSES.includes(order.status)) {
          try {
            const cfg = await api.get<any>("/companies/system-config");
            setEditSysConfig(cfg);
            const canEditTerminal =
              (order.status === "CONCLUIDA" && cfg?.os?.allowEditConcluida) ||
              (order.status === "APROVADA" && cfg?.os?.allowEditAprovada);
            setIsTerminal(!canEditTerminal);
          } catch {
            setIsTerminal(true);
          }
        } else {
          setIsTerminal(false);
        }

        setForm({
          title: order.title || "",
          description: order.description || "",
          state: order.state || "",
          cep: order.cep ? maskCep(order.cep) : "",
          addressStreet: order.addressStreet || (order.state ? "" : order.addressText || ""),
          addressNumber: order.addressNumber || "",
          addressComp: order.addressComp || "",
          neighborhood: order.neighborhood || "",
          contactPersonName: order.contactPersonName || "",
          deadlineAt: order.deadlineAt ? formatDatetimeLocal(order.deadlineAt) : "",
          scheduledStartAt: order.scheduledStartAt ? formatDatetimeLocal(order.scheduledStartAt) : "",
          estimatedDurationMinutes: order.estimatedDurationMinutes != null ? String(order.estimatedDurationMinutes) : "",
        });

        // Service items — re-fetch from catalog to get updated names/prices
        if (order.items?.length) {
          const serviceIds = [...new Set(order.items.map((i: any) => i.serviceId).filter(Boolean))];
          let catalogMap: Record<string, any> = {};
          // Fetch each service from catalog (usually 1-5 items)
          await Promise.all(serviceIds.map(async (sid: string) => {
            try {
              const s = await api.get<any>(`/services/${sid}`);
              if (s) catalogMap[s.id] = s;
            } catch { /* service may have been deleted — use OS data */ }
          }));
          setServiceItems(order.items.map((item: any) => {
            const catalog = catalogMap[item.serviceId];
            return {
              serviceId: item.serviceId,
              serviceName: catalog?.name || item.serviceName,
              unit: catalog?.unit || item.unit,
              unitPriceCents: catalog?.priceCents ?? item.unitPriceCents,
              commissionBps: catalog?.commissionBps ?? item.commissionBps ?? null,
              quantity: item.quantity || 1,
            };
          }));
        }

        // Timeouts
        if (order.acceptTimeoutMinutes != null) {
          const mins = order.acceptTimeoutMinutes;
          if (mins >= 60 && mins % 60 === 0) { setAcceptTimeoutMode('hours'); setAcceptTimeoutValue(mins / 60); }
          else { setAcceptTimeoutMode('minutes'); setAcceptTimeoutValue(mins); }
        }
        if (order.enRouteTimeoutMinutes != null) {
          const mins = order.enRouteTimeoutMinutes;
          if (mins >= 60 && mins % 60 === 0) { setEnRouteTimeoutMode('hours'); setEnRouteTimeoutValue(mins / 60); }
          else { setEnRouteTimeoutMode('minutes'); setEnRouteTimeoutValue(mins); }
        }

        // Return
        if (order.isReturn) setIsReturn(true);
        if (order.returnPaidToTech === false) setReturnPaidToTech(false);

        // Client — re-fetch to get latest data (name, address, phone changes)
        if (order.clientPartner?.id) {
          try {
            const freshClient = await api.get<any>(`/partners/${order.clientPartner.id}`);
            setSelectedClient({
              id: freshClient.id, name: freshClient.name,
              document: freshClient.document || null, phone: freshClient.phone || null,
              cep: freshClient.cep || null, addressStreet: freshClient.addressStreet || null,
              addressNumber: freshClient.addressNumber || null, addressComp: freshClient.addressComp || null,
              neighborhood: freshClient.neighborhood || null, city: freshClient.city || null,
              state: freshClient.state || null,
              ie: freshClient.ie || null, ieStatus: freshClient.ieStatus || null,
              isRuralProducer: freshClient.isRuralProducer ?? false,
            });
          } catch {
            // Fallback to OS snapshot
            setSelectedClient({
              id: order.clientPartner.id, name: order.clientPartner.name,
              document: order.clientPartner.document || null, phone: order.clientPartner.phone || null,
              cep: order.clientPartner.cep || null, addressStreet: order.clientPartner.addressStreet || null,
              addressNumber: order.clientPartner.addressNumber || null, addressComp: order.clientPartner.addressComp || null,
              neighborhood: order.clientPartner.neighborhood || null, city: order.clientPartner.city || null,
              state: order.clientPartner.state || null,
              ie: order.clientPartner.ie || null, ieStatus: order.clientPartner.ieStatus || null,
              isRuralProducer: order.clientPartner.isRuralProducer ?? false,
            });
          }
        }

        // Tech assignment
        if (order.techAssignmentMode) setTechMode(order.techAssignmentMode as TechAssignmentMode);
        if (order.requiredSpecializationIds?.length) {
          try {
            const res = await api.get<any>("/specializations?limit=100");
            const allSpecs: SpecializationSummary[] = Array.isArray(res) ? res : res.data || [];
            setSelectedSpecs(allSpecs.filter(s => order.requiredSpecializationIds.includes(s.id)));
          } catch { /* ignore */ }
        }
        if (order.directedTechnicianIds?.length) {
          try {
            const res = await api.get<any>("/partners?limit=100&type=TECNICO");
            const allTechs: TechnicianSummary[] = Array.isArray(res) ? res : res.data || [];
            setSelectedTechs(allTechs.filter(t => order.directedTechnicianIds.includes(t.id)));
          } catch { /* ignore */ }
        }
        if (order.workflowTemplateId && order.workflowTemplate) {
          setSelectedWorkflow({ id: order.workflowTemplate.id, name: order.workflowTemplate.name });
        }

        // City
        if (order.state && order.city) {
          try {
            const cities = await fetchCitiesByState(order.state);
            const found = cities.find((c: IBGECity) => c.nome.toLowerCase() === order.city.toLowerCase());
            if (found) setSelectedCity(found);
          } catch { /* ignore */ }
        }

        // Obra
        if (order.obraId) setSelectedObraId(order.obraId);

        // Agendamento
        if (order.scheduledStartAt) setAgendamentoEnabled(true);
      } catch {
        setError("Erro ao carregar OS");
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editId]);

  // Load original OS for return pre-population
  useEffect(() => {
    if (!returnFromId) return;
    let cancelled = false;
    setReturnLoading(true);
    (async () => {
      try {
        const orig = await api.get<any>(`/service-orders/${returnFromId}`);
        if (cancelled) return;

        setForm(f => ({
          ...f,
          title: `Retorno: ${orig.title || ""}`,
          state: orig.state || "",
          cep: orig.cep ? maskCep(orig.cep) : "",
          addressStreet: orig.addressStreet || "",
          addressNumber: orig.addressNumber || "",
          addressComp: orig.addressComp || "",
          neighborhood: orig.neighborhood || "",
          contactPersonName: orig.contactPersonName || "",
          deadlineAt: "",
          scheduledStartAt: "",
          estimatedDurationMinutes: "",
        }));

        // Pre-populate items from original OS if available
        if (orig.items?.length) {
          setServiceItems(orig.items.map((item: any) => ({
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            unit: item.unit,
            unitPriceCents: item.unitPriceCents,
            commissionBps: item.commissionBps ?? null,
            quantity: item.quantity || 1,
          })));
        }

        setIsReturn(true);
        setReturnPaidToTech(true);

        if (orig.clientPartnerId) {
          try {
            const client = await api.get<PartnerSummary>(`/partners/${orig.clientPartnerId}`);
            if (!cancelled) setSelectedClient(client);
          } catch { /* ignore */ }
        }

        if (orig.state && orig.city) {
          try {
            const cities = await fetchCitiesByState(orig.state);
            const found = cities.find((c: IBGECity) => c.nome.toLowerCase() === orig.city.toLowerCase());
            if (found && !cancelled) setSelectedCity(found);
          } catch { /* ignore */ }
        }

        if (orig.obraId) setSelectedObraId(orig.obraId);

        if (orig.assignedPartnerId && orig.assignedPartner) {
          setTechMode("DIRECTED");
          setSelectedTechs([{
            id: orig.assignedPartner.id,
            name: orig.assignedPartner.name,
            phone: orig.assignedPartner.phone || null,
          }]);
        }

        setTimeout(() => {
          const el = document.getElementById("return-section");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 600);
      } catch { /* ignore load errors */ }
      finally { if (!cancelled) setReturnLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [returnFromId]);

  // Load quote data for "Convert quote to OS" pre-population
  useEffect(() => {
    if (!fromQuoteId) return;
    let cancelled = false;
    setReturnLoading(true);
    (async () => {
      try {
        const quote = await api.get<any>(`/quotes/${fromQuoteId}`);
        if (cancelled) return;

        setForm(f => ({
          ...f,
          title: quote.title || "",
          description: quote.description || "",
        }));

        // Pre-populate items from quote
        if (quote.items?.length) {
          const sorted = [...quote.items].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
          setServiceItems(sorted
            .filter((item: any) => item.serviceId)
            .map((item: any) => ({
              serviceId: item.serviceId,
              serviceName: item.description,
              unit: item.unit || "SV",
              unitPriceCents: item.unitPriceCents,
              commissionBps: null,
              quantity: item.quantity || 1,
            }))
          );
        }

        // Pre-select client
        if (quote.clientPartnerId) {
          try {
            const client = await api.get<PartnerSummary>(`/partners/${quote.clientPartnerId}`);
            if (!cancelled) setSelectedClient(client);
          } catch { /* ignore */ }
        }
      } catch { /* ignore load errors */ }
      finally { if (!cancelled) setReturnLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [fromQuoteId]);

  function onChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;

    if (name === "state") {
      setSelectedCity(null);
      setForm((f) => ({ ...f, state: value }));
      return;
    }

    if (name === "cep") {
      const masked = maskCep(value);
      setForm((f) => ({ ...f, cep: masked }));
      const digits = masked.replace(/\D/g, "");
      if (digits.length === 8) handleCepLookup(digits);
      return;
    }

    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleCepLookup(digits: string) {
    setCepLoading(true);
    try {
      const result = await lookupCep(digits);
      if (result) {
        setForm((f) => ({
          ...f,
          addressStreet: result.logradouro || f.addressStreet,
          neighborhood: result.bairro || f.neighborhood,
          state: result.uf || f.state,
        }));
        if (result.uf && result.localidade) {
          const cities = await fetchCitiesByState(result.uf);
          const found = cities.find(
            (c) => c.nome.toLowerCase() === result.localidade.toLowerCase()
          );
          if (found) setSelectedCity(found);
        }
      }
    } catch { /* ignore */ }
    finally { setCepLoading(false); }
  }

  async function fillAddress(addr: { state?: string | null; cep?: string | null; addressStreet?: string | null; addressNumber?: string | null; addressComp?: string | null; neighborhood?: string | null; city?: string | null }) {
    const updates: Partial<typeof form> = {};
    if (addr.state) updates.state = addr.state;
    if (addr.cep) updates.cep = maskCep(addr.cep);
    if (addr.addressStreet) updates.addressStreet = addr.addressStreet;
    if (addr.addressNumber) updates.addressNumber = addr.addressNumber;
    if (addr.addressComp) updates.addressComp = addr.addressComp || "";
    if (addr.neighborhood) updates.neighborhood = addr.neighborhood;
    setForm((f) => ({ ...f, ...updates }));
    if (addr.state && addr.city) {
      try {
        const cities = await fetchCitiesByState(addr.state);
        const found = cities.find((c) => c.nome.toLowerCase() === addr.city!.toLowerCase());
        if (found) setSelectedCity(found);
      } catch { /* ignore */ }
    }
  }

  function handleAddressSourceChange(source: "main" | "saved" | "new", addrId?: string) {
    setAddressSource(source);
    if (source === "main" && selectedClient) {
      setSelectedAddressId("");
      fillAddress(selectedClient);
    } else if (source === "saved" && addrId) {
      setSelectedAddressId(addrId);
      const addr = serviceAddresses.find(a => a.id === addrId);
      if (addr) fillAddress(addr);
    } else if (source === "new") {
      setSelectedAddressId("");
      setForm(f => ({ ...f, state: "", cep: "", addressStreet: "", addressNumber: "", addressComp: "", neighborhood: "" }));
      setSelectedCity(null);
    }
  }

  const cityFetcher: LookupFetcher<IBGECity> = useCallback(
    async (search, page, signal) => {
      if (!form.state) {
        return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
      }
      const allCities = await fetchCitiesByState(form.state);
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");

      let filtered = allCities;
      if (search) {
        const lower = search.toLowerCase();
        filtered = allCities.filter((c) => c.nome.toLowerCase().includes(lower));
      }

      const limit = 20;
      const start = (page - 1) * limit;
      const data = filtered.slice(start, start + limit);

      return {
        data,
        meta: {
          total: filtered.length,
          page,
          limit,
          totalPages: Math.ceil(filtered.length / limit),
        },
      };
    },
    [form.state],
  );

  // Computed values from service items
  const totalValueCents = serviceItems.reduce((sum, i) => sum + Math.round(i.unitPriceCents * i.quantity), 0);
  const totalCommissionCents = serviceItems.reduce((sum, i) => {
    const bps = i.commissionBps ?? 0;
    return sum + Math.round((i.unitPriceCents * i.quantity * bps) / 10000);
  }, 0);
  const weightedCommissionBps = totalValueCents > 0
    ? Math.round((totalCommissionCents / totalValueCents) * 10000)
    : 0;

  async function checkClientIe(client: PartnerSummary) {
    if (!client.ie || !client.state) return;
    // Show stored status immediately
    if (client.ieStatus && client.ieStatus !== "ATIVA") {
      setIeWarning({
        type: "error",
        message: `Atenção: IE ${client.ie} do cliente ${client.name} está ${client.ieStatus === "INATIVA" ? "INATIVA" : "NÃO HABILITADA"} na SEFAZ.`,
      });
    }
    // Background live check
    try {
      const cpfDigits = client.document?.replace(/\D/g, "") || "";
      if (cpfDigits.length < 11) return;
      const params = new URLSearchParams({ cpf: cpfDigits, uf: client.state });
      const result = await api.get<{ ieStatus: string; ie: string }>(`/partners/sefaz-lookup?${params}`);
      if (result.ieStatus === "ATIVA") {
        setIeWarning({ type: "success", message: `IE ${result.ie} do cliente ${client.name} está ATIVA na SEFAZ.` });
        // Clear success message after 5s
        setTimeout(() => setIeWarning((prev) => prev?.type === "success" ? null : prev), 5000);
      } else {
        setIeWarning({
          type: "error",
          message: `Atenção: IE ${result.ie} do cliente ${client.name} está ${result.ieStatus === "INATIVA" ? "INATIVA" : "NÃO HABILITADA"} na SEFAZ. Verifique antes de prosseguir.`,
        });
      }
    } catch {
      // Silently fail — don't block OS creation if SEFAZ check fails
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);
    setGeocodingMsg(null);

    try {
      if (!selectedClient) {
        setError("Selecione um cliente");
        setLoading(false);
        return;
      }

      if (serviceItems.length === 0) {
        setError("Adicione pelo menos um serviço");
        setLoading(false);
        return;
      }

      // Check zero quantity
      const zeroQtyItem = serviceItems.find(i => !i.quantity || i.quantity <= 0);
      if (zeroQtyItem) {
        setError(`O serviço "${zeroQtyItem.serviceName}" está com quantidade zero. Informe a quantidade.`);
        setLoading(false);
        return;
      }

      // Check zero value
      if (totalValueCents <= 0 && !showZeroValueConfirm) {
        try {
          const cfg = await api.get<any>("/companies/system-config");
          if (cfg?.os?.allowZeroValueOs) {
            // Toggle ON: show confirmation modal (user can proceed)
            setShowZeroValueConfirm(true);
            setLoading(false);
            return;
          } else {
            // Toggle OFF: block creation
            setError("O valor total dos servicos deve ser maior que zero. Ative 'Permitir OS com valor zero' em Configuracoes > Sistema para criar OS sem valor.");
            setLoading(false);
            return;
          }
        } catch {
          setError("O valor total dos servicos deve ser maior que zero");
          setLoading(false);
          return;
        }
      }
      setShowZeroValueConfirm(false);

      // Calculate commission
      let finalCommissionBps = weightedCommissionBps;
      let finalTechCents = totalCommissionCents;

      if (isReturn && !returnPaidToTech) {
        finalCommissionBps = 0;
        finalTechCents = 0;
      }

      // Compose address
      const cityName = selectedCity?.nome || "";
      const addressText = composeAddressText({
        addressStreet: form.addressStreet,
        addressNumber: form.addressNumber,
        neighborhood: form.neighborhood,
        city: cityName,
        state: form.state,
      });

      if (!addressText) {
        setError("Preencha pelo menos a rua ou CEP do endereço");
        setLoading(false);
        return;
      }

      // Geocoding
      setGeocodingMsg("Obtendo coordenadas...");
      const coords = await geocodeAddress(addressText, {
        street: form.addressStreet,
        number: form.addressNumber,
        city: cityName,
        state: form.state,
      });
      setGeocodingMsg(null);

      // Validate agenda if workflow with scheduleConfig
      if (hasAgendaFromWorkflow) {
        if (!agendaSelection) {
          setError("Selecione um técnico, data e hora na agenda");
          setLoading(false);
          return;
        }
      }

      // Save new service address if label filled
      if (addressSource === "new" && newAddressLabel.trim() && selectedClient) {
        try {
          await api.post("/service-addresses", {
            partnerId: selectedClient.id,
            label: newAddressLabel.trim(),
            cep: form.cep ? form.cep.replace(/\D/g, "") : null,
            addressStreet: form.addressStreet,
            addressNumber: form.addressNumber || null,
            addressComp: form.addressComp || null,
            neighborhood: form.neighborhood || null,
            city: cityName,
            state: form.state,
          });
        } catch { /* don't block OS creation */ }
      }

      const payload: Record<string, any> = {
        title: form.title,
        addressText,
        lat: coords?.lat ?? undefined,
        lng: coords?.lng ?? undefined,
        valueCents: totalValueCents,
        deadlineAt: new Date(form.deadlineAt).toISOString(),
        clientPartnerId: selectedClient.id,
        // Structured address fields
        addressStreet: form.addressStreet || undefined,
        addressNumber: form.addressNumber || undefined,
        addressComp: form.addressComp || undefined,
        neighborhood: form.neighborhood || undefined,
        city: cityName || undefined,
        state: form.state || undefined,
        cep: form.cep ? form.cep.replace(/\D/g, "") : undefined,
        // Tech assignment
        techAssignmentMode: techMode,
        requiredSpecializationIds: techMode === "BY_SPECIALIZATION" ? selectedSpecs.map((s) => s.id) : [],
        directedTechnicianIds: techMode === "DIRECTED" ? selectedTechs.map((t) => t.id) : [],
        workflowTemplateId: techMode === "BY_WORKFLOW" ? selectedWorkflow?.id || undefined : undefined,
        // Agenda CLT pre-assign
        ...(hasAgendaFromWorkflow && agendaSelection ? {
          assignedPartnerId: agendaSelection.technicianId,
        } : {}),
        // Scheduling (agenda CLT or manual toggle)
        scheduledStartAt: hasAgendaFromWorkflow && agendaSelection
          ? agendaSelection.scheduledStartAt
          : agendamentoEnabled && form.scheduledStartAt ? new Date(form.scheduledStartAt).toISOString() : undefined,
        estimatedDurationMinutes: hasAgendaFromWorkflow && agendaSelection
          ? agendaSelection.estimatedDurationMinutes
          : agendamentoEnabled && form.estimatedDurationMinutes ? parseInt(form.estimatedDurationMinutes) || undefined : undefined,
        // Contact
        contactPersonName: form.contactPersonName || undefined,
        // Obra
        obraId: selectedObraId || undefined,
        // Commission and return
        commissionBps: finalCommissionBps,
        techCommissionCents: finalTechCents,
        isReturn,
        returnPaidToTech: isReturn ? returnPaidToTech : true,
        isUrgent: false,
        isEvaluation,
        parentOrderId: returnFromId || undefined,
        // Service items
        items: serviceItems.map(i => ({ serviceId: i.serviceId, quantity: i.quantity })),
      };

      if (isEditMode) {
        // Edit-only fields
        payload.description = form.description || undefined;
        // Timeouts
        if (acceptTimeoutMode === 'from_flow') {
          payload.acceptTimeoutMinutes = null;
        } else {
          const mins = acceptTimeoutMode === 'hours' ? acceptTimeoutValue * 60 : acceptTimeoutValue;
          payload.acceptTimeoutMinutes = mins;
        }
        if (enRouteTimeoutMode === 'from_flow') {
          payload.enRouteTimeoutMinutes = null;
        } else {
          const mins = enRouteTimeoutMode === 'hours' ? enRouteTimeoutValue * 60 : enRouteTimeoutValue;
          payload.enRouteTimeoutMinutes = mins;
        }
        await api.put(`/service-orders/${editId}`, payload);
        router.push(`/orders/${editId}`);
      } else {
        const result = await api.post<any>("/service-orders", payload);

        // Link quote to created OS if converting from quote
        if (fromQuoteId && result?.id) {
          try {
            await api.post(`/quotes/${fromQuoteId}/link-os`, { serviceOrderId: result.id });
          } catch { /* non-blocking */ }
        }

        // Tech Review Modal: workflow has techReviewScreen enabled
        if (result?._pendingReview) {
          setReviewModal({
            open: true,
            orderId: result.id,
            orderCode: result.code || "",
            orderTitle: result.title || form.title,
            candidates: result._candidates || [],
            allowEdit: result._allowEdit ?? false,
          });
          setLoading(false);
          return;
        }

        // Dispatch panel: open floating card immediately
        // Workflow runs in background — panel shows initial state and updates via polling
        if (result?._dispatch) {
          const d = result._dispatch;
          addDispatch(result.id, {
            technicianName: d.technicianName,
            technicianPhone: d.technicianPhone,
            notificationId: d.notificationId,
            notificationStatus: d.notificationStatus,
            notificationChannel: d.notificationChannel,
            errorDetail: d.errorDetail,
          }, result.code, result.title);
          toast("OS criada com sucesso!", "success");
        } else {
          // No _dispatch yet (workflow running in background) — open panel with basic info
          const techNames = selectedTechs.map((t: any) => t.name).join(", ");
          addDispatch(result.id, {
            technicianName: techNames || "Aguardando fluxo...",
            technicianPhone: "",
            notificationStatus: "PENDING",
            notificationChannel: "WHATSAPP",
          }, result.code, result.title);
          toast("OS criada! Fluxo de atendimento em execução...", "success");
        }

        router.push("/orders");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.payload?.message || err.message);
      } else {
        setError(isEditMode ? "Erro ao salvar OS" : "Erro ao criar OS");
      }
    } finally {
      setLoading(false);
      setGeocodingMsg(null);
    }
  }

  const handleReviewDispatched = (result: any) => {
    // After tech review dispatch, open floating card and navigate
    if (result?._dispatch) {
      const d = result._dispatch;
      addDispatch(reviewModal.orderId, {
        technicianName: d.technicianName,
        technicianPhone: d.technicianPhone,
        notificationId: d.notificationId,
        notificationStatus: d.notificationStatus,
        notificationChannel: d.notificationChannel,
        errorDetail: d.errorDetail,
      }, reviewModal.orderCode, reviewModal.orderTitle);

      if (d.notificationStatus === "FAILED") {
        toast(`Notificações disparadas, mas houve falha: ${d.errorDetail || "erro desconhecido"}`, "warning");
      } else {
        toast("Notificações disparadas com sucesso! ✓", "success");
      }
    } else {
      toast("Notificações disparadas com sucesso!", "success");
    }
    setReviewModal((prev) => ({ ...prev, open: false }));
    router.push("/orders");
  };

  const handleReviewClose = () => {
    // Close modal — OS already created, just not dispatched yet
    setReviewModal((prev) => ({ ...prev, open: false }));
    toast("OS criada. Notificações não foram disparadas.", "info");
    router.push("/orders");
  };

  if (editLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="h-8 w-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/orders" className="hover:text-blue-600">
          Ordens de Serviço
        </Link>
        <span>/</span>
        {isEditMode ? (
          <>
            <Link href={`/orders/${editId}`} className="hover:text-blue-600">
              {form.title || "OS"}
            </Link>
            <span>/</span>
            <span className="text-slate-900 font-medium">Editar</span>
          </>
        ) : (
          <span className="text-slate-900 font-medium">Nova OS</span>
        )}
      </div>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {isEditMode ? "Editar Ordem de Serviço" : returnFromId ? "Retorno de Atendimento" : fromQuoteId ? "Nova OS (do Orçamento)" : "Nova Ordem de Serviço"}
        </h1>
        {isEditMode && status && (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status] || "bg-slate-100 text-slate-600"}`}>
            {STATUS_LABELS[status] || status}
          </span>
        )}
      </div>

      {isTerminal && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Esta OS está em status final ({STATUS_LABELS[status] || status}). Não é possível editar.
        </div>
      )}

      {isEditMode && !isTerminal && TERMINAL_STATUSES.includes(status) && (
        <div className="mb-4 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-700">
          ⚠️ Editando OS em status <strong>{STATUS_LABELS[status] || status}</strong>. Alteracoes serao salvas diretamente.
        </div>
      )}

      {isEditMode && !isTerminal && (lockedFields.client || lockedFields.address || lockedFields.services || lockedFields.techMode) && (
        <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
          Alguns campos estão bloqueados porque a OS está em status &quot;{STATUS_LABELS[status] || status}&quot;.
        </div>
      )}

      {returnLoading && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
          <svg className="h-4 w-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-blue-700">Carregando dados da OS original...</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="space-y-4">

          {/* ─── 1. Cliente ─────────────────────────────────── */}
          <LookupField
            label="Cliente"
            placeholder="Selecione um cliente"
            modalTitle="Buscar Cliente"
            modalPlaceholder="Nome, documento ou telefone..."
            value={selectedClient}
            displayValue={(c) => c.name}
            onChange={(c) => { setSelectedClient(c); setAddressSource("new"); setIeWarning(null); if (c?.ie && c.state) checkClientIe(c); }}
            fetcher={clientFetcher}
            keyExtractor={(c) => c.id}
            required
            disabled={lockedFields.client}
            renderItem={(c) => (
              <div>
                <div className="font-medium text-slate-900">{c.name}</div>
                <div className="flex gap-3 text-xs text-slate-400 mt-0.5">
                  {c.document && <span>{c.document}</span>}
                  {c.phone && <span>{c.phone}</span>}
                </div>
              </div>
            )}
          />
          {ieWarning && (
            <div className={`rounded-lg border px-3 py-2 text-sm flex items-start gap-2 ${
              ieWarning.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : ieWarning.type === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-green-200 bg-green-50 text-green-700"
            }`}>
              <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span>{ieWarning.message}</span>
            </div>
          )}

          {/* ─── 2. Titulo ──────────────────────────────────── */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">Título *</span>
            <input
              name="title"
              value={form.title}
              onChange={onChange}
              onBlur={() => setForm((f) => ({ ...f, title: toTitleCase(f.title) }))}
              required
              disabled={lockedFields.title}
              placeholder="Ex: Manutenção ar-condicionado"
              className={`${inputClass} ${lockedFields.title ? "bg-slate-100 cursor-not-allowed" : ""}`}
            />
          </label>

          {/* ─── 2b. Descricao (edit mode) ──────────────────── */}
          {isEditMode && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">Descrição</span>
              <textarea
                name="description"
                value={form.description}
                onChange={onChange}
                rows={3}
                placeholder="Detalhes adicionais sobre o serviço, observações internas..."
                className={`${inputClass} resize-y`}
              />
            </label>
          )}

          {/* ─── 3. Endereco (sempre aberto, nao colapsavel) ─ */}
          <fieldset disabled={lockedFields.address} className={lockedFields.address ? "opacity-60" : ""}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-semibold text-slate-800">Endereço do Serviço</span>
              {lockedFields.address && <span className="text-xs text-amber-600 font-normal">(bloqueado neste status)</span>}
            </div>

            {/* Address source selector */}
            {selectedClient && (selectedClient.addressStreet || serviceAddresses.length > 0) && (
              <div className="space-y-1.5">
                {selectedClient.addressStreet && (
                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors select-none"
                    style={{ borderColor: addressSource === "main" ? "rgb(59 130 246)" : "rgb(226 232 240)" }}>
                    <input type="radio" name="addressSource" checked={addressSource === "main"}
                      onChange={() => handleAddressSourceChange("main")}
                      className="mt-0.5 text-blue-600 focus:ring-blue-200" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-700">Endereço do cadastro</span>
                      <p className="text-xs text-slate-500 truncate">
                        {[selectedClient.addressStreet, selectedClient.addressNumber, selectedClient.neighborhood, selectedClient.city && selectedClient.state ? `${selectedClient.city}/${selectedClient.state}` : ""].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </label>
                )}

                {serviceAddresses.map(addr => (
                  <label key={addr.id} className="flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors select-none"
                    style={{ borderColor: addressSource === "saved" && selectedAddressId === addr.id ? "rgb(59 130 246)" : "rgb(226 232 240)" }}>
                    <input type="radio" name="addressSource" checked={addressSource === "saved" && selectedAddressId === addr.id}
                      onChange={() => handleAddressSourceChange("saved", addr.id)}
                      className="mt-0.5 text-blue-600 focus:ring-blue-200" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-700">{addr.label}</span>
                      <p className="text-xs text-slate-500 truncate">
                        {[addr.addressStreet, addr.addressNumber, addr.neighborhood, `${addr.city}/${addr.state}`].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </label>
                ))}

                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors select-none"
                  style={{ borderColor: addressSource === "new" ? "rgb(59 130 246)" : "rgb(226 232 240)" }}>
                  <input type="radio" name="addressSource" checked={addressSource === "new"}
                    onChange={() => handleAddressSourceChange("new")}
                    className="mt-0.5 text-blue-600 focus:ring-blue-200" />
                  <span className="text-sm font-medium text-blue-600">+ Novo endereço de atendimento</span>
                </label>
              </div>
            )}

            {/* New address fields */}
            {(addressSource === "new" || !selectedClient) && (
              <div className="space-y-3">
                {selectedClient && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Nome do endereço
                      <span className="text-xs text-slate-400 font-normal ml-1">(preencha para salvar no cadastro do cliente)</span>
                    </span>
                    <input
                      value={newAddressLabel}
                      onChange={(e) => setNewAddressLabel(e.target.value)}
                      onBlur={() => setNewAddressLabel(toTitleCase(newAddressLabel))}
                      placeholder="Ex: Escritório Centro, Casa do Cliente"
                      className={inputClass}
                    />
                  </label>
                )}

                {/* Rua/Av + Numero */}
                <div className="grid grid-cols-3 gap-3">
                  <label className="flex flex-col gap-1.5 col-span-2">
                    <span className="text-sm font-medium text-slate-700">Rua/Av *</span>
                    <input name="addressStreet" value={form.addressStreet} onChange={onChange}
                      onBlur={() => setForm((f) => ({ ...f, addressStreet: toTitleCase(f.addressStreet) }))}
                      required placeholder="Logradouro" className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-700">Nº</span>
                    <input name="addressNumber" value={form.addressNumber} onChange={onChange} placeholder="Nº" className={inputClass} />
                  </label>
                </div>

                {/* Bairro + Cidade */}
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-700">Bairro</span>
                    <input name="neighborhood" value={form.neighborhood} onChange={onChange}
                      onBlur={() => setForm((f) => ({ ...f, neighborhood: toTitleCase(f.neighborhood) }))}
                      placeholder="Bairro" className={inputClass} />
                  </label>
                  <LookupField
                    label="Cidade *"
                    placeholder={form.state ? "Buscar cidade..." : "Selecione o estado"}
                    modalTitle={`Cidades - ${form.state || "UF"}`}
                    modalPlaceholder="Digite o nome da cidade..."
                    value={selectedCity}
                    displayValue={(c) => c.nome}
                    onChange={(c) => setSelectedCity(c)}
                    fetcher={cityFetcher}
                    keyExtractor={(c) => String(c.id)}
                    renderItem={(c) => (<div className="font-medium text-slate-900">{c.nome}</div>)}
                    disabled={!form.state}
                    required
                  />
                </div>

                {/* UF + CEP */}
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-700">UF *</span>
                    <select name="state" value={form.state} onChange={onChange} required className={`${inputClass} bg-white`}>
                      <option value="">Selecione</option>
                      {STATES.map((uf) => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      CEP
                      {cepLoading && (<span className="ml-2 text-xs text-blue-500 font-normal">Buscando...</span>)}
                    </span>
                    <input name="cep" value={form.cep} onChange={onChange} placeholder="00000-000" maxLength={9} className={inputClass} />
                  </label>
                </div>

                {/* Complemento */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700">Complemento</span>
                  <input name="addressComp" value={form.addressComp} onChange={onChange}
                    onBlur={() => setForm((f) => ({ ...f, addressComp: toTitleCase(f.addressComp) }))}
                    placeholder="Apt, Sala, Bloco..." className={inputClass} />
                </label>
              </div>
            )}

            {/* Contato no Local (dentro do Endereco) */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">Contato no Local</span>
              <input
                name="contactPersonName"
                value={form.contactPersonName}
                onChange={onChange}
                onBlur={() => setForm((f) => ({ ...f, contactPersonName: toTitleCase(f.contactPersonName) }))}
                placeholder="Nome de quem estará no local"
                className={inputClass}
              />
            </label>
          </div>

          </fieldset>

          {/* ─── 4. Tipo de Atendimento ─────────────────────── */}
          <fieldset disabled={lockedFields.techMode} className={lockedFields.techMode ? "opacity-60" : ""}>
          <CollapsibleSection
            title={<>Tipo de Atendimento{lockedFields.techMode && <span className="text-xs text-amber-600 font-normal ml-2">(bloqueado)</span>}</>}
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
            defaultOpen={!lockedFields.techMode}
            autoCollapse={false}
            summary={
              techMode === "BY_SPECIALIZATION" ? (selectedSpecs.length ? selectedSpecs.map(s => s.name).join(", ") : "Por especialização")
              : techMode === "DIRECTED" ? (selectedTechs.length ? selectedTechs.map(t => t.name).join(", ") : "Direcionado")
              : selectedWorkflow?.name || "Por fluxo"
            }
          >
            <TechAssignmentSection
              mode={techMode}
              onModeChange={setTechMode}
              selectedSpecializations={selectedSpecs}
              onSpecializationsChange={setSelectedSpecs}
              selectedTechnicians={selectedTechs}
              onTechniciansChange={setSelectedTechs}
              selectedWorkflow={selectedWorkflow}
              onWorkflowChange={setSelectedWorkflow}
              hideHeader
            />
          </CollapsibleSection>
          </fieldset>

          {/* Agenda CLT — when workflow has scheduleConfig */}
          {hasAgendaFromWorkflow && scheduleConfig && (
            <AgendaSelector
              workingHours={scheduleConfig.workingHours}
              workingDays={scheduleConfig.workingDays}
              defaultDurationMinutes={scheduleConfig.defaultDurationMinutes}
              selection={agendaSelection}
              onSelect={setAgendaSelection}
            />
          )}

          {/* Obra (optional, only when client has obras) */}
          {obras.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">
                Obra <span className="text-xs text-slate-400 font-normal">(opcional)</span>
              </span>
              <select
                value={selectedObraId}
                onChange={(e) => setSelectedObraId(e.target.value)}
                className={`${inputClass} bg-white`}
              >
                <option value="">Nenhuma obra vinculada</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} — CNO: {o.cno} ({o.city}/{o.state})
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-400">Selecione se esta OS é para uma obra de construção</span>
            </label>
          )}

          {/* ─── 5. Servicos (tabela) ──────────────────────── */}
          <fieldset disabled={lockedFields.services} className={lockedFields.services ? "opacity-60" : ""}>
          {lockedFields.services && <p className="text-xs text-amber-600 mb-1">Serviços bloqueados neste status</p>}
          <ServiceItemsSection
            items={serviceItems}
            onChange={(items) => { setServiceItems(items); if (error) setError(null); }}
          />
          </fieldset>

          {/* ─── 6. Prazo ───────────────────────────────────── */}
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Prazo *</span>
            <span className="text-[10px] text-slate-400">Data limite para concluir o serviço</span>
            <DateTimePicker
              name="deadlineAt"
              value={form.deadlineAt}
              onChange={(v) => setForm((f) => ({ ...f, deadlineAt: v }))}
              required
            />
          </div>

          {/* ─── 7. Agendamento (toggle, nao colapsavel) ───── */}
          {!hasAgendaFromWorkflow && (
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <span className="text-sm font-semibold text-slate-800">Agendamento</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={agendamentoEnabled}
                  onClick={() => setAgendamentoEnabled(!agendamentoEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    agendamentoEnabled ? "bg-blue-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      agendamentoEnabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </label>
              {agendamentoEnabled && (
                <div className="grid grid-cols-2 gap-3 pl-1">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-700">Data e hora do serviço</span>
                    <DateTimePicker
                      name="scheduledStartAt"
                      value={form.scheduledStartAt}
                      onChange={(v) => setForm((f) => ({ ...f, scheduledStartAt: v }))}
                    />
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-700">Duração estimada (min)</span>
                    <input
                      name="estimatedDurationMinutes"
                      value={form.estimatedDurationMinutes}
                      onChange={onChange}
                      type="number"
                      min="15"
                      step="15"
                      placeholder="60"
                      className={inputClass}
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* ─── 7b. Timeouts (edit mode only) ──────────────── */}
          {isEditMode && (
            <CollapsibleSection
              title="Tempos Limite"
              icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              defaultOpen={false}
              summary={
                acceptTimeoutMode === 'from_flow' && enRouteTimeoutMode === 'from_flow'
                  ? "Usando tempos do fluxo"
                  : [
                      acceptTimeoutMode !== 'from_flow' ? `Aceitar: ${acceptTimeoutValue}${acceptTimeoutMode === 'hours' ? 'h' : 'min'}` : null,
                      enRouteTimeoutMode !== 'from_flow' ? `A caminho: ${enRouteTimeoutValue}${enRouteTimeoutMode === 'hours' ? 'h' : 'min'}` : null,
                    ].filter(Boolean).join(" | ") || "Usando tempos do fluxo"
              }
            >
              <div className="space-y-4">
                {/* Accept timeout */}
                <div>
                  <span className="text-sm font-medium text-slate-700">Tempo para aceitar</span>
                  <div className="mt-1.5 flex items-center gap-2">
                    <select
                      value={acceptTimeoutMode}
                      onChange={(e) => setAcceptTimeoutMode(e.target.value as any)}
                      className={`${inputClass} bg-white w-36`}
                    >
                      <option value="from_flow">Do fluxo</option>
                      <option value="minutes">Minutos</option>
                      <option value="hours">Horas</option>
                    </select>
                    {acceptTimeoutMode !== 'from_flow' && (
                      <input
                        type="number"
                        min="1"
                        value={acceptTimeoutValue}
                        onChange={(e) => setAcceptTimeoutValue(parseInt(e.target.value) || 1)}
                        className={`${inputClass} w-24`}
                      />
                    )}
                  </div>
                </div>
                {/* En-route timeout */}
                <div>
                  <span className="text-sm font-medium text-slate-700">Tempo para clicar &quot;a caminho&quot;</span>
                  <div className="mt-1.5 flex items-center gap-2">
                    <select
                      value={enRouteTimeoutMode}
                      onChange={(e) => setEnRouteTimeoutMode(e.target.value as any)}
                      className={`${inputClass} bg-white w-36`}
                    >
                      <option value="from_flow">Do fluxo</option>
                      <option value="minutes">Minutos</option>
                      <option value="hours">Horas</option>
                    </select>
                    {enRouteTimeoutMode !== 'from_flow' && (
                      <input
                        type="number"
                        min="1"
                        value={enRouteTimeoutValue}
                        onChange={(e) => setEnRouteTimeoutValue(parseInt(e.target.value) || 1)}
                        className={`${inputClass} w-24`}
                      />
                    )}
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* ─── 8. Retorno ─────────────────────────────────── */}
          {isReturn && (
            <div id="return-section" className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2">
                <span className="text-amber-600">🔄</span>
                <span className="text-sm font-medium text-amber-800">Retorno de atendimento</span>
              </div>
              <div className="ml-6 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="returnPaid"
                    checked={returnPaidToTech}
                    onChange={() => setReturnPaidToTech(true)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600">Lancar valor para o tecnico</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="returnPaid"
                    checked={!returnPaidToTech}
                    onChange={() => setReturnPaidToTech(false)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600">Obrigacao do tecnico (sem comissao)</span>
                </label>
              </div>
              {!returnPaidToTech && (
                <p className="text-xs text-amber-600 ml-1">Tecnico nao recebera comissao neste retorno</p>
              )}
            </div>
          )}

          {/* ─── 9. Avaliação/Orçamento ────────────────────── */}
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isEvaluation}
                onChange={(e) => setIsEvaluation(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">OS de Avaliação/Orçamento</span>
            </label>
            {isEvaluation && (
              <p className="text-xs text-blue-600 ml-6">O técnico fará uma visita para avaliar e orçar o serviço</p>
            )}
          </div>

          {/* Geocoding indicator */}
          {geocodingMsg && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {geocodingMsg}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || isTerminal}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? (isEditMode ? "Salvando..." : "Criando...") : (isEditMode ? "Salvar Alterações" : "Criar OS")}
            </button>
            <Link
              href={isEditMode ? `/orders/${editId}` : "/orders"}
              className="rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </Link>
          </div>
        </div>
      </form>

      {/* Zero Value Confirmation */}
      {showZeroValueConfirm && (() => {
        // Calculate tech payment from service items
        const techPayCents = serviceItems.reduce((sum, item) => {
          if (item.techFixedValueCents && item.techFixedValueCents > 0) {
            return sum + item.techFixedValueCents * item.quantity;
          }
          if (item.commissionBps && item.commissionBps > 0) {
            return sum + Math.round((item.unitPriceCents * item.quantity * item.commissionBps) / 10000);
          }
          return sum;
        }, 0);
        const hasReceivable = false; // valor zero = sem A Receber
        const hasPayable = techPayCents > 0;
        const fmtBRL = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowZeroValueConfirm(false)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
              <div className="text-center mb-3">
                <div className="text-3xl mb-2">⚠️</div>
                <h3 className="text-sm font-bold text-slate-800">Valor da OS zerado</h3>
                <p className="text-xs text-slate-500 mt-2">
                  O valor total dos servicos e <span className="font-bold text-red-600">R$ 0,00</span>.
                </p>
              </div>

              {/* Financial preview */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-3 space-y-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Lancamentos ao aprovar</p>

                {/* A Receber */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">🟢 A Receber (cliente)</span>
                  <span className="text-slate-400">Nao sera gerado</span>
                </div>

                {/* A Pagar */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">🔵 A Pagar (tecnico)</span>
                  {hasPayable ? (
                    <span className="font-semibold text-blue-700">{fmtBRL(techPayCents)}</span>
                  ) : (
                    <span className="text-slate-400">Nao sera gerado</span>
                  )}
                </div>

                {hasPayable && (
                  <p className="text-[10px] text-blue-600 mt-1">
                    Valor fixo do tecnico sera lancado como conta a pagar
                  </p>
                )}
                {!hasPayable && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Nenhum lancamento financeiro sera criado
                  </p>
                )}
              </div>

              <p className="text-xs text-slate-400 text-center mb-3">Deseja criar a OS mesmo assim?</p>

              <div className="flex gap-2">
                <button onClick={() => setShowZeroValueConfirm(false)}
                  className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button onClick={() => { setShowZeroValueConfirm(false); handleSubmit(); }}
                  className="flex-1 py-2 rounded-lg bg-blue-600 text-sm text-white font-semibold hover:bg-blue-700">
                  Criar mesmo assim
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tech Review Modal */}
      <TechReviewModal
        open={reviewModal.open}
        orderId={reviewModal.orderId}
        orderCode={reviewModal.orderCode}
        orderTitle={reviewModal.orderTitle}
        candidates={reviewModal.candidates}
        allowEdit={reviewModal.allowEdit}
        onDispatched={handleReviewDispatched}
        onClose={handleReviewClose}
      />
    </div>
  );
}
