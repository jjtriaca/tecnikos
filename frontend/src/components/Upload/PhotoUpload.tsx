"use client";

import { useRef, useState } from "react";

type Attachment = {
  id: string;
  type: string;
  fileName: string;
  mimeType: string;
  url: string;
  stepOrder?: number | null;
  createdAt: string;
};

type PhotoUploadProps = {
  orderId: string;
  type: string;
  stepOrder?: number;
  attachments: Attachment[];
  onUpload: (att: Attachment) => void;
  onDelete?: (id: string) => void;
  apiFetch: <T>(url: string, init?: RequestInit) => Promise<T>;
  apiBase?: string;
  label?: string;
  disabled?: boolean;
};

export default function PhotoUpload({
  orderId,
  type,
  stepOrder,
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

  const filtered = attachments.filter(
    (a) => a.type === type && (stepOrder === undefined || a.stepOrder === stepOrder)
  );

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      let qs = `type=${encodeURIComponent(type)}`;
      if (stepOrder !== undefined) qs += `&stepOrder=${stepOrder}`;

      // Use raw fetch for multipart upload
      const res = await fetch(
        `${apiBase}/service-orders/${orderId}/attachments?${qs}`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro no upload");
      }

      const att = await res.json();
      onUpload(att);
    } catch (err: any) {
      alert(err?.message || "Erro ao enviar foto");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      {/* Gallery */}
      {filtered.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-2">
          {filtered.map((att) => (
            <div key={att.id} className="relative group">
              <img
                src={`${apiBase}${att.url}`}
                alt={att.fileName}
                className="h-20 w-20 rounded-xl object-cover border border-slate-200"
              />
              {onDelete && (
                <button
                  onClick={() => onDelete(att.id)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
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
            Enviando...
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
