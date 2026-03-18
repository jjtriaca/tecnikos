"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { toTitleCase } from "@/lib/brazil-utils";

/* ===================================================================
   NFS-e EMISSION MODAL — 3-Phase Flow
   Phase 1: FORM   — Preview + edit data + confirm emission
   Phase 2: PROCESSING — Spinner + polling for authorization
   Phase 3: SEND   — Success + send via Email / WhatsApp
   =================================================================== */

type Phase = "FORM" | "PROCESSING" | "SEND";

interface Props {
  financialEntryId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface NfsePreview {
  prestador: {
    cnpj: string;
    inscricaoMunicipal: string | null;
    codigoMunicipio: string | null;
    razaoSocial: string;
  };
  tomador: {
    partnerId: string | null;
    cnpjCpf: string;
    razaoSocial: string;
    email: string;
    telefone: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    codigoMunicipio: string;
    uf: string;
    cep: string;
    city: string;
  };
  servico: {
    valorServicosCents: number;
    aliquotaIss: number;
    issRetido: boolean;
    itemListaServico: string;
    codigoCnae: string;
    codigoTributarioMunicipio: string;
    discriminacao: string;
    naturezaOperacao: string;
    codigoMunicipioServico: string;
  };
  config: {
    optanteSimplesNacional: boolean;
    regimeEspecialTributacao: string | null;
    sendEmailToTomador: boolean;
    afterEmissionSendWhatsApp: boolean;
    codigoTributarioNacional: string;
    codigoTributarioNacionalServico: string;
  };
  financialEntry: {
    id: string;
    serviceOrderId: string | null;
    grossCents: number;
    netCents: number;
    description: string | null;
    nfseStatus: string | null;
  };
  obra: {
    id: string;
    name: string;
    cno: string;
    addressStreet: string;
    addressNumber: string;
    addressComp: string | null;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    ibgeCode: string | null;
  } | null;
  serviceCodes: {
    id: string;
    codigo: string;
    codigoNbs: string | null;
    descricao: string;
    tipo: string;
    aliquotaIss: number | null;
    itemListaServico: string | null;
    codigoCnae: string | null;
    codigoTribMunicipal: string | null;
  }[];
}

type TipoNota = "SERVICO" | "OBRA";

interface ObraOption {
  id: string;
  name: string;
  cno: string;
  addressStreet: string;
  addressNumber: string;
  addressComp: string | null;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  ibgeCode: string | null;
  active: boolean;
}

interface EmissionData {
  id: string;
  status: string;
  nfseNumber?: string;
  codigoVerificacao?: string;
  rpsNumber?: number;
  rpsSeries?: string;
  tomadorRazaoSocial?: string;
  tomadorEmail?: string;
  valorServicos?: number;
  errorMessage?: string;
  pdfUrl?: string;
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCnpjCpf(v: string): string {
  const d = v.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v;
}

const NATUREZA_LABELS: Record<string, string> = {
  "1": "Tributacao no municipio",
  "2": "Tributacao fora do municipio",
  "3": "Isencao",
  "4": "Imune",
  "5": "Exigibilidade suspensa por decisao judicial",
  "6": "Exigibilidade suspensa por proc. administrativo",
};

const POLL_INTERVAL = 3000; // 3 seconds
const POLL_TIMEOUT = 180000; // 3 minutes

export default function NfseEmissionModal({ financialEntryId, open, onClose, onSuccess }: Props) {
  const { toast } = useToast();

  // Phase management
  const [phase, setPhase] = useState<Phase>("FORM");
  const [emissionId, setEmissionId] = useState<string | null>(null);
  const [emissionData, setEmissionData] = useState<EmissionData | null>(null);

  // FORM phase state
  const [loading, setLoading] = useState(true);
  const [emitting, setEmitting] = useState(false);
  const [preview, setPreview] = useState<NfsePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [tomadorCnpjCpf, setTomadorCnpjCpf] = useState("");
  const [tomadorRazaoSocial, setTomadorRazaoSocial] = useState("");
  const [tomadorEmail, setTomadorEmail] = useState("");
  const [tomadorLogradouro, setTomadorLogradouro] = useState("");
  const [tomadorNumero, setTomadorNumero] = useState("");
  const [tomadorComplemento, setTomadorComplemento] = useState("");
  const [tomadorBairro, setTomadorBairro] = useState("");
  const [tomadorCodigoMunicipio, setTomadorCodigoMunicipio] = useState("");
  const [tomadorUf, setTomadorUf] = useState("");
  const [tomadorCep, setTomadorCep] = useState("");
  const [discriminacao, setDiscriminacao] = useState("");
  const [aliquotaIss, setAliquotaIss] = useState("");
  const [issRetido, setIssRetido] = useState(false);

  // Tipo de nota + Obra state
  const [tipoNota, setTipoNota] = useState<TipoNota>("SERVICO");
  const [obras, setObras] = useState<ObraOption[]>([]);
  const [selectedObraId, setSelectedObraId] = useState<string>("");
  const [loadingObras, setLoadingObras] = useState(false);
  const [selectedServiceCodeId, setSelectedServiceCodeId] = useState<string>("");

  // SEND phase state
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [sending, setSending] = useState(false);

  // Polling refs
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartRef = useRef<number>(0);

  // Reset all state when modal opens
  useEffect(() => {
    if (open) {
      setPhase("FORM");
      setEmissionId(null);
      setEmissionData(null);
      setError(null);
      setEmitting(false);
      setSending(false);
      setSelectedServiceCodeId("");
    } else {
      // Clean up polling when modal closes
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
  }, [open]);

  // Load preview
  const loadPreview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<NfsePreview>(`/nfse-emission/preview/${financialEntryId}`);
      setPreview(data);
      setTomadorCnpjCpf(data.tomador.cnpjCpf);
      setTomadorRazaoSocial(data.tomador.razaoSocial);
      setTomadorEmail(data.tomador.email);
      setTomadorLogradouro(data.tomador.logradouro);
      setTomadorNumero(data.tomador.numero);
      setTomadorComplemento(data.tomador.complemento);
      setTomadorBairro(data.tomador.bairro);
      setTomadorCodigoMunicipio(data.tomador.codigoMunicipio);
      setTomadorUf(data.tomador.uf);
      setTomadorCep(data.tomador.cep);
      setDiscriminacao(data.servico.discriminacao);
      setAliquotaIss(String(data.servico.aliquotaIss || ""));
      setIssRetido(data.servico.issRetido);
      // Set tipo nota default based on linked obra
      if (data.obra) {
        setTipoNota("OBRA");
        setSelectedObraId(data.obra.id);
      } else {
        setTipoNota("SERVICO");
        setSelectedObraId("");
      }
      // Set defaults from config
      setSendEmail(data.config.sendEmailToTomador);
      setSendWhatsApp(data.config.afterEmissionSendWhatsApp);
    } catch (err: any) {
      setError(err?.message || "Erro ao carregar dados da NFS-e");
    } finally {
      setLoading(false);
    }
  }, [financialEntryId]);

  useEffect(() => {
    if (open && phase === "FORM") loadPreview();
  }, [open, loadPreview, phase]);

  // ═══════════════════════════════════════════
  // Fetch obras when tipo = OBRA
  // ═══════════════════════════════════════════
  useEffect(() => {
    if (tipoNota !== "OBRA" || !preview?.tomador?.partnerId) {
      setObras([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingObras(true);
      try {
        const data = await api.get<ObraOption[]>(`/obras?partnerId=${preview.tomador.partnerId}&activeOnly=true`);
        if (!cancelled) setObras(data);
      } catch {
        if (!cancelled) setObras([]);
      } finally {
        if (!cancelled) setLoadingObras(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tipoNota, preview?.tomador?.partnerId]);

  // Derived: selected obra object
  const selectedObra = obras.find((o) => o.id === selectedObraId) || (preview?.obra?.id === selectedObraId ? preview.obra : null);

  // ═══════════════════════════════════════════
  // Polling logic for PROCESSING phase
  // ═══════════════════════════════════════════
  useEffect(() => {
    if (phase !== "PROCESSING" || !emissionId) return;

    pollStartRef.current = Date.now();

    const poll = async () => {
      try {
        const result = await api.post<EmissionData>(`/nfse-emission/emissions/${emissionId}/refresh`);
        setEmissionData(result);

        if (result.status === "AUTHORIZED") {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setPhase("SEND");
          return;
        }

        if (result.status === "ERROR") {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setError(result.errorMessage || "Erro na autorizacao da NFS-e");
          return;
        }

        // Check timeout
        if (Date.now() - pollStartRef.current > POLL_TIMEOUT) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setError("Tempo limite de aguardo excedido (3 min). A NFS-e continua em processamento na prefeitura. Voce pode verificar o status posteriormente na listagem de notas.");
          return;
        }
      } catch (err: any) {
        // Don't stop polling on network errors
        console.warn("Poll error:", err);
      }
    };

    // First poll immediately
    poll();
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [phase, emissionId]);

  // ═══════════════════════════════════════════
  // FORM phase: Emit
  // ═══════════════════════════════════════════
  async function handleEmit() {
    if (!preview) return;
    if (!tomadorCnpjCpf) { toast("CPF/CNPJ do tomador e obrigatorio.", "error"); return; }
    if (!discriminacao) { toast("Discriminacao do servico e obrigatoria.", "error"); return; }
    if (!tomadorLogradouro) { toast("Endereco do tomador e obrigatorio.", "error"); return; }
    if (!tomadorBairro) { toast("Bairro do tomador e obrigatorio.", "error"); return; }
    if (!tomadorUf) { toast("UF do tomador e obrigatoria.", "error"); return; }
    if (!tomadorCep) { toast("CEP do tomador e obrigatorio.", "error"); return; }
    if (!tomadorCodigoMunicipio) { toast("Codigo do municipio (IBGE) do tomador e obrigatorio.", "error"); return; }
    if (tipoNota === "OBRA" && !selectedObraId) { toast("Selecione uma obra para emitir nota de obra.", "error"); return; }

    setEmitting(true);
    try {
      const result = await api.post<EmissionData>("/nfse-emission/emit", {
        financialEntryId,
        serviceOrderId: preview.financialEntry.serviceOrderId,
        tipoNota,
        ...(selectedServiceCodeId ? { serviceCodeId: selectedServiceCodeId } : {}),
        ...(tipoNota === "OBRA" && selectedObraId ? { obraId: selectedObraId } : {}),
        tomadorCnpjCpf,
        tomadorRazaoSocial,
        tomadorEmail,
        tomadorLogradouro,
        tomadorNumero: tomadorNumero || "S/N",
        tomadorComplemento,
        tomadorBairro,
        tomadorCodigoMunicipio,
        tomadorUf,
        tomadorCep,
        valorServicosCents: preview.servico.valorServicosCents,
        aliquotaIss: aliquotaIss ? parseFloat(aliquotaIss) : undefined,
        issRetido,
        itemListaServico: preview.servico.itemListaServico,
        codigoCnae: preview.servico.codigoCnae,
        codigoTributarioMunicipio: preview.servico.codigoTributarioMunicipio,
        discriminacao,
        naturezaOperacao: preview.servico.naturezaOperacao,
        codigoMunicipioServico: preview.servico.codigoMunicipioServico,
      });

      setEmissionId(result.id);
      setEmissionData(result);

      // If already authorized synchronously
      if (result.status === "AUTHORIZED") {
        setPhase("SEND");
      } else if (result.status === "ERROR") {
        setError(result.errorMessage || "Erro na emissao");
      } else {
        // PROCESSING — go to phase 2
        setPhase("PROCESSING");
      }
    } catch (err: any) {
      toast(err?.message || "Erro ao emitir NFS-e", "error");
    } finally {
      setEmitting(false);
    }
  }

  // ═══════════════════════════════════════════
  // SEND phase: Send email and/or WhatsApp
  // ═══════════════════════════════════════════
  async function handleSend() {
    if (!emissionId) return;
    setSending(true);
    try {
      const promises: Promise<any>[] = [];

      if (sendEmail && tomadorEmail) {
        promises.push(
          api.post(`/nfse-emission/emissions/${emissionId}/resend-email`, { emails: [tomadorEmail] })
        );
      }

      if (sendWhatsApp) {
        promises.push(
          api.post(`/nfse-emission/emissions/${emissionId}/send-whatsapp`)
        );
      }

      if (promises.length > 0) {
        await Promise.allSettled(promises);
        toast("NFS-e enviada com sucesso!", "success");
      }

      onSuccess();
    } catch (err: any) {
      toast(err?.message || "Erro ao enviar NFS-e", "error");
    } finally {
      setSending(false);
    }
  }

  function handleCloseWithoutSend() {
    onSuccess();
  }

  // Block close during processing (user must wait or it will timeout)
  function handleOverlayClick() {
    if (phase === "PROCESSING") return; // Block close during processing
    onClose();
  }

  function handleCloseClick() {
    if (phase === "PROCESSING") return; // Block close during processing
    onClose();
  }

  if (!open) return null;

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleOverlayClick}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            {phase === "FORM" && (
              <>
                <h2 className="text-lg font-bold text-slate-900">Emitir NFS-e</h2>
                <p className="text-xs text-slate-500 mt-0.5">Confirme os dados antes de emitir</p>
              </>
            )}
            {phase === "PROCESSING" && (
              <>
                <h2 className="text-lg font-bold text-slate-900">Processando NFS-e</h2>
                <p className="text-xs text-slate-500 mt-0.5">Aguardando autorizacao da prefeitura...</p>
              </>
            )}
            {phase === "SEND" && (
              <>
                <h2 className="text-lg font-bold text-green-700">NFS-e Autorizada!</h2>
                <p className="text-xs text-slate-500 mt-0.5">Enviar notificacao ao tomador</p>
              </>
            )}
          </div>
          {phase !== "PROCESSING" && (
            <button onClick={handleCloseClick} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
          )}
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* ════════════════════════════════════════════
              PHASE 1: FORM
              ════════════════════════════════════════════ */}
          {phase === "FORM" && (
            <>
              {loading && (
                <div className="space-y-3">
                  <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
                  <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
                  <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {preview && !loading && (
                <>
                  {/* Valor */}
                  <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-800">Valor dos Servicos</span>
                    <span className="text-lg font-bold text-blue-900">{formatCurrency(preview.servico.valorServicosCents)}</span>
                  </div>

                  {/* Prestador */}
                  <div className="rounded-lg border border-slate-200 p-4">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Prestador</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-slate-500">CNPJ:</span>
                        <span className="ml-1 font-medium text-slate-800">{formatCnpjCpf(preview.prestador.cnpj || "")}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Razao Social:</span>
                        <span className="ml-1 font-medium text-slate-800">{preview.prestador.razaoSocial}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">IM:</span>
                        <span className="ml-1 font-medium text-slate-800">{preview.prestador.inscricaoMunicipal || "\u2014"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Cod. Municipio:</span>
                        <span className="ml-1 font-medium text-slate-800">{preview.prestador.codigoMunicipio || "\u2014"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tomador (editavel) */}
                  <div className="rounded-lg border border-slate-200 p-4">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tomador</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">CPF/CNPJ *</label>
                        <input
                          type="text"
                          value={tomadorCnpjCpf}
                          onChange={(e) => setTomadorCnpjCpf(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Razao Social</label>
                        <input
                          type="text"
                          value={tomadorRazaoSocial}
                          onChange={(e) => setTomadorRazaoSocial(e.target.value)}
                          onBlur={() => setTomadorRazaoSocial(toTitleCase(tomadorRazaoSocial))}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                        <input
                          type="email"
                          value={tomadorEmail}
                          onChange={(e) => setTomadorEmail(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Endereco do tomador */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Endereco</p>
                      {(!tomadorLogradouro || !tomadorBairro || !tomadorUf || !tomadorCep || !tomadorCodigoMunicipio) && (
                        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 mb-2">
                          Endereco incompleto — preencha todos os campos obrigatorios para emitir a NFS-e.
                        </div>
                      )}
                      <div className="grid grid-cols-6 gap-2">
                        <div className="col-span-4">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Endereco *</label>
                          <input type="text" value={tomadorLogradouro} onChange={(e) => setTomadorLogradouro(e.target.value)}
                            onBlur={() => setTomadorLogradouro(toTitleCase(tomadorLogradouro))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Numero</label>
                          <input type="text" value={tomadorNumero} onChange={(e) => setTomadorNumero(e.target.value)} placeholder="S/N"
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Complemento</label>
                          <input type="text" value={tomadorComplemento} onChange={(e) => setTomadorComplemento(e.target.value)}
                            onBlur={() => setTomadorComplemento(toTitleCase(tomadorComplemento))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Bairro *</label>
                          <input type="text" value={tomadorBairro} onChange={(e) => setTomadorBairro(e.target.value)}
                            onBlur={() => setTomadorBairro(toTitleCase(tomadorBairro))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">CEP *</label>
                          <input type="text" value={tomadorCep} onChange={(e) => setTomadorCep(e.target.value)} placeholder="00000-000"
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="col-span-1">
                          <label className="block text-xs font-medium text-slate-600 mb-1">UF *</label>
                          <input type="text" value={tomadorUf} onChange={(e) => setTomadorUf(e.target.value.toUpperCase())} maxLength={2}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Cod. Municipio IBGE *</label>
                          <input type="text" value={tomadorCodigoMunicipio} onChange={(e) => setTomadorCodigoMunicipio(e.target.value)} placeholder="7 digitos"
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Servico (editavel) */}
                  <div className="rounded-lg border border-slate-200 p-4">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Servico</h3>

                    {/* Tipo de NFS-e toggle */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">Tipo de NFS-e</label>
                      <div className="flex gap-1 rounded-lg border border-slate-300 p-1">
                        {(["SERVICO", "OBRA"] as TipoNota[]).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => { setTipoNota(t); setSelectedServiceCodeId(""); }}
                            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                              tipoNota === t
                                ? "bg-blue-600 text-white"
                                : "text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            {t === "SERVICO" ? "Servico" : "Obra"}
                          </button>
                        ))}
                      </div>
                      {/* Servico habilitado (cTribNac selector) */}
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Servico *</label>
                        {(preview.serviceCodes || []).filter(sc => sc.tipo === tipoNota).length > 0 ? (
                          <select
                            value={selectedServiceCodeId}
                            onChange={(e) => {
                              const id = e.target.value;
                              setSelectedServiceCodeId(id);
                              const sc = (preview.serviceCodes || []).find(s => s.id === id);
                              if (sc) {
                                if (sc.aliquotaIss != null) setAliquotaIss(String(sc.aliquotaIss));
                              }
                            }}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          >
                            <option value="">Selecione o servico...</option>
                            {(preview.serviceCodes || []).filter(sc => sc.tipo === tipoNota).map((sc) => (
                              <option key={sc.id} value={sc.id}>
                                {sc.codigo} — {sc.descricao}{sc.codigoNbs ? ` (NBS: ${sc.codigoNbs})` : ""}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <>
                            <input
                              type="text"
                              readOnly
                              value={
                                tipoNota === "SERVICO"
                                  ? preview.config.codigoTributarioNacionalServico || preview.config.codigoTributarioNacional || ""
                                  : preview.config.codigoTributarioNacional || ""
                              }
                              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm text-slate-700 font-medium outline-none cursor-default"
                            />
                            <p className="mt-1 text-xs text-amber-600">Nenhum servico cadastrado. Configure em Configuracoes &gt; Fiscal &gt; Servicos Habilitados.</p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Obra selector (only when tipo=OBRA) */}
                    {tipoNota === "OBRA" && (
                      <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-2">
                        <label className="block text-xs font-medium text-amber-800 mb-1">Obra *</label>
                        {loadingObras ? (
                          <div className="h-9 animate-pulse rounded-lg bg-amber-100" />
                        ) : obras.length === 0 && !preview.obra ? (
                          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700 space-y-1">
                            <p className="font-semibold">Nenhuma obra cadastrada para este parceiro.</p>
                            <p>Para emitir NFS-e de obra, primeiro cadastre a obra (CNO + endereço) no cadastro do parceiro: <strong>Parceiros &gt; Editar &gt; Obras</strong>.</p>
                          </div>
                        ) : (
                          <select
                            value={selectedObraId}
                            onChange={(e) => setSelectedObraId(e.target.value)}
                            className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          >
                            <option value="">Selecione uma obra...</option>
                            {obras.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name} — CNO: {o.cno}
                              </option>
                            ))}
                            {/* If preview.obra exists but is not in the obras list (e.g. inactive), still show it */}
                            {preview.obra && !obras.find((o) => o.id === preview.obra!.id) && (
                              <option key={preview.obra.id} value={preview.obra.id}>
                                {preview.obra.name} — CNO: {preview.obra.cno}
                              </option>
                            )}
                          </select>
                        )}
                        {/* Selected obra details */}
                        {selectedObra && (
                          <div className="rounded-md bg-white border border-amber-200 px-3 py-2 text-xs text-slate-700 space-y-0.5">
                            <div><span className="text-slate-500">CNO:</span> <span className="font-medium">{selectedObra.cno}</span></div>
                            <div>
                              <span className="text-slate-500">Endereco:</span>{" "}
                              <span className="font-medium">
                                {selectedObra.addressStreet}, {selectedObra.addressNumber}
                                {selectedObra.addressComp ? ` - ${selectedObra.addressComp}` : ""}
                                {" — "}{selectedObra.neighborhood}, {selectedObra.city}/{selectedObra.state} — CEP: {selectedObra.cep}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Discriminacao *</label>
                        <textarea
                          value={discriminacao}
                          onChange={(e) => setDiscriminacao(e.target.value)}
                          rows={3}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Aliquota ISS (%)</label>
                        <input
                          type="text"
                          value={aliquotaIss}
                          onChange={(e) => setAliquotaIss(e.target.value)}
                          placeholder="Ex: 3.0"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={issRetido}
                            onChange={(e) => setIssRetido(e.target.checked)}
                            className="rounded border-slate-300"
                          />
                          ISS Retido
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-slate-500">
                      <div>Item LC 116: <span className="font-medium text-slate-700">{preview.servico.itemListaServico || "\u2014"}</span></div>
                      <div>CNAE: <span className="font-medium text-slate-700">{preview.servico.codigoCnae || "\u2014"}</span></div>
                      <div>Natureza: <span className="font-medium text-slate-700">{NATUREZA_LABELS[preview.servico.naturezaOperacao] || preview.servico.naturezaOperacao}</span></div>
                    </div>
                  </div>

                  {/* ISS Preview */}
                  {aliquotaIss && (
                    <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between text-sm">
                      <span className="text-slate-600">ISS estimado ({aliquotaIss}%)</span>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(Math.round(preview.servico.valorServicosCents * (parseFloat(aliquotaIss) || 0) / 100))}
                      </span>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ════════════════════════════════════════════
              PHASE 2: PROCESSING
              ════════════════════════════════════════════ */}
          {phase === "PROCESSING" && (
            <div className="flex flex-col items-center py-8 space-y-6">
              {!error ? (
                <>
                  {/* Spinner */}
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-slate-200 rounded-full" />
                    <div className="absolute inset-0 w-16 h-16 border-4 border-t-blue-600 rounded-full animate-spin" />
                  </div>

                  <div className="text-center">
                    <p className="text-base font-semibold text-slate-800">Aguardando autorizacao da prefeitura...</p>
                    <p className="text-sm text-slate-500 mt-1">Isso pode levar alguns segundos</p>
                  </div>

                  {/* Emission info */}
                  {emissionData && (
                    <div className="w-full rounded-lg border border-slate-200 p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Tomador</span>
                        <span className="font-medium text-slate-800">{emissionData.tomadorRazaoSocial || tomadorRazaoSocial || "\u2014"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Valor</span>
                        <span className="font-medium text-slate-800">{formatCurrency(emissionData.valorServicos || preview?.servico.valorServicosCents || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">RPS</span>
                        <span className="font-medium text-slate-800">{emissionData.rpsSeries || ""}{emissionData.rpsNumber || ""}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Status</span>
                        <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
                          <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                          Processando
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Error state */}
                  <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold text-red-800">Erro na autorizacao</p>
                    <p className="text-sm text-red-600 mt-1">{error}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════
              PHASE 3: SEND
              ════════════════════════════════════════════ */}
          {phase === "SEND" && emissionData && (
            <div className="space-y-5">
              {/* Success banner */}
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800">NFS-e Autorizada com Sucesso!</p>
                    <div className="flex gap-4 mt-1 text-xs text-green-700">
                      <span>Numero: <strong>{emissionData.nfseNumber || "N/A"}</strong></span>
                      <span>Cod. Verificacao: <strong>{emissionData.codigoVerificacao || "N/A"}</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Emission summary */}
              <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Tomador</span>
                  <span className="font-medium text-slate-800">{emissionData.tomadorRazaoSocial || "\u2014"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Valor</span>
                  <span className="font-medium text-slate-800">{formatCurrency(emissionData.valorServicos || 0)}</span>
                </div>
              </div>

              {/* Send options */}
              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Enviar NFS-e ao Tomador</h4>

                {tomadorEmail ? (
                  <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <div>
                      <span className="font-medium">Enviar por Email</span>
                      <p className="text-xs text-slate-400">{tomadorEmail}</p>
                    </div>
                  </label>
                ) : (
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <input type="checkbox" disabled className="rounded border-slate-200" />
                    <div>
                      <span className="font-medium">Enviar por Email</span>
                      <p className="text-xs">Email do tomador nao informado</p>
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendWhatsApp}
                    onChange={(e) => setSendWhatsApp(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <div>
                    <span className="font-medium">Enviar por WhatsApp</span>
                    <p className="text-xs text-slate-400">Envia dados da NFS-e e PDF via WhatsApp</p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 rounded-b-2xl flex justify-end gap-2">
          {phase === "FORM" && (
            <>
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEmit}
                disabled={emitting || loading || !!error || (tipoNota === "OBRA" && !selectedObraId)}
                className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {emitting ? "Emitindo..." : "Confirmar e Emitir NFS-e"}
              </button>
            </>
          )}

          {phase === "PROCESSING" && (
            <>
              {error ? (
                <button
                  onClick={() => { onSuccess(); }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Fechar
                </button>
              ) : (
                <p className="text-xs text-slate-400 italic">Aguardando resposta da prefeitura...</p>
              )}
            </>
          )}

          {phase === "SEND" && (
            <>
              <button
                onClick={handleCloseWithoutSend}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Fechar sem Enviar
              </button>
              <button
                onClick={handleSend}
                disabled={sending || (!sendEmail && !sendWhatsApp)}
                className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {sending ? "Enviando..." : "Enviar e Fechar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
