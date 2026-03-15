"use client";

import { api } from "@/lib/api";
import LookupField from "@/components/ui/LookupField";
import type { LookupFetcher, LookupFetcherResult } from "@/components/ui/SearchLookupModal";

/* ── Types ─────────────────────────────────────────── */

export interface ServiceItemRow {
  serviceId: string;
  serviceName: string;
  unit: string;
  unitPriceCents: number;
  commissionBps: number | null;
  quantity: number;
}

interface ServiceOption {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  unit: string;
  priceCents: number | null;
  commissionBps: number | null;
  category: string | null;
  isActive: boolean;
}

interface Props {
  items: ServiceItemRow[];
  onChange: (items: ServiceItemRow[]) => void;
}

/* ── Helpers ────────────────────────────────────────── */

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const UNIT_LABELS: Record<string, string> = {
  SV: "Serviço",
  HR: "Hora",
  UN: "Unidade",
  DI: "Diária",
  MT: "Metro",
  M2: "Metro²",
};

/* ── Fetcher (module-level) ─────────────────────────── */

const serviceFetcher: LookupFetcher<ServiceOption> = async (search, page, signal) => {
  const params = new URLSearchParams({ status: "active", page: String(page), limit: "20" });
  if (search) params.set("search", search);
  return api.get<LookupFetcherResult<ServiceOption>>(`/services?${params.toString()}`, { signal });
};

/* ── Component ──────────────────────────────────────── */

export default function ServiceItemsSection({ items, onChange }: Props) {

  function handleAddService(svc: ServiceOption | null) {
    if (!svc) return;
    // Prevent duplicate
    if (items.some((i) => i.serviceId === svc.id)) return;
    const newItem: ServiceItemRow = {
      serviceId: svc.id,
      serviceName: svc.name,
      unit: svc.unit || "SV",
      unitPriceCents: svc.priceCents || 0,
      commissionBps: svc.commissionBps ?? null,
      quantity: 1,
    };
    onChange([...items, newItem]);
  }

  function handleRemove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function handleQtyChange(idx: number, qty: number) {
    const updated = items.map((item, i) =>
      i === idx ? { ...item, quantity: Math.max(1, qty) } : item,
    );
    onChange(updated);
  }

  const totalCents = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);

  return (
    <div>
      {/* Search field — always visible */}
      <LookupField<ServiceOption>
        label="Serviços *"
        placeholder="Buscar serviço por nome ou código..."
        modalTitle="Buscar Serviço"
        modalPlaceholder="Nome, código ou descrição..."
        value={null}
        displayValue={(s) => s.name}
        onChange={handleAddService}
        fetcher={serviceFetcher}
        keyExtractor={(s) => s.id}
        renderItem={(s) => (
          <div>
            <div className="font-medium text-slate-900">
              {s.code && <span className="text-slate-400 font-mono text-xs mr-2">{s.code}</span>}
              {s.name}
            </div>
            <div className="flex gap-3 text-xs text-slate-400 mt-0.5">
              <span>{UNIT_LABELS[s.unit] || s.unit}</span>
              {s.priceCents != null && <span>{formatCurrency(s.priceCents)}</span>}
              {s.commissionBps != null && <span>Comissão: {(s.commissionBps / 100).toFixed(1)}%</span>}
            </div>
          </div>
        )}
      />

      {/* Items table */}
      {items.length > 0 && (
        <div className="rounded-lg border border-slate-200 overflow-hidden mt-3">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Serviço</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase w-16">Qtd</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase w-16">Un</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase w-24">Valor Unit.</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase w-20">Comissão</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase w-24">Total</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <tr key={item.serviceId} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-900 font-medium">{item.serviceName}</td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => handleQtyChange(idx, parseInt(e.target.value) || 1)}
                      className="w-14 rounded border border-slate-300 px-1.5 py-0.5 text-center text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                    />
                  </td>
                  <td className="px-3 py-2 text-center text-slate-500">{UNIT_LABELS[item.unit] || item.unit}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(item.unitPriceCents)}</td>
                  <td className="px-3 py-2 text-right text-slate-500">
                    {item.commissionBps != null ? `${(item.commissionBps / 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-green-700">
                    {formatCurrency(item.unitPriceCents * item.quantity)}
                  </td>
                  <td className="px-1 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      className="text-red-400 hover:text-red-600 text-xs"
                      title="Remover"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200">
                <td colSpan={5} className="px-3 py-2 text-right text-sm font-semibold text-slate-700">
                  Total:
                </td>
                <td className="px-3 py-2 text-right text-sm font-bold text-green-700">
                  {formatCurrency(totalCents)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
