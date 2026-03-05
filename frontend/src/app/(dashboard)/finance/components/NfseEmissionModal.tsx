"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { toTitleCase } from "@/lib/brazil-utils";

/* ===================================================================
   NFS-e EMISSION MODAL — Preview and confirm NFS-e emission data
   =================================================================== */

interface Props {
  financialEntryId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface NfsePreview {
  prestador: {
    cnpj: string;
    inscricaoMunicipal: string | null;
    codigoMunicipio: string | null;
    razaoSocial: string;
  };
  tomador: {
    cnpjCpf: string;
    razaoSocial: string;
    email: string;
    telefone: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    codigoMunicipio: string;
    uf: string;
    cep: string;
    city: string;
  };
  servico: {
    valorServicosCents: number;
    aliquotaIss: number;
    issRetido: boolean;
    itemListaServico: string;
    codigoCnae: string;
    codigoTributarioMunicipio: string;
    discriminacao: string;
    naturezaOperacao: string;
    codigoMunicipioServico: string;
  };
  config: {
    optanteSimplesNacional: boolean;
    regimeEspecialTributacao: string | null;
    sendEmailToTomador: boolean;
  };
  financialEntry: {
    id: string;
    serviceOrderId: string | null;
    grossCents: number;
    netCents: number;
    description: string | null;
    nfseStatus: string | null;
  };
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCnpjCpf(v: string): string {
  const d = v.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v;
}

const NATUREZA_LABELS: Record<string, string> = {
  "1": "Tributacao no municipio",
  "2": "Tributacao fora do municipio",
  "3": "Isencao",
  "4": "Imune",
  "5": "Exigibilidade suspensa por decisao judicial",
  "6": "Exigibilidade suspensa por proc. administrativo",
};

export default function NfseEmissionModal({ financialEntryId, open, onClose, onSuccess }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [emitting, setEmitting] = useState(false);
  const [preview, setPreview] = useState<NfsePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editable fields (pre-filled from preview)
  const [tomadorCnpjCpf, setTomadorCnpjCpf] = useState("");
  const [tomadorRazaoSocial, setTomadorRazaoSocial] = useState("");
  const [tomadorEmail, setTomadorEmail] = useState("");
  const [tomadorLogradouro, setTomadorLogradouro] = useState("");
  const [tomadorNumero, setTomadorNumero] = useState("");
  const [tomadorComplemento, setTomadorComplemento] = useState("");
  const [tomadorBairro, setTomadorBairro] = useState("");
  const [tomadorCodigoMunicipio, setTomadorCodigoMunicipio] = useState("");
  const [tomadorUf, setTomadorUf] = useState("");
  const [tomadorCep, setTomadorCep] = useState("");
  const [discriminacao, setDiscriminacao] = useState("");
  const [aliquotaIss, setAliquotaIss] = useState("");
  const [issRetido, setIssRetido] = useState(false);

  const loadPreview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<NfsePreview>(`/nfse-emission/preview/${financialEntryId}`);
      setPreview(data);
      setTomadorCnpjCpf(data.tomador.cnpjCpf);
      setTomadorRazaoSocial(data.tomador.razaoSocial);
      setTomadorEmail(data.tomador.email);
      setTomadorLogradouro(data.tomador.logradouro);
      setTomadorNumero(data.tomador.numero);
      setTomadorComplemento(data.tomador.complemento);
      setTomadorBairro(data.tomador.bairro);
      setTomadorCodigoMunicipio(data.tomador.codigoMunicipio);
      setTomadorUf(data.tomador.uf);
      setTomadorCep(data.tomador.cep);
      setDiscriminacao(data.servico.discriminacao);
      setAliquotaIss(String(data.servico.aliquotaIss || ""));
      setIssRetido(data.servico.issRetido);
    } catch (err: any) {
      setError(err?.message || "Erro ao carregar dados da NFS-e");
    } finally {
      setLoading(false);
    }
  }, [financialEntryId]);

  useEffect(() => {
    if (open) loadPreview();
  }, [open, loadPreview]);

  async function handleEmit() {
    if (!preview) return;
    if (!tomadorCnpjCpf) {
      toast("CPF/CNPJ do tomador e obrigatorio.", "error");
      return;
    }
    if (!discriminacao) {
      toast("Discriminacao do servico e obrigatoria.", "error");
      return;
    }
    if (!tomadorLogradouro) {
      toast("Endereco do tomador e obrigatorio.", "error");
      return;
    }
    if (!tomadorBairro) {
      toast("Bairro do tomador e obrigatorio.", "error");
      return;
    }
    if (!tomadorUf) {
      toast("UF do tomador e obrigatoria.", "error");
      return;
    }
    if (!tomadorCep) {
      toast("CEP do tomador e obrigatorio.", "error");
      return;
    }
    if (!tomadorCodigoMunicipio) {
      toast("Codigo do municipio (IBGE) do tomador e obrigatorio.", "error");
      return;
    }

    setEmitting(true);
    try {
      await api.post("/nfse-emission/emit", {
        financialEntryId,
        serviceOrderId: preview.financialEntry.serviceOrderId,
        tomadorCnpjCpf,
        tomadorRazaoSocial,
        tomadorEmail,
        tomadorLogradouro,
        tomadorNumero: tomadorNumero || "S/N",
        tomadorComplemento,
        tomadorBairro,
        tomadorCodigoMunicipio,
        tomadorUf,
        tomadorCep,
        valorServicosCents: preview.servico.valorServicosCents,
        aliquotaIss: aliquotaIss ? parseFloat(aliquotaIss) : undefined,
        issRetido,
        itemListaServico: preview.servico.itemListaServico,
        codigoCnae: preview.servico.codigoCnae,
        codigoTributarioMunicipio: preview.servico.codigoTributarioMunicipio,
        discriminacao,
        naturezaOperacao: preview.servico.naturezaOperacao,
        codigoMunicipioServico: preview.servico.codigoMunicipioServico,
      });
      toast("NFS-e enviada para processamento!", "success");
      onSuccess();
    } catch (err: any) {
      toast(err?.message || "Erro ao emitir NFS-e", "error");
    } finally {
      setEmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Emitir NFS-e</h2>
            <p className="text-xs text-slate-500 mt-0.5">Confirme os dados antes de emitir</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {loading && (
            <div className="space-y-3">
              <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {preview && !loading && (
            <>
              {/* Valor */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">Valor dos Servicos</span>
                <span className="text-lg font-bold text-blue-900">{formatCurrency(preview.servico.valorServicosCents)}</span>
              </div>

              {/* Prestador */}
              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Prestador</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500">CNPJ:</span>
                    <span className="ml-1 font-medium text-slate-800">{formatCnpjCpf(preview.prestador.cnpj || "")}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Razao Social:</span>
                    <span className="ml-1 font-medium text-slate-800">{preview.prestador.razaoSocial}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">IM:</span>
                    <span className="ml-1 font-medium text-slate-800">{preview.prestador.inscricaoMunicipal || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Cod. Municipio:</span>
                    <span className="ml-1 font-medium text-slate-800">{preview.prestador.codigoMunicipio || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Tomador (editavel) */}
              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tomador</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">CPF/CNPJ *</label>
                    <input
                      type="text"
                      value={tomadorCnpjCpf}
                      onChange={(e) => setTomadorCnpjCpf(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Razao Social</label>
                    <input
                      type="text"
                      value={tomadorRazaoSocial}
                      onChange={(e) => setTomadorRazaoSocial(e.target.value)}
                      onBlur={() => setTomadorRazaoSocial(toTitleCase(tomadorRazaoSocial))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={tomadorEmail}
                      onChange={(e) => setTomadorEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* Endereço do tomador */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Endereco</p>
                  {(!tomadorLogradouro || !tomadorBairro || !tomadorUf || !tomadorCep || !tomadorCodigoMunicipio) && (
                    <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 mb-2">
                      ⚠ Endereco incompleto — preencha todos os campos obrigatorios para emitir a NFS-e.
                    </div>
                  )}
                  <div className="grid grid-cols-6 gap-2">
                    <div className="col-span-4">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Endereco *</label>
                      <input type="text" value={tomadorLogradouro} onChange={(e) => setTomadorLogradouro(e.target.value)}
                        onBlur={() => setTomadorLogradouro(toTitleCase(tomadorLogradouro))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Numero</label>
                      <input type="text" value={tomadorNumero} onChange={(e) => setTomadorNumero(e.target.value)} placeholder="S/N"
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Complemento</label>
                      <input type="text" value={tomadorComplemento} onChange={(e) => setTomadorComplemento(e.target.value)}
                        onBlur={() => setTomadorComplemento(toTitleCase(tomadorComplemento))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Bairro *</label>
                      <input type="text" value={tomadorBairro} onChange={(e) => setTomadorBairro(e.target.value)}
                        onBlur={() => setTomadorBairro(toTitleCase(tomadorBairro))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-600 mb-1">CEP *</label>
                      <input type="text" value={tomadorCep} onChange={(e) => setTomadorCep(e.target.value)} placeholder="00000-000"
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-slate-600 mb-1">UF *</label>
                      <input type="text" value={tomadorUf} onChange={(e) => setTomadorUf(e.target.value.toUpperCase())} maxLength={2}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Cod. Municipio IBGE *</label>
                      <input type="text" value={tomadorCodigoMunicipio} onChange={(e) => setTomadorCodigoMunicipio(e.target.value)} placeholder="7 digitos"
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Servico (editavel) */}
              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Servico</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Discriminacao *</label>
                    <textarea
                      value={discriminacao}
                      onChange={(e) => setDiscriminacao(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Aliquota ISS (%)</label>
                    <input
                      type="text"
                      value={aliquotaIss}
                      onChange={(e) => setAliquotaIss(e.target.value)}
                      placeholder="Ex: 3.0"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={issRetido}
                        onChange={(e) => setIssRetido(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      ISS Retido
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-slate-500">
                  <div>Item LC 116: <span className="font-medium text-slate-700">{preview.servico.itemListaServico || "—"}</span></div>
                  <div>CNAE: <span className="font-medium text-slate-700">{preview.servico.codigoCnae || "—"}</span></div>
                  <div>Natureza: <span className="font-medium text-slate-700">{NATUREZA_LABELS[preview.servico.naturezaOperacao] || preview.servico.naturezaOperacao}</span></div>
                </div>
              </div>

              {/* ISS Preview */}
              {aliquotaIss && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-slate-600">ISS estimado ({aliquotaIss}%)</span>
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(Math.round(preview.servico.valorServicosCents * (parseFloat(aliquotaIss) || 0) / 100))}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 rounded-b-2xl flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleEmit}
            disabled={emitting || loading || !!error}
            className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {emitting ? "Emitindo..." : "Confirmar e Emitir NFS-e"}
          </button>
        </div>
      </div>
    </div>
  );
}
