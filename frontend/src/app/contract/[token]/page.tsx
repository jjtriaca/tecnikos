"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

/* ── Types ───────────────────────────────────────────── */

type ContractData = {
  id: string;
  token: string;
  contractName: string;
  contractContent: string;
  status: string;
  expiresAt: string;
  viewedAt: string | null;
  acceptedAt: string | null;
  blockUntilAccepted: boolean;
  partner: { name: string; email: string | null };
  company: { name: string; tradeName: string | null; logoUrl: string | null };
};

/* ── Main Page ───────────────────────────────────────── */

export default function ContractTokenPage() {
  const { token } = useParams<{ token: string }>();

  const [data, setData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/contract/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || "Contrato nao encontrado");
        }
        return res.json();
      })
      .then((d) => {
        setData(d);
        if (d.status === "ACCEPTED") setAccepted(true);
      })
      .catch((err) => setError(err.message || "Erro ao carregar contrato"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!token || accepting) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/contract/${token}/accept`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Erro ao aceitar contrato");
      }
      setAccepted(true);
    } catch (err: any) {
      setError(err.message || "Erro ao aceitar");
    } finally {
      setAccepting(false);
    }
  };

  /* ── Loading ─────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 mx-auto animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Carregando contrato...</p>
        </div>
      </div>
    );
  }

  /* ── Error ──────────────────────── */
  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center max-w-md w-full">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-lg font-bold text-slate-800 mb-2">Contrato Indisponivel</h1>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  /* ── Expired ────────────────────── */
  if (data.status === "EXPIRED") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center max-w-md w-full">
          <div className="text-4xl mb-4">⏰</div>
          <h1 className="text-lg font-bold text-slate-800 mb-2">Contrato Expirado</h1>
          <p className="text-sm text-slate-500">
            Este link de contrato expirou. Solicite um novo envio ao gestor.
          </p>
        </div>
      </div>
    );
  }

  /* ── Cancelled ──────────────────── */
  if (data.status === "CANCELLED") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center max-w-md w-full">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-lg font-bold text-slate-800 mb-2">Contrato Cancelado</h1>
          <p className="text-sm text-slate-500">
            Este contrato foi cancelado. Entre em contato com a empresa.
          </p>
        </div>
      </div>
    );
  }

  /* ── Accepted (success) ─────────── */
  if (accepted) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="bg-white rounded-2xl shadow-lg border border-green-200 p-8 text-center max-w-md w-full">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-green-700 mb-2">Contrato Aceito!</h1>
          <p className="text-sm text-slate-600">
            Obrigado, <strong>{data.partner.name}</strong>. Seu aceite foi registrado com sucesso.
          </p>
          {data.blockUntilAccepted && (
            <p className="text-xs text-slate-400 mt-3">
              Seu cadastro sera ativado automaticamente.
            </p>
          )}
          <p className="text-xs text-slate-400 mt-4">
            Voce pode fechar esta pagina.
          </p>
        </div>
      </div>
    );
  }

  /* ── Contract View + Accept Button ─── */
  const companyName = data.company.tradeName || data.company.name;
  const expiresDate = new Date(data.expiresAt).toLocaleDateString("pt-BR");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5 text-center">
          {data.company.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.company.logoUrl}
              alt={companyName}
              className="h-10 mx-auto mb-3"
            />
          )}
          <h1 className="text-white text-lg font-bold">{companyName}</h1>
          <p className="text-slate-300 text-xs mt-1">Contrato para Aceite</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Contract info */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800">{data.contractName}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Para: <strong>{data.partner.name}</strong>
              </p>
            </div>
            <span className="text-xs text-amber-600 bg-amber-50 rounded-full px-3 py-1 font-medium">
              Pendente
            </span>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* Contract content */}
          <div className="prose prose-sm prose-slate max-w-none">
            <div
              className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: data.contractContent }}
            />
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* Expiration notice */}
          <p className="text-xs text-slate-400 text-center">
            Este contrato expira em <strong>{expiresDate}</strong>
          </p>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Accept button */}
          <div className="text-center pt-2">
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full sm:w-auto rounded-xl bg-green-600 px-8 py-3.5 text-base font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-colors shadow-lg shadow-green-200"
            >
              {accepting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Registrando aceite...
                </span>
              ) : (
                "✅ Aceitar Contrato"
              )}
            </button>
          </div>

          <p className="text-[10px] text-slate-400 text-center">
            Ao clicar em &quot;Aceitar Contrato&quot;, voce concorda com os termos acima.
            Seu IP e data de aceite serao registrados.
          </p>
        </div>
      </div>
    </div>
  );
}
