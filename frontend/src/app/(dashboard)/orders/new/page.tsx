"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
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

export default function NewOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<PartnerSummary | null>(null);
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

  // Agenda CLT (v1.01.72)
  const [isAgendaMode, setIsAgendaMode] = useState(false);
  const [agendaSelection, setAgendaSelection] = useState<AgendaSelection | null>(null);
  const [scheduleConfig, setScheduleConfig] = useState<{
    defaultDurationMinutes: number;
    workingHours: { start: string; end: string };
    workingDays: number[];
  } | null>(null);

  // Fetch workflow definition when workflow changes to detect scheduleConfig
  useEffect(() => {
    if (techMode !== "BY_WORKFLOW" || !selectedWorkflow) {
      setIsAgendaMode(false);
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
          // V2 format: look for SCHEDULE_CONFIG block
          if (def?.version === 2 && Array.isArray(def.blocks)) {
            const schedBlock = def.blocks.find((b: { type: string }) => b.type === "SCHEDULE_CONFIG");
            if (schedBlock?.data?.enabled) {
              setIsAgendaMode(true);
              setScheduleConfig({
                defaultDurationMinutes: schedBlock.data.defaultDurationMinutes || 60,
                workingHours: schedBlock.data.workingHours || { start: "08:00", end: "18:00" },
                workingDays: schedBlock.data.workingDays || [1, 2, 3, 4, 5],
              });
              return;
            }
          }
        } catch { /* ignore parse errors */ }
        setIsAgendaMode(false);
        setScheduleConfig(null);
        setAgendaSelection(null);
      })
      .catch(() => {
        if (!cancelled) {
          setIsAgendaMode(false);
          setScheduleConfig(null);
        }
      });
    return () => { cancelled = true; };
  }, [techMode, selectedWorkflow]);

  // Accept timeout state — restored from localStorage
  const [acceptTimeoutMode, setAcceptTimeoutMode] = useState<'minutes' | 'hours' | 'from_flow'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lastAcceptTimeout');
      if (saved) { try { return JSON.parse(saved).mode || 'minutes'; } catch { /* */ } }
    }
    return 'minutes';
  });
  const [acceptTimeoutValue, setAcceptTimeoutValue] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lastAcceptTimeout');
      if (saved) { try { return JSON.parse(saved).value || 60; } catch { /* */ } }
    }
    return 60;
  });

  // En-route timeout state — restored from localStorage
  const [enRouteTimeoutMode, setEnRouteTimeoutMode] = useState<'minutes' | 'hours' | 'from_flow'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lastEnRouteTimeout');
      if (saved) { try { return JSON.parse(saved).mode || 'from_flow'; } catch { /* */ } }
    }
    return 'from_flow';
  });
  const [enRouteTimeoutValue, setEnRouteTimeoutValue] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lastEnRouteTimeout');
      if (saved) { try { return JSON.parse(saved).value || 30; } catch { /* */ } }
    }
    return 30;
  });

  // Service address states
  const [serviceAddresses, setServiceAddresses] = useState<ServiceAddressSummary[]>([]);
  const [addressSource, setAddressSource] = useState<"main" | "saved" | "new">("new");
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [newAddressLabel, setNewAddressLabel] = useState("");

  // Commission + return states
  const [companyCommission, setCompanyCommission] = useState<{
    commissionBps: number; overrideEnabled: boolean; minBps: number | null; maxBps: number | null;
  }>({ commissionBps: 1000, overrideEnabled: false, minBps: null, maxBps: null });
  const [isReturn, setIsReturn] = useState(false);
  const [returnPaidToTech, setReturnPaidToTech] = useState(true);
  const [techCommissionValue, setTechCommissionValue] = useState("");
  const [commissionError, setCommissionError] = useState<string | null>(null);

  // Load company commission config on mount
  useEffect(() => {
    api.get<any>("/company/me").then(c => {
      setCompanyCommission({
        commissionBps: c.commissionBps ?? 1000,
        overrideEnabled: c.commissionOverrideEnabled ?? false,
        minBps: c.commissionMinBps ?? null,
        maxBps: c.commissionMaxBps ?? null,
      });
    }).catch(() => {});
  }, []);

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
        // Default: ultimo endereco de atendimento (mais recente = primeiro, ordenado por createdAt desc)
        if (addrs.length > 0) {
          const last = addrs[0];
          setAddressSource("saved");
          setSelectedAddressId(last.id);
          fillAddress(last);
        } else if (selectedClient.addressStreet) {
          // Se nao tem enderecos salvos mas tem endereco principal, usa ele
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
    valueCents: "",
    deadlineAt: "",
    contactPersonName: "",
    scheduledStartAt: "",
    estimatedDurationMinutes: "",
  });

  // Auto-recalculate tech commission when value or commission config changes
  function recalcTechCommission(valueCentsStr: string, bps: number) {
    const v = parseFloat(valueCentsStr);
    if (!isNaN(v) && v > 0) {
      const commission = (v * bps) / 10000;
      setTechCommissionValue(commission.toFixed(2));
    } else {
      setTechCommissionValue("");
    }
    setCommissionError(null);
  }

  function onChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;

    if (name === "state") {
      // Quando estado muda, limpa cidade selecionada
      setSelectedCity(null);
      setForm((f) => ({ ...f, state: value }));
      return;
    }

    if (name === "valueCents") {
      setForm((f) => ({ ...f, valueCents: value }));
      if (!isReturn || returnPaidToTech) {
        recalcTechCommission(value, companyCommission.commissionBps);
      }
      return;
    }

    if (name === "cep") {
      const masked = maskCep(value);
      setForm((f) => ({ ...f, cep: masked }));
      // Auto-lookup quando CEP completo (8 dígitos)
      const digits = masked.replace(/\D/g, "");
      if (digits.length === 8) {
        handleCepLookup(digits);
      }
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
        // Tentar selecionar a cidade retornada pelo ViaCEP
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

  // Preencher endereco a partir de um objeto de endereco
  async function fillAddress(addr: { state?: string | null; cep?: string | null; addressStreet?: string | null; addressNumber?: string | null; addressComp?: string | null; neighborhood?: string | null; city?: string | null }) {
    const updates: Partial<typeof form> = {};
    if (addr.state) updates.state = addr.state;
    if (addr.cep) updates.cep = maskCep(addr.cep);
    if (addr.addressStreet) updates.addressStreet = addr.addressStreet;
    if (addr.addressNumber) updates.addressNumber = addr.addressNumber;
    if (addr.addressComp) updates.addressComp = addr.addressComp || "";
    if (addr.neighborhood) updates.neighborhood = addr.neighborhood;
    setForm((f) => ({ ...f, ...updates }));
    // Auto-selecionar cidade
    if (addr.state && addr.city) {
      try {
        const cities = await fetchCitiesByState(addr.state);
        const found = cities.find((c) => c.nome.toLowerCase() === addr.city!.toLowerCase());
        if (found) setSelectedCity(found);
      } catch { /* ignore */ }
    }
  }

  // Ao mudar fonte de endereco
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
      // Limpar campos de endereco
      setForm(f => ({ ...f, state: "", cep: "", addressStreet: "", addressNumber: "", addressComp: "", neighborhood: "" }));
      setSelectedCity(null);
    }
  }

  // City fetcher — busca IBGE e filtra client-side
  const cityFetcher: LookupFetcher<IBGECity> = useCallback(
    async (search, page, signal) => {
      if (!form.state) {
        return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
      }
      const allCities = await fetchCitiesByState(form.state);
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");

      // Filtrar por busca
      let filtered = allCities;
      if (search) {
        const lower = search.toLowerCase();
        filtered = allCities.filter((c) => c.nome.toLowerCase().includes(lower));
      }

      // Paginar client-side
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setGeocodingMsg(null);

    try {
      if (!selectedClient) {
        setError("Selecione um cliente");
        setLoading(false);
        return;
      }

      const valueNum = Math.round(parseFloat(form.valueCents) * 100);
      if (isNaN(valueNum) || valueNum <= 0) {
        setError("Valor inválido");
        setLoading(false);
        return;
      }

      // Calcular comissão do técnico
      let finalCommissionBps = companyCommission.commissionBps;
      let finalTechCents = Math.round(valueNum * finalCommissionBps / 10000);

      if (isReturn && !returnPaidToTech) {
        finalCommissionBps = 0;
        finalTechCents = 0;
      } else if (companyCommission.overrideEnabled && techCommissionValue) {
        finalTechCents = Math.round(parseFloat(techCommissionValue) * 100);
        if (isNaN(finalTechCents) || finalTechCents < 0) {
          setError("Valor do técnico inválido");
          setLoading(false);
          return;
        }
        finalCommissionBps = valueNum > 0 ? Math.round((finalTechCents / valueNum) * 10000) : 0;
        // Validar faixa min/max
        if (companyCommission.minBps != null && finalCommissionBps < companyCommission.minBps) {
          const minPct = (companyCommission.minBps / 100).toFixed(2);
          setError(`Comissão abaixo do mínimo permitido (${minPct}%)`);
          setLoading(false);
          return;
        }
        if (companyCommission.maxBps != null && finalCommissionBps > companyCommission.maxBps) {
          const maxPct = (companyCommission.maxBps / 100).toFixed(2);
          setError(`Comissão acima do máximo permitido (${maxPct}%)`);
          setLoading(false);
          return;
        }
      }

      // Compor endereço
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

      // Geocoding automático (estruturado + fallback texto)
      setGeocodingMsg("Obtendo coordenadas...");
      const coords = await geocodeAddress(addressText, {
        street: form.addressStreet,
        number: form.addressNumber,
        city: cityName,
        state: form.state,
      });
      setGeocodingMsg(null);

      // Validar agenda se modo agenda ativo
      if (isAgendaMode) {
        if (!agendaSelection) {
          setError("Selecione um tecnico, data e hora na agenda");
          setLoading(false);
          return;
        }
      }

      const effectiveMode = isAgendaMode ? "BY_AGENDA" : techMode;

      // Salvar novo endereco de atendimento se label preenchido
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
        } catch { /* nao impede criacao da OS */ }
      }

      await api.post("/service-orders", {
        title: form.title,
        description: form.description || undefined,
        addressText,
        lat: coords?.lat ?? undefined,
        lng: coords?.lng ?? undefined,
        valueCents: valueNum,
        deadlineAt: new Date(form.deadlineAt).toISOString(),
        clientPartnerId: selectedClient?.id || undefined,
        // Campos estruturados
        addressStreet: form.addressStreet || undefined,
        addressNumber: form.addressNumber || undefined,
        addressComp: form.addressComp || undefined,
        neighborhood: form.neighborhood || undefined,
        city: cityName || undefined,
        state: form.state || undefined,
        cep: form.cep ? form.cep.replace(/\D/g, "") : undefined,
        // Atribuicao de tecnico
        techAssignmentMode: effectiveMode,
        requiredSpecializationIds: techMode === "BY_SPECIALIZATION" ? selectedSpecs.map((s) => s.id) : [],
        directedTechnicianIds: techMode === "DIRECTED" ? selectedTechs.map((t) => t.id) : [],
        workflowTemplateId: techMode === "BY_WORKFLOW" ? selectedWorkflow?.id || undefined : undefined,
        // Agenda CLT — pre-atribuir tecnico
        ...(isAgendaMode && agendaSelection ? {
          assignedPartnerId: agendaSelection.technicianId,
        } : {}),
        // Agendamento (manual ou via Agenda CLT)
        scheduledStartAt: isAgendaMode && agendaSelection
          ? agendaSelection.scheduledStartAt
          : form.scheduledStartAt ? new Date(form.scheduledStartAt).toISOString() : undefined,
        estimatedDurationMinutes: isAgendaMode && agendaSelection
          ? agendaSelection.estimatedDurationMinutes
          : form.estimatedDurationMinutes ? parseInt(form.estimatedDurationMinutes) || undefined : undefined,
        // Contato no local
        contactPersonName: form.contactPersonName || undefined,
        // Obra vinculada
        obraId: selectedObraId || undefined,
        // Tempo para aceitar (null = usa do fluxo)
        acceptTimeoutMinutes: isAgendaMode ? undefined
          : acceptTimeoutMode === 'from_flow' ? undefined
          : acceptTimeoutMode === 'hours' ? acceptTimeoutValue * 60
          : acceptTimeoutValue,
        // Comissão e retorno (v1.01.81)
        commissionBps: finalCommissionBps,
        techCommissionCents: finalTechCents,
        isReturn,
        returnPaidToTech: isReturn ? returnPaidToTech : true,
        // Tempo para clicar a caminho (null = usa do fluxo)
        enRouteTimeoutMinutes: isAgendaMode ? undefined
          : enRouteTimeoutMode === 'from_flow' ? undefined
          : enRouteTimeoutMode === 'hours' ? enRouteTimeoutValue * 60
          : enRouteTimeoutValue,
      });

      // Salvar no localStorage para pré-popular próxima OS
      localStorage.setItem('lastAcceptTimeout', JSON.stringify({ mode: acceptTimeoutMode, value: acceptTimeoutValue }));
      localStorage.setItem('lastEnRouteTimeout', JSON.stringify({ mode: enRouteTimeoutMode, value: enRouteTimeoutValue }));

      router.push("/orders");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.payload?.message || err.message);
      } else {
        setError("Erro ao criar OS");
      }
    } finally {
      setLoading(false);
      setGeocodingMsg(null);
    }
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/orders" className="hover:text-blue-600">
          Ordens de Serviço
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">Nova OS</span>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        Nova Ordem de Serviço
      </h1>

      <form
        onSubmit={handleSubmit}
        className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="space-y-4">
          {/* Cliente (LookupField) */}
          <LookupField
            label="Cliente"
            placeholder="Selecione um cliente"
            modalTitle="Buscar Cliente"
            modalPlaceholder="Nome, documento ou telefone..."
            value={selectedClient}
            displayValue={(c) => c.name}
            onChange={(c) => { setSelectedClient(c); setAddressSource("new"); }}
            fetcher={clientFetcher}
            keyExtractor={(c) => c.id}
            required
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

          {/* Obra (opcional, só aparece se cliente tem obras) */}
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

          {/* Título */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">
              Título *
            </span>
            <input
              name="title"
              value={form.title}
              onChange={onChange}
              onBlur={() => setForm((f) => ({ ...f, title: toTitleCase(f.title) }))}
              required
              placeholder="Ex: Manutenção ar-condicionado"
              className={inputClass}
            />
          </label>

          {/* Descrição */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">
              Descrição
            </span>
            <textarea
              name="description"
              value={form.description}
              onChange={onChange}
              rows={3}
              placeholder="Detalhes do serviço..."
              className={`${inputClass} resize-none`}
            />
          </label>

          {/* Contato no Local */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">
              Contato no Local
            </span>
            <input
              name="contactPersonName"
              value={form.contactPersonName}
              onChange={onChange}
              onBlur={() => setForm((f) => ({ ...f, contactPersonName: toTitleCase(f.contactPersonName) }))}
              placeholder="Nome de quem estará no local"
              className={inputClass}
            />
          </label>

          {/* Atribuir Técnico */}
          <CollapsibleSection
            title="Atribuir Técnico"
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
            summary={techMode === "BY_SPECIALIZATION" ? (selectedSpecs.length ? selectedSpecs.map(s => s.name).join(", ") : "Por especialização") : techMode === "DIRECTED" ? (selectedTechs.length ? selectedTechs.map(t => t.name).join(", ") : "Direcionado") : selectedWorkflow?.name || "Por fluxo"}
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

          {/* Agenda CLT — aparece quando o fluxo tem scheduleConfig.enabled */}
          {isAgendaMode && scheduleConfig && (
            <AgendaSelector
              workingHours={scheduleConfig.workingHours}
              workingDays={scheduleConfig.workingDays}
              defaultDurationMinutes={scheduleConfig.defaultDurationMinutes}
              selection={agendaSelection}
              onSelect={setAgendaSelection}
            />
          )}

          {/* Tempo para aceitar + a caminho — oculto em modo agenda */}
          {!isAgendaMode && (<>
          <CollapsibleSection
            title="Tempo para aceitar"
            icon={<span className="text-base leading-none">⏱️</span>}
            summary={acceptTimeoutMode === 'from_flow' ? "Definido no fluxo" : `${acceptTimeoutValue} ${acceptTimeoutMode === 'hours' ? 'h' : 'min'}`}
          >
            <p className="text-xs text-slate-400 mb-2">
              Quanto tempo o técnico tem para aceitar esta OS.
            </p>
            <div className="space-y-2 ml-1">
              {([
                { mode: 'minutes' as const, label: 'Minutos', hint: 'Define um tempo fixo em minutos para esta OS' },
                { mode: 'hours' as const, label: 'Horas', hint: 'Define um tempo fixo em horas para esta OS' },
                { mode: 'from_flow' as const, label: 'Definido no fluxo de atendimento', hint: 'Usa o tempo configurado no fluxo (evita duplicidade)' },
              ]).map(opt => (
                <label key={opt.mode} className="flex items-start gap-2 cursor-pointer group">
                  <input type="radio" name="acceptTimeoutMode"
                    checked={acceptTimeoutMode === opt.mode}
                    onChange={() => {
                      setAcceptTimeoutMode(opt.mode);
                      if (opt.mode === 'hours' && acceptTimeoutValue > 200) setAcceptTimeoutValue(2);
                      if (opt.mode === 'minutes' && acceptTimeoutValue < 5) setAcceptTimeoutValue(60);
                    }}
                    className="mt-0.5 text-blue-600 focus:ring-blue-200" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-700">{opt.label}</span>
                      {acceptTimeoutMode === opt.mode && opt.mode !== 'from_flow' && (
                        <input type="number" min={1}
                          value={acceptTimeoutValue}
                          onChange={e => setAcceptTimeoutValue(parseInt(e.target.value) || 1)}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-sm w-20 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{opt.hint}</p>
                  </div>
                </label>
              ))}
            </div>
            {acceptTimeoutMode !== 'from_flow' && (
              <p className="text-[10px] text-amber-600 mt-2 ml-5 flex items-center gap-1">
                <span>⚠️</span> Este valor sobrescreve a configuração do fluxo de atendimento para esta OS.
              </p>
            )}
          </CollapsibleSection>

          {/* Tempo para clicar a caminho */}
          <CollapsibleSection
            title="Tempo para clicar a caminho"
            icon={<span className="text-base leading-none">🚗</span>}
            summary={enRouteTimeoutMode === 'from_flow' ? "Definido no fluxo" : `${enRouteTimeoutValue} ${enRouteTimeoutMode === 'hours' ? 'h' : 'min'}`}
          >
            <p className="text-xs text-slate-400 mb-2">
              Quanto tempo o técnico tem para indicar que está a caminho.
            </p>
            <div className="space-y-2 ml-1">
              {([
                { mode: 'minutes' as const, label: 'Minutos', hint: 'Define um tempo fixo em minutos para esta OS' },
                { mode: 'hours' as const, label: 'Horas', hint: 'Define um tempo fixo em horas para esta OS' },
                { mode: 'from_flow' as const, label: 'Definido no fluxo de atendimento', hint: 'Usa o tempo configurado no fluxo (evita duplicidade)' },
              ]).map(opt => (
                <label key={`enroute_${opt.mode}`} className="flex items-start gap-2 cursor-pointer group">
                  <input type="radio" name="enRouteTimeoutMode"
                    checked={enRouteTimeoutMode === opt.mode}
                    onChange={() => {
                      setEnRouteTimeoutMode(opt.mode);
                      if (opt.mode === 'hours' && enRouteTimeoutValue > 200) setEnRouteTimeoutValue(1);
                      if (opt.mode === 'minutes' && enRouteTimeoutValue < 5) setEnRouteTimeoutValue(30);
                    }}
                    className="mt-0.5 text-green-600 focus:ring-green-200" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-700">{opt.label}</span>
                      {enRouteTimeoutMode === opt.mode && opt.mode !== 'from_flow' && (
                        <input type="number" min={1}
                          value={enRouteTimeoutValue}
                          onChange={e => setEnRouteTimeoutValue(parseInt(e.target.value) || 1)}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-sm w-20 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{opt.hint}</p>
                  </div>
                </label>
              ))}
            </div>
            {enRouteTimeoutMode !== 'from_flow' && (
              <p className="text-[10px] text-amber-600 mt-2 ml-5 flex items-center gap-1">
                <span>⚠️</span> Este valor sobrescreve a configuração do fluxo de atendimento para esta OS.
              </p>
            )}
          </CollapsibleSection>
          </>)}

          {/* Endereco do Servico */}
          <CollapsibleSection
            title="Endereço do Serviço"
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            defaultOpen={true}
            summary={form.addressStreet ? [form.addressStreet, form.addressNumber, selectedCity?.nome || ""].filter(Boolean).join(", ") : ""}
          >
            {/* Seletor de enderecos — so aparece quando tem cliente selecionado */}
            {selectedClient && (selectedClient.addressStreet || serviceAddresses.length > 0) && (
              <div className="space-y-1.5 mb-4">
                {/* Endereco principal do cadastro */}
                {selectedClient.addressStreet && (
                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors select-none"
                    style={{ borderColor: addressSource === "main" ? "rgb(59 130 246)" : "rgb(226 232 240)" }}>
                    <input type="radio" name="addressSource" checked={addressSource === "main"}
                      onChange={() => handleAddressSourceChange("main")}
                      className="mt-0.5 text-blue-600 focus:ring-blue-200" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-700">Endereco do cadastro</span>
                      <p className="text-xs text-slate-500 truncate">
                        {[selectedClient.addressStreet, selectedClient.addressNumber, selectedClient.neighborhood, selectedClient.city && selectedClient.state ? `${selectedClient.city}/${selectedClient.state}` : ""].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </label>
                )}

                {/* Enderecos de atendimento salvos */}
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

                {/* Novo endereco */}
                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors select-none"
                  style={{ borderColor: addressSource === "new" ? "rgb(59 130 246)" : "rgb(226 232 240)" }}>
                  <input type="radio" name="addressSource" checked={addressSource === "new"}
                    onChange={() => handleAddressSourceChange("new")}
                    className="mt-0.5 text-blue-600 focus:ring-blue-200" />
                  <span className="text-sm font-medium text-blue-600">+ Novo endereco de atendimento</span>
                </label>
              </div>
            )}

            {/* Campos de endereco — aparecem quando addressSource="new" OU quando nao tem cliente */}
            {(addressSource === "new" || !selectedClient) && (
              <div className="space-y-3">
                {/* Label para salvar (opcional) — so aparece se tem cliente */}
                {selectedClient && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      Nome do endereco
                      <span className="text-xs text-slate-400 font-normal ml-1">(preencha para salvar no cadastro do cliente)</span>
                    </span>
                    <input
                      value={newAddressLabel}
                      onChange={(e) => setNewAddressLabel(e.target.value)}
                      onBlur={() => setNewAddressLabel(toTitleCase(newAddressLabel))}
                      placeholder="Ex: Escritorio Centro, Casa do Cliente"
                      className={inputClass}
                    />
                  </label>
                )}

                {/* Estado + Cidade */}
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-700">Estado *</span>
                    <select name="state" value={form.state} onChange={onChange} required className={`${inputClass} bg-white`}>
                      <option value="">Selecione o UF</option>
                      {STATES.map((uf) => (
                        <option key={uf} value={uf}>{uf} - {STATE_NAMES[uf]}</option>
                      ))}
                    </select>
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

                {/* CEP + Bairro */}
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      CEP
                      {cepLoading && (<span className="ml-2 text-xs text-blue-500 font-normal">Buscando...</span>)}
                    </span>
                    <input name="cep" value={form.cep} onChange={onChange} placeholder="00000-000" maxLength={9} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-700">Bairro</span>
                    <input name="neighborhood" value={form.neighborhood} onChange={onChange}
                      onBlur={() => setForm((f) => ({ ...f, neighborhood: toTitleCase(f.neighborhood) }))}
                      placeholder="Bairro" className={inputClass} />
                  </label>
                </div>

                {/* Rua + Numero */}
                <div className="grid grid-cols-3 gap-4">
                  <label className="flex flex-col gap-1.5 col-span-2">
                    <span className="text-sm font-medium text-slate-700">Rua *</span>
                    <input name="addressStreet" value={form.addressStreet} onChange={onChange}
                      onBlur={() => setForm((f) => ({ ...f, addressStreet: toTitleCase(f.addressStreet) }))}
                      required placeholder="Endereco" className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-slate-700">Numero</span>
                    <input name="addressNumber" value={form.addressNumber} onChange={onChange} placeholder="No" className={inputClass} />
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

            {/* Endereco preenchido (readonly preview) — quando selecionou main ou saved */}
            {selectedClient && addressSource !== "new" && (
              <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-xs text-slate-500">
                  {[form.addressStreet, form.addressNumber, form.neighborhood, selectedCity?.nome || "", form.state].filter(Boolean).join(", ")}
                  {form.cep && <span className="ml-2 text-slate-400">CEP: {form.cep}</span>}
                </p>
              </div>
            )}
          </CollapsibleSection>

          {/* Valor e Prazo */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">
                Valor (R$) *
              </span>
              <input
                name="valueCents"
                value={form.valueCents}
                onChange={onChange}
                required
                type="number"
                step="0.01"
                min="0.01"
                placeholder="150.00"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-700">
                Prazo de execução *
              </span>
              <span className="text-[10px] text-slate-400">Data limite para concluir o serviço</span>
              <input
                name="deadlineAt"
                value={form.deadlineAt}
                onChange={onChange}
                required
                type="datetime-local"
                className={inputClass}
              />
            </label>
          </div>

          {/* Retorno + Comissão do Técnico */}
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            {/* Retorno */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isReturn}
                onChange={(e) => {
                  const ret = e.target.checked;
                  setIsReturn(ret);
                  if (ret && !returnPaidToTech) {
                    setTechCommissionValue("0.00");
                  } else {
                    recalcTechCommission(form.valueCents, companyCommission.commissionBps);
                  }
                }}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">Retorno de atendimento anterior</span>
            </label>

            {isReturn && (
              <div className="ml-6 space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="returnPaid"
                    checked={returnPaidToTech}
                    onChange={() => {
                      setReturnPaidToTech(true);
                      recalcTechCommission(form.valueCents, companyCommission.commissionBps);
                    }}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600">Lançar valor para o técnico</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="returnPaid"
                    checked={!returnPaidToTech}
                    onChange={() => {
                      setReturnPaidToTech(false);
                      setTechCommissionValue("0.00");
                      setCommissionError(null);
                    }}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-600">Obrigação do técnico (sem comissão)</span>
                </label>
              </div>
            )}

            {/* Comissão do técnico */}
            {(!isReturn || returnPaidToTech) && (
              <div className="flex items-end gap-3">
                <div className="flex flex-col gap-1 flex-1">
                  <span className="text-sm font-medium text-slate-700">Valor do técnico (R$)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={techCommissionValue}
                    onChange={(e) => {
                      if (!companyCommission.overrideEnabled) return;
                      const val = e.target.value;
                      setTechCommissionValue(val);
                      // Validar faixa
                      const v = parseFloat(form.valueCents);
                      const tc = parseFloat(val);
                      if (!isNaN(v) && v > 0 && !isNaN(tc)) {
                        const bps = Math.round((tc / v) * 10000);
                        if (companyCommission.minBps != null && bps < companyCommission.minBps) {
                          setCommissionError(`Mínimo: ${(companyCommission.minBps / 100).toFixed(2)}%`);
                        } else if (companyCommission.maxBps != null && bps > companyCommission.maxBps) {
                          setCommissionError(`Máximo: ${(companyCommission.maxBps / 100).toFixed(2)}%`);
                        } else {
                          setCommissionError(null);
                        }
                      }
                    }}
                    readOnly={!companyCommission.overrideEnabled}
                    className={`${inputClass} ${companyCommission.overrideEnabled ? "" : "bg-slate-100 text-slate-500 cursor-not-allowed"} ${commissionError ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : ""}`}
                    placeholder="0.00"
                  />
                  {commissionError && (
                    <span className="text-xs text-red-600">{commissionError}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1 w-28">
                  <span className="text-sm font-medium text-slate-700">Comissão %</span>
                  <input
                    type="text"
                    readOnly
                    value={(() => {
                      const v = parseFloat(form.valueCents);
                      const tc = parseFloat(techCommissionValue);
                      if (!isNaN(v) && v > 0 && !isNaN(tc)) {
                        return ((tc / v) * 100).toFixed(2) + "%";
                      }
                      return (companyCommission.commissionBps / 100).toFixed(2) + "%";
                    })()}
                    className={`${inputClass} bg-slate-100 text-slate-500 cursor-not-allowed text-center`}
                  />
                </div>
              </div>
            )}
            {isReturn && !returnPaidToTech && (
              <p className="text-xs text-amber-600 ml-1">Técnico não receberá comissão neste retorno</p>
            )}
          </div>

          {/* Agendamento — aparece sempre (exceto agenda CLT que usa AgendaSelector) */}
          {!isAgendaMode && (
            <CollapsibleSection
              title="Agendamento"
              icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
              subtitle="(opcional)"
              summary={form.scheduledStartAt ? new Date(form.scheduledStartAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
            >
              <p className="text-xs text-slate-400 mb-3">
                Preencha para que a OS apareca na aba Agenda.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700">Data e hora do servico</span>
                  <input
                    name="scheduledStartAt"
                    value={form.scheduledStartAt}
                    onChange={onChange}
                    type="datetime-local"
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700">Duracao estimada (min)</span>
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
            </CollapsibleSection>
          )}

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
              disabled={loading}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Criando..." : "Criar OS"}
            </button>
            <Link
              href="/orders"
              className="rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
