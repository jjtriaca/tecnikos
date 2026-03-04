"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError, getAccessToken } from "@/lib/api";

/* ── Types ──────────────────────────────────────────── */

type CompanyData = {
  id: string;
  name: string;
  tradeName: string | null;
  cnpj: string | null;
  ie: string | null;
  im: string | null;
  phone: string | null;
  email: string | null;
  cep: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComp: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  ownerName: string | null;
  ownerCpf: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  logoUrl: string | null;
  logoWidth: number | null;
  logoHeight: number | null;
  status: string;
  commissionBps: number;
  evalGestorWeight: number;
  evalClientWeight: number;
  evalMinRating: number;
  createdAt: string;
};

type BuildInfo = {
  version: string;
  codename: string;
  releasedAt: string;
  uptime: number;
};

type CompanyForm = {
  name: string;
  tradeName: string;
  cnpj: string;
  ie: string;
  im: string;
  phone: string;
  email: string;
  cep: string;
  addressStreet: string;
  addressNumber: string;
  addressComp: string;
  neighborhood: string;
  city: string;
  state: string;
  ownerName: string;
  ownerCpf: string;
  ownerPhone: string;
  ownerEmail: string;
  commissionPercent: string;
  evalGestorWeight: string;
  evalClientWeight: string;
  evalMinRating: string;
};

const STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

/* ── Masks ──────────────────────────────────────────── */

function maskCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.replace(/(\d{5})(\d)/, "$1-$2");
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

/* ── Helpers ────────────────────────────────────────── */

function companyToForm(c: CompanyData): CompanyForm {
  return {
    name: c.name || "",
    tradeName: c.tradeName || "",
    cnpj: c.cnpj || "",
    ie: c.ie || "",
    im: c.im || "",
    phone: c.phone || "",
    email: c.email || "",
    cep: c.cep || "",
    addressStreet: c.addressStreet || "",
    addressNumber: c.addressNumber || "",
    addressComp: c.addressComp || "",
    neighborhood: c.neighborhood || "",
    city: c.city || "",
    state: c.state || "",
    ownerName: c.ownerName || "",
    ownerCpf: c.ownerCpf || "",
    ownerPhone: c.ownerPhone || "",
    ownerEmail: c.ownerEmail || "",
    commissionPercent: (c.commissionBps / 100).toFixed(2),
    evalGestorWeight: String(c.evalGestorWeight ?? 40),
    evalClientWeight: String(c.evalClientWeight ?? 60),
    evalMinRating: String(c.evalMinRating ?? 3.0),
  };
}

/* ── Component ──────────────────────────────────────── */

export default function SettingsPage() {
  const { user } = useAuth();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const loadedVersionRef = useRef<string | null>(null);
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false);
  const [cnpjStatus, setCnpjStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoWidth, setLogoWidth] = useState(120);
  const [logoHeight, setLogoHeight] = useState(40);
  const [form, setForm] = useState<CompanyForm>({
    name: "", tradeName: "", cnpj: "", ie: "", im: "",
    phone: "", email: "",
    cep: "", addressStreet: "", addressNumber: "", addressComp: "",
    neighborhood: "", city: "", state: "",
    ownerName: "", ownerCpf: "", ownerPhone: "", ownerEmail: "",
    commissionPercent: "",
    evalGestorWeight: "40", evalClientWeight: "60", evalMinRating: "3.0",
  });

  const isAdmin = user?.role === "ADMIN";
  const savedFormRef = useRef<string>("");
  const isDirty = JSON.stringify(form) !== savedFormRef.current;
  const savedLogoDimsRef = useRef<string>("");
  const isLogoDimsDirty = JSON.stringify({ logoWidth, logoHeight }) !== savedLogoDimsRef.current;
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Show success toast for `ms` milliseconds, cancelling any previous timer */
  function flashSuccess(msg = "Configuracoes salvas com sucesso!", ms = 3000) {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setSuccessMsg(msg);
    successTimerRef.current = setTimeout(() => setSuccessMsg(null), ms);
  }

  const loadCompany = useCallback(async () => {
    try {
      const data = await api.get<CompanyData>("/companies/me");
      setCompany(data);
      const f = companyToForm(data);
      setForm(f);
      savedFormRef.current = JSON.stringify(f);
      const lw = data.logoWidth ?? 120;
      const lh = data.logoHeight ?? 40;
      setLogoWidth(lw);
      setLogoHeight(lh);
      savedLogoDimsRef.current = JSON.stringify({ logoWidth: lw, logoHeight: lh });
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  // Carrega health e faz polling a cada 60min para detectar nova versao
  const fetchHealth = useCallback(async () => {
    try {
      const r = await fetch("/api/health");
      const d = await r.json();
      setBuildInfo(d);
      if (loadedVersionRef.current === null) {
        // Primeira carga: registra a versao atual do frontend
        loadedVersionRef.current = d.version;
      } else if (d.version !== loadedVersionRef.current) {
        // Backend tem versao diferente da que o frontend carregou
        setHasNewVersion(true);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadCompany();
    fetchHealth();
    const interval = setInterval(fetchHealth, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadCompany, fetchHealth]);

  function setField(field: keyof CompanyForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // ── Busca CNPJ na Receita Federal via BrasilAPI ──
  async function lookupCnpj() {
    const digits = form.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) {
      setCnpjStatus({ type: "error", msg: "CNPJ deve ter 14 digitos" });
      return;
    }

    setLookingUpCnpj(true);
    setCnpjStatus(null);

    try {
      // Tenta BrasilAPI primeiro (gratuita, sem limite)
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();

      // Mapeia campos da API para o formulario
      const phone = data.ddd_telefone_1
        ? maskPhone(data.ddd_telefone_1.replace(/\D/g, ""))
        : form.phone;

      const cep = data.cep
        ? maskCep(String(data.cep).replace(/\D/g, ""))
        : form.cep;

      setForm((f) => ({
        ...f,
        name: data.razao_social || f.name,
        tradeName: data.nome_fantasia || f.tradeName,
        phone,
        email: data.email || f.email,
        cep,
        addressStreet: data.logradouro
          ? `${data.descricao_tipo_de_logradouro || ""} ${data.logradouro}`.trim()
          : f.addressStreet,
        addressNumber: data.numero || f.addressNumber,
        addressComp: data.complemento || f.addressComp,
        neighborhood: data.bairro || f.neighborhood,
        city: data.municipio || f.city,
        state: data.uf || f.state,
      }));

      const situacao = data.descricao_situacao_cadastral || "OK";
      setCnpjStatus({
        type: "success",
        msg: `Dados importados da Receita Federal - Situacao: ${situacao}`,
      });
    } catch {
      // Fallback: tenta ReceitaWS
      try {
        const res2 = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`);
        if (!res2.ok) throw new Error("ReceitaWS falhou");
        const data2 = await res2.json();
        if (data2.status === "ERROR") throw new Error(data2.message);

        const phone2 = data2.telefone
          ? maskPhone(data2.telefone.replace(/\D/g, "").slice(0, 11))
          : form.phone;

        const cep2 = data2.cep
          ? maskCep(data2.cep.replace(/\D/g, ""))
          : form.cep;

        setForm((f) => ({
          ...f,
          name: data2.nome || f.name,
          tradeName: data2.fantasia || f.tradeName,
          phone: phone2,
          email: data2.email || f.email,
          cep: cep2,
          addressStreet: data2.logradouro || f.addressStreet,
          addressNumber: data2.numero || f.addressNumber,
          addressComp: data2.complemento || f.addressComp,
          neighborhood: data2.bairro || f.neighborhood,
          city: data2.municipio || f.city,
          state: data2.uf || f.state,
        }));

        setCnpjStatus({
          type: "success",
          msg: `Dados importados da Receita Federal - Situacao: ${data2.situacao || "OK"}`,
        });
      } catch {
        setCnpjStatus({
          type: "error",
          msg: "Nao foi possivel consultar a Receita Federal. Verifique o CNPJ e tente novamente.",
        });
      }
    } finally {
      setLookingUpCnpj(false);
    }
  }

  // Auto-fill address from CEP via ViaCEP
  async function lookupCep(cep: string) {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          addressStreet: data.logradouro || f.addressStreet,
          neighborhood: data.bairro || f.neighborhood,
          city: data.localidade || f.city,
          state: data.uf || f.state,
          addressComp: data.complemento || f.addressComp,
        }));
      }
    } catch { /* ignore */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    setError(null);
    setSuccessMsg(null);
    setSaving(true);

    try {
      const commissionBps = Math.round(parseFloat(form.commissionPercent) * 100);
      if (isNaN(commissionBps) || commissionBps < 0 || commissionBps > 10000) {
        setError("Comissao deve ser entre 0% e 100%");
        setSaving(false);
        return;
      }

      const evalGestorWeight = parseInt(form.evalGestorWeight);
      const evalClientWeight = parseInt(form.evalClientWeight);
      const evalMinRating = parseFloat(form.evalMinRating);

      if (isNaN(evalGestorWeight) || isNaN(evalClientWeight) || evalGestorWeight + evalClientWeight !== 100) {
        setError("A soma dos pesos (gestor + cliente) deve ser 100%");
        setSaving(false);
        return;
      }

      if (isNaN(evalMinRating) || evalMinRating < 1 || evalMinRating > 5) {
        setError("Nota minima deve ser entre 1.0 e 5.0");
        setSaving(false);
        return;
      }

      await api.put(`/companies/${company.id}`, {
        name: form.name,
        tradeName: form.tradeName || null,
        cnpj: form.cnpj || null,
        ie: form.ie || null,
        im: form.im || null,
        phone: form.phone || null,
        email: form.email || null,
        cep: form.cep || null,
        addressStreet: form.addressStreet || null,
        addressNumber: form.addressNumber || null,
        addressComp: form.addressComp || null,
        neighborhood: form.neighborhood || null,
        city: form.city || null,
        state: form.state || null,
        ownerName: form.ownerName || null,
        ownerCpf: form.ownerCpf || null,
        ownerPhone: form.ownerPhone || null,
        ownerEmail: form.ownerEmail || null,
        commissionBps,
        evalGestorWeight,
        evalClientWeight,
        evalMinRating,
      });

      savedFormRef.current = JSON.stringify(form);
      await loadCompany();
      flashSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.payload?.message || err.message);
      } else {
        setError("Erro ao salvar configuracoes");
      }
    } finally {
      setSaving(false);
    }
  }

  /* ── Field component ── */

  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 disabled:bg-slate-50 disabled:text-slate-500 transition-colors";

  function Field({
    label, value, onChange, required, disabled, placeholder, className, type = "text",
  }: {
    label: string; value: string; onChange: (v: string) => void;
    required?: boolean; disabled?: boolean; placeholder?: string;
    className?: string; type?: string;
  }) {
    return (
      <div className={className}>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          className={inputClass}
        />
      </div>
    );
  }

  /* ── Render ── */

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Configuracoes</h1>
        </div>
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Configuracoes</h1>
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
          Erro ao carregar dados da empresa.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Configuracoes</h1>
        <p className="text-sm text-slate-500">
          Configure os dados cadastrais da sua empresa.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Importar da Receita Federal ── */}
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Importar Dados da Receita Federal
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Digite o CNPJ e clique em buscar para preencher automaticamente os dados da empresa.
          </p>
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                CNPJ <span className="text-red-400">*</span>
              </label>
              <input
                value={form.cnpj}
                onChange={(e) => {
                  setField("cnpj", maskCnpj(e.target.value));
                  setCnpjStatus(null);
                }}
                disabled={!isAdmin}
                placeholder="00.000.000/0000-00"
                className={inputClass}
              />
            </div>
            <button
              type="button"
              onClick={lookupCnpj}
              disabled={!isAdmin || lookingUpCnpj || form.cnpj.replace(/\D/g, "").length !== 14}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {lookingUpCnpj ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Consultando...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Buscar na Receita
                </>
              )}
            </button>
          </div>
          {cnpjStatus && (
            <div className={`mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
              cnpjStatus.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {cnpjStatus.type === "success" ? (
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {cnpjStatus.msg}
            </div>
          )}
        </div>

        {/* ── Logomarca ── */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Logomarca
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            A logomarca sera usada nos relatorios financeiros em PDF. Formatos: JPEG, PNG ou WebP (max 5MB).
          </p>

          <div className="flex flex-col sm:flex-row gap-6">
            {/* Preview */}
            <div className="flex-shrink-0">
              {company?.logoUrl ? (
                <div className="border border-slate-200 rounded-lg p-2 bg-slate-50">
                  <img
                    src={`/api${company.logoUrl}`}
                    alt="Logo"
                    style={{ width: logoWidth, height: logoHeight, objectFit: 'contain' }}
                    className="block"
                  />
                </div>
              ) : (
                <div className="w-[120px] h-[40px] border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-xs text-slate-400">
                  Sem logo
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex-1 space-y-3">
              {/* Upload */}
              <div className="flex gap-2">
                <label className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isAdmin ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                } ${logoUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {logoUploading ? 'Enviando...' : 'Enviar Logo'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={!isAdmin || logoUploading}
                    onChange={async () => {
                      const file = fileInputRef.current?.files?.[0];
                      if (!file) return;
                      setLogoUploading(true);
                      setError(null);
                      const controller = new AbortController();
                      const timeout = setTimeout(() => controller.abort(), 30000);
                      try {
                        const formData = new FormData();
                        formData.append('file', file);
                        const token = getAccessToken();
                        const res = await fetch('/api/companies/logo', {
                          method: 'POST',
                          body: formData,
                          credentials: 'include',
                          headers: token ? { Authorization: `Bearer ${token}` } : {},
                          signal: controller.signal,
                        });
                        if (!res.ok) {
                          const err = await res.json().catch(() => ({}));
                          throw new Error(err.message || 'Erro ao enviar logo');
                        }
                        await res.json();
                        await loadCompany();
                        flashSuccess("Logo enviada com sucesso!");
                      } catch (err: any) {
                        if (err.name === 'AbortError') {
                          setError('Upload demorou demais. Tente novamente.');
                        } else {
                          setError(err.message || 'Erro ao enviar logo');
                        }
                      } finally {
                        clearTimeout(timeout);
                        setLogoUploading(false);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }
                    }}
                  />
                </label>

                {company?.logoUrl && isAdmin && (
                  <button
                    onClick={async () => {
                      try {
                        await api.del('/companies/logo');
                        setCompany((c) => c ? { ...c, logoUrl: null } : c);
                        await loadCompany();
                        flashSuccess("Logo removida com sucesso!");
                      } catch { setError('Erro ao remover logo'); }
                    }}
                    className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Remover
                  </button>
                )}
              </div>

              {/* Dimensions */}
              {company?.logoUrl && (
                <div className="flex items-end gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Largura (px)</label>
                    <input
                      type="number"
                      min={30}
                      max={300}
                      value={logoWidth}
                      onChange={(e) => setLogoWidth(Number(e.target.value))}
                      disabled={!isAdmin}
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Altura (px)</label>
                    <input
                      type="number"
                      min={15}
                      max={150}
                      value={logoHeight}
                      onChange={(e) => setLogoHeight(Number(e.target.value))}
                      disabled={!isAdmin}
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  {isAdmin && isLogoDimsDirty && (
                    <button
                      onClick={async () => {
                        try {
                          await api.patch('/companies/logo-dimensions', { logoWidth, logoHeight });
                          setCompany((c) => c ? { ...c, logoWidth, logoHeight } : c);
                          savedLogoDimsRef.current = JSON.stringify({ logoWidth, logoHeight });
                          flashSuccess("Dimensoes salvas com sucesso!");
                        } catch { setError('Erro ao salvar dimensoes'); }
                      }}
                      className="rounded-lg bg-slate-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 transition-colors"
                    >
                      Salvar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Dados da Empresa ── */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Dados da Empresa
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field
              label="Razao Social"
              value={form.name}
              onChange={(v) => setField("name", v)}
              required
              disabled={!isAdmin}
              placeholder="Razao social completa"
              className="sm:col-span-2"
            />
            <Field
              label="Nome Fantasia"
              value={form.tradeName}
              onChange={(v) => setField("tradeName", v)}
              disabled={!isAdmin}
              placeholder="Nome comercial"
            />
            <Field
              label="Inscricao Estadual"
              value={form.ie}
              onChange={(v) => setField("ie", v)}
              disabled={!isAdmin}
              placeholder="Isento ou numero"
            />
            <Field
              label="Inscricao Municipal"
              value={form.im}
              onChange={(v) => setField("im", v)}
              disabled={!isAdmin}
              placeholder="Numero"
            />
          </div>
        </div>

        {/* ── Contato ── */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Contato
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Telefone"
              value={form.phone}
              onChange={(v) => setField("phone", maskPhone(v))}
              disabled={!isAdmin}
              placeholder="(11) 99999-9999"
            />
            <Field
              label="E-mail da Empresa"
              value={form.email}
              onChange={(v) => setField("email", v)}
              disabled={!isAdmin}
              placeholder="contato@empresa.com.br"
              type="email"
            />
          </div>
        </div>

        {/* ── Endereco ── */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Endereco
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">CEP</label>
              <input
                value={form.cep}
                onChange={(e) => {
                  const masked = maskCep(e.target.value);
                  setField("cep", masked);
                  if (masked.replace(/\D/g, "").length === 8) {
                    lookupCep(masked);
                  }
                }}
                disabled={!isAdmin}
                placeholder="00000-000"
                className={inputClass}
              />
            </div>
            <Field
              label="Logradouro"
              value={form.addressStreet}
              onChange={(v) => setField("addressStreet", v)}
              disabled={!isAdmin}
              placeholder="Rua, Av., etc."
              className="sm:col-span-2 lg:col-span-2"
            />
            <Field
              label="Numero"
              value={form.addressNumber}
              onChange={(v) => setField("addressNumber", v)}
              disabled={!isAdmin}
              placeholder="No"
            />
            <Field
              label="Complemento"
              value={form.addressComp}
              onChange={(v) => setField("addressComp", v)}
              disabled={!isAdmin}
              placeholder="Sala, Andar, Bloco"
            />
            <Field
              label="Bairro"
              value={form.neighborhood}
              onChange={(v) => setField("neighborhood", v)}
              disabled={!isAdmin}
              placeholder="Bairro"
            />
            <Field
              label="Cidade"
              value={form.city}
              onChange={(v) => setField("city", v)}
              disabled={!isAdmin}
              placeholder="Cidade"
            />
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">UF</label>
              <select
                value={form.state}
                onChange={(e) => setField("state", e.target.value)}
                disabled={!isAdmin}
                className={inputClass}
              >
                <option value="">Selecione</option>
                {STATES.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Responsavel Legal ── */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Responsavel Legal
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Nome Completo"
              value={form.ownerName}
              onChange={(v) => setField("ownerName", v)}
              disabled={!isAdmin}
              placeholder="Nome do responsavel"
            />
            <Field
              label="CPF"
              value={form.ownerCpf}
              onChange={(v) => setField("ownerCpf", maskCpf(v))}
              disabled={!isAdmin}
              placeholder="000.000.000-00"
            />
            <Field
              label="Telefone"
              value={form.ownerPhone}
              onChange={(v) => setField("ownerPhone", maskPhone(v))}
              disabled={!isAdmin}
              placeholder="(11) 99999-9999"
            />
            <Field
              label="E-mail"
              value={form.ownerEmail}
              onChange={(v) => setField("ownerEmail", v)}
              disabled={!isAdmin}
              placeholder="responsavel@empresa.com.br"
              type="email"
            />
          </div>
        </div>

        {/* ── Plataforma ── */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Plataforma
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Comissao da Plataforma (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.commissionPercent}
                onChange={(e) => setField("commissionPercent", e.target.value)}
                required
                disabled={!isAdmin}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-400">
                Percentual descontado do valor bruto da OS. Atual: {(company.commissionBps / 100).toFixed(2)}%
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <span className="text-xs font-medium text-slate-500">ID da Empresa</span>
              <p className="mt-1 text-xs font-mono text-slate-700 break-all">{company.id}</p>
            </div>
            <div className="flex gap-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex-1">
                <span className="text-xs font-medium text-slate-500">Status</span>
                <p className="mt-1">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    company.status === "ATIVA" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
                  }`}>
                    {company.status}
                  </span>
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex-1">
                <span className="text-xs font-medium text-slate-500">Criada em</span>
                <p className="mt-1 text-sm text-slate-700">
                  {new Date(company.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Avaliacao de Tecnicos ── */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <svg className="h-4 w-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            Avaliacao de Tecnicos
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Configure os pesos da avaliacao e a nota minima para manter o tecnico ativo.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Peso Gestor (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.evalGestorWeight}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({
                    ...f,
                    evalGestorWeight: v,
                    evalClientWeight: String(100 - (parseInt(v) || 0)),
                  }));
                }}
                disabled={!isAdmin}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-400">
                Peso da avaliacao feita pelo gestor
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Peso Cliente (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.evalClientWeight}
                disabled
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-400">
                Calculado automaticamente (100 - Peso Gestor)
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nota Minima (1.0 - 5.0)
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={form.evalMinRating}
                onChange={(e) => setField("evalMinRating", e.target.value)}
                disabled={!isAdmin}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-400">
                Tecnicos abaixo dessa nota ficam em &quot;Em Treinamento&quot;
              </p>
            </div>
          </div>
        </div>

        {/* ── Feedback + Submit ── */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isAdmin && isDirty && !loading ? (
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-all"
            >
              {saving ? "Salvando..." : "Salvar Alteracoes"}
            </button>
          </div>
        ) : !isAdmin ? (
          <p className="text-xs text-slate-400">
            Somente administradores podem alterar as configuracoes.
          </p>
        ) : null}
      </form>

      {/* ── Sistema / Build Info ── */}
      {isAdmin && buildInfo && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Sistema
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <span className="text-xs font-medium text-slate-500">Versao</span>
              <p className="mt-0.5 text-lg font-bold text-blue-600">v{buildInfo.version}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500">Codinome</span>
              <p className="mt-0.5 text-sm font-medium text-slate-700">{buildInfo.codename}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500">Uptime</span>
              <p className="mt-0.5 text-sm font-medium text-slate-700">
                {buildInfo.uptime >= 3600
                  ? `${Math.floor(buildInfo.uptime / 3600)}h ${Math.floor((buildInfo.uptime % 3600) / 60)}m`
                  : `${Math.floor(buildInfo.uptime / 60)}m ${buildInfo.uptime % 60}s`}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500">Ultima Atualizacao</span>
              <p className="mt-0.5 text-sm font-medium text-slate-700">
                {(() => {
                  try {
                    const d = new Date(buildInfo.releasedAt);
                    if (isNaN(d.getTime())) return buildInfo.releasedAt;
                    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                  } catch {
                    return buildInfo.releasedAt;
                  }
                })()}
              </p>
            </div>
          </div>

          {/* Indicador de status + Botao */}
          <div className="flex items-center gap-3 flex-wrap">
            {hasNewVersion ? (
              <>
                {/* Badge nova versao disponivel */}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                  Nova versao disponivel!
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setRefreshing(true);
                    if (typeof window !== "undefined" && "caches" in window) {
                      caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
                    }
                    setTimeout(() => window.location.reload(), 500);
                  }}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {refreshing ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Atualizando...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Atualizar Sistema
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                {/* Badge sistema atualizado */}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-semibold text-green-700">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Sistema atualizado
                </span>

                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-500 cursor-not-allowed transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Atualizar Sistema
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Toast de sucesso ── */}
      {successMsg && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <div className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
            <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {successMsg}
          </div>
        </div>
      )}
    </div>
  );
}
