"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth, hasRole } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────

interface InvoiceTenant {
  id: string;
  name: string;
  slug: string;
  cnpj: string | null;
  plan: { name: string } | null;
}

interface Invoice {
  id: string;
  tenantId: string;
  tenant: InvoiceTenant;
  asaasInvoiceId: string | null;
  status: string;
  value: number;
  serviceDescription: string;
  observations: string | null;
  effectiveDate: string;
  pdfUrl: string | null;
  xmlUrl: string | null;
  invoiceNumber: string | null;
  rpsNumber: number | null;
  iss: number;
  cofins: number;
  csll: number;
  inss: number;
  ir: number;
  pis: number;
  retainIss: boolean;
  errorMessage: string | null;
  createdAt: string;
}

interface InvoiceConfig {
  id: string;
  autoEmitOnPayment: boolean;
  municipalServiceId: string | null;
  municipalServiceCode: string | null;
  municipalServiceName: string | null;
  defaultIss: number;
  defaultCofins: number;
  defaultCsll: number;
  defaultInss: number;
  defaultIr: number;
  defaultPis: number;
  defaultRetainIss: boolean;
  serviceDescriptionTemplate: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  cnpj: string | null;
  status: string;
  plan: { id: string; name: string; priceCents: number } | null;
  asaasCustomerId: string | null;
}

// ─── Status Colors ────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendente", color: "bg-slate-100 text-slate-600" },
  SCHEDULED: { label: "Agendada", color: "bg-blue-100 text-blue-700" },
  SYNCHRONIZED: { label: "Sincronizada", color: "bg-cyan-100 text-cyan-700" },
  AUTHORIZED: { label: "Emitida", color: "bg-green-100 text-green-700" },
  ERROR: { label: "Erro", color: "bg-red-100 text-red-700" },
  CANCELED: { label: "Cancelada", color: "bg-slate-100 text-slate-500" },
  PROCESSING_CANCELLATION: { label: "Cancelando", color: "bg-yellow-100 text-yellow-700" },
  CANCELLATION_DENIED: { label: "Cancel. Negado", color: "bg-orange-100 text-orange-700" },
};

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Main Page ────────────────────────────────────────────

export default function InvoicesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab state: "invoices" or "config"
  const [activeTab, setActiveTab] = useState<"invoices" | "config">("invoices");

  // Invoices list state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceFilter, setInvoiceFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  // Config state
  const [config, setConfig] = useState<InvoiceConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  // Issue invoice modal
  const [showIssue, setShowIssue] = useState(false);
  const [issueLoading, setIssueLoading] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [issueTenantId, setIssueTenantId] = useState("");
  const [issueValue, setIssueValue] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [issueObservations, setIssueObservations] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [issueError, setIssueError] = useState<string | null>(null);

  // Detail modal
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);

  // ─── Load Data ──────────────────────────────────────────

  const loadInvoices = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (invoiceFilter !== "ALL") params.append("status", invoiceFilter);
      params.append("page", String(invoicePage));
      params.append("limit", "20");
      const data = await api.get<{ items: Invoice[]; total: number }>(`/admin/tenants/invoices/list?${params}`);
      setInvoices(data.items);
      setInvoiceTotal(data.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [invoiceFilter, invoicePage]);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const data = await api.get<InvoiceConfig>("/admin/tenants/invoices/config");
      setConfig(data);
    } catch { /* ignore */ }
    finally { setConfigLoading(false); }
  }, []);

  const loadTenants = useCallback(async () => {
    try {
      const data = await api.get<Tenant[]>("/admin/tenants?status=ACTIVE");
      setTenants(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (user && !hasRole(user, "ADMIN")) { router.replace("/dashboard"); return; }
    loadInvoices();
  }, [user, router, loadInvoices]);

  // Auto-open issue modal when tenantId comes from query params (from tenants page)
  const [autoOpenDone, setAutoOpenDone] = useState(false);
  useEffect(() => {
    const tid = searchParams.get("tenantId");
    if (tid && !autoOpenDone) {
      setAutoOpenDone(true);
      openIssueModal(tid);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, autoOpenDone]);

  useEffect(() => {
    if (activeTab === "config") loadConfig();
  }, [activeTab, loadConfig]);

  // ─── Issue Invoice ─────────────────────────────────────

  function openIssueModal(preSelectedTenantId?: string) {
    loadTenants();
    setIssueTenantId(preSelectedTenantId || "");
    setIssueValue("");
    setIssueDescription("");
    setIssueObservations("");
    setIssueDate(new Date().toISOString().split("T")[0]);
    setIssueError(null);
    setShowIssue(true);
  }

  // When tenant is selected, pre-fill value from plan
  useEffect(() => {
    if (!issueTenantId) return;
    const t = tenants.find((t) => t.id === issueTenantId);
    if (t?.plan) {
      setIssueValue(String(t.plan.priceCents / 100));
    }
  }, [issueTenantId, tenants]);

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    setIssueError(null);
    setIssueLoading(true);
    try {
      const body: any = {
        effectiveDate: issueDate,
      };
      if (issueValue) body.value = parseFloat(issueValue);
      if (issueDescription) body.serviceDescription = issueDescription;
      if (issueObservations) body.observations = issueObservations;

      await api.post(`/admin/tenants/${issueTenantId}/issue-invoice`, body);
      setShowIssue(false);
      await loadInvoices();
    } catch (err: any) {
      setIssueError(err.message || "Erro ao emitir nota fiscal");
    } finally {
      setIssueLoading(false);
    }
  }

  // ─── Cancel Invoice ────────────────────────────────────

  async function handleCancel(invoiceId: string) {
    if (!confirm("Tem certeza que deseja cancelar esta nota fiscal?")) return;
    try {
      await api.del(`/admin/tenants/invoices/${invoiceId}`);
      await loadInvoices();
    } catch (err: any) {
      alert(err.message || "Erro ao cancelar");
    }
  }

  // ─── Save Config ───────────────────────────────────────

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setConfigSaving(true);
    setConfigSaved(false);
    try {
      const updated = await api.put<InvoiceConfig>("/admin/tenants/invoices/config", {
        autoEmitOnPayment: config.autoEmitOnPayment,
        municipalServiceId: config.municipalServiceId || null,
        municipalServiceCode: config.municipalServiceCode || null,
        municipalServiceName: config.municipalServiceName || null,
        defaultIss: config.defaultIss,
        defaultCofins: config.defaultCofins,
        defaultCsll: config.defaultCsll,
        defaultInss: config.defaultInss,
        defaultIr: config.defaultIr,
        defaultPis: config.defaultPis,
        defaultRetainIss: config.defaultRetainIss,
        serviceDescriptionTemplate: config.serviceDescriptionTemplate,
      });
      setConfig(updated);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } catch (err: any) {
      alert(err.message || "Erro ao salvar configuração");
    } finally {
      setConfigSaving(false);
    }
  }

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Notas Fiscais (NFS-e)</h1>
          <p className="text-sm text-slate-500">Emissao e gestao de notas fiscais via Asaas</p>
        </div>
        <button
          onClick={() => openIssueModal()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Emitir Nota Fiscal
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("invoices")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "invoices"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Notas Emitidas
        </button>
        <button
          onClick={() => setActiveTab("config")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "config"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Configuracao Fiscal
        </button>
      </div>

      {/* ─── INVOICES TAB ────────────────────────────────── */}
      {activeTab === "invoices" && (
        <>
          {/* Status filters */}
          <div className="flex flex-wrap gap-2">
            {["ALL", "AUTHORIZED", "SCHEDULED", "PENDING", "ERROR", "CANCELED"].map((s) => (
              <button
                key={s}
                onClick={() => { setInvoiceFilter(s); setInvoicePage(1); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  invoiceFilter === s ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s === "ALL" ? "Todas" : STATUS_MAP[s]?.label || s}
              </button>
            ))}
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
              Nenhuma nota fiscal encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Empresa</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Valor</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">NF</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Data</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {invoices.map((inv) => {
                    const st = STATUS_MAP[inv.status] || { label: inv.status, color: "bg-slate-100 text-slate-600" };
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{inv.tenant.name}</div>
                          {inv.tenant.cnpj && <div className="text-xs text-slate-400">{inv.tenant.cnpj}</div>}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {formatBRL(inv.value)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${st.color}`}>
                            {st.label}
                          </span>
                          {inv.errorMessage && (
                            <div className="text-[10px] text-red-500 mt-0.5 max-w-[200px] truncate" title={inv.errorMessage}>
                              {inv.errorMessage}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {inv.invoiceNumber ? (
                            <span className="font-mono">#{inv.invoiceNumber}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(inv.effectiveDate)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setDetailInvoice(inv)}
                              className="rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                            >
                              Detalhes
                            </button>
                            {inv.pdfUrl && (
                              <a
                                href={inv.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                              >
                                PDF
                              </a>
                            )}
                            {(inv.status === "PENDING" || inv.status === "SCHEDULED" || inv.status === "ERROR") && (
                              <button
                                onClick={() => handleCancel(inv.id)}
                                className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {invoiceTotal > 20 && (
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>{invoiceTotal} nota{invoiceTotal !== 1 ? "s" : ""} no total</span>
              <div className="flex gap-2">
                <button
                  disabled={invoicePage <= 1}
                  onClick={() => setInvoicePage((p) => p - 1)}
                  className="rounded-lg border px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-30"
                >
                  Anterior
                </button>
                <span className="px-2 py-1 text-xs">Pagina {invoicePage}</span>
                <button
                  disabled={invoicePage * 20 >= invoiceTotal}
                  onClick={() => setInvoicePage((p) => p + 1)}
                  className="rounded-lg border px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-30"
                >
                  Proxima
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── CONFIG TAB ──────────────────────────────────── */}
      {activeTab === "config" && (
        <div className="max-w-2xl">
          {configLoading ? (
            <div className="flex justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
            </div>
          ) : config ? (
            <form onSubmit={handleSaveConfig} className="space-y-6">
              {/* Auto-emit toggle */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Emissao Automatica</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Emitir nota fiscal automaticamente ao confirmar pagamento de assinatura
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, autoEmitOnPayment: !config.autoEmitOnPayment })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      config.autoEmitOnPayment ? "bg-blue-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow ${
                        config.autoEmitOnPayment ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Municipal Service */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Servico Municipal</h3>
                <p className="text-xs text-slate-500">
                  Dados do servico municipal para emissao de NFS-e (obrigatorio para emissao via prefeitura)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Codigo do Servico</label>
                    <input
                      className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                      value={config.municipalServiceCode || ""}
                      onChange={(e) => setConfig({ ...config, municipalServiceCode: e.target.value || null })}
                      placeholder="1.01"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">ID Servico (Asaas)</label>
                    <input
                      className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                      value={config.municipalServiceId || ""}
                      onChange={(e) => setConfig({ ...config, municipalServiceId: e.target.value || null })}
                      placeholder="ID interno Asaas"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nome do Servico</label>
                  <input
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                    value={config.municipalServiceName || ""}
                    onChange={(e) => setConfig({ ...config, municipalServiceName: e.target.value || null })}
                    placeholder="Licenciamento de uso de software"
                  />
                </div>
              </div>

              {/* Default Taxes */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Impostos Padrao (%)</h3>
                <p className="text-xs text-slate-500">
                  Percentuais de impostos aplicados por padrao nas notas fiscais
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    ["ISS", "defaultIss"],
                    ["COFINS", "defaultCofins"],
                    ["CSLL", "defaultCsll"],
                    ["INSS", "defaultInss"],
                    ["IR", "defaultIr"],
                    ["PIS", "defaultPis"],
                  ] as const).map(([label, key]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                      <div className="flex items-center">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          className="h-9 w-full rounded-l-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                          value={config[key]}
                          onChange={(e) => setConfig({ ...config, [key]: parseFloat(e.target.value) || 0 })}
                        />
                        <span className="h-9 rounded-r-lg border border-l-0 border-slate-200 bg-slate-50 px-2 text-xs text-slate-400 leading-9">%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="checkbox"
                    id="retainIss"
                    checked={config.defaultRetainIss}
                    onChange={(e) => setConfig({ ...config, defaultRetainIss: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="retainIss" className="text-sm text-slate-700">
                    Reter ISS na fonte
                  </label>
                </div>
              </div>

              {/* Service Description Template */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Template de Descricao</h3>
                <p className="text-xs text-slate-500">
                  Descricao padrao do servico na nota fiscal. Variaveis: {"{empresa}"}, {"{plano}"}, {"{periodo}"}
                </p>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none h-20"
                  value={config.serviceDescriptionTemplate}
                  onChange={(e) => setConfig({ ...config, serviceDescriptionTemplate: e.target.value })}
                />
                <div className="flex flex-wrap gap-1">
                  {["{empresa}", "{plano}", "{periodo}"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setConfig({ ...config, serviceDescriptionTemplate: config.serviceDescriptionTemplate + " " + v })}
                      className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-green-100 hover:text-green-700 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save */}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={configSaving}
                  className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {configSaving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                  Salvar Configuracao
                </button>
                {configSaved && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Salvo!
                  </span>
                )}
              </div>
            </form>
          ) : (
            <div className="text-sm text-slate-400">Erro ao carregar configuracao.</div>
          )}
        </div>
      )}

      {/* ─── Issue Invoice Modal ─────────────────────────── */}
      {showIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !issueLoading && setShowIssue(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">Emitir Nota Fiscal</h2>
            <p className="mb-4 text-xs text-slate-500">Preencha os dados para emissao da NFS-e via Asaas</p>

            <form onSubmit={handleIssue} className="space-y-3">
              {/* Tenant selection */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Empresa *</label>
                <select
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 bg-white"
                  value={issueTenantId}
                  onChange={(e) => setIssueTenantId(e.target.value)}
                  required
                >
                  <option value="">Selecione a empresa</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.cnpj ? `(${t.cnpj})` : ""} — {t.plan?.name || "Sem plano"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected tenant info */}
              {issueTenantId && (() => {
                const t = tenants.find((t) => t.id === issueTenantId);
                return t ? (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Empresa:</span>
                      <span className="font-medium text-slate-700">{t.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">CNPJ:</span>
                      <span className="font-medium text-slate-700">{t.cnpj || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Plano:</span>
                      <span className="font-medium text-slate-700">{t.plan?.name || "—"}</span>
                    </div>
                    {t.plan && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Valor mensal:</span>
                        <span className="font-medium text-green-700">{formatBRL(t.plan.priceCents / 100)}</span>
                      </div>
                    )}
                    {!t.asaasCustomerId && (
                      <div className="mt-1 rounded bg-amber-50 border border-amber-200 px-2 py-1 text-amber-700">
                        Cliente sera criado automaticamente no Asaas
                      </div>
                    )}
                  </div>
                ) : null;
              })()}

              {/* Value */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Valor (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                  value={issueValue}
                  onChange={(e) => setIssueValue(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              {/* Date */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Data de Emissao</label>
                <input
                  type="date"
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
                <p className="text-[10px] text-slate-400 mt-1">Se hoje: emissao em ate 15 minutos. Se futura: agendada.</p>
              </div>

              {/* Description (optional override) */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Descricao do Servico</label>
                <textarea
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none h-16"
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="Deixe vazio para usar o template configurado"
                />
              </div>

              {/* Observations */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Observacoes</label>
                <input
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
                  value={issueObservations}
                  onChange={(e) => setIssueObservations(e.target.value)}
                  placeholder="Observacoes opcionais"
                />
              </div>

              {issueError && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{issueError}</div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIssue(false)}
                  disabled={issueLoading}
                  className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={issueLoading || !issueTenantId}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {issueLoading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                  Emitir NFS-e
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Detail Modal ────────────────────────────────── */}
      {detailInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetailInvoice(null)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="border-b border-slate-200 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Detalhes da Nota Fiscal</h2>
                  <p className="text-sm text-slate-500 mt-1">{detailInvoice.tenant.name}</p>
                </div>
                <button onClick={() => setDetailInvoice(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${(STATUS_MAP[detailInvoice.status] || { color: "bg-slate-100 text-slate-600" }).color}`}>
                  {(STATUS_MAP[detailInvoice.status] || { label: detailInvoice.status }).label}
                </span>
                {detailInvoice.invoiceNumber && (
                  <span className="text-sm font-mono text-slate-500">NF #{detailInvoice.invoiceNumber}</span>
                )}
              </div>

              {/* Error message */}
              {detailInvoice.errorMessage && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                  <strong>Erro:</strong> {detailInvoice.errorMessage}
                </div>
              )}

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-slate-400">Valor</span>
                  <p className="font-semibold text-slate-900">{formatBRL(detailInvoice.value)}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Data Emissao</span>
                  <p className="font-medium text-slate-700">{formatDate(detailInvoice.effectiveDate)}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">CNPJ</span>
                  <p className="font-medium text-slate-700">{detailInvoice.tenant.cnpj || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Plano</span>
                  <p className="font-medium text-slate-700">{detailInvoice.tenant.plan?.name || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Asaas ID</span>
                  <p className="font-mono text-xs text-slate-500">{detailInvoice.asaasInvoiceId || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Criado em</span>
                  <p className="text-xs text-slate-500">{formatDateTime(detailInvoice.createdAt)}</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <span className="text-xs text-slate-400">Descricao</span>
                <p className="text-sm text-slate-700 mt-1">{detailInvoice.serviceDescription}</p>
              </div>
              {detailInvoice.observations && (
                <div>
                  <span className="text-xs text-slate-400">Observacoes</span>
                  <p className="text-sm text-slate-700 mt-1">{detailInvoice.observations}</p>
                </div>
              )}

              {/* Taxes */}
              <div>
                <span className="text-xs text-slate-400">Impostos</span>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    ["ISS", detailInvoice.iss],
                    ["COFINS", detailInvoice.cofins],
                    ["CSLL", detailInvoice.csll],
                    ["INSS", detailInvoice.inss],
                    ["IR", detailInvoice.ir],
                    ["PIS", detailInvoice.pis],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="rounded bg-slate-50 px-2 py-1 text-center">
                      <span className="text-[10px] text-slate-400 block">{String(label)}</span>
                      <span className="text-xs font-medium text-slate-700">{String(val)}%</span>
                    </div>
                  ))}
                </div>
                {detailInvoice.retainIss && (
                  <p className="text-[10px] text-blue-600 mt-1">ISS retido na fonte</p>
                )}
              </div>

              {/* PDF/XML links */}
              {(detailInvoice.pdfUrl || detailInvoice.xmlUrl) && (
                <div className="flex gap-2 pt-2">
                  {detailInvoice.pdfUrl && (
                    <a
                      href={detailInvoice.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Baixar PDF
                    </a>
                  )}
                  {detailInvoice.xmlUrl && (
                    <a
                      href={detailInvoice.xmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                    >
                      Baixar XML
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
