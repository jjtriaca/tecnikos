"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, getAccessToken } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

/* ── Types (Upload Manual) ─────────────────────────────────── */

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

interface NfeItem {
  itemNumber: number;
  productCode: string;
  description: string;
  ncm: string;
  unit: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  productId: string | null;
  productDescription: string | null;
}

interface NfeImport {
  id: string;
  nfeNumber: string;
  accessKey: string;
  supplierCnpj: string;
  supplierName: string;
  totalCents: number;
  issueDate: string;
  status: "PENDING" | "PROCESSED" | "CANCELLED";
  supplierId: string | null;
  supplierMatchedName: string | null;
  items: NfeItem[];
  createdAt: string;
}

interface SupplierAction {
  action: "CREATE" | "LINK";
  partnerId?: string;
}

interface ItemAction {
  itemNumber: number;
  action: "CREATE" | "LINK" | "IGNORE";
  productId?: string;
}

interface PartnerSearchResult {
  id: string;
  name: string;
  document: string;
}

interface ProductSearchResult {
  id: string;
  description: string;
  code: string;
}

/* ── Types (SEFAZ) ─────────────────────────────────────────── */

interface SefazConfigInfo {
  hasCertificate: boolean;
  certificateCN: string | null;
  certificateExpiry: string | null;
  environment: "PRODUCTION" | "HOMOLOGATION";
  autoFetchEnabled: boolean;
  lastFetchAt: string | null;
  lastFetchStatus: "SUCCESS" | "ERROR" | "NO_DOCS" | null;
  lastFetchError: string | null;
  lastNsu: string;
}

interface SefazDocument {
  id: string;
  nsu: string;
  schema: "resNFe" | "procNFe" | "resEvento";
  nfeKey: string | null;
  emitterCnpj: string | null;
  emitterName: string | null;
  issueDate: string | null;
  nfeValue: number | null;
  situacao: string | null;
  status: "FETCHED" | "IMPORTED" | "IGNORED" | "EVENT";
  xmlContent: string | null;
  fetchedAt: string;
}

/* ── Helpers ──────────────────────────────────────────────── */

function formatCurrency(cents: number | undefined | null) {
  if (cents == null) return "\u2014";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string | undefined | null) {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(dateStr: string | undefined | null) {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateKey(key: string | null | undefined, len = 20) {
  if (!key) return "\u2014";
  if (key.length <= len) return key;
  return key.slice(0, len) + "\u2026";
}

function formatCnpj(cnpj: string | null | undefined) {
  if (!cnpj) return "\u2014";
  if (cnpj.length === 14) {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  return cnpj;
}

/* ── Status Badge (Upload Manual) ─────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  PENDING: {
    label: "Pendente",
    classes: "bg-amber-50 text-amber-700 border-amber-200",
  },
  PROCESSED: {
    label: "Processado",
    classes: "bg-green-50 text-green-700 border-green-200",
  },
  CANCELLED: {
    label: "Cancelado",
    classes: "bg-slate-50 text-slate-500 border-slate-200",
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.classes}`}
    >
      {cfg.label}
    </span>
  );
}

/* ── SEFAZ Badges ─────────────────────────────────────────── */

const SEFAZ_SCHEMA_CONFIG: Record<string, { label: string; classes: string }> = {
  resNFe: { label: "resNFe", classes: "bg-blue-50 text-blue-700 border-blue-200" },
  procNFe: { label: "procNFe", classes: "bg-green-50 text-green-700 border-green-200" },
  resEvento: { label: "resEvento", classes: "bg-slate-50 text-slate-500 border-slate-200" },
};

function SchemaBadge({ schema }: { schema: string }) {
  const cfg = SEFAZ_SCHEMA_CONFIG[schema] || SEFAZ_SCHEMA_CONFIG.resNFe;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

const SITUACAO_CONFIG: Record<number, { label: string; classes: string }> = {
  1: { label: "Autorizada", classes: "bg-green-50 text-green-700 border-green-200" },
  2: { label: "Denegada", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  3: { label: "Cancelada", classes: "bg-red-50 text-red-700 border-red-200" },
};

function SituacaoBadge({ situacao }: { situacao: string | number | null }) {
  if (situacao == null) return <span className="text-slate-400 text-xs">{"\u2014"}</span>;
  const cfg = SITUACAO_CONFIG[situacao] || { label: `${situacao}`, classes: "bg-slate-50 text-slate-500 border-slate-200" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

const SEFAZ_STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  FETCHED: { label: "Buscado", classes: "bg-blue-50 text-blue-700 border-blue-200" },
  IMPORTED: { label: "Importado", classes: "bg-green-50 text-green-700 border-green-200" },
  IGNORED: { label: "Ignorado", classes: "bg-slate-50 text-slate-500 border-slate-200" },
  EVENT: { label: "Evento", classes: "bg-purple-50 text-purple-700 border-purple-200" },
};

function SefazStatusBadge({ status }: { status: string }) {
  const cfg = SEFAZ_STATUS_CONFIG[status] || SEFAZ_STATUS_CONFIG.FETCHED;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

const FETCH_STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  SUCCESS: { label: "Sucesso", classes: "bg-green-50 text-green-700 border-green-200" },
  ERROR: { label: "Erro", classes: "bg-red-50 text-red-700 border-red-200" },
  NO_DOCS: { label: "Sem documentos", classes: "bg-slate-50 text-slate-500 border-slate-200" },
  RATE_LIMIT: { label: "Aguardando (limite)", classes: "bg-amber-50 text-amber-700 border-amber-200" },
};

function FetchStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const cfg = FETCH_STATUS_CONFIG[status] || FETCH_STATUS_CONFIG.SUCCESS;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

/* ── Step Indicator ──────────────────────────────────────── */

const STEPS = [
  { num: 1, label: "Upload XML" },
  { num: 2, label: "Fornecedor" },
  { num: 3, label: "Produtos" },
  { num: 4, label: "Confirmacao" },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((s, idx) => {
        const done = current > s.num;
        const active = current === s.num;
        return (
          <div key={s.num} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  done
                    ? "bg-green-600 text-white"
                    : active
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {done ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s.num
                )}
              </div>
              <span
                className={`text-sm font-medium hidden sm:inline ${
                  active ? "text-blue-700" : done ? "text-green-700" : "text-slate-400"
                }`}
              >
                {s.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-8 rounded-full ${
                  current > s.num ? "bg-green-400" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────── */

export default function NfePage() {
  const { toast } = useToast();

  /* ══════════════════════════════════════════════════════════ */
  /*  TAB STATE                                                */
  /* ══════════════════════════════════════════════════════════ */

  const [activeTab, setActiveTab] = useState<"sefaz" | "upload">("sefaz");

  /* ══════════════════════════════════════════════════════════ */
  /*  SEFAZ STATE                                              */
  /* ══════════════════════════════════════════════════════════ */

  const [sefazConfig, setSefazConfig] = useState<SefazConfigInfo | null>(null);
  const [sefazConfigLoading, setSefazConfigLoading] = useState(true);
  const [sefazDocs, setSefazDocs] = useState<SefazDocument[]>([]);
  const [sefazDocsLoading, setSefazDocsLoading] = useState(true);
  const [sefazDocsMeta, setSefazDocsMeta] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  const [sefazPage, setSefazPage] = useState(1);

  // Fetch button
  const [fetching, setFetching] = useState(false);

  // Config modal
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState("");
  const [certEnvironment, setCertEnvironment] = useState<"PRODUCTION" | "HOMOLOGATION">("PRODUCTION");
  const [uploadingCert, setUploadingCert] = useState(false);

  // Filters
  const [sefazDateFrom, setSefazDateFrom] = useState("");
  const [sefazDateTo, setSefazDateTo] = useState("");
  const [sefazSupplierCnpj, setSefazSupplierCnpj] = useState("");
  const [sefazStatusFilter, setSefazStatusFilter] = useState("");
  const [sefazSchemaFilter, setSefazSchemaFilter] = useState("");
  const [sefazSearch, setSefazSearch] = useState("");

  // XML Modal
  const [xmlModalOpen, setXmlModalOpen] = useState(false);
  const [xmlContent, setXmlContent] = useState("");
  const [xmlLoading, setXmlLoading] = useState(false);

  // Auto-refresh timestamp
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Action loading states
  const [importingDocId, setImportingDocId] = useState<string | null>(null);
  const [ignoringDocId, setIgnoringDocId] = useState<string | null>(null);

  /* ══════════════════════════════════════════════════════════ */
  /*  UPLOAD MANUAL STATE                                      */
  /* ══════════════════════════════════════════════════════════ */

  const [imports, setImports] = useState<NfeImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  /* ---- Wizard state ---- */
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [nfeData, setNfeData] = useState<NfeImport | null>(null);

  // Step 1 - drag & drop
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 - supplier
  const [supplierAction, setSupplierAction] = useState<SupplierAction>({
    action: "CREATE",
  });
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerResults, setPartnerResults] = useState<PartnerSearchResult[]>([]);
  const [searchingPartners, setSearchingPartners] = useState(false);

  // Step 3 - products
  const [itemActions, setItemActions] = useState<ItemAction[]>([]);
  const [productSearches, setProductSearches] = useState<Record<number, string>>({});
  const [productResults, setProductResults] = useState<Record<number, ProductSearchResult[]>>({});
  const [searchingProducts, setSearchingProducts] = useState<Record<number, boolean>>({});

  /* ══════════════════════════════════════════════════════════ */
  /*  SEFAZ: Load config                                       */
  /* ══════════════════════════════════════════════════════════ */

  const loadSefazConfig = useCallback(async () => {
    try {
      setSefazConfigLoading(true);
      const res = await api.get<SefazConfigInfo>("/nfe/sefaz/config");
      setSefazConfig(res);
    } catch {
      // Config not available yet - keep null
      setSefazConfig(null);
    } finally {
      setSefazConfigLoading(false);
    }
  }, []);

  /* ══════════════════════════════════════════════════════════ */
  /*  SEFAZ: Load documents                                    */
  /* ══════════════════════════════════════════════════════════ */

  const loadSefazDocs = useCallback(async () => {
    try {
      setSefazDocsLoading(true);
      const params = new URLSearchParams({ page: String(sefazPage), limit: "20" });
      if (sefazSearch) params.set("search", sefazSearch);
      if (sefazStatusFilter) params.set("status", sefazStatusFilter);
      if (sefazSchemaFilter) params.set("schema", sefazSchemaFilter);
      if (sefazDateFrom) params.set("dateFrom", sefazDateFrom);
      if (sefazDateTo) params.set("dateTo", sefazDateTo);
      if (sefazSupplierCnpj) params.set("supplierCnpj", sefazSupplierCnpj);
      const res = await api.get<PaginatedResponse<SefazDocument>>(`/nfe/sefaz/documents?${params.toString()}`);
      setSefazDocs(res.data);
      setSefazDocsMeta(res.meta);
      setLastRefresh(new Date());
    } catch {
      toast("Erro ao carregar documentos SEFAZ.", "error");
    } finally {
      setSefazDocsLoading(false);
    }
  }, [sefazPage, sefazSearch, sefazStatusFilter, sefazSchemaFilter, sefazDateFrom, sefazDateTo, sefazSupplierCnpj, toast]);

  /* ══════════════════════════════════════════════════════════ */
  /*  SEFAZ: Effects                                           */
  /* ══════════════════════════════════════════════════════════ */

  useEffect(() => {
    if (activeTab === "sefaz") {
      loadSefazConfig();
      loadSefazDocs();
    }
  }, [activeTab, loadSefazConfig, loadSefazDocs]);

  // Auto-refresh every 10 minutes when on SEFAZ tab
  useEffect(() => {
    if (activeTab !== "sefaz") return;
    const interval = setInterval(() => {
      loadSefazDocs();
      loadSefazConfig();
    }, 600000);
    return () => clearInterval(interval);
  }, [activeTab, loadSefazDocs, loadSefazConfig]);

  /* ══════════════════════════════════════════════════════════ */
  /*  SEFAZ: Actions                                           */
  /* ══════════════════════════════════════════════════════════ */

  async function handleFetchNow() {
    setFetching(true);
    try {
      const res = await api.post<{ newDocuments: number; lastNsu: string }>("/nfe/sefaz/fetch");
      if (res.newDocuments > 0) {
        toast(`${res.newDocuments} novo(s) documento(s) encontrado(s)!`, "success");
      } else {
        toast("Nenhum documento novo encontrado.", "info");
      }
      loadSefazDocs();
      loadSefazConfig();
    } catch (err: any) {
      toast(err?.message || "Erro ao buscar documentos na SEFAZ.", "error");
    } finally {
      setFetching(false);
    }
  }

  async function handleUploadCertificate() {
    if (!certFile) {
      toast("Selecione um arquivo de certificado.", "error");
      return;
    }
    if (!certPassword) {
      toast("Informe a senha do certificado.", "error");
      return;
    }
    setUploadingCert(true);
    try {
      const formData = new FormData();
      formData.append("file", certFile);
      formData.append("pfxPassword", certPassword);

      const token = getAccessToken();
      const res = await fetch("/api/nfe/sefaz/certificate", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao enviar certificado");
      }
      toast("Certificado configurado com sucesso!", "success");
      setConfigModalOpen(false);
      setCertFile(null);
      setCertPassword("");
      loadSefazConfig();
    } catch (err: any) {
      toast(err?.message || "Erro ao configurar certificado.", "error");
    } finally {
      setUploadingCert(false);
    }
  }

  async function handleToggleAutoFetch(enabled: boolean) {
    try {
      await api.put("/nfe/sefaz/config", { autoFetchEnabled: enabled });
      setSefazConfig((prev) => prev ? { ...prev, autoFetchEnabled: enabled } : prev);
      toast(enabled ? "Busca automatica ativada." : "Busca automatica desativada.", "success");
    } catch (err: any) {
      toast(err?.message || "Erro ao atualizar configuracao.", "error");
    }
  }

  async function handleImportDoc(docId: string) {
    setImportingDocId(docId);
    try {
      await api.post(`/nfe/sefaz/documents/${docId}/import`);
      toast("Documento importado com sucesso!", "success");
      loadSefazDocs();
    } catch (err: any) {
      toast(err?.message || "Erro ao importar documento.", "error");
    } finally {
      setImportingDocId(null);
    }
  }

  async function handleIgnoreDoc(docId: string) {
    setIgnoringDocId(docId);
    try {
      await api.post(`/nfe/sefaz/documents/${docId}/ignore`);
      toast("Documento marcado como ignorado.", "success");
      loadSefazDocs();
    } catch (err: any) {
      toast(err?.message || "Erro ao ignorar documento.", "error");
    } finally {
      setIgnoringDocId(null);
    }
  }

  async function handleViewXml(docId: string) {
    setXmlLoading(true);
    setXmlModalOpen(true);
    setXmlContent("");
    try {
      const res = await api.get<SefazDocument>(`/nfe/sefaz/documents/${docId}`);
      setXmlContent(res.xmlContent || "XML nao disponivel.");
    } catch (err: any) {
      setXmlContent("Erro ao carregar XML.");
      toast(err?.message || "Erro ao carregar XML.", "error");
    } finally {
      setXmlLoading(false);
    }
  }

  function isCertExpiringSoon(): boolean {
    if (!sefazConfig?.certificateExpiry) return false;
    const expiry = new Date(sefazConfig.certificateExpiry);
    const now = new Date();
    const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays < 30;
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  UPLOAD MANUAL: Load imports                              */
  /* ══════════════════════════════════════════════════════════ */

  const loadImports = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      const res = await api.get<PaginatedResponse<NfeImport>>(`/nfe/imports?${params.toString()}`);
      setImports(res.data);
      setMeta(res.meta);
    } catch {
      toast("Erro ao carregar importacoes.", "error");
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => {
    if (activeTab === "upload") {
      loadImports();
    }
  }, [activeTab, loadImports]);

  /* ══════════════════════════════════════════════════════════ */
  /*  UPLOAD MANUAL: Wizard helpers                            */
  /* ══════════════════════════════════════════════════════════ */

  function openWizard() {
    setStep(1);
    setNfeData(null);
    setSupplierAction({ action: "CREATE" });
    setPartnerSearch("");
    setPartnerResults([]);
    setItemActions([]);
    setProductSearches({});
    setProductResults({});
    setDragOver(false);
    setWizardOpen(true);
  }

  function closeWizard() {
    setWizardOpen(false);
    setNfeData(null);
  }

  /* ── Step 1: Upload XML ────────────────────────────────── */

  async function handleFileSelected(file: File) {
    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast("Selecione um arquivo XML valido.", "error");
      return;
    }
    setUploading(true);
    try {
      const text = await file.text();
      const result = await api.post<NfeImport>("/nfe/upload", { xml: text });
      setNfeData(result);
      // Initialize supplier action based on match
      if (result.supplierId) {
        setSupplierAction({ action: "LINK", partnerId: result.supplierId });
      } else {
        setSupplierAction({ action: "CREATE" });
      }
      // Initialize item actions
      const actions: ItemAction[] = (result.items || []).map((item) => ({
        itemNumber: item.itemNumber,
        action: item.productId ? "LINK" : "CREATE",
        productId: item.productId || undefined,
      }));
      setItemActions(actions);
      toast("XML processado com sucesso!", "success");
    } catch (err: any) {
      toast(err?.message || "Erro ao processar XML.", "error");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    e.target.value = "";
  }

  /* ── Step 2: Search partners ───────────────────────────── */

  async function searchPartners(query: string) {
    setPartnerSearch(query);
    if (query.length < 2) {
      setPartnerResults([]);
      return;
    }
    setSearchingPartners(true);
    try {
      const res = await api.get<PaginatedResponse<PartnerSearchResult>>(
        `/partners?search=${encodeURIComponent(query)}&limit=10&type=FORNECEDOR`
      );
      setPartnerResults(res.data || []);
    } catch {
      setPartnerResults([]);
    } finally {
      setSearchingPartners(false);
    }
  }

  function selectPartner(partner: PartnerSearchResult) {
    setSupplierAction({ action: "LINK", partnerId: partner.id });
    setPartnerSearch(partner.name);
    setPartnerResults([]);
  }

  /* ── Step 3: Item actions ──────────────────────────────── */

  function updateItemAction(itemNumber: number, action: "CREATE" | "LINK" | "IGNORE", productId?: string) {
    setItemActions((prev) =>
      prev.map((ia) =>
        ia.itemNumber === itemNumber ? { ...ia, action, productId } : ia
      )
    );
  }

  async function searchProducts(itemNumber: number, query: string) {
    setProductSearches((prev) => ({ ...prev, [itemNumber]: query }));
    if (query.length < 2) {
      setProductResults((prev) => ({ ...prev, [itemNumber]: [] }));
      return;
    }
    setSearchingProducts((prev) => ({ ...prev, [itemNumber]: true }));
    try {
      const res = await api.get<PaginatedResponse<ProductSearchResult>>(
        `/products?search=${encodeURIComponent(query)}&limit=10`
      );
      setProductResults((prev) => ({ ...prev, [itemNumber]: res.data || [] }));
    } catch {
      setProductResults((prev) => ({ ...prev, [itemNumber]: [] }));
    } finally {
      setSearchingProducts((prev) => ({ ...prev, [itemNumber]: false }));
    }
  }

  function selectProduct(itemNumber: number, product: ProductSearchResult) {
    updateItemAction(itemNumber, "LINK", product.id);
    setProductSearches((prev) => ({ ...prev, [itemNumber]: product.description }));
    setProductResults((prev) => ({ ...prev, [itemNumber]: [] }));
  }

  /* ── Step 4: Process ───────────────────────────────────── */

  async function handleProcess() {
    if (!nfeData) return;
    setProcessing(true);
    try {
      await api.post(`/nfe/imports/${nfeData.id}/process`, {
        supplier: supplierAction,
        items: itemActions,
      });
      toast("NFe importada com sucesso!", "success");
      closeWizard();
      loadImports();
    } catch (err: any) {
      toast(err?.message || "Erro ao processar importacao.", "error");
    } finally {
      setProcessing(false);
    }
  }

  /* ── Summary counts for step 4 ─────────────────────────── */

  const itemsToCreate = itemActions.filter((i) => i.action === "CREATE").length;
  const itemsToLink = itemActions.filter((i) => i.action === "LINK").length;
  const itemsToIgnore = itemActions.filter((i) => i.action === "IGNORE").length;

  /* ══════════════════════════════════════════════════════════ */
  /*  PAGINATION HELPERS                                       */
  /* ══════════════════════════════════════════════════════════ */

  function renderPagination(
    pMeta: PaginationMeta,
    setPageFn: (p: number) => void
  ) {
    if (pMeta.totalPages <= 1) return null;
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, pMeta.page - Math.floor(maxVisible / 2));
    const end = Math.min(pMeta.totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);

    return (
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-slate-500">
          {pMeta.total} registro{pMeta.total !== 1 ? "s" : ""} | Pagina {pMeta.page} de{" "}
          {pMeta.totalPages}
        </p>
        <div className="flex gap-1">
          <button
            onClick={() => setPageFn(pMeta.page - 1)}
            disabled={pMeta.page <= 1}
            className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          >
            Anterior
          </button>
          {pages.map((p) => (
            <button
              key={p}
              onClick={() => setPageFn(p)}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                p === pMeta.page
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPageFn(pMeta.page + 1)}
            disabled={pMeta.page >= pMeta.totalPages}
            className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
          >
            Proxima
          </button>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  RENDER: SEFAZ TAB                                        */
  /* ══════════════════════════════════════════════════════════ */

  function renderSefazTab() {
    return (
      <div className="space-y-6">
        {/* ── Config Section ──────────────────────────────── */}
        {sefazConfigLoading ? (
          <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        ) : !sefazConfig?.hasCertificate ? (
          /* No certificate configured */
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="h-8 w-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Certificado Digital Nao Configurado</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Configure o certificado digital A1 para buscar notas automaticamente da SEFAZ.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfigModalOpen(true)}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors flex-shrink-0"
              >
                Configurar
              </button>
            </div>
          </div>
        ) : (
          /* Certificate configured - status card */
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">Certificado Digital</h3>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  sefazConfig.environment === "PRODUCTION"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  {sefazConfig.environment === "PRODUCTION" ? "Producao" : "Homologacao"}
                </span>
                <button
                  onClick={() => setConfigModalOpen(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
                >
                  Alterar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* CN */}
              <div>
                <p className="text-xs text-slate-500">Titular (CN)</p>
                <p className="text-sm font-medium text-slate-900 truncate" title={sefazConfig.certificateCN || ""}>
                  {sefazConfig.certificateCN || "\u2014"}
                </p>
              </div>

              {/* Expiry */}
              <div>
                <p className="text-xs text-slate-500">Validade</p>
                <p className={`text-sm font-medium ${isCertExpiringSoon() ? "text-red-600" : "text-slate-900"}`}>
                  {formatDate(sefazConfig.certificateExpiry)}
                  {isCertExpiringSoon() && (
                    <span className="ml-1 inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700 border border-red-200">
                      Expirando
                    </span>
                  )}
                </p>
              </div>

              {/* NSU */}
              <div>
                <p className="text-xs text-slate-500">Ultimo NSU</p>
                <p className="text-sm font-medium text-slate-900">{sefazConfig.lastNsu || "0"}</p>
              </div>

              {/* Last fetch */}
              <div>
                <p className="text-xs text-slate-500">Ultima Busca</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-slate-900">
                    {sefazConfig.lastFetchAt
                      ? `${formatDate(sefazConfig.lastFetchAt)} ${formatTime(sefazConfig.lastFetchAt)}`
                      : "Nunca"}
                  </p>
                  <FetchStatusBadge status={sefazConfig.lastFetchStatus} />
                </div>
              </div>
            </div>

            {/* Auto-fetch toggle + Fetch Now */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={sefazConfig.autoFetchEnabled}
                    onChange={(e) => handleToggleAutoFetch(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                </div>
                <span className="text-sm text-slate-700">Busca automatica</span>
              </label>
              <button
                onClick={handleFetchNow}
                disabled={fetching}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {fetching ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Buscar Agora
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Filters Row ─────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Date from */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">De</label>
              <input
                type="date"
                value={sefazDateFrom}
                onChange={(e) => { setSefazDateFrom(e.target.value); setSefazPage(1); }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Date to */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ate</label>
              <input
                type="date"
                value={sefazDateTo}
                onChange={(e) => { setSefazDateTo(e.target.value); setSefazPage(1); }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Supplier CNPJ */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">CNPJ Fornecedor</label>
              <input
                type="text"
                name="sefaz_supplier_cnpj"
                autoComplete="off"
                value={sefazSupplierCnpj}
                onChange={(e) => { setSefazSupplierCnpj(e.target.value); setSefazPage(1); }}
                placeholder="00.000.000/0000-00"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select
                value={sefazStatusFilter}
                onChange={(e) => { setSefazStatusFilter(e.target.value); setSefazPage(1); }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="FETCHED">Buscado</option>
                <option value="IMPORTED">Importado</option>
                <option value="IGNORED">Ignorado</option>
                <option value="EVENT">Evento</option>
              </select>
            </div>

            {/* Schema */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
              <select
                value={sefazSchemaFilter}
                onChange={(e) => { setSefazSchemaFilter(e.target.value); setSefazPage(1); }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="resNFe">resNFe</option>
                <option value="procNFe">procNFe</option>
                <option value="resEvento">resEvento</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Buscar</label>
              <input
                type="text"
                name="sefaz_search_nfe"
                autoComplete="off"
                value={sefazSearch}
                onChange={(e) => { setSefazSearch(e.target.value); setSefazPage(1); }}
                placeholder="Chave, nome..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* ── Documents Table ─────────────────────────────── */}
        {sefazDocsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            ))}
          </div>
        ) : sefazDocs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-slate-400 text-sm">
              Nenhum documento SEFAZ encontrado. Configure o certificado e clique em &ldquo;Buscar Agora&rdquo;.
            </p>
          </div>
        ) : (
          <>
            {/* Last refresh indicator */}
            <div className="flex items-center justify-end">
              <p className="text-xs text-slate-400">
                Ultima atualizacao: {formatTime(lastRefresh.toISOString())}
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-16">
                      NSU
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-24">
                      Tipo
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Chave NFe
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Emitente
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-28">
                      Data Emissao
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider w-28">
                      Valor
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-24">
                      Situacao
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-24">
                      Status
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-40">
                      Acoes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sefazDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-3 text-slate-700 font-mono text-xs">
                        {doc.nsu}
                      </td>
                      <td className="px-3 py-3">
                        <SchemaBadge schema={doc.schema} />
                      </td>
                      <td className="px-3 py-3 text-slate-500 font-mono text-xs max-w-[180px] truncate" title={doc.nfeKey || ""}>
                        {truncateKey(doc.nfeKey, 25)}
                      </td>
                      <td className="px-3 py-3">
                        <div>
                          <p className="text-xs text-slate-900 font-medium truncate max-w-[160px]" title={doc.emitterName || ""}>
                            {doc.emitterName || "\u2014"}
                          </p>
                          <p className="text-xs text-slate-400">{formatCnpj(doc.emitterCnpj)}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-500 text-xs">
                        {formatDate(doc.issueDate)}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-slate-900 text-xs">
                        {formatCurrency(doc.nfeValue)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <SituacaoBadge situacao={doc.situacao} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <SefazStatusBadge status={doc.status} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Import button - only for procNFe + FETCHED */}
                          {doc.schema === "procNFe" && doc.status === "FETCHED" && (
                            <button
                              onClick={() => handleImportDoc(doc.id)}
                              disabled={importingDocId === doc.id}
                              className="rounded border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                            >
                              {importingDocId === doc.id ? (
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-green-300 border-t-green-700" />
                              ) : (
                                "Importar"
                              )}
                            </button>
                          )}

                          {/* Ignore button - only for FETCHED */}
                          {doc.status === "FETCHED" && (
                            <button
                              onClick={() => handleIgnoreDoc(doc.id)}
                              disabled={ignoringDocId === doc.id}
                              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                            >
                              {ignoringDocId === doc.id ? (
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                              ) : (
                                "Ignorar"
                              )}
                            </button>
                          )}

                          {/* View XML button */}
                          <button
                            onClick={() => handleViewXml(doc.id)}
                            className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                          >
                            Ver XML
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination(sefazDocsMeta, setSefazPage)}
          </>
        )}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  RENDER: UPLOAD MANUAL TAB                                */
  /* ══════════════════════════════════════════════════════════ */

  function renderUploadManualTab() {
    return (
      <div>
        {/* Header action */}
        <div className="flex items-center justify-end mb-6">
          <button
            onClick={openWizard}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Importar XML
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            ))}
          </div>
        ) : imports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-slate-400 text-sm">
              Nenhuma importacao encontrada. Clique em &ldquo;Importar XML&rdquo; para comecar.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      N. NFe
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Chave
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Fornecedor
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Valor Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Data Emissao
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Acoes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {imports.map((imp) => (
                    <tr key={imp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {imp.nfeNumber}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs max-w-[200px] truncate" title={imp.accessKey}>
                        {imp.accessKey}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {imp.supplierName}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatCurrency(imp.totalCents)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(imp.issueDate)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={imp.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {imp.status === "PENDING" ? (
                          <button
                            onClick={() => {
                              setNfeData(imp);
                              // Initialize actions from existing data
                              if (imp.supplierId) {
                                setSupplierAction({ action: "LINK", partnerId: imp.supplierId });
                              } else {
                                setSupplierAction({ action: "CREATE" });
                              }
                              setItemActions(
                                (imp.items || []).map((item) => ({
                                  itemNumber: item.itemNumber,
                                  action: item.productId ? "LINK" : "CREATE",
                                  productId: item.productId || undefined,
                                }))
                              );
                              setProductSearches({});
                              setProductResults({});
                              setStep(2);
                              setWizardOpen(true);
                            }}
                            className="text-blue-600 hover:text-blue-700 text-xs font-medium hover:underline"
                          >
                            Processar
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">{"\u2014"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination(meta, setPage)}
          </>
        )}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════ */
  /*  RENDER                                                   */
  /* ══════════════════════════════════════════════════════════ */

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Notas Fiscais Eletronicas</h1>
        <p className="text-sm text-slate-500">
          Gerencie notas fiscais via integracao SEFAZ ou importacao manual de XML
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("sefaz")}
          className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "sefaz"
              ? "text-blue-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            Notas SEFAZ
          </div>
          {activeTab === "sefaz" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("upload")}
          className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "upload"
              ? "text-blue-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Manual
          </div>
          {activeTab === "upload" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "sefaz" ? renderSefazTab() : renderUploadManualTab()}

      {/* ══════════════════════════════════════════════════════ */}
      {/*  CONFIG MODAL (SEFAZ Certificate)                     */}
      {/* ══════════════════════════════════════════════════════ */}
      {configModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl mx-4">
            {/* Close button */}
            <button
              onClick={() => { setConfigModalOpen(false); setCertFile(null); setCertPassword(""); }}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors z-10"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Configurar Certificado Digital</h2>
              <p className="text-sm text-slate-500 mb-6">
                Envie o certificado digital A1 (.pfx ou .p12) para conectar com a SEFAZ.
              </p>

              <div className="space-y-4">
                {/* File input */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Arquivo do Certificado</label>
                  <input
                    type="file"
                    accept=".pfx,.p12"
                    onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">Formatos aceitos: .pfx, .p12</p>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Senha do Certificado</label>
                  <input
                    type="password"
                    name="cert_pfx_password"
                    autoComplete="new-password"
                    value={certPassword}
                    onChange={(e) => setCertPassword(e.target.value)}
                    placeholder="Digite a senha do certificado"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Environment */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ambiente</label>
                  <select
                    value={certEnvironment}
                    onChange={(e) => setCertEnvironment(e.target.value as "PRODUCTION" | "HOMOLOGATION")}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="PRODUCTION">Producao</option>
                    <option value="HOMOLOGATION">Homologacao</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-1">
                    Use &ldquo;Homologacao&rdquo; para testes. Selecione &ldquo;Producao&rdquo; para notas reais.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end mt-6 gap-3">
                <button
                  onClick={() => { setConfigModalOpen(false); setCertFile(null); setCertPassword(""); }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUploadCertificate}
                  disabled={uploadingCert || !certFile || !certPassword}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploadingCert ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar Certificado"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/*  XML VIEWER MODAL                                     */}
      {/* ══════════════════════════════════════════════════════ */}
      {xmlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl max-h-[85vh] rounded-2xl bg-white shadow-2xl mx-4 flex flex-col">
            {/* Close button */}
            <button
              onClick={() => { setXmlModalOpen(false); setXmlContent(""); }}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors z-10"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="p-6 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Conteudo XML</h2>
              <p className="text-sm text-slate-500">XML do documento SEFAZ</p>
            </div>

            <div className="flex-1 overflow-auto px-6 pb-6">
              {xmlLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                </div>
              ) : (
                <pre className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 font-mono overflow-auto whitespace-pre-wrap break-all">
                  {xmlContent}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/*  WIZARD MODAL (Upload Manual)                         */}
      {/* ══════════════════════════════════════════════════════ */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl mx-4">
            {/* Close button */}
            <button
              onClick={closeWizard}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors z-10"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="p-6">
              {/* Title */}
              <h2 className="text-lg font-bold text-slate-900 mb-1">Importar Nota Fiscal Eletronica</h2>
              <p className="text-sm text-slate-500 mb-6">Siga os passos para importar a NFe e cadastrar os dados.</p>

              {/* Step indicator */}
              <StepIndicator current={step} />

              {/* ── Step 1: Upload XML ────────────────────── */}
              {step === 1 && (
                <div>
                  <h3 className="text-base font-semibold text-slate-800 mb-4">Upload do Arquivo XML</h3>

                  {!nfeData ? (
                    <>
                      <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 cursor-pointer transition-colors ${
                          dragOver
                            ? "border-blue-400 bg-blue-50"
                            : "border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50"
                        }`}
                      >
                        {uploading ? (
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                            <p className="text-sm text-slate-500">Processando XML...</p>
                          </div>
                        ) : (
                          <>
                            <svg className="h-12 w-12 text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                            <p className="text-sm font-medium text-slate-700 mb-1">
                              Arraste o arquivo XML aqui ou clique para selecionar
                            </p>
                            <p className="text-xs text-slate-400">Somente arquivos .xml da NFe</p>
                          </>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xml"
                        onChange={handleFileInput}
                        className="hidden"
                      />
                    </>
                  ) : (
                    <div className="rounded-xl border border-green-200 bg-green-50 p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-semibold text-green-800">XML processado com sucesso</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                        <div>
                          <p className="text-xs text-slate-500">N. NFe</p>
                          <p className="text-sm font-medium text-slate-900">{nfeData.nfeNumber}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Chave de Acesso</p>
                          <p className="text-sm font-mono text-slate-700 truncate" title={nfeData.accessKey}>
                            {nfeData.accessKey}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Fornecedor</p>
                          <p className="text-sm font-medium text-slate-900">{nfeData.supplierName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">CNPJ</p>
                          <p className="text-sm text-slate-700">{nfeData.supplierCnpj}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Valor Total</p>
                          <p className="text-sm font-semibold text-slate-900">{formatCurrency(nfeData.totalCents)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Itens</p>
                          <p className="text-sm font-medium text-slate-900">{nfeData.items?.length || 0} itens</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="flex justify-end mt-6 gap-3">
                    <button
                      onClick={closeWizard}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => setStep(2)}
                      disabled={!nfeData}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Proximo
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 2: Fornecedor ────────────────────── */}
              {step === 2 && nfeData && (
                <div>
                  <h3 className="text-base font-semibold text-slate-800 mb-4">Fornecedor</h3>

                  {/* Supplier info from NFe */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-5">
                    <p className="text-xs text-slate-500 mb-1">Dados do fornecedor na NFe</p>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{nfeData.supplierName}</p>
                        <p className="text-xs text-slate-500">CNPJ: {nfeData.supplierCnpj}</p>
                      </div>
                    </div>
                  </div>

                  {/* If auto-matched */}
                  {nfeData.supplierId && nfeData.supplierMatchedName ? (
                    <div className="rounded-xl border border-green-200 bg-green-50 p-4 mb-5">
                      <div className="flex items-center gap-2">
                        <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium text-green-800">
                          Fornecedor encontrado: {nfeData.supplierMatchedName}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-300">
                          Vinculado
                        </span>
                      </div>
                      <p className="text-xs text-green-600 mt-1">
                        O fornecedor foi identificado automaticamente pelo CNPJ.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Options when not matched */}
                      <p className="text-sm text-slate-600 mb-3">
                        Fornecedor nao encontrado no sistema. Escolha uma acao:
                      </p>
                      <div className="space-y-3">
                        {/* Option: Create new */}
                        <label
                          className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                            supplierAction.action === "CREATE"
                              ? "border-blue-300 bg-blue-50"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="supplierAction"
                            checked={supplierAction.action === "CREATE"}
                            onChange={() => setSupplierAction({ action: "CREATE" })}
                            className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <p className="text-sm font-medium text-slate-900">Cadastrar novo parceiro</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Sera criado um novo fornecedor com os dados da NFe:
                              {" "}{nfeData.supplierName} ({nfeData.supplierCnpj})
                            </p>
                          </div>
                        </label>

                        {/* Option: Link existing */}
                        <label
                          className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                            supplierAction.action === "LINK"
                              ? "border-blue-300 bg-blue-50"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="supplierAction"
                            checked={supplierAction.action === "LINK"}
                            onChange={() => setSupplierAction({ action: "LINK" })}
                            className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">Vincular a parceiro existente</p>
                            <p className="text-xs text-slate-500 mt-0.5 mb-2">
                              Busque e selecione um fornecedor ja cadastrado no sistema.
                            </p>
                            {supplierAction.action === "LINK" && (
                              <div className="relative">
                                <input
                                  type="text"
                                  value={partnerSearch}
                                  onChange={(e) => searchPartners(e.target.value)}
                                  placeholder="Buscar fornecedor por nome..."
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                {searchingPartners && (
                                  <div className="absolute right-3 top-2.5">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                                  </div>
                                )}
                                {partnerResults.length > 0 && (
                                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                                    {partnerResults.map((p) => (
                                      <button
                                        key={p.id}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          selectPartner(p);
                                        }}
                                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
                                      >
                                        <span className="font-medium text-slate-900">{p.name}</span>
                                        <span className="text-xs text-slate-400">{p.document}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                    </>
                  )}

                  {/* Navigation */}
                  <div className="flex justify-between mt-6">
                    <button
                      onClick={() => setStep(1)}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      disabled={supplierAction.action === "LINK" && !supplierAction.partnerId}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Proximo
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 3: Produtos ──────────────────────── */}
              {step === 3 && nfeData && (
                <div>
                  <h3 className="text-base font-semibold text-slate-800 mb-4">Produtos</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Defina a acao para cada item da nota fiscal.
                  </p>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 w-10">#</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Codigo</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">Descricao</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 w-16">NCM</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600 w-12">Unid</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 w-14">Qtd</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 w-24">Preco Unit.</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 w-24">Total</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 w-52">Acao</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(nfeData.items || []).map((item) => {
                          const ia = itemActions.find((a) => a.itemNumber === item.itemNumber);
                          const action = ia?.action || "CREATE";
                          const isLinkedAuto = item.productId && action === "LINK";

                          return (
                            <tr key={item.itemNumber} className="hover:bg-slate-50 transition-colors">
                              <td className="px-3 py-2 text-slate-500 text-xs">{item.itemNumber}</td>
                              <td className="px-3 py-2 text-slate-700 font-mono text-xs">{item.productCode}</td>
                              <td className="px-3 py-2 text-slate-900 text-xs max-w-[180px] truncate" title={item.description}>
                                {item.description}
                              </td>
                              <td className="px-3 py-2 text-slate-500 text-xs">{item.ncm}</td>
                              <td className="px-3 py-2 text-center text-slate-500 text-xs">{item.unit}</td>
                              <td className="px-3 py-2 text-right text-slate-700 text-xs">{item.quantity}</td>
                              <td className="px-3 py-2 text-right text-slate-700 text-xs">{formatCurrency(item.unitPriceCents)}</td>
                              <td className="px-3 py-2 text-right font-medium text-slate-900 text-xs">{formatCurrency(item.totalCents)}</td>
                              <td className="px-3 py-2">
                                {isLinkedAuto ? (
                                  <div className="flex items-center gap-1.5">
                                    <svg className="h-4 w-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                                    </svg>
                                    <span className="text-xs text-green-700 font-medium truncate" title={item.productDescription || undefined}>
                                      Vinculado: {item.productDescription || "Produto"}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    <select
                                      value={action}
                                      onChange={(e) =>
                                        updateItemAction(
                                          item.itemNumber,
                                          e.target.value as "CREATE" | "LINK" | "IGNORE"
                                        )
                                      }
                                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                      <option value="CREATE">Cadastrar novo</option>
                                      <option value="LINK">Vincular existente</option>
                                      <option value="IGNORE">Ignorar</option>
                                    </select>

                                    {action === "LINK" && (
                                      <div className="relative">
                                        <input
                                          type="text"
                                          value={productSearches[item.itemNumber] || ""}
                                          onChange={(e) => searchProducts(item.itemNumber, e.target.value)}
                                          placeholder="Buscar produto..."
                                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        {searchingProducts[item.itemNumber] && (
                                          <div className="absolute right-2 top-1.5">
                                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                                          </div>
                                        )}
                                        {(productResults[item.itemNumber] || []).length > 0 && (
                                          <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg max-h-36 overflow-y-auto">
                                            {(productResults[item.itemNumber] || []).map((prod) => (
                                              <button
                                                key={prod.id}
                                                onClick={() => selectProduct(item.itemNumber, prod)}
                                                className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs hover:bg-blue-50 transition-colors"
                                              >
                                                <span className="font-medium text-slate-900 truncate">{prod.description}</span>
                                                <span className="text-slate-400 ml-2 flex-shrink-0">{prod.code}</span>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                        {ia?.productId && (
                                          <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                            Produto selecionado
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-between mt-6">
                    <button
                      onClick={() => setStep(2)}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={() => setStep(4)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                    >
                      Proximo
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 4: Confirmacao ───────────────────── */}
              {step === 4 && nfeData && (
                <div>
                  <h3 className="text-base font-semibold text-slate-800 mb-4">Confirmacao</h3>

                  <div className="space-y-4">
                    {/* Supplier summary */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Fornecedor</p>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-medium text-slate-900">{nfeData.supplierName}</p>
                        {supplierAction.action === "CREATE" ? (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                            Cadastrar novo
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-200">
                            Vincular existente
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Items summary */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Itens ({nfeData.items?.length || 0})</p>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="rounded-lg bg-white border border-slate-200 p-3 text-center">
                          <p className="text-lg font-bold text-blue-600">{itemsToCreate}</p>
                          <p className="text-xs text-slate-500">Cadastrar novos</p>
                        </div>
                        <div className="rounded-lg bg-white border border-slate-200 p-3 text-center">
                          <p className="text-lg font-bold text-green-600">{itemsToLink}</p>
                          <p className="text-xs text-slate-500">Vincular existentes</p>
                        </div>
                        <div className="rounded-lg bg-white border border-slate-200 p-3 text-center">
                          <p className="text-lg font-bold text-slate-400">{itemsToIgnore}</p>
                          <p className="text-xs text-slate-500">Ignorar</p>
                        </div>
                      </div>
                    </div>

                    {/* Total / Financial */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Valor Total</p>
                      <p className="text-xl font-bold text-slate-900">{formatCurrency(nfeData.totalCents)}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Sera criado um lancamento A Pagar com esse valor.
                      </p>
                    </div>

                    {/* Warning */}
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex gap-3">
                        <svg className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-amber-800">Atencao</p>
                          <p className="text-xs text-amber-700 mt-1">
                            Ao confirmar, serao criados automaticamente: parceiro (se necessario), produtos novos,
                            equivalencias e um lancamento A Pagar.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-between mt-6">
                    <button
                      onClick={() => setStep(3)}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleProcess}
                      disabled={processing}
                      className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {processing ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Confirmar Importacao
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
