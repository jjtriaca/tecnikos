"use client";

import { useState } from "react";

/* ---- Props ---- */
export interface LocationPickerModalProps {
  open: boolean;
  lat: number | null;
  lng: number | null;
  city?: string | null;
  state?: string | null;
  addressText?: string | null;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
}

/* ---- Build Google Maps search URL ---- */
function buildSearchUrl(props: LocationPickerModalProps): string {
  const parts: string[] = [];
  if (props.addressText) parts.push(props.addressText);
  else {
    if (props.city) parts.push(props.city);
    if (props.state) parts.push(props.state);
  }
  const q = parts.join(", ") || "Brasil";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/* ---- Parse pasted coordinates ---- */
function parseCoordinates(raw: string): { lat: number; lng: number } | null {
  if (!raw.trim()) return null;

  // Clean: remove parentheses, extra spaces
  const cleaned = raw.replace(/[()]/g, "").trim();

  // Try "lat, lng" or "lat lng" (comma or space separated)
  const match = cleaned.match(/^(-?\d+[.,]\d+)\s*[,;\s]\s*(-?\d+[.,]\d+)$/);
  if (!match) return null;

  const lat = parseFloat(match[1].replace(",", "."));
  const lng = parseFloat(match[2].replace(",", "."));

  // Validate ranges
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;

  return { lat, lng };
}

/* ---- Modal ---- */
export default function LocationPickerModal({
  open,
  lat,
  lng,
  city,
  state,
  addressText,
  onConfirm,
  onClose,
}: LocationPickerModalProps) {
  const [coordsInput, setCoordsInput] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const parsed = parseCoordinates(coordsInput);

  function handleConfirm() {
    if (!parsed) {
      setError("Formato inválido. Cole as coordenadas copiadas do Google Maps.");
      return;
    }
    setError("");
    onConfirm(parsed.lat, parsed.lng);
  }

  const mapsUrl = buildSearchUrl({ open, lat, lng, city, state, addressText, onConfirm, onClose });

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative mx-4 w-full max-w-lg rounded-2xl bg-white shadow-xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">
            Definir Localização
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-5">
          {/* Step 1 — Open Google Maps */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">1</span>
              <span className="text-sm font-medium text-slate-800">Abra o Google Maps e encontre o local</span>
            </div>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              Buscar no Google Maps
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          {/* Step 2 — Copy coordinates */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">2</span>
              <span className="text-sm font-medium text-slate-800">Copie as coordenadas</span>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-slate-600 leading-relaxed">
              <p>No Google Maps, <strong>clique com o botão direito</strong> no local exato.</p>
              <p className="mt-1">As coordenadas aparecem no topo do menu. <strong>Clique nelas para copiar.</strong></p>
            </div>
          </div>

          {/* Step 3 — Paste coordinates */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">3</span>
              <span className="text-sm font-medium text-slate-800">Cole as coordenadas aqui</span>
            </div>
            <input
              type="text"
              value={coordsInput}
              onChange={(e) => {
                setCoordsInput(e.target.value);
                setError("");
              }}
              placeholder="Ex: -15.561049, -54.368185"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400"
            />
            {error && (
              <p className="mt-1 text-xs text-red-500">{error}</p>
            )}
            {parsed && (
              <p className="mt-1 text-xs text-green-600">
                ✓ Lat: {parsed.lat.toFixed(6)}, Lng: {parsed.lng.toFixed(6)}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!parsed}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Salvar localização
          </button>
        </div>
      </div>
    </div>
  );
}
