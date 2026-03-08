"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import PasswordInput from "@/components/ui/PasswordInput";
import {
  maskCnpj,
  maskCpf,
  maskCep,
  maskPhone,
  lookupCnpj,
  lookupCep,
  toTitleCase,
  STATES,
} from "@/lib/brazil-utils";
import type { Partner } from "./PartnerTable";
import type { Specialization } from "./SpecializationsTab";
import ObrasSection from "./ObrasSection";

type PersonType = "PF" | "PJ";

const TYPE_LABELS: Record<string, string> = {
  CLIENTE: "Cliente",
  FORNECEDOR: "Fornecedor",
  TECNICO: "Técnico",
};

const EMPTY_FORM = {
  partnerTypes: ["CLIENTE"] as string[],
  personType: "PJ" as PersonType,
  name: "",
  tradeName: "",
  document: "",
  documentType: "CNPJ" as string,
  ie: "",
  im: "",
  isRuralProducer: false,
  phone: "",
  email: "",
  password: "",
  cep: "",
  addressStreet: "",
  addressNumber: "",
  addressComp: "",
  neighborhood: "",
  city: "",
  state: "",
  specializationIds: [] as string[],
};

interface PartnerFormProps {
  editingPartner: Partner | null;
  specializations: Specialization[];
  onSaved: () => void;
  onCancel: () => void;
  onGoToSpecs: () => void;
}

const inputClass =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500";

export default function PartnerForm({
  editingPartner,
  specializations,
  onSaved,
  onCancel,
  onGoToSpecs,
}: PartnerFormProps) {
  const { toast } = useToast();
  const editingId = editingPartner?.id || null;

  const [form, setForm] = useState(() => {
    if (editingPartner) {
      return {
        partnerTypes: editingPartner.partnerTypes || [],
        personType: editingPartner.personType,
        name: editingPartner.name,
        tradeName: editingPartner.tradeName || "",
        document: editingPartner.document || "",
        documentType: editingPartner.documentType || (editingPartner.personType === "PJ" ? "CNPJ" : "CPF"),
        ie: editingPartner.ie || "",
        im: editingPartner.im || "",
        isRuralProducer: editingPartner.isRuralProducer,
        phone: editingPartner.phone || "",
        email: editingPartner.email || "",
        password: "",
        cep: editingPartner.cep || "",
        addressStreet: editingPartner.addressStreet || "",
        addressNumber: editingPartner.addressNumber || "",
        addressComp: editingPartner.addressComp || "",
        neighborhood: editingPartner.neighborhood || "",
        city: editingPartner.city || "",
        state: editingPartner.state || "",
        specializationIds: (editingPartner.specializations || []).map((s) => s.specializationId),
      };
    }
    return { ...EMPTY_FORM };
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{ name: string; document: string; ie: string | null }[] | null>(null);
  const [forceDuplicate, setForceDuplicate] = useState(false);

  const isTecnico = form.partnerTypes.includes("TECNICO");

  function toggleType(type: string) {
    setForm((f) => {
      const has = f.partnerTypes.includes(type);
      let newTypes: string[];
      if (has) {
        newTypes = f.partnerTypes.filter((t) => t !== type);
        if (newTypes.length === 0) return f;
      } else {
        newTypes = [...f.partnerTypes, type];
      }
      const updates: any = { partnerTypes: newTypes };
      if (type === "TECNICO" && has) {
        updates.password = "";
        updates.specializationIds = [];
      }
      return { ...f, ...updates };
    });
  }

  function toggleSpecialization(specId: string) {
    setForm((f) => {
      const has = f.specializationIds.includes(specId);
      return {
        ...f,
        specializationIds: has
          ? f.specializationIds.filter((id) => id !== specId)
          : [...f.specializationIds, specId],
      };
    });
  }

  async function checkDocumentDuplicate(doc: string) {
    if (!doc) return;
    const digits = doc.replace(/\D/g, "");
    if (digits.length < 11) return;
    try {
      const params = new URLSearchParams({ document: digits });
      if (editingId) params.set("excludeId", editingId);
      const res = (await api.get(`/partners/check-duplicate?${params}`)) as any[];
      if (res.length > 0) {
        setDuplicateWarning(res.map((d: any) => ({ name: d.name, document: d.document, ie: d.ie })));
      } else {
        setDuplicateWarning(null);
        setForceDuplicate(false);
      }
    } catch { /* ignore */ }
  }

  async function handleLookupCnpj() {
    if (lookingUpCnpj) return;
    setLookingUpCnpj(true);
    try {
      const result = await lookupCnpj(form.document);
      if (!result) { toast("CNPJ não encontrado.", "warning"); return; }
      setForm((f) => ({
        ...f,
        name: result.razaoSocial || f.name,
        tradeName: result.nomeFantasia || f.tradeName,
        phone: result.telefone ? maskPhone(result.telefone) : f.phone,
        email: result.email || f.email,
        cep: result.cep ? maskCep(result.cep) : f.cep,
        addressStreet: result.logradouro || f.addressStreet,
        addressNumber: result.numero || f.addressNumber,
        addressComp: result.complemento || f.addressComp,
        neighborhood: result.bairro || f.neighborhood,
        city: result.municipio || f.city,
        state: result.uf || f.state,
      }));
      toast("Dados do CNPJ preenchidos.", "success");
    } catch { toast("Erro ao consultar CNPJ.", "error"); }
    finally { setLookingUpCnpj(false); }
  }

  async function handleCepBlur() {
    const digits = form.cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    const result = await lookupCep(form.cep);
    if (!result) return;
    setForm((f) => ({
      ...f,
      addressStreet: result.logradouro || f.addressStreet,
      neighborhood: result.bairro || f.neighborhood,
      city: result.localidade || f.city,
      state: result.uf || f.state,
      addressComp: result.complemento || f.addressComp,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    // Block CNPJ duplicates on frontend side
    if (duplicateWarning && duplicateWarning.length > 0 && form.personType === "PJ" && !editingId) {
      setFormError("CNPJ já cadastrado. Edite o cadastro existente.");
      setSaving(false);
      return;
    }
    // Block CPF duplicates if user didn't confirm
    if (duplicateWarning && duplicateWarning.length > 0 && form.personType === "PF" && !forceDuplicate && !editingId) {
      setFormError("Marque a opção para confirmar o cadastro com CPF duplicado.");
      setSaving(false);
      return;
    }

    try {
      const payload: any = { ...form };
      payload.documentType = form.personType === "PJ" ? "CNPJ" : "CPF";
      if (forceDuplicate) payload.forceDuplicate = true;
      if (!form.password) delete payload.password;
      if (!isTecnico) {
        delete payload.password;
        delete payload.specializationIds;
      }

      if (editingId) {
        await api.put(`/partners/${editingId}`, payload);
        toast("Parceiro atualizado com sucesso.", "success");
      } else {
        await api.post("/partners", payload);
        toast("Parceiro criado com sucesso.", "success");
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.payload?.message || err.message);
      } else {
        setFormError("Erro ao salvar");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        {editingId ? "Editar Parceiro" : "Novo Parceiro"}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Partner Types */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Tipo(s) de Parceiro *</label>
          <div className="flex gap-3">
            {(["CLIENTE", "FORNECEDOR", "TECNICO"] as const).map((type) => (
              <label key={type} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.partnerTypes.includes(type)}
                  onChange={() => toggleType(type)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span className="text-sm text-slate-700">{TYPE_LABELS[type]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Person Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de Pessoa</label>
            <div className="flex gap-1">
              {(["PF", "PJ"] as const).map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      personType: pt,
                      document: "",
                      documentType: pt === "PJ" ? "CNPJ" : "CPF",
                      ie: "",
                      im: "",
                      tradeName: pt === "PF" ? "" : f.tradeName,
                      isRuralProducer: false,
                    }))
                  }
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    form.personType === pt
                      ? "bg-blue-600 text-white"
                      : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {pt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* PF fields */}
        {form.personType === "PF" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input placeholder="Nome completo *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} onBlur={() => setForm((f) => ({ ...f, name: toTitleCase(f.name) }))} required className={inputClass + " w-full"} />
              <input placeholder="CPF" value={form.document} onChange={(e) => setForm((f) => ({ ...f, document: maskCpf(e.target.value) }))} onBlur={() => checkDocumentDuplicate(form.document)} className={inputClass + " w-full"} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={form.isRuralProducer} onChange={(e) => setForm((f) => ({ ...f, isRuralProducer: e.target.checked }))} className="rounded border-slate-300" />
              Produtor Rural
            </label>
            {form.isRuralProducer && (
              <input placeholder="Inscrição Estadual (IE)" value={form.ie} onChange={(e) => setForm((f) => ({ ...f, ie: e.target.value }))} className={inputClass + " w-full sm:w-1/2"} />
            )}
          </div>
        )}

        {/* PJ fields */}
        {form.personType === "PJ" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input placeholder="CNPJ" value={form.document} onChange={(e) => setForm((f) => ({ ...f, document: maskCnpj(e.target.value) }))} onBlur={() => checkDocumentDuplicate(form.document)} className={inputClass + " flex-1"} />
              <button type="button" onClick={handleLookupCnpj} disabled={lookingUpCnpj || form.document.replace(/\D/g, "").length !== 14} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition-colors whitespace-nowrap">
                {lookingUpCnpj ? "Buscando..." : "Buscar CNPJ"}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input placeholder="Razão Social *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} onBlur={() => setForm((f) => ({ ...f, name: toTitleCase(f.name) }))} required className={inputClass + " w-full"} />
              <input placeholder="Nome Fantasia" value={form.tradeName} onChange={(e) => setForm((f) => ({ ...f, tradeName: e.target.value }))} onBlur={() => setForm((f) => ({ ...f, tradeName: toTitleCase(f.tradeName) }))} className={inputClass + " w-full"} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input placeholder="Inscrição Estadual (IE)" value={form.ie} onChange={(e) => setForm((f) => ({ ...f, ie: e.target.value }))} className={inputClass + " w-full"} />
              <input placeholder="Inscrição Municipal (IM)" value={form.im} onChange={(e) => setForm((f) => ({ ...f, im: e.target.value }))} className={inputClass + " w-full"} />
            </div>
          </div>
        )}

        {/* Phone + Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input placeholder="Telefone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: maskPhone(e.target.value) }))} className={inputClass + " w-full"} />
          <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputClass + " w-full"} />
        </div>

        {/* TECNICO password */}
        {isTecnico && (
          <div className="border-t border-slate-200 pt-4">
            <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">Acesso do Técnico</p>
            <PasswordInput placeholder={editingId ? "Nova senha (deixe vazio para manter)" : "Senha de acesso *"} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required={!editingId} className={inputClass + " w-full sm:w-1/2"} />
          </div>
        )}

        {/* Address */}
        <div className="border-t border-slate-200 pt-4">
          <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">Endereço</p>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input placeholder="CEP" value={form.cep} onChange={(e) => setForm((f) => ({ ...f, cep: maskCep(e.target.value) }))} onBlur={handleCepBlur} className={inputClass + " w-full"} />
              <input placeholder="Endereco" value={form.addressStreet} onChange={(e) => setForm((f) => ({ ...f, addressStreet: e.target.value }))} onBlur={() => setForm((f) => ({ ...f, addressStreet: toTitleCase(f.addressStreet) }))} className={inputClass + " w-full"} />
              <input placeholder="Número" value={form.addressNumber} onChange={(e) => setForm((f) => ({ ...f, addressNumber: e.target.value }))} className={inputClass + " w-full"} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input placeholder="Complemento" value={form.addressComp} onChange={(e) => setForm((f) => ({ ...f, addressComp: e.target.value }))} onBlur={() => setForm((f) => ({ ...f, addressComp: toTitleCase(f.addressComp) }))} className={inputClass + " w-full"} />
              <input placeholder="Bairro" value={form.neighborhood} onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))} onBlur={() => setForm((f) => ({ ...f, neighborhood: toTitleCase(f.neighborhood) }))} className={inputClass + " w-full"} />
              <input placeholder="Cidade" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} onBlur={() => setForm((f) => ({ ...f, city: toTitleCase(f.city) }))} className={inputClass + " w-full"} />
              <select value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} className={inputClass + " w-full"}>
                <option value="">UF</option>
                {STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* OBRAS — só aparece ao editar um CLIENTE */}
        {editingId && form.partnerTypes.includes("CLIENTE") && (
          <div className="border-t border-slate-200 pt-4">
            <ObrasSection partnerId={editingId} />
          </div>
        )}

        {/* TECNICO Specializations */}
        {isTecnico && (
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Especializações</p>
              <button type="button" onClick={onGoToSpecs} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Adicionar nova</button>
            </div>
            {specializations.length === 0 ? (
              <p className="text-sm text-slate-400">
                Nenhuma especialização cadastrada.{" "}
                <button type="button" onClick={onGoToSpecs} className="text-blue-600 hover:underline">Cadastrar agora</button>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {specializations.map((spec) => {
                  const selected = form.specializationIds.includes(spec.id);
                  return (
                    <button key={spec.id} type="button" onClick={() => toggleSpecialization(spec.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {spec.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Duplicate Warning */}
        {duplicateWarning && duplicateWarning.length > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-300 px-4 py-3">
            <p className="text-sm font-medium text-amber-800 mb-1">
              Documento já cadastrado{form.personType === "PF" ? " (CPF)" : " (CNPJ)"}:
            </p>
            <ul className="text-sm text-amber-700 list-disc pl-5 mb-2">
              {duplicateWarning.map((d, i) => (
                <li key={i}>
                  {d.name}{d.ie ? ` (IE: ${d.ie})` : ""}
                </li>
              ))}
            </ul>
            {form.personType === "PF" && (
              <label className="flex items-center gap-2 text-sm text-amber-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceDuplicate}
                  onChange={(e) => setForceDuplicate(e.target.checked)}
                  className="rounded border-amber-400 text-amber-600"
                />
                Cadastrar mesmo assim (ex: produtor rural com IE diferente)
              </label>
            )}
            {form.personType === "PJ" && (
              <p className="text-xs text-amber-600">CNPJ duplicado não é permitido. Edite o cadastro existente.</p>
            )}
          </div>
        )}

        {/* Error */}
        {formError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{formError}</div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Salvando..." : editingId ? "Atualizar" : "Criar"}
          </button>
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
