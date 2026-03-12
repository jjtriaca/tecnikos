"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

/**
 * Top banner that shows verification status for PENDING_VERIFICATION tenants.
 * - PENDING: "Documentos em análise"
 * - APPROVED: "Empresa validada" (brief — disappears when tenant becomes ACTIVE)
 * - REJECTED: "Documentos recusados" — click to re-upload
 */
export default function VerificationBanner() {
  const { user, verificationInfo } = useAuth();
  const router = useRouter();

  // Don't show if tenant is ACTIVE or no info
  if (!user || user.tenantStatus === "ACTIVE" || !user.tenantStatus) return null;

  // PENDING_VERIFICATION: check verificationInfo for details
  const isPending = !verificationInfo || verificationInfo.status === "PENDING";
  const isRejected = verificationInfo?.status === "REJECTED";
  const isApproved = verificationInfo?.status === "APPROVED";

  if (isApproved) {
    // Brief green banner (tenant is now ACTIVE but may need a refresh)
    return (
      <div className="bg-green-500 text-white text-center py-2 px-4 text-sm font-medium">
        <div className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          Empresa validada! Recarregue a pagina para acessar todas as funcionalidades.
          <button
            onClick={() => window.location.reload()}
            className="ml-2 underline font-bold hover:no-underline"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }

  if (isRejected) {
    return (
      <div className="bg-red-500 text-white text-center py-2.5 px-4 text-sm font-medium">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <span>
            Documentos recusados
            {verificationInfo.rejectionReason && (
              <span className="opacity-80"> — {verificationInfo.rejectionReason}</span>
            )}
          </span>
          {verificationInfo.token && (
            <button
              onClick={() => router.push(`/verify/${verificationInfo.token}`)}
              className="ml-1 rounded-md bg-white/20 px-3 py-0.5 text-xs font-bold hover:bg-white/30 transition-colors"
            >
              Reenviar documentos
            </button>
          )}
        </div>
      </div>
    );
  }

  // Default: PENDING
  return (
    <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium">
      <div className="flex items-center justify-center gap-2">
        <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        Documentos em analise — algumas funcionalidades estao temporariamente limitadas.
      </div>
    </div>
  );
}
