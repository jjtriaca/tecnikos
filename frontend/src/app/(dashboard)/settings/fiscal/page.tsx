"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import PasswordInput from "@/components/ui/PasswordInput";
import { useFiscalModule } from "@/contexts/FiscalModuleContext";
import ctribnacRef from "@/lib/ctribnac-ref.json";

/* ===================================================================
   FISCAL SETTINGS — Tax Regime + NFS-e Configuration
   =================================================================== */

interface FiscalConfig {
  taxRegime: string;
  crt: number;
  cnae: string | null;
  suframa: string | null;
  fiscalProfile: string;
  contabilistName: string | null;
  contabilistCpf: string | null;
  contabilistCrc: string | null;
  contabilistCnpj: string | null;
  contabilistCep: string | null;
  contabilistPhone: string | null;
  contabilistEmail: string | null;
}

const EMPTY_FISCAL: FiscalConfig = {
  taxRegime: "SN",
  crt: 1,
  cnae: null,
  suframa: null,
  fiscalProfile: "A",
  contabilistName: null,
  contabilistCpf: null,
  contabilistCrc: null,
  contabilistCnpj: null,
  contabilistCep: null,
  contabilistPhone: null,
  contabilistEmail: null,
};

interface NfseConfig {
  id?: string;
  companyId?: string;
  focusNfeToken: string | null;
  focusNfeEnvironment: string;
  inscricaoMunicipal: string | null;
  codigoMunicipio: string | null;
  naturezaOperacao: string;
  regimeEspecialTributacao: string | null;
  optanteSimplesNacional: boolean;
  itemListaServico: string | null;
  codigoCnae: string | null;
  codigoTributarioMunicipio: string | null;
  codigoTributarioNacional: string | null;
  codigoTributarioNacionalServico: string | null;
  nfseLayout: string;
  aliquotaIss: number | null;
  autoEmitOnEntry: boolean;
  askOnFinishOS: boolean;
  receiveWithoutNfse: string;
  sendEmailToTomador: boolean;
  afterEmissionSendWhatsApp: boolean;
  rpsSeries: string;
  defaultDiscriminacao: string | null;
}

const EMPTY_CONFIG: NfseConfig = {
  focusNfeToken: null,
  focusNfeEnvironment: "HOMOLOGATION",
  inscricaoMunicipal: null,
  codigoMunicipio: null,
  naturezaOperacao: "1",
  regimeEspecialTributacao: null,
  optanteSimplesNacional: false,
  itemListaServico: null,
  codigoCnae: null,
  codigoTributarioMunicipio: null,
  codigoTributarioNacional: null,
  codigoTributarioNacionalServico: null,
  nfseLayout: "MUNICIPAL",
  aliquotaIss: null,
  autoEmitOnEntry: false,
  askOnFinishOS: true,
  receiveWithoutNfse: "WARN",
  sendEmailToTomador: true,
  afterEmissionSendWhatsApp: false,
  rpsSeries: "A",
  defaultDiscriminacao: null,
};

const NATUREZA_OPTIONS = [
  { value: "1", label: "1 - Tributacao no municipio" },
  { value: "2", label: "2 - Tributacao fora do municipio" },
  { value: "3", label: "3 - Isencao" },
  { value: "4", label: "4 - Imune" },
  { value: "5", label: "5 - Exigibilidade suspensa - decisao judicial" },
  { value: "6", label: "6 - Exigibilidade suspensa - proc. administrativo" },
];

const REGIME_OPTIONS = [
  { value: "", label: "Nenhum" },
  { value: "1", label: "1 - Microempresa municipal" },
  { value: "2", label: "2 - Estimativa" },
  { value: "3", label: "3 - Sociedade de profissionais" },
  { value: "4", label: "4 - Cooperativa" },
  { value: "5", label: "5 - MEI" },
  { value: "6", label: "6 - ME/EPP Simples Nacional" },
];

const RECEIVE_WITHOUT_NFSE_OPTIONS = [
  { value: "IGNORE", label: "Ignorar - aceita recebimento sem nota" },
  { value: "WARN", label: "Avisar - alerta antes de receber sem nota" },
  { value: "BLOCK", label: "Bloquear - nao aceita receber sem nota emitida" },
];

const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors";
const labelClass = "block text-xs font-medium text-slate-600 mb-1";

/** Extract only user-editable fields for dirty comparison (avoids id/timestamps/token masking issues) */
function editableSnapshot(c: NfseConfig, t: string): string {
  return JSON.stringify([
    c.focusNfeEnvironment, c.inscricaoMunicipal, c.codigoMunicipio,
    c.naturezaOperacao, c.regimeEspecialTributacao, c.optanteSimplesNacional,
    c.itemListaServico, c.codigoCnae, c.codigoTributarioMunicipio, c.codigoTributarioNacional, c.codigoTributarioNacionalServico,
    c.nfseLayout, c.aliquotaIss, c.autoEmitOnEntry, c.askOnFinishOS, c.receiveWithoutNfse,
    c.sendEmailToTomador, c.afterEmissionSendWhatsApp, c.rpsSeries, c.defaultDiscriminacao, t,
  ]);
}

export default function FiscalSettingsPage() {
  const { fiscalEnabled, refresh: refreshFiscal } = useFiscalModule();
  const [config, setConfig] = useState<NfseConfig>(EMPTY_CONFIG);
  const [fiscal, setFiscal] = useState<FiscalConfig>(EMPTY_FISCAL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingFiscal, setSavingFiscal] = useState(false);
  const [togglingModule, setTogglingModule] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [savedFiscalSnapshot, setSavedFiscalSnapshot] = useState<string>("");
  // Service codes
  const [serviceCodes, setServiceCodes] = useState<any[]>([]);
  const [editingCode, setEditingCode] = useState<any | null>(null);
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [savingCode, setSavingCode] = useState(false);
  const [codeSearch, setCodeSearch] = useState("");
  const [showCodeDropdown, setShowCodeDropdown] = useState(false);
  const codeSearchRef = useRef<HTMLDivElement>(null);
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentSnapshot = editableSnapshot(config, token);
  const isDirty = savedSnapshot !== "" && currentSnapshot !== savedSnapshot;
  const fiscalSnapshot = JSON.stringify(fiscal);
  const isFiscalDirty = savedFiscalSnapshot !== "" && fiscalSnapshot !== savedFiscalSnapshot;

  function flashSuccess(msg = "Configuracoes salvas com sucesso!", ms = 3000) {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setSuccessMsg(msg);
    successTimerRef.current = setTimeout(() => setSuccessMsg(null), ms);
  }

  const fetchConfig = useCallback(async () => {
    try {
      const data = await api.get<NfseConfig | null>("/nfse-emission/config");
      if (data) {
        setConfig(data);
        const t = data.focusNfeToken || "";
        if (t) setToken(t);
        setSavedSnapshot(editableSnapshot(data, t));
      } else {
        setSavedSnapshot(editableSnapshot(EMPTY_CONFIG, ""));
      }
    } catch {
      // Config not found — use defaults
      setSavedSnapshot(editableSnapshot(EMPTY_CONFIG, ""));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFiscalConfig = useCallback(async () => {
    try {
      const data = await api.get<FiscalConfig>("/companies/fiscal-config");
      if (data) {
        setFiscal(data);
        setSavedFiscalSnapshot(JSON.stringify(data));
      }
    } catch {
      // Fiscal config not available — use defaults
    }
  }, []);

  // Close search dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (codeSearchRef.current && !codeSearchRef.current.contains(e.target as Node)) {
        setShowCodeDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchServiceCodes = useCallback(async () => {
    try {
      const data = await api.get<any[]>("/nfse-emission/service-codes");
      setServiceCodes(data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchFiscalConfig();
    fetchServiceCodes();
  }, [fetchConfig, fetchFiscalConfig, fetchServiceCodes]);

  const emptyCode = { codigo: "", codigoNbs: "", descricao: "", tipo: "SERVICO", aliquotaIss: null as number | null, itemListaServico: "", codigoCnae: "", codigoTribMunicipal: "" };

  async function handleSaveServiceCode() {
    if (!editingCode?.codigo || !editingCode?.descricao) return;
    setSavingCode(true);
    try {
      if (editingCode.id) {
        await api.put(`/nfse-emission/service-codes/${editingCode.id}`, editingCode);
      } else {
        await api.post("/nfse-emission/service-codes", editingCode);
      }
      await fetchServiceCodes();
      setEditingCode(null);
      setShowCodeForm(false);
      flashSuccess("Servico salvo!");
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao salvar servico");
    } finally {
      setSavingCode(false);
    }
  }

  async function handleDeleteServiceCode(id: string) {
    if (!confirm("Excluir este servico?")) return;
    try {
      await api.del(`/nfse-emission/service-codes/${id}`);
      await fetchServiceCodes();
      flashSuccess("Servico excluido!");
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao excluir");
    }
  }

  async function handleToggleServiceCode(sc: any) {
    try {
      await api.put(`/nfse-emission/service-codes/${sc.id}`, { active: !sc.active });
      await fetchServiceCodes();
    } catch { /* ignore */ }
  }

  async function handleSave() {
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload: any = {
        focusNfeEnvironment: config.focusNfeEnvironment,
        inscricaoMunicipal: config.inscricaoMunicipal || undefined,
        codigoMunicipio: config.codigoMunicipio || undefined,
        naturezaOperacao: config.naturezaOperacao,
        regimeEspecialTributacao: config.regimeEspecialTributacao || undefined,
        optanteSimplesNacional: config.optanteSimplesNacional,
        itemListaServico: config.itemListaServico || undefined,
        codigoCnae: config.codigoCnae || undefined,
        codigoTributarioMunicipio: config.codigoTributarioMunicipio || undefined,
        codigoTributarioNacional: config.codigoTributarioNacional || undefined,
        codigoTributarioNacionalServico: config.codigoTributarioNacionalServico || undefined,
        nfseLayout: config.nfseLayout,
        aliquotaIss: config.aliquotaIss ?? undefined,
        autoEmitOnEntry: config.autoEmitOnEntry,
        askOnFinishOS: config.askOnFinishOS,
        receiveWithoutNfse: config.receiveWithoutNfse,
        sendEmailToTomador: config.sendEmailToTomador,
        afterEmissionSendWhatsApp: config.afterEmissionSendWhatsApp,
        rpsSeries: config.rpsSeries,
        defaultDiscriminacao: config.defaultDiscriminacao || undefined,
      };

      if (token && token !== "••••••••") {
        payload.focusNfeToken = token;
      }

      const result = await api.put<NfseConfig>("/nfse-emission/config", payload);
      setConfig(result);
      const t = result.focusNfeToken || token; // keep current token if API returns masked
      setToken(t);
      setSavedSnapshot(editableSnapshot(result, t));
      flashSuccess();
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao salvar configuracoes");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveFiscal() {
    setSavingFiscal(true);
    setErrorMsg(null);
    try {
      const payload: Record<string, any> = {};
      for (const [key, value] of Object.entries(fiscal)) {
        payload[key] = value;
      }
      const result = await api.patch<FiscalConfig>("/companies/fiscal-config", payload);
      setFiscal(result);
      setSavedFiscalSnapshot(JSON.stringify(result));
      flashSuccess("Configuracoes fiscais salvas com sucesso!");
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao salvar configuracoes fiscais");
    } finally {
      setSavingFiscal(false);
    }
  }

  async function handleToggleFiscal() {
    setTogglingModule(true);
    setErrorMsg(null);
    try {
      const next = !fiscalEnabled;
      await api.patch("/companies/fiscal-module", { fiscalEnabled: next });
      await refreshFiscal();
      flashSuccess(next ? "Modulo fiscal habilitado!" : "Modulo fiscal desabilitado!");
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao alterar modulo fiscal");
    } finally {
      setTogglingModule(false);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Fiscal</h1>
        </div>
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/settings" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
            Configuracoes
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-sm text-slate-700 font-medium">Fiscal</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Configuracoes Fiscais</h1>
        <p className="text-sm text-slate-500 mt-1">
          Regime tributario, dados do contabilista e emissao de NFS-e
        </p>
      </div>

      {/* Feedback */}
      {errorMsg && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 mb-4">
          {successMsg}
        </div>
      )}

      {/* ── Module Toggle ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${fiscalEnabled ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Modulo Fiscal (NFS-e)</h3>
              <p className="text-xs text-slate-400">
                {fiscalEnabled
                  ? "Habilitado — emissao de notas fiscais ativa"
                  : "Desabilitado — nenhuma funcionalidade fiscal visivel no sistema"}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleFiscal}
            disabled={togglingModule}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none ${
              fiscalEnabled ? "bg-green-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                fiscalEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {!fiscalEnabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center mb-6">
          <svg className="w-12 h-12 text-amber-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.694-.833-2.464 0L4.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          <h3 className="text-sm font-semibold text-amber-800 mb-1">Modulo fiscal desabilitado</h3>
          <p className="text-xs text-amber-600">
            Ative o modulo acima para configurar a emissao de NFS-e e ter acesso ao menu NFe.
          </p>
        </div>
      )}

      {!fiscalEnabled ? null : (<>

      {/* ── Regime Tributario ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          Regime Tributario
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Regime de Tributacao</label>
            <select
              value={fiscal.taxRegime}
              onChange={(e) => {
                const regime = e.target.value;
                const crtMap: Record<string, number> = { SN: 1, LP: 3, LR: 3 };
                setFiscal({ ...fiscal, taxRegime: regime, crt: crtMap[regime] ?? 3 });
              }}
              className={inputClass}
            >
              <option value="SN">Simples Nacional</option>
              <option value="LP">Lucro Presumido</option>
              <option value="LR">Lucro Real</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>CRT (Cod. Regime Trib.)</label>
            <input
              type="number"
              value={fiscal.crt}
              readOnly
              className={inputClass + " bg-slate-50 text-slate-500 cursor-not-allowed"}
            />
            <p className="text-xs text-slate-400 mt-1">Definido automaticamente pelo regime</p>
          </div>
          <div>
            <label className={labelClass}>Perfil EFD (SPED)</label>
            <select
              value={fiscal.fiscalProfile}
              onChange={(e) => setFiscal({ ...fiscal, fiscalProfile: e.target.value })}
              className={inputClass}
            >
              <option value="A">A — Completo</option>
              <option value="B">B — Intermediario</option>
              <option value="C">C — Simplificado</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">Determina nivel de detalhamento no SPED Fiscal</p>
          </div>
          <div>
            <label className={labelClass}>CNAE Principal</label>
            <input
              type="text"
              value={fiscal.cnae || ""}
              onChange={(e) => setFiscal({ ...fiscal, cnae: e.target.value || null })}
              placeholder="Ex: 4321500"
              maxLength={7}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Inscricao SUFRAMA</label>
            <input
              type="text"
              value={fiscal.suframa || ""}
              onChange={(e) => setFiscal({ ...fiscal, suframa: e.target.value || null })}
              placeholder="Se aplicavel"
              className={inputClass}
            />
            <p className="text-xs text-slate-400 mt-1">Apenas para empresas na Zona Franca de Manaus</p>
          </div>
        </div>
      </div>

      {/* ── Contabilista Responsavel ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          Contabilista Responsavel
          <span className="text-xs font-normal text-slate-400 ml-1">(obrigatorio para SPED)</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Nome</label>
            <input
              type="text"
              value={fiscal.contabilistName || ""}
              onChange={(e) => setFiscal({ ...fiscal, contabilistName: e.target.value || null })}
              placeholder="Nome completo"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>CPF</label>
            <input
              type="text"
              value={fiscal.contabilistCpf || ""}
              onChange={(e) => setFiscal({ ...fiscal, contabilistCpf: e.target.value || null })}
              placeholder="000.000.000-00"
              maxLength={14}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>CRC</label>
            <input
              type="text"
              value={fiscal.contabilistCrc || ""}
              onChange={(e) => setFiscal({ ...fiscal, contabilistCrc: e.target.value || null })}
              placeholder="Registro no CRC"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>CNPJ Escritorio</label>
            <input
              type="text"
              value={fiscal.contabilistCnpj || ""}
              onChange={(e) => setFiscal({ ...fiscal, contabilistCnpj: e.target.value || null })}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>CEP</label>
            <input
              type="text"
              value={fiscal.contabilistCep || ""}
              onChange={(e) => setFiscal({ ...fiscal, contabilistCep: e.target.value || null })}
              placeholder="00000-000"
              maxLength={9}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Telefone</label>
            <input
              type="text"
              value={fiscal.contabilistPhone || ""}
              onChange={(e) => setFiscal({ ...fiscal, contabilistPhone: e.target.value || null })}
              placeholder="(00) 00000-0000"
              className={inputClass}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={fiscal.contabilistEmail || ""}
              onChange={(e) => setFiscal({ ...fiscal, contabilistEmail: e.target.value || null })}
              placeholder="contabilidade@email.com"
              className={inputClass}
            />
          </div>
        </div>

        {/* Fiscal config save button */}
        <div className="flex justify-end mt-6 pt-4 border-t border-slate-100">
          <button
            onClick={handleSaveFiscal}
            disabled={savingFiscal || !isFiscalDirty}
            className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {savingFiscal ? "Salvando..." : "Salvar Dados Fiscais"}
          </button>
        </div>
      </div>

      {/* ── Separator — NFS-e Configuration ── */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
        <div className="relative flex justify-center">
          <span className="bg-slate-50 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Configuracoes NFS-e (Saida)
          </span>
        </div>
      </div>

      {/* ── Focus NFe Connection ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          Conexao Focus NFe
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Token de Acesso</label>
            <PasswordInput
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Token da API Focus NFe"
              className={inputClass}
            />
            <p className="text-xs text-slate-400 mt-1">Encontre em painel.focusnfe.com.br</p>
          </div>
          <div>
            <label className={labelClass}>Ambiente</label>
            <select
              value={config.focusNfeEnvironment}
              onChange={(e) => setConfig({ ...config, focusNfeEnvironment: e.target.value })}
              className={inputClass}
            >
              <option value="HOMOLOGATION">Homologacao (testes)</option>
              <option value="PRODUCTION">Producao</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Layout NFS-e</label>
            <select
              value={config.nfseLayout}
              onChange={(e) => setConfig({ ...config, nfseLayout: e.target.value })}
              className={inputClass}
            >
              <option value="MUNICIPAL">Municipal (ABRASF) — /v2/nfse</option>
              <option value="NACIONAL">Nacional (SPED) — /v2/nfsen</option>
            </select>
            <p className="text-xs text-slate-400 mt-1">Verifique qual layout seu municipio usa em focusnfe.com.br</p>
          </div>
        </div>
      </div>

      {/* ── Dados do Prestador ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          Dados do Prestador
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Inscricao Municipal</label>
            <input
              type="text"
              value={config.inscricaoMunicipal || ""}
              onChange={(e) => setConfig({ ...config, inscricaoMunicipal: e.target.value })}
              placeholder="Numero da IM"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Codigo Municipio (IBGE)</label>
            <input
              type="text"
              value={config.codigoMunicipio || ""}
              onChange={(e) => setConfig({ ...config, codigoMunicipio: e.target.value })}
              placeholder="7 digitos (ex: 3550308)"
              maxLength={7}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* ── Tributacao ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
          Tributacao
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Natureza da Operacao</label>
            <select
              value={config.naturezaOperacao}
              onChange={(e) => setConfig({ ...config, naturezaOperacao: e.target.value })}
              className={inputClass}
            >
              {NATUREZA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Regime Especial de Tributacao</label>
            <select
              value={config.regimeEspecialTributacao || ""}
              onChange={(e) => setConfig({ ...config, regimeEspecialTributacao: e.target.value || null })}
              className={inputClass}
            >
              {REGIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Aliquota ISS padrao (%)</label>
            <input
              type="number"
              step="0.01"
              value={config.aliquotaIss ?? ""}
              onChange={(e) => setConfig({ ...config, aliquotaIss: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="Ex: 3.0"
              className={inputClass}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={config.optanteSimplesNacional}
                onChange={(e) => setConfig({ ...config, optanteSimplesNacional: e.target.checked })}
                className="rounded border-slate-300"
              />
              Optante pelo Simples Nacional
            </label>
          </div>
        </div>
      </div>

      {/* ── Codigos do Servico ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>
          Codigos do Servico
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Item Lista Servico (LC 116)</label>
            <input
              type="text"
              value={config.itemListaServico || ""}
              onChange={(e) => setConfig({ ...config, itemListaServico: e.target.value })}
              placeholder="Ex: 14.01"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Codigo CNAE</label>
            <input
              type="text"
              value={config.codigoCnae || ""}
              onChange={(e) => setConfig({ ...config, codigoCnae: e.target.value })}
              placeholder="7 digitos (ex: 6201501)"
              maxLength={7}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Codigo Tributario Municipal</label>
            <input
              type="text"
              value={config.codigoTributarioMunicipio || ""}
              onChange={(e) => setConfig({ ...config, codigoTributarioMunicipio: e.target.value })}
              placeholder="Codigo da prefeitura"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* ── Servicos Habilitados na Prefeitura ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            Servicos Habilitados na Prefeitura
          </h3>
          <button
            onClick={() => { setEditingCode({ ...emptyCode }); setShowCodeForm(true); setCodeSearch(""); }}
            className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            + Novo Servico
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-4">Cadastre os servicos que sua empresa esta apta a prestar. Ao emitir NFS-e, voce selecionara o servico adequado.</p>

        {serviceCodes.length === 0 && !showCodeForm && (
          <div className="text-center py-8 text-slate-400 text-sm">
            Nenhum servico cadastrado. Clique em &quot;+ Novo Servico&quot; para adicionar.
          </div>
        )}

        {serviceCodes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-2 pr-3 font-medium">cTribNac</th>
                  <th className="pb-2 pr-3 font-medium">NBS</th>
                  <th className="pb-2 pr-3 font-medium">Descricao</th>
                  <th className="pb-2 pr-3 font-medium">Tipo</th>
                  <th className="pb-2 pr-3 font-medium">ISS %</th>
                  <th className="pb-2 pr-3 font-medium">LC 116</th>
                  <th className="pb-2 text-right font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {serviceCodes.map((sc) => (
                  <tr key={sc.id} className={`border-b border-slate-100 ${!sc.active ? "opacity-40" : ""}`}>
                    <td className="py-2 pr-3 font-mono">{sc.codigo}</td>
                    <td className="py-2 pr-3 font-mono text-slate-500">{sc.codigoNbs || "-"}</td>
                    <td className="py-2 pr-3">{sc.descricao}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sc.tipo === "OBRA" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                        {sc.tipo}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{sc.aliquotaIss != null ? `${sc.aliquotaIss}%` : "-"}</td>
                    <td className="py-2 pr-3 font-mono text-slate-500">{sc.itemListaServico || "-"}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleToggleServiceCode(sc)}
                        className={`mr-2 text-[10px] px-1.5 py-0.5 rounded ${sc.active ? "text-amber-600 hover:bg-amber-50" : "text-green-600 hover:bg-green-50"}`}
                      >
                        {sc.active ? "Desativar" : "Ativar"}
                      </button>
                      <button
                        onClick={() => { setEditingCode({ ...sc }); setShowCodeForm(true); }}
                        className="mr-2 text-blue-600 hover:text-blue-800"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteServiceCode(sc.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Inline form */}
        {showCodeForm && editingCode && (
          <div className="mt-4 p-4 border border-slate-200 rounded-lg bg-slate-50">
            <h4 className="text-xs font-semibold text-slate-600 mb-3">{editingCode.id ? "Editar Servico" : "Novo Servico"}</h4>

            {/* Searchable service selector — only for new items */}
            {!editingCode.id && (
              <div className="mb-4" ref={codeSearchRef}>
                <label className={labelClass}>Buscar servico na tabela nacional *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={codeSearch}
                    onChange={(e) => { setCodeSearch(e.target.value); setShowCodeDropdown(true); }}
                    onFocus={() => setShowCodeDropdown(true)}
                    placeholder="Digite o codigo, nome do servico ou item LC 116..."
                    className={inputClass + " pr-8"}
                  />
                  <svg className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  {showCodeDropdown && codeSearch.length >= 2 && (
                    <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-300 rounded-lg shadow-lg">
                      {(() => {
                        const q = codeSearch.toLowerCase();
                        const filtered = (ctribnacRef as { c: string; i: string; d: string }[]).filter(
                          (r) => r.c.includes(q) || r.d.toLowerCase().includes(q) || r.i.includes(q)
                        ).slice(0, 30);
                        if (filtered.length === 0) return <div className="px-3 py-2 text-xs text-slate-400">Nenhum resultado</div>;
                        return filtered.map((r) => (
                          <button
                            key={r.c}
                            type="button"
                            onClick={() => {
                              setEditingCode({
                                ...editingCode,
                                codigo: r.c,
                                descricao: r.d,
                                itemListaServico: r.i,
                                tipo: r.c.startsWith("07") ? "OBRA" : "SERVICO",
                              });
                              setCodeSearch(r.c + " — " + r.d);
                              setShowCodeDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b border-slate-100 last:border-0"
                          >
                            <span className="font-mono font-semibold text-blue-700">{r.c}</span>
                            <span className="text-slate-400 ml-1">(LC {r.i})</span>
                            <span className="text-slate-600 ml-2">{r.d}</span>
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                </div>
                {editingCode.codigo && (
                  <p className="mt-1 text-xs text-green-600">Selecionado: <span className="font-mono font-semibold">{editingCode.codigo}</span> — {editingCode.descricao}</p>
                )}
              </div>
            )}

            {/* Editable fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>cTribNac *</label>
                <input type="text" value={editingCode.codigo} onChange={(e) => setEditingCode({ ...editingCode, codigo: e.target.value })} placeholder="140601" maxLength={6} className={inputClass + " font-mono"} readOnly={!editingCode.id && !!editingCode.codigo} />
              </div>
              <div>
                <label className={labelClass}>Item NBS</label>
                <input type="text" value={editingCode.codigoNbs || ""} onChange={(e) => setEditingCode({ ...editingCode, codigoNbs: e.target.value })} placeholder="Ex: 1.0101.00.00" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Tipo</label>
                <select value={editingCode.tipo} onChange={(e) => setEditingCode({ ...editingCode, tipo: e.target.value })} className={inputClass}>
                  <option value="SERVICO">Servico</option>
                  <option value="OBRA">Obra</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label className={labelClass}>Descricao *</label>
                <input type="text" value={editingCode.descricao} onChange={(e) => setEditingCode({ ...editingCode, descricao: e.target.value })} placeholder="Descricao do servico" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Aliquota ISS (%)</label>
                <input type="number" step="0.01" value={editingCode.aliquotaIss ?? ""} onChange={(e) => setEditingCode({ ...editingCode, aliquotaIss: e.target.value ? parseFloat(e.target.value) : null })} placeholder="Ex: 5.00" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Item LC 116</label>
                <input type="text" value={editingCode.itemListaServico || ""} onChange={(e) => setEditingCode({ ...editingCode, itemListaServico: e.target.value })} placeholder="Ex: 14.06" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>CNAE</label>
                <input type="text" value={editingCode.codigoCnae || ""} onChange={(e) => setEditingCode({ ...editingCode, codigoCnae: e.target.value })} placeholder="Ex: 4322302" maxLength={7} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Cod. Trib. Municipal</label>
                <input type="text" value={editingCode.codigoTribMunicipal || ""} onChange={(e) => setEditingCode({ ...editingCode, codigoTribMunicipal: e.target.value })} placeholder="Codigo da prefeitura" className={inputClass} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSaveServiceCode} disabled={savingCode || !editingCode.codigo || !editingCode.descricao} className="px-4 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {savingCode ? "Salvando..." : "Salvar"}
              </button>
              <button onClick={() => { setShowCodeForm(false); setEditingCode(null); setCodeSearch(""); }} className="px-4 py-2 text-xs bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── RPS e Discriminacao ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          RPS e Discriminacao
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Serie RPS</label>
            <input
              type="text"
              value={config.rpsSeries}
              onChange={(e) => setConfig({ ...config, rpsSeries: e.target.value })}
              placeholder="A"
              maxLength={5}
              className={inputClass}
            />
          </div>
          <div className="md:col-span-1">
            <label className={labelClass}>&nbsp;</label>
            <p className="text-xs text-slate-400 py-2">
              O numero RPS e incrementado automaticamente a cada emissao.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <label className={labelClass}>Discriminacao padrao do servico</label>
          <textarea
            value={config.defaultDiscriminacao || ""}
            onChange={(e) => setConfig({ ...config, defaultDiscriminacao: e.target.value })}
            rows={3}
            placeholder="Descricao que aparece na NFS-e. Variaveis: {titulo_os}, {descricao_os}, {tecnico}"
            className={inputClass + " resize-none"}
          />
          <p className="text-xs text-slate-400 mt-1">
            Variaveis disponiveis: {"{titulo_os}"}, {"{descricao_os}"}, {"{tecnico}"}
          </p>
        </div>
      </div>

      {/* ── Comportamento ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Comportamento
        </h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoEmitOnEntry}
              onChange={(e) => setConfig({ ...config, autoEmitOnEntry: e.target.checked })}
              className="rounded border-slate-300"
            />
            <div>
              <span className="font-medium">Auto-emitir NFS-e ao criar lancamento a receber</span>
              <p className="text-xs text-slate-400">Quando um lancamento financeiro do tipo &quot;A Receber&quot; for criado, emitir a NFS-e automaticamente</p>
            </div>
          </label>

          <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={config.askOnFinishOS}
              onChange={(e) => setConfig({ ...config, askOnFinishOS: e.target.checked })}
              className="rounded border-slate-300"
            />
            <div>
              <span className="font-medium">Perguntar ao finalizar OS</span>
              <p className="text-xs text-slate-400">Ao concluir uma OS, perguntar se deseja emitir a NFS-e</p>
            </div>
          </label>

          <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={config.sendEmailToTomador}
              onChange={(e) => setConfig({ ...config, sendEmailToTomador: e.target.checked })}
              className="rounded border-slate-300"
            />
            <div>
              <span className="font-medium">Enviar email ao tomador</span>
              <p className="text-xs text-slate-400">Envia automaticamente o DANFSe por email ao tomador</p>
            </div>
          </label>

          <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={config.afterEmissionSendWhatsApp}
              onChange={(e) => setConfig({ ...config, afterEmissionSendWhatsApp: e.target.checked })}
              className="rounded border-slate-300"
            />
            <div>
              <span className="font-medium">Enviar NFS-e por WhatsApp ao tomador</span>
              <p className="text-xs text-slate-400">Apos emissao autorizada, envia dados da NFS-e e PDF via WhatsApp</p>
            </div>
          </label>

          <div>
            <label className={labelClass}>Recebimento sem NFS-e emitida</label>
            <select
              value={config.receiveWithoutNfse}
              onChange={(e) => setConfig({ ...config, receiveWithoutNfse: e.target.value })}
              className={inputClass}
            >
              {RECEIVE_WITHOUT_NFSE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Controla o que acontece ao tentar dar baixa em uma conta a receber sem nota fiscal emitida
            </p>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end pb-8">
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Salvando..." : "Salvar Configuracoes"}
        </button>
      </div>
      </>)}
    </div>
  );
}
