"use client";

import { useRef, useState, useEffect } from "react";
import { getTechAccessToken } from "@/contexts/TechAuthContext";
import { saveOfflinePhoto } from "@/lib/offline/db";

type Attachment = {
  id: string;
  type: string;
  fileName: string;
  mimeType: string;
  url: string;
  stepOrder?: number | null;
  blockId?: string | null;
  createdAt: string;
  isOffline?: boolean; // local-only indicator
};

type PhotoUploadProps = {
  orderId: string;
  type: string;
  stepOrder?: number;
  blockId?: string;
  attachments: Attachment[];
  onUpload: (att: Attachment) => void;
  onDelete?: (id: string) => void;
  apiFetch: <T>(url: string, init?: RequestInit) => Promise<T>;
  apiBase?: string;
  label?: string;
  disabled?: boolean;
};

/** Compress image — aggressive optimization for low-end devices */
async function compressImage(file: File): Promise<Blob> {
  // If file is already small enough (< 500KB JPEG), skip compression entirely
  if (file.size < 500_000 && file.type === "image/jpeg") {
    return file;
  }

  // Try OffscreenCanvas in worker-like mode (doesn't block main thread)
  // Falls back to regular canvas
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);

      // Aggressive scaling: low-memory devices get 800px, normal get 1280px
      const deviceMemory = (navigator as any).deviceMemory;
      const MAX = (deviceMemory && deviceMemory <= 2) ? 800
        : (deviceMemory && deviceMemory < 4) ? 1024 : 1280;
      const quality = (deviceMemory && deviceMemory <= 2) ? 0.5 : 0.65;

      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            // Immediately release canvas memory
            ctx.clearRect(0, 0, width, height);
            canvas.width = 0;
            canvas.height = 0;
            resolve(blob || file);
          },
          "image/jpeg",
          quality,
        );
      } catch {
        // Canvas failed (OOM) — send original file
        resolve(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export default function PhotoUpload({
  orderId,
  type,
  stepOrder,
  blockId,
  attachments,
  onUpload,
  onDelete,
  apiFetch,
  apiBase = "/api",
  label = "Adicionar foto",
  disabled = false,
}: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // Local object URLs for offline photos (cleaned up on unmount)
  const localUrlsRef = useRef<string[]>([]);

  // Cleanup object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      localUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      localUrlsRef.current = [];
    };
  }, []);

  const filtered = attachments.filter(
    (a) => a.type === type
      && (stepOrder === undefined || a.stepOrder === stepOrder)
      && (blockId === undefined || a.blockId === blockId)
  );

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      if (navigator.onLine) {
        await uploadOnline(file);
      } else {
        await saveOffline(file);
      }
    } catch (err: any) {
      // If online upload fails due to network, fallback to offline
      if (!navigator.onLine) {
        try {
          await saveOffline(file);
        } catch {
          alert("Erro ao salvar foto offline");
        }
      } else {
        // On memory errors, try uploading original without compression
        if (err?.message?.includes("memory") || err?.name === "RangeError") {
          try {
            const formData = new FormData();
            formData.append("file", file);
            let qs = `type=${encodeURIComponent(type)}`;
            if (stepOrder !== undefined) qs += `&stepOrder=${stepOrder}`;
            if (blockId) qs += `&blockId=${encodeURIComponent(blockId)}`;
            const token = getTechAccessToken();
            const headers: Record<string, string> = {};
            if (token) headers["Authorization"] = `Bearer ${token}`;
            const res = await fetch(`${apiBase}/service-orders/${orderId}/attachments?${qs}`, {
              method: "POST", body: formData, headers, credentials: "include",
            });
            if (res.ok) { onUpload(await res.json()); return; }
          } catch { /* fall through */ }
        }
        alert(err?.message || "Erro ao enviar foto");
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function uploadOnline(file: File) {
    // Compress before uploading to save bandwidth and memory
    const compressed = await compressImage(file);

    const formData = new FormData();
    formData.append("file", new File([compressed], file.name || `photo_${Date.now()}.jpg`, { type: "image/jpeg" }));

    let qs = `type=${encodeURIComponent(type)}`;
    if (stepOrder !== undefined) qs += `&stepOrder=${stepOrder}`;
    if (blockId) qs += `&blockId=${encodeURIComponent(blockId)}`;

    const url = `${apiBase}/service-orders/${orderId}/attachments?${qs}`;

    const doUpload = async () => {
      const headers: Record<string, string> = {};
      const token = getTechAccessToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      return fetch(url, { method: "POST", body: formData, headers, credentials: "include" });
    };

    let res = await doUpload();

    // 401: token expired — try refresh then retry once
    if (res.status === 401) {
      const { techSilentRefresh, techDeviceRecover } = await import("@/contexts/TechAuthContext");
      let refreshed = await techSilentRefresh();
      if (!refreshed) refreshed = await techDeviceRecover();
      if (refreshed) {
        res = await doUpload();
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Erro no upload");
    }

    const att = await res.json();
    onUpload(att);
  }

  async function saveOffline(file: File) {
    // Compress photo before storing
    const compressed = await compressImage(file);
    const photoId = crypto.randomUUID();

    // Save blob to IndexedDB
    await saveOfflinePhoto({
      id: photoId,
      serviceOrderId: orderId,
      blockId: blockId || "",
      blob: compressed,
      fileName: file.name || `photo_${Date.now()}.jpg`,
      mimeType: "image/jpeg",
      sizeBytes: compressed.size,
      createdAt: Date.now(),
      synced: false,
    });

    // Create local object URL for preview
    const localUrl = URL.createObjectURL(compressed);
    localUrlsRef.current.push(localUrl);

    // Create synthetic attachment for UI
    const syntheticAtt: Attachment = {
      id: photoId,
      type,
      fileName: file.name || `photo_${Date.now()}.jpg`,
      mimeType: "image/jpeg",
      url: localUrl,
      blockId: blockId || null,
      createdAt: new Date().toISOString(),
      isOffline: true,
    };
    onUpload(syntheticAtt);
  }

  return (
    <div>
      {/* Gallery */}
      {filtered.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-2">
          {filtered.map((att) => (
            <div key={att.id} className="relative group">
              <img
                src={att.isOffline ? att.url : `${apiBase}${att.url}`}
                alt={att.fileName}
                className="h-20 w-20 rounded-xl object-cover border border-slate-200"
                loading="lazy"
              />
              {att.isOffline && (
                <div className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full bg-amber-500 flex items-center justify-center">
                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
                  </svg>
                </div>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(att.id)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  x
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handleFile}
        className="hidden"
        disabled={disabled || uploading}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50 transition-colors"
      >
        {uploading ? (
          <>
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            {navigator.onLine ? "Enviando..." : "Salvando..."}
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {label}
          </>
        )}
      </button>
    </div>
  );
}
