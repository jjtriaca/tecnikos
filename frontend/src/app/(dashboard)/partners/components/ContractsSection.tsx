'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

/* ── Types ───────────────────────────────────────────── */

interface Contract {
  id: string;
  contractName: string;
  contractContent: string;
  contractType: string;      // CONTRACT (PJ) | WELCOME (CLT)
  status: string;
  token: string;
  sentVia: string | null;
  blockUntilAccepted: boolean;
  requireSignature: boolean;
  requireAcceptance: boolean;
  signatureData: string | null;
  replyMessage: string | null; // Resposta do técnico via WhatsApp (CLT)
  sentAt: string;
  viewedAt: string | null;
  acceptedAt: string | null;
  acceptedIp: string | null;
  acceptedUserAgent: string | null;
  expiresAt: string;
  cancelledAt: string | null;
  cancelledReason: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  PENDING: { label: 'Pendente', color: 'bg-amber-100 text-amber-800', icon: '⏳' },
  VIEWED: { label: 'Visualizado', color: 'bg-blue-100 text-blue-800', icon: '👁️' },
  ACCEPTED: { label: 'Aceito', color: 'bg-green-100 text-green-800', icon: '✅' },
  REJECTED: { label: 'Recusado', color: 'bg-red-100 text-red-800', icon: '🚫' },
  EXPIRED: { label: 'Expirado', color: 'bg-red-100 text-red-800', icon: '⏰' },
  CANCELLED: { label: 'Cancelado', color: 'bg-slate-100 text-slate-600', icon: '❌' },
};

/* ── Props ───────────────────────────────────────────── */

interface Props {
  partnerId: string;
}

/* ── Component ───────────────────────────────────────── */

export default function ContractsSection({ partnerId }: Props) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Contract[]>(`/contracts/partner/${partnerId}`);
      setContracts(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  const handleCancel = async (contractId: string) => {
    if (!window.confirm('Tem certeza que deseja cancelar este contrato? Se estiver atrelado a uma especialização, a especialização será removida do técnico.')) return;
    setCancellingId(contractId);
    try {
      await api.post(`/contracts/${contractId}/cancel`, {});
      await load(); // Reload
    } catch {
      alert('Erro ao cancelar contrato');
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="border-t border-slate-200 pt-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Contratos</p>
        <div className="flex justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="border-t border-slate-200 pt-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Contratos</p>
        <p className="text-sm text-slate-400 italic">Nenhum contrato enviado para este parceiro.</p>
      </div>
    );
  }

  const fmtDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="border-t border-slate-200 pt-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
        📄 Contratos ({contracts.length})
      </p>

      <div className="space-y-2">
        {contracts.map((c) => {
          const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.PENDING;
          const isExpanded = expandedId === c.id;

          return (
            <div key={c.id} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              {/* Contract header — clickable */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">{cfg.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{c.contractName}</p>
                    <p className="text-[10px] text-slate-400">
                      Enviado {fmtDate(c.sentAt)} via {c.sentVia || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <svg className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-slate-100 px-3 py-3 space-y-3 bg-slate-50/50">
                  {/* Timeline */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="text-slate-500">Enviado:</div>
                    <div className="text-slate-700">{fmtDate(c.sentAt)}</div>

                    <div className="text-slate-500">Visualizado:</div>
                    <div className="text-slate-700">{c.viewedAt ? fmtDate(c.viewedAt) : <span className="text-slate-400">Ainda não</span>}</div>

                    <div className="text-slate-500">Aceito:</div>
                    <div className="text-slate-700">
                      {c.acceptedAt ? (
                        <span className="text-green-700 font-medium">{fmtDate(c.acceptedAt)}</span>
                      ) : (
                        <span className="text-slate-400">Ainda não</span>
                      )}
                    </div>

                    <div className="text-slate-500">Expira:</div>
                    <div className="text-slate-700">{fmtDate(c.expiresAt)}</div>

                    {c.acceptedIp && (
                      <>
                        <div className="text-slate-500">IP do aceite:</div>
                        <div className="text-slate-700 font-mono text-[10px]">{c.acceptedIp}</div>
                      </>
                    )}

                    {c.cancelledAt && (
                      <>
                        <div className="text-slate-500">Cancelado:</div>
                        <div className="text-red-600">{fmtDate(c.cancelledAt)}{c.cancelledReason ? ` — ${c.cancelledReason}` : ''}</div>
                      </>
                    )}
                  </div>

                  {/* WhatsApp reply message (CLT) */}
                  {c.replyMessage && (
                    <div className="rounded-lg border border-green-200 bg-green-50/50 p-2.5">
                      <p className="text-[10px] font-medium text-green-700 uppercase tracking-wide mb-1">
                        💬 Resposta via WhatsApp
                      </p>
                      <p className="text-sm text-slate-700 italic">&ldquo;{c.replyMessage}&rdquo;</p>
                    </div>
                  )}

                  {/* Flags */}
                  <div className="flex flex-wrap gap-1.5">
                    {c.blockUntilAccepted && (
                      <span className="inline-flex items-center rounded bg-orange-50 px-1.5 py-0.5 text-[10px] text-orange-700">🔒 Bloqueia até aceitar</span>
                    )}
                    {c.requireSignature && (
                      <span className="inline-flex items-center rounded bg-purple-50 px-1.5 py-0.5 text-[10px] text-purple-700">✍️ Assinatura obrigatória</span>
                    )}
                    {c.requireAcceptance && (
                      <span className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">✅ Aceite obrigatório</span>
                    )}
                  </div>

                  {/* Signature image */}
                  {c.signatureData && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowSignature(showSignature === c.id ? null : c.id)}
                        className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                      >
                        {showSignature === c.id ? '🔽 Ocultar assinatura' : '✍️ Ver assinatura digital'}
                      </button>
                      {showSignature === c.id && (
                        <div className="mt-2 rounded-lg border border-purple-200 bg-white p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={c.signatureData}
                            alt="Assinatura digital"
                            className="max-w-full h-auto max-h-32 mx-auto"
                          />
                          <p className="text-[10px] text-slate-400 text-center mt-1">Assinatura registrada em {fmtDate(c.acceptedAt)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Contract content preview — only for CONTRACT type (PJ) */}
                  {c.contractType !== 'WELCOME' && (
                    <details className="group">
                      <summary className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer font-medium">
                        📋 Ver conteúdo do contrato
                      </summary>
                      <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 max-h-48 overflow-y-auto">
                        <div
                          className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{ __html: c.contractContent }}
                        />
                      </div>
                    </details>
                  )}

                  {/* Welcome message content — for WELCOME type (CLT) */}
                  {c.contractType === 'WELCOME' && c.contractContent && (
                    <details className="group">
                      <summary className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer font-medium">
                        💬 Ver mensagem enviada
                      </summary>
                      <div className="mt-2 rounded-lg border border-green-200 bg-green-50 p-3">
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{c.contractContent}</p>
                      </div>
                    </details>
                  )}

                  {/* Actions row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Link to public page — only for CONTRACT type (PJ) */}
                    {c.contractType !== 'WELCOME' && (
                      <a
                        href={`/contract/${c.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        🔗 Abrir página pública
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}

                    {/* Cancel button — only for PENDING / VIEWED */}
                    {(c.status === 'PENDING' || c.status === 'VIEWED') && (
                      <button
                        type="button"
                        onClick={() => handleCancel(c.id)}
                        disabled={cancellingId === c.id}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                      >
                        {cancellingId === c.id ? (
                          <>
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                            Cancelando...
                          </>
                        ) : (
                          '❌ Cancelar contrato'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
