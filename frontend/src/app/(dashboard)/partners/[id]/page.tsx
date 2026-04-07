"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/contexts/AuthContext";
import PartnerForm from "../components/PartnerForm";
import type { Partner } from "../components/PartnerTable";
import type { Specialization } from "../components/SpecializationsTab";

export default function PartnerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const partnerId = params.id as string;

  const [partner, setPartner] = useState<Partner | null>(null);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [p, specs] = await Promise.all([
        api.get<Partner>(`/partners/${partnerId}`),
        api.get<Specialization[]>("/specializations"),
      ]);
      setPartner(p);
      setSpecializations(specs);
    } catch {
      toast("Parceiro nao encontrado", "error");
      router.push("/partners");
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!partner) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => router.push("/partners")}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          &larr; Voltar
        </button>
        <h1 className="text-xl font-bold text-slate-800">{partner.name}</h1>
        <span className="text-xs text-slate-400">{partner.code}</span>
      </div>

      <PartnerForm
        editingPartner={partner}
        specializations={specializations}
        onSaved={() => { toast("Parceiro atualizado!", "success"); load(); }}
        onCancel={() => router.push("/partners")}
        onGoToSpecs={() => router.push("/partners?tab=especializacoes")}
      />
    </div>
  );
}
