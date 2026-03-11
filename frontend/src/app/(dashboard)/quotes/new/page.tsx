"use client";

import { useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import Link from "next/link";
import LookupField from "@/components/ui/LookupField";
import type { LookupFetcher, LookupFetcherResult } from "@/components/ui/SearchLookupModal";
import { useToast } from "@/components/ui/Toast";

/* ── Types ── */
type PartnerSummary = { id: string; name: string; document: string | null; phone: string | null; email: string | null };
type ServiceOrderSummary = { id: string; code: string; title: string };
type ProductSummary = { id: string; name: string; code: string | null; unit: string; salePriceCents: number };
type ServiceSummary = { id: string; name: string; code: string | null; unit: string; priceCents: number };

type QuoteItemRow = {
  key: string;
  type: "SERVICE" | "PRODUCT" | "LABOR";
  productId: string | null;
  serviceId: string | null;
  description: string;
  unit: string;
  quantity: string;
  unitPriceCents: string;
  discountPercent: string;
};

/* ── Fetchers (module-level) ── */
const clientFetcher: LookupFetcher<PartnerSummary> = async (search, page, signal) => {
  const params = new URLSearchParams({ type: "CLIENTE", page: String(page), limit: "20" });
  if (search) params.set("search", search);
  return api.get<LookupFetcherResult<PartnerSummary>>(`/partners?${params.toString()}`, { signal });
};

const osFetcher: LookupFetcher<ServiceOrderSummary> = async (search, page, signal) => {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("search", search);
  return api.get<LookupFetcherResult<ServiceOrderSummary>>(`/service-orders?${params.toString()}`, { signal });
};

const productFetcher: LookupFetcher<ProductSummary> = async (search, page, signal) => {
  const params = new URLSearchParams({ page: String(page), limit: "20", status: "active" });
  if (search) params.set("search", search);
  return api.get<LookupFetcherResult<ProductSummary>>(`/products?${params.toString()}`, { signal });
};

const serviceFetcher: LookupFetcher<ServiceSummary> = async (search, page, signal) => {
  const params = new URLSearchParams({ page: String(page), limit: "20", status: "active" });
  if (search) params.set("search", search);
  return api.get<LookupFetcherResult<ServiceSummary>>(`/services?${params.toString()}`, { signal });
};

/* ── Helpers ── */
const inputClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 w-full";

function parseBRL(s: string): number {
  return parseFloat((s || "0").replace(/[^\d,]/g, "").replace(",", "."));
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function emptyItem(): QuoteItemRow {
  return {
    key: crypto.randomUUID(),
    type: "SERVICE",
    productId: null,
    serviceId: null,
    description: "",
    unit: "UN",
    quantity: "1",
    unitPriceCents: "",
    discountPercent: "",
  };
}

function calcItemTotal(item: QuoteItemRow): number {
  const qty = parseFloat(item.quantity.replace(",", ".")) || 0;
  const price = Math.round(parseBRL(item.unitPriceCents) * 100);
  const disc = parseFloat(item.discountPercent.replace(",", ".")) || 0;
  return Math.round(qty * price * (1 - disc / 100));
}

export default function NewQuotePageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><svg className="h-8 w-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>}>
      <NewQuotePage />
    </Suspense>
  );
}

function NewQuotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Header fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedClient, setSelectedClient] = useState<PartnerSummary | null>(null);
  const [selectedOS, setSelectedOS] = useState<ServiceOrderSummary | null>(null);

  // Items
  const [items, setItems] = useState<QuoteItemRow[]>([emptyItem()]);

  // Global discount
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");

  // Notes
  const [notes, setNotes] = useState("");
  const [termsConditions, setTermsConditions] = useState("");

  // Attachments (partner PDFs)
  const [attachmentFiles, setAttachmentFiles] = useState<{ file: File; label: string; supplierName: string }[]>([]);

  // Pre-fill from serviceOrderId query param
  const prefilledOsId = searchParams.get("serviceOrderId");

  // Computed totals
  const subtotalCents = items.reduce((sum, item) => sum + calcItemTotal(item), 0);
  const globalDiscountCents = discountType === "percent"
    ? Math.round(subtotalCents * (parseFloat(discountValue.replace(",", ".")) || 0) / 100)
    : Math.round(parseBRL(discountValue) * 100);
  const totalCents = Math.max(0, subtotalCents - globalDiscountCents);

  // Item handlers
  function updateItem(key: string, field: keyof QuoteItemRow, value: string) {
    setItems(prev => prev.map(item =>
      item.key === key ? { ...item, [field]: value } : item
    ));
  }

  function removeItem(key: string) {
    setItems(prev => {
      const next = prev.filter(item => item.key !== key);
      return next.length === 0 ? [emptyItem()] : next;
    });
  }

  function addItem() {
    setItems(prev => [...prev, emptyItem()]);
  }

  function selectProduct(key: string, product: ProductSummary) {
    setItems(prev => prev.map(item =>
      item.key === key ? {
        ...item,
        productId: product.id,
        serviceId: null,
        description: product.name,
        unit: product.unit || "UN",
        unitPriceCents: (product.salePriceCents / 100).toFixed(2).replace(".", ","),
      } : item
    ));
  }

  function selectService(key: string, service: ServiceSummary) {
    setItems(prev => prev.map(item =>
      item.key === key ? {
        ...item,
        serviceId: service.id,
        productId: null,
        description: service.name,
        unit: service.unit || "SV",
        unitPriceCents: (service.priceCents / 100).toFixed(2).replace(".", ","),
      } : item
    ));
  }

  // Move item up/down
  function moveItem(key: string, direction: "up" | "down") {
    setItems(prev => {
      const idx = prev.findIndex(i => i.key === key);
      if (idx < 0) return prev;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
  }

  // Attachment handlers
  function addAttachment(file: File) {
    setAttachmentFiles(prev => [...prev, { file, label: "", supplierName: "" }]);
  }

  function removeAttachment(idx: number) {
    setAttachmentFiles(prev => prev.filter((_, i) => i !== idx));
  }

  function updateAttachment(idx: number, field: "label" | "supplierName", value: string) {
    setAttachmentFiles(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  }

  // Submit
  async function handleSubmit(action: "draft" | "send") {
    setError(null);
    setLoading(true);

    try {
      if (!title.trim()) { setError("Titulo e obrigatorio"); setLoading(false); return; }
      if (!selectedClient) { setError("Selecione um cliente"); setLoading(false); return; }

      const validItems = items.filter(i => i.description.trim());
      if (validItems.length === 0) { setError("Adicione pelo menos um item"); setLoading(false); return; }

      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        clientPartnerId: selectedClient.id,
        serviceOrderId: selectedOS?.id || undefined,
        discountPercent: discountType === "percent" ? (parseFloat(discountValue.replace(",", ".")) || undefined) : undefined,
        discountCents: discountType === "fixed" ? Math.round(parseBRL(discountValue) * 100) || undefined : undefined,
        notes: notes.trim() || undefined,
        termsConditions: termsConditions.trim() || undefined,
        items: validItems.map((item, idx) => ({
          type: item.type,
          productId: item.productId || undefined,
          serviceId: item.serviceId || undefined,
          description: item.description,
          unit: item.unit,
          quantity: parseFloat(item.quantity.replace(",", ".")) || 1,
          unitPriceCents: Math.round(parseBRL(item.unitPriceCents) * 100),
          discountPercent: parseFloat(item.discountPercent.replace(",", ".")) || undefined,
          sortOrder: idx,
        })),
      };

      const quote = await api.post<{ id: string }>("/quotes", payload);

      // Upload attachments if any
      for (const att of attachmentFiles) {
        const formData = new FormData();
        formData.append("file", att.file);
        if (att.label) formData.append("label", att.label);
        if (att.supplierName) formData.append("supplierName", att.supplierName);

        await fetch(`/api/quotes/${quote.id}/attachments`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${(await import("@/lib/api")).getAccessToken()}`,
          },
          body: formData,
          credentials: "include",
        });
      }

      if (action === "send") {
        try {
          await api.post(`/quotes/${quote.id}/send`, {});
          toast("Orcamento criado e enviado!", "success");
        } catch {
          toast("Orcamento criado, mas houve erro ao enviar.", "warning");
        }
      } else {
        toast("Orcamento salvo como rascunho!", "success");
      }

      router.push(`/quotes/${quote.id}`);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Erro ao salvar orcamento");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1 text-sm text-slate-500">
        <Link href="/quotes" className="hover:text-blue-600">Orcamentos</Link>
        <span>/</span>
        <span className="text-slate-700">Novo Orcamento</span>
      </nav>

      <h1 className="text-2xl font-bold text-slate-800 mb-6">Novo Orcamento</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit("draft"); }}>
        {/* ── Header Section ── */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">Dados do Orcamento</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Titulo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Manutencao preventiva - Ar condicionado"
                className={inputClass}
                required
              />
            </div>

            {/* Client */}
            <LookupField<PartnerSummary>
              label="Cliente"
              placeholder="Buscar cliente..."
              modalTitle="Buscar Cliente"
              modalPlaceholder="Nome, documento ou telefone..."
              value={selectedClient}
              onChange={setSelectedClient}
              fetcher={clientFetcher}
              keyExtractor={c => c.id}
              displayValue={c => c.name}
              renderItem={c => (
                <div>
                  <div className="font-medium text-sm">{c.name}</div>
                  {c.document && <div className="text-xs text-slate-500">{c.document}</div>}
                </div>
              )}
              required
            />

            {/* OS vinculada */}
            <LookupField<ServiceOrderSummary>
              label="OS Vinculada"
              placeholder="Opcional - buscar OS..."
              modalTitle="Vincular a Ordem de Servico"
              modalPlaceholder="Codigo ou titulo da OS..."
              value={selectedOS}
              onChange={setSelectedOS}
              fetcher={osFetcher}
              keyExtractor={o => o.id}
              displayValue={o => `${o.code} - ${o.title}`}
              renderItem={o => (
                <div>
                  <div className="font-medium text-sm">{o.code}</div>
                  <div className="text-xs text-slate-500 truncate">{o.title}</div>
                </div>
              )}
            />

            {/* Description */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Descricao</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descricao geral do orcamento..."
                rows={2}
                className={inputClass + " resize-none"}
              />
            </div>

          </div>
        </div>

        {/* ── Items Section ── */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-700">Itens do Orcamento</h2>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Adicionar Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, idx) => (
              <QuoteItemEditor
                key={item.key}
                item={item}
                index={idx}
                totalItems={items.length}
                onUpdate={(field, value) => updateItem(item.key, field, value)}
                onRemove={() => removeItem(item.key)}
                onMove={(dir) => moveItem(item.key, dir)}
                onSelectProduct={(p) => selectProduct(item.key, p)}
                onSelectService={(s) => selectService(item.key, s)}
              />
            ))}
          </div>

          {/* Totals */}
          <div className="mt-6 border-t border-slate-200 pt-4">
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-medium text-slate-800 w-32 text-right">{formatCurrency(subtotalCents)}</span>
              </div>

              {/* Global Discount */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-600">Desconto:</span>
                <select
                  value={discountType}
                  onChange={e => { setDiscountType(e.target.value as "percent" | "fixed"); setDiscountValue(""); }}
                  className="rounded border border-slate-300 px-2 py-1 text-xs bg-white"
                >
                  <option value="percent">%</option>
                  <option value="fixed">R$</option>
                </select>
                <input
                  type="text"
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  placeholder={discountType === "percent" ? "0" : "0,00"}
                  className="w-24 rounded border border-slate-300 px-2 py-1 text-sm text-right outline-none focus:border-blue-500"
                />
                {globalDiscountCents > 0 && (
                  <span className="text-red-500 w-32 text-right">-{formatCurrency(globalDiscountCents)}</span>
                )}
              </div>

              <div className="flex items-center gap-4 text-base font-bold border-t border-slate-300 pt-2 mt-1">
                <span className="text-slate-800">TOTAL:</span>
                <span className="text-blue-700 w-32 text-right">{formatCurrency(totalCents)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Attachments Section (Partner PDFs) ── */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-slate-700 mb-2">Orcamentos de Parceiros</h2>
          <p className="text-xs text-slate-500 mb-4">
            Anexe orcamentos em PDF de lojas parceiras (ex: materiais, equipamentos). Serao enviados junto com o orcamento.
          </p>

          {attachmentFiles.map((att, idx) => (
            <div key={idx} className="flex items-start gap-3 mb-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex-shrink-0 mt-1">
                <svg className="h-8 w-8 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                </svg>
              </div>
              <div className="flex-1 space-y-2">
                <div className="text-sm font-medium text-slate-700 truncate">{att.file.name}</div>
                <div className="text-xs text-slate-500">{(att.file.size / 1024).toFixed(0)} KB</div>
                <input
                  type="text"
                  value={att.supplierName}
                  onChange={e => updateAttachment(idx, "supplierName", e.target.value)}
                  placeholder="Nome do fornecedor..."
                  className="rounded border border-slate-300 px-2 py-1 text-sm w-full outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  value={att.label}
                  onChange={e => updateAttachment(idx, "label", e.target.value)}
                  placeholder="Descricao (ex: Materiais eletricos)"
                  className="rounded border border-slate-300 px-2 py-1 text-sm w-full outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={() => removeAttachment(idx)}
                className="text-slate-400 hover:text-red-500 transition-colors mt-1"
                title="Remover"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          <label className="flex items-center gap-2 cursor-pointer rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Anexar PDF de parceiro
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) addAttachment(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {/* ── Notes Section ── */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">Observacoes e Termos</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Observacoes Internas</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notas internas (nao visiveis ao cliente)..."
                rows={2}
                className={inputClass + " resize-none"}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Termos e Condicoes</label>
              <textarea
                value={termsConditions}
                onChange={e => setTermsConditions(e.target.value)}
                placeholder="Termos que serao exibidos ao cliente no orcamento..."
                rows={3}
                className={inputClass + " resize-none"}
              />
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center justify-between">
          <Link
            href="/quotes"
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg border border-blue-300 bg-white px-5 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar Rascunho"}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit("send")}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? "Salvando..." : "Salvar e Enviar"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ── QuoteItemEditor Component ── */
function QuoteItemEditor({
  item,
  index,
  totalItems,
  onUpdate,
  onRemove,
  onMove,
  onSelectProduct,
  onSelectService,
}: {
  item: QuoteItemRow;
  index: number;
  totalItems: number;
  onUpdate: (field: keyof QuoteItemRow, value: string) => void;
  onRemove: () => void;
  onMove: (dir: "up" | "down") => void;
  onSelectProduct: (p: ProductSummary) => void;
  onSelectService: (s: ServiceSummary) => void;
}) {
  const [showProductLookup, setShowProductLookup] = useState(false);
  const [showServiceLookup, setShowServiceLookup] = useState(false);
  const itemTotal = calcItemTotal(item);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold text-slate-400 w-6">#{index + 1}</span>

        {/* Move buttons */}
        <div className="flex flex-col gap-0.5">
          <button type="button" onClick={() => onMove("up")} disabled={index === 0}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-30" title="Mover para cima">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button type="button" onClick={() => onMove("down")} disabled={index === totalItems - 1}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-30" title="Mover para baixo">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Type selector */}
        <select
          value={item.type}
          onChange={e => {
            onUpdate("type", e.target.value);
            onUpdate("productId", "");
            onUpdate("serviceId", "");
          }}
          className="rounded border border-slate-300 px-2 py-1 text-xs bg-white font-medium"
        >
          <option value="SERVICE">Servico</option>
          <option value="PRODUCT">Produto</option>
          <option value="LABOR">Mao de Obra</option>
        </select>

        {/* Catalog search button */}
        {item.type === "PRODUCT" && (
          <button
            type="button"
            onClick={() => setShowProductLookup(true)}
            className="flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100 transition-colors"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Catalogo
          </button>
        )}
        {item.type === "SERVICE" && (
          <button
            type="button"
            onClick={() => setShowServiceLookup(true)}
            className="flex items-center gap-1 rounded bg-purple-50 px-2 py-1 text-xs text-purple-700 hover:bg-purple-100 transition-colors"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Catalogo
          </button>
        )}

        <div className="flex-1" />

        {/* Item total */}
        <span className="text-sm font-semibold text-slate-700">{formatCurrency(itemTotal)}</span>

        {/* Remove */}
        <button type="button" onClick={onRemove}
          className="text-slate-400 hover:text-red-500 transition-colors" title="Remover item">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Item fields */}
      <div className="grid grid-cols-12 gap-2">
        {/* Description - spans 12 on mobile, 5 on desktop */}
        <div className="col-span-12 md:col-span-5">
          <label className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5 block">Descricao</label>
          <input
            type="text"
            value={item.description}
            onChange={e => onUpdate("description", e.target.value)}
            placeholder="Descricao do item..."
            className="rounded border border-slate-300 px-2 py-1.5 text-sm w-full outline-none focus:border-blue-500"
          />
        </div>

        {/* Quantity */}
        <div className="col-span-4 md:col-span-1">
          <label className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5 block">Qtd</label>
          <input
            type="text"
            value={item.quantity}
            onChange={e => onUpdate("quantity", e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm w-full text-center outline-none focus:border-blue-500"
          />
        </div>

        {/* Unit */}
        <div className="col-span-4 md:col-span-1">
          <label className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5 block">Unid</label>
          <select
            value={item.unit}
            onChange={e => onUpdate("unit", e.target.value)}
            className="rounded border border-slate-300 px-1 py-1.5 text-sm w-full bg-white outline-none focus:border-blue-500"
          >
            <option value="UN">UN</option>
            <option value="SV">SV</option>
            <option value="HR">HR</option>
            <option value="MT">MT</option>
            <option value="M2">M2</option>
            <option value="KG">KG</option>
            <option value="CX">CX</option>
            <option value="PC">PC</option>
          </select>
        </div>

        {/* Unit price */}
        <div className="col-span-4 md:col-span-2">
          <label className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5 block">Valor Unit. (R$)</label>
          <input
            type="text"
            value={item.unitPriceCents}
            onChange={e => onUpdate("unitPriceCents", e.target.value)}
            placeholder="0,00"
            className="rounded border border-slate-300 px-2 py-1.5 text-sm w-full text-right outline-none focus:border-blue-500"
          />
        </div>

        {/* Discount */}
        <div className="col-span-6 md:col-span-1">
          <label className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5 block">Desc.%</label>
          <input
            type="text"
            value={item.discountPercent}
            onChange={e => onUpdate("discountPercent", e.target.value)}
            placeholder="0"
            className="rounded border border-slate-300 px-2 py-1.5 text-sm w-full text-center outline-none focus:border-blue-500"
          />
        </div>

        {/* Total (read-only) */}
        <div className="col-span-6 md:col-span-2">
          <label className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5 block">Total</label>
          <div className="rounded bg-slate-100 border border-slate-200 px-2 py-1.5 text-sm text-right font-medium text-slate-700">
            {formatCurrency(itemTotal)}
          </div>
        </div>
      </div>

      {/* Product Lookup Modal */}
      {showProductLookup && (
        <SearchLookupModalInline
          title="Buscar Produto"
          placeholder="Nome ou codigo do produto..."
          fetcher={productFetcher}
          keyExtractor={(p: ProductSummary) => p.id}
          renderItem={(p: ProductSummary) => (
            <div className="flex items-center justify-between w-full">
              <div>
                <div className="font-medium text-sm">{p.name}</div>
                {p.code && <div className="text-xs text-slate-500">{p.code}</div>}
              </div>
              <span className="text-sm font-medium text-green-700">{formatCurrency(p.salePriceCents)}</span>
            </div>
          )}
          onSelect={(p: ProductSummary) => { onSelectProduct(p); setShowProductLookup(false); }}
          onClose={() => setShowProductLookup(false)}
        />
      )}

      {/* Service Lookup Modal */}
      {showServiceLookup && (
        <SearchLookupModalInline
          title="Buscar Servico"
          placeholder="Nome ou codigo do servico..."
          fetcher={serviceFetcher}
          keyExtractor={(s: ServiceSummary) => s.id}
          renderItem={(s: ServiceSummary) => (
            <div className="flex items-center justify-between w-full">
              <div>
                <div className="font-medium text-sm">{s.name}</div>
                {s.code && <div className="text-xs text-slate-500">{s.code}</div>}
              </div>
              <span className="text-sm font-medium text-purple-700">{formatCurrency(s.priceCents)}</span>
            </div>
          )}
          onSelect={(s: ServiceSummary) => { onSelectService(s); setShowServiceLookup(false); }}
          onClose={() => setShowServiceLookup(false)}
        />
      )}
    </div>
  );
}

/* ── Inline Search Modal (simpler, embedded in item) ── */
import SearchLookupModal from "@/components/ui/SearchLookupModal";

function SearchLookupModalInline<T>({
  title,
  placeholder,
  fetcher,
  keyExtractor,
  renderItem,
  onSelect,
  onClose,
}: {
  title: string;
  placeholder: string;
  fetcher: LookupFetcher<T>;
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  onSelect: (item: T) => void;
  onClose: () => void;
}) {
  return (
    <SearchLookupModal
      open={true}
      title={title}
      placeholder={placeholder}
      fetcher={fetcher}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}
