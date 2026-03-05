"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import Link from "next/link";
import LookupField from "@/components/ui/LookupField";
import type { LookupFetcher, LookupFetcherResult } from "@/components/ui/SearchLookupModal";
import TechAssignmentSection, {
  type TechAssignmentMode,
  type SpecializationSummary,
  type TechnicianSummary,
  type WorkflowSummary,
} from "@/components/os/TechAssignmentSection";
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
type PartnerSummary = { id: string; name: string; document: string | null; phone: string | null };

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
  ABERTA: "bg-yellow-100 text-yellow-800 border-yellow-200",
  OFERTADA: "bg-orange-100 text-orange-800 border-orange-200",
  ATRIBUIDA: "bg-blue-100 text-blue-800 border-blue-200",
  EM_EXECUCAO: "bg-indigo-100 text-indigo-800 border-indigo-200",
  CONCLUIDA: "bg-green-100 text-green-800 border-green-200",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  AJUSTE: "bg-amber-100 text-amber-800 border-amber-200",
  CANCELADA: "bg-slate-100 text-slate-600 border-slate-200",
};

const TERMINAL_STATUSES = ["CONCLUIDA", "APROVADA", "CANCELADA"];

/* ---- Fetcher (module-level, stable ref) ---- */
const clientFetcher: LookupFetcher<PartnerSummary> = async (search, page, signal) => {
  const params = new URLSearchParams({ type: "CLIENTE", page: String(page), limit: "20" });
  if (search) params.set("search", search);
  return api.get<LookupFetcherResult<PartnerSummary>>(
    `/partners?${params.toString()}`,
    { signal },
  );
};

function formatDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputClass =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed";

export default function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<PartnerSummary | null>(null);
  const [selectedCity, setSelectedCity] = useState<IBGECity | null>(null);
  const [status, setStatus] = useState("");
  const [title, setTitle] = useState("");
  const [isTerminal, setIsTerminal] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [geocodingMsg, setGeocodingMsg] = useState<string | null>(null);

  // Tech assignment states
  const [techMode, setTechMode] = useState<TechAssignmentMode>("BY_SPECIALIZATION");
  const [selectedSpecs, setSelectedSpecs] = useState<SpecializationSummary[]>([]);
  const [selectedTechs, setSelectedTechs] = useState<TechnicianSummary[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowSummary | null>(null);

  // Accept timeout state
  const [acceptTimeoutMode, setAcceptTimeoutMode] = useState<'minutes' | 'hours' | 'from_flow'>('from_flow');
  const [acceptTimeoutValue, setAcceptTimeoutValue] = useState<number>(60);

  // En-route timeout state
  const [enRouteTimeoutMode, setEnRouteTimeoutMode] = useState<'minutes' | 'hours' | 'from_flow'>('from_flow');
  const [enRouteTimeoutValue, setEnRouteTimeoutValue] = useState<number>(30);

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
  });

  useEffect(() => {
    api.get<any>(`/service-orders/${id}`).then(async (order) => {
      setStatus(order.status);
      setTitle(order.title);
      setIsTerminal(TERMINAL_STATUSES.includes(order.status));

      // Pre-populate form
      const hasStructured = !!(order.state || order.city || order.addressStreet);

      setForm({
        title: order.title || "",
        description: order.description || "",
        state: order.state || "",
        cep: order.cep ? maskCep(order.cep) : "",
        addressStreet: order.addressStreet || (hasStructured ? "" : order.addressText || ""),
        addressNumber: order.addressNumber || "",
        addressComp: order.addressComp || "",
        neighborhood: order.neighborhood || "",
        valueCents: order.valueCents != null ? (order.valueCents / 100).toFixed(2) : "",
        deadlineAt: order.deadlineAt ? formatDatetimeLocal(order.deadlineAt) : "",
        contactPersonName: order.contactPersonName || "",
      });

      // Pre-populate accept timeout
      if (order.acceptTimeoutMinutes != null) {
        const mins = order.acceptTimeoutMinutes;
        if (mins >= 60 && mins % 60 === 0) {
          setAcceptTimeoutMode('hours');
          setAcceptTimeoutValue(mins / 60);
        } else {
          setAcceptTimeoutMode('minutes');
          setAcceptTimeoutValue(mins);
        }
      } else {
        setAcceptTimeoutMode('from_flow');
        setAcceptTimeoutValue(60);
      }

      // Pre-populate en-route timeout
      if (order.enRouteTimeoutMinutes != null) {
        const mins = order.enRouteTimeoutMinutes;
        if (mins >= 60 && mins % 60 === 0) {
          setEnRouteTimeoutMode('hours');
          setEnRouteTimeoutValue(mins / 60);
        } else {
          setEnRouteTimeoutMode('minutes');
          setEnRouteTimeoutValue(mins);
        }
      } else {
        setEnRouteTimeoutMode('from_flow');
        setEnRouteTimeoutValue(30);
      }

      // Pre-populate selected client
      if (order.clientPartner) {
        setSelectedClient({
          id: order.clientPartner.id,
          name: order.clientPartner.name,
          document: order.clientPartner.document || null,
          phone: order.clientPartner.phone || null,
        });
      }

      // Pre-populate selected city
      if (order.state && order.city) {
        try {
          const cities = await fetchCitiesByState(order.state);
          const found = cities.find(
            (c) => c.nome.toLowerCase() === order.city.toLowerCase()
          );
          if (found) setSelectedCity(found);
        } catch { /* ignore */ }
      }

      // Pre-populate tech assignment
      if (order.techAssignmentMode) {
        setTechMode(order.techAssignmentMode as TechAssignmentMode);
      }
      // Resolve specialization IDs to objects
      if (order.requiredSpecializationIds?.length) {
        try {
          const res = await api.get<any>("/specializations?limit=100");
          const allSpecs: SpecializationSummary[] = Array.isArray(res) ? res : res.data || [];
          const matched = allSpecs.filter((s: SpecializationSummary) =>
            order.requiredSpecializationIds.includes(s.id)
          );
          setSelectedSpecs(matched);
        } catch { /* ignore */ }
      }
      // Resolve technician IDs to objects
      if (order.directedTechnicianIds?.length) {
        try {
          const res = await api.get<any>("/partners?limit=100&type=TECNICO");
          const allTechs: TechnicianSummary[] = Array.isArray(res) ? res : res.data || [];
          const matched = allTechs.filter((t: TechnicianSummary) =>
            order.directedTechnicianIds.includes(t.id)
          );
          setSelectedTechs(matched);
        } catch { /* ignore */ }
      }
      // Resolve workflow
      if (order.workflowTemplateId && order.workflowTemplate) {
        setSelectedWorkflow({
          id: order.workflowTemplate.id,
          name: order.workflowTemplate.name,
        });
      }
    }).catch(() => {
      setError("Erro ao carregar OS");
    }).finally(() => {
      setLoading(false);
    });
  }, [id]);

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

  // City fetcher — busca IBGE e filtra client-side
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setGeocodingMsg(null);

    try {
      const valueNum = Math.round(parseFloat(form.valueCents) * 100);
      if (isNaN(valueNum) || valueNum <= 0) {
        setError("Valor inválido");
        setSaving(false);
        return;
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
        setSaving(false);
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

      await api.put(`/service-orders/${id}`, {
        title: form.title,
        description: form.description || undefined,
        addressText,
        lat: coords?.lat ?? undefined,
        lng: coords?.lng ?? undefined,
        valueCents: valueNum,
        deadlineAt: form.deadlineAt ? new Date(form.deadlineAt).toISOString() : undefined,
        clientPartnerId: selectedClient?.id || null,
        // Campos estruturados
        addressStreet: form.addressStreet || undefined,
        addressNumber: form.addressNumber || undefined,
        addressComp: form.addressComp || undefined,
        neighborhood: form.neighborhood || undefined,
        city: cityName || undefined,
        state: form.state || undefined,
        cep: form.cep ? form.cep.replace(/\D/g, "") : undefined,
        // Atribuição de técnico
        techAssignmentMode: techMode,
        requiredSpecializationIds: techMode === "BY_SPECIALIZATION" ? selectedSpecs.map((s) => s.id) : [],
        directedTechnicianIds: techMode === "DIRECTED" ? selectedTechs.map((t) => t.id) : [],
        workflowTemplateId: techMode === "BY_WORKFLOW" ? selectedWorkflow?.id || undefined : undefined,
        // Contato no local
        contactPersonName: form.contactPersonName || undefined,
        // Tempo para aceitar (null = usa do fluxo)
        acceptTimeoutMinutes: acceptTimeoutMode === 'from_flow' ? null
          : acceptTimeoutMode === 'hours' ? acceptTimeoutValue * 60
          : acceptTimeoutValue,
        // Tempo para clicar a caminho (null = usa do fluxo)
        enRouteTimeoutMinutes: enRouteTimeoutMode === 'from_flow' ? null
          : enRouteTimeoutMode === 'hours' ? enRouteTimeoutValue * 60
          : enRouteTimeoutValue,
      });

      router.push(`/orders/${id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.payload?.message || err.message);
      } else {
        setError("Erro ao salvar OS");
      }
    } finally {
      setSaving(false);
      setGeocodingMsg(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
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
        <Link href={`/orders/${id}`} className="hover:text-blue-600">
          {title || "OS"}
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">Editar</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Editar OS</h1>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] || "bg-slate-100 text-slate-600"}`}
        >
          {STATUS_LABELS[status] || status}
        </span>
      </div>

      {isTerminal && (
        <div className="mb-4 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Esta OS está em status <strong>{STATUS_LABELS[status] || status}</strong> e não pode ser editada.
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <fieldset disabled={isTerminal} className="space-y-4">
          {/* Cliente (LookupField) */}
          <LookupField
            label="Cliente"
            placeholder="Selecione um cliente (opcional)"
            modalTitle="Buscar Cliente"
            modalPlaceholder="Nome, documento ou telefone..."
            value={selectedClient}
            displayValue={(c) => c.name}
            onChange={(c) => setSelectedClient(c)}
            fetcher={clientFetcher}
            keyExtractor={(c) => c.id}
            renderItem={(c) => (
              <div>
                <div className="font-medium text-slate-900">{c.name}</div>
                <div className="flex gap-3 text-xs text-slate-400 mt-0.5">
                  {c.document && <span>{c.document}</span>}
                  {c.phone && <span>{c.phone}</span>}
                </div>
              </div>
            )}
            disabled={isTerminal}
          />

          {/* Título */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">Título *</span>
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
            <span className="text-sm font-medium text-slate-700">Descrição</span>
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
          <TechAssignmentSection
            mode={techMode}
            onModeChange={setTechMode}
            selectedSpecializations={selectedSpecs}
            onSpecializationsChange={setSelectedSpecs}
            selectedTechnicians={selectedTechs}
            onTechniciansChange={setSelectedTechs}
            selectedWorkflow={selectedWorkflow}
            onWorkflowChange={setSelectedWorkflow}
            disabled={isTerminal}
          />

          {/* Tempo para aceitar */}
          <div className="border-t border-slate-200 pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              ⏱️ Tempo para aceitar
            </label>
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
          </div>

          {/* Tempo para clicar a caminho */}
          <div className="border-t border-slate-200 pt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              🚗 Tempo para clicar a caminho
            </label>
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
          </div>

          {/* Separador Endereço */}
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Endereço
            </h3>

            <div className="space-y-3">
              {/* Estado + Cidade */}
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700">Estado *</span>
                  <select
                    name="state"
                    value={form.state}
                    onChange={onChange}
                    required
                    className={`${inputClass} bg-white`}
                  >
                    <option value="">Selecione o UF</option>
                    {STATES.map((uf) => (
                      <option key={uf} value={uf}>
                        {uf} - {STATE_NAMES[uf]}
                      </option>
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
                  renderItem={(c) => (
                    <div className="font-medium text-slate-900">{c.nome}</div>
                  )}
                  disabled={!form.state || isTerminal}
                  required
                />
              </div>

              {/* CEP + Bairro */}
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700">
                    CEP
                    {cepLoading && (
                      <span className="ml-2 text-xs text-blue-500 font-normal">Buscando...</span>
                    )}
                  </span>
                  <input
                    name="cep"
                    value={form.cep}
                    onChange={onChange}
                    placeholder="00000-000"
                    maxLength={9}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700">Bairro</span>
                  <input
                    name="neighborhood"
                    value={form.neighborhood}
                    onChange={onChange}
                    onBlur={() => setForm((f) => ({ ...f, neighborhood: toTitleCase(f.neighborhood) }))}
                    placeholder="Bairro"
                    className={inputClass}
                  />
                </label>
              </div>

              {/* Rua + Número */}
              <div className="grid grid-cols-3 gap-4">
                <label className="flex flex-col gap-1.5 col-span-2">
                  <span className="text-sm font-medium text-slate-700">Rua *</span>
                  <input
                    name="addressStreet"
                    value={form.addressStreet}
                    onChange={onChange}
                    onBlur={() => setForm((f) => ({ ...f, addressStreet: toTitleCase(f.addressStreet) }))}
                    required
                    placeholder="Endereco"
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700">Número</span>
                  <input
                    name="addressNumber"
                    value={form.addressNumber}
                    onChange={onChange}
                    placeholder="Nº"
                    className={inputClass}
                  />
                </label>
              </div>

              {/* Complemento */}
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-700">Complemento</span>
                <input
                  name="addressComp"
                  value={form.addressComp}
                  onChange={onChange}
                  onBlur={() => setForm((f) => ({ ...f, addressComp: toTitleCase(f.addressComp) }))}
                  placeholder="Apt, Sala, Bloco..."
                  className={inputClass}
                />
              </label>
            </div>
          </div>

          {/* Valor e Prazo */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">Valor (R$) *</span>
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
              <span className="text-sm font-medium text-slate-700">Prazo de execução *</span>
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
            {!isTerminal && (
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Salvando..." : "Salvar Alterações"}
              </button>
            )}
            <Link
              href={`/orders/${id}`}
              className="rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Voltar
            </Link>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
