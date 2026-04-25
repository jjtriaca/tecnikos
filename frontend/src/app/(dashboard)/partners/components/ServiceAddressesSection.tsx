'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { maskCep, toTitleCase, STATES } from '@/lib/brazil-utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ServiceAddress {
  id: string;
  label: string;
  cep: string | null;
  addressStreet: string;
  addressNumber: string | null;
  addressComp: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  active: boolean;
}

interface Props {
  partnerId: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const EMPTY_FORM = {
  label: '',
  cep: '',
  addressStreet: '',
  addressNumber: '',
  addressComp: '',
  neighborhood: '',
  city: '',
  state: '',
};

type AddrForm = typeof EMPTY_FORM;

const inputClass =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500';

function formatAddr(a: ServiceAddress): string {
  const parts: string[] = [];
  if (a.addressStreet) parts.push(a.addressStreet);
  if (a.addressNumber) parts.push(a.addressNumber);
  if (a.neighborhood) parts.push(`- ${a.neighborhood}`);
  if (a.city && a.state) parts.push(`${a.city}/${a.state}`);
  return parts.join(', ') || 'Endereco incompleto';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ServiceAddressesSection({ partnerId }: Props) {
  const { toast } = useToast();

  const [addresses, setAddresses] = useState<ServiceAddress[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddrForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Load addresses                                                   */
  /* ---------------------------------------------------------------- */

  const loadAddresses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ServiceAddress[]>(
        `/service-addresses?partnerId=${partnerId}&activeOnly=false`,
      );
      setAddresses(data);
    } catch {
      toast('Erro ao carregar enderecos.', 'error');
    } finally {
      setLoading(false);
    }
  }, [partnerId, toast]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  /* ---------------------------------------------------------------- */
  /*  CEP lookup                                                       */
  /* ---------------------------------------------------------------- */

  async function handleCepBlur() {
    const digits = form.cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setLookingUpCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (r.ok) {
        const d = await r.json();
        if (!d.erro) {
          setForm((f) => ({
            ...f,
            addressStreet: d.logradouro || f.addressStreet,
            neighborhood: d.bairro || f.neighborhood,
            city: d.localidade || f.city,
            state: d.uf || f.state,
          }));
        }
      }
    } catch {
      /* ignore */
    } finally {
      setLookingUpCep(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Open form for create / edit                                      */
  /* ---------------------------------------------------------------- */

  function handleNew() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }

  function handleEdit(addr: ServiceAddress) {
    setEditingId(addr.id);
    setForm({
      label: addr.label,
      cep: addr.cep || '',
      addressStreet: addr.addressStreet,
      addressNumber: addr.addressNumber || '',
      addressComp: addr.addressComp || '',
      neighborhood: addr.neighborhood || '',
      city: addr.city,
      state: addr.state,
    });
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  /* ---------------------------------------------------------------- */
  /*  Save (create or update)                                          */
  /* ---------------------------------------------------------------- */

  async function handleSave() {
    if (!form.label.trim() || !form.addressStreet.trim() ||
        !form.city.trim() || !form.state) {
      toast('Preencha os campos obrigatorios: Nome, Rua, Cidade e UF.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        label: form.label.trim(),
        cep: form.cep.replace(/\D/g, '') || null,
        addressStreet: form.addressStreet.trim(),
        addressNumber: form.addressNumber.trim() || null,
        addressComp: form.addressComp.trim() || null,
        neighborhood: form.neighborhood.trim() || null,
        city: form.city.trim(),
        state: form.state,
        partnerId,
      };

      if (editingId) {
        await api.put(`/service-addresses/${editingId}`, payload);
        toast('Endereco atualizado com sucesso.', 'success');
      } else {
        await api.post('/service-addresses', payload);
        toast('Endereco criado com sucesso.', 'success');
      }

      setShowForm(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      loadAddresses();
    } catch (err) {
      if (err instanceof ApiError) {
        toast(err.payload?.message || err.message, 'error');
      } else {
        toast('Erro ao salvar endereco.', 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Toggle active                                                    */
  /* ---------------------------------------------------------------- */

  async function handleToggleActive(addr: ServiceAddress) {
    try {
      await api.patch(`/service-addresses/${addr.id}/toggle`);
      toast(
        addr.active ? 'Endereco desativado.' : 'Endereco ativado.',
        'success',
      );
      loadAddresses();
    } catch (err) {
      if (err instanceof ApiError) {
        toast(err.payload?.message || err.message, 'error');
      } else {
        toast('Erro ao alterar status.', 'error');
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Delete                                                           */
  /* ---------------------------------------------------------------- */

  async function handleDelete(addr: ServiceAddress) {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o endereco "${addr.label}"?\n\nEssa acao nao pode ser desfeita.`,
    );
    if (!confirmed) return;

    try {
      await api.del(`/service-addresses/${addr.id}`);
      toast('Endereco excluido com sucesso.', 'success');
      loadAddresses();
    } catch (err) {
      if (err instanceof ApiError) {
        toast(err.payload?.message || err.message, 'error');
      } else {
        toast('Erro ao excluir endereco.', 'error');
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="border-t border-slate-200 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-800">Enderecos de Atendimento</h4>
        {!showForm && (
          <button
            type="button"
            onClick={handleNew}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Novo Endereco
          </button>
        )}
      </div>

      {/* ----- Inline form ----- */}
      {showForm && (
        <div className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50">
          <p className="text-sm font-semibold text-slate-800 mb-3">
            {editingId ? 'Editar Endereco' : 'Novo Endereco de Atendimento'}
          </p>

          <div className="space-y-3">
            {/* Label */}
            <div>
              <label className="text-xs font-medium text-slate-600">Nome/Identificacao *</label>
              <input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                onBlur={() => setForm((f) => ({ ...f, label: toTitleCase(f.label) }))}
                placeholder="Ex: Escritorio Centro, Casa do Cliente"
                className={inputClass + ' w-full mt-1'}
              />
            </div>

            {/* CEP + Logradouro + Numero */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">CEP</label>
                <div className="relative mt-1">
                  <input
                    value={form.cep}
                    onChange={(e) => setForm((f) => ({ ...f, cep: maskCep(e.target.value) }))}
                    onBlur={handleCepBlur}
                    placeholder="XXXXX-XXX"
                    className={inputClass + ' w-full'}
                  />
                  {lookingUpCep && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      ...
                    </span>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600">Rua *</label>
                <input
                  value={form.addressStreet}
                  onChange={(e) => setForm((f) => ({ ...f, addressStreet: e.target.value }))}
                  onBlur={() => setForm((f) => ({ ...f, addressStreet: toTitleCase(f.addressStreet) }))}
                  placeholder="Rua, Av., etc."
                  className={inputClass + ' w-full mt-1'}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Numero</label>
                <input
                  value={form.addressNumber}
                  onChange={(e) => setForm((f) => ({ ...f, addressNumber: e.target.value }))}
                  placeholder="123"
                  className={inputClass + ' w-full mt-1'}
                />
              </div>
            </div>

            {/* Complemento + Bairro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Complemento</label>
                <input
                  value={form.addressComp}
                  onChange={(e) => setForm((f) => ({ ...f, addressComp: e.target.value }))}
                  onBlur={() => setForm((f) => ({ ...f, addressComp: toTitleCase(f.addressComp) }))}
                  placeholder="Bloco A, Sala 2"
                  className={inputClass + ' w-full mt-1'}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Bairro</label>
                <input
                  value={form.neighborhood}
                  onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
                  onBlur={() => setForm((f) => ({ ...f, neighborhood: toTitleCase(f.neighborhood) }))}
                  placeholder="Bairro"
                  className={inputClass + ' w-full mt-1'}
                />
              </div>
            </div>

            {/* Cidade + UF */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600">Cidade *</label>
                <input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  onBlur={() => setForm((f) => ({ ...f, city: toTitleCase(f.city) }))}
                  placeholder="Cidade"
                  className={inputClass + ' w-full mt-1'}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">UF *</label>
                <select
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  className={inputClass + ' w-full mt-1'}
                >
                  <option value="">UF</option>
                  {STATES.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Coordenadas GPS (readonly — preenchidas automaticamente pelo tecnico) */}
            {editingId && (() => {
              const edited = addresses.find((a) => a.id === editingId);
              if (!edited?.lat || !edited?.lng) return null;
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Latitude</label>
                    <input value={edited.lat.toFixed(6)} readOnly className={inputClass + ' w-full mt-1 bg-slate-100 text-slate-500 cursor-not-allowed'} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Longitude</label>
                    <input value={edited.lng.toFixed(6)} readOnly className={inputClass + ' w-full mt-1 bg-slate-100 text-slate-500 cursor-not-allowed'} />
                  </div>
                  <p className="sm:col-span-2 text-[10px] text-slate-400 -mt-1">Coordenadas capturadas automaticamente pelo GPS do tecnico ao chegar no local</p>
                </div>
              );
            })()}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----- Loading ----- */}
      {loading && (
        <p className="text-sm text-slate-400 py-4">Carregando enderecos...</p>
      )}

      {/* ----- Empty state ----- */}
      {!loading && addresses.length === 0 && !showForm && (
        <p className="text-sm text-slate-400 py-4">
          Nenhum endereco de atendimento cadastrado para este parceiro.
        </p>
      )}

      {/* ----- Address list ----- */}
      {!loading && addresses.length > 0 && (
        <div className="space-y-2">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800 truncate">
                    {addr.label}
                  </span>
                  <span
                    className={
                      addr.active
                        ? 'text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700'
                        : 'text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700'
                    }
                  >
                    {addr.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {formatAddr(addr)}
                </p>
                {addr.lat && addr.lng && (
                  <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    {addr.lat.toFixed(6)}, {addr.lng.toFixed(6)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleEdit(addr)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                  title="Editar"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleActive(addr)}
                  className={
                    addr.active
                      ? 'text-xs px-3 py-1.5 text-amber-600 hover:text-amber-800'
                      : 'text-xs px-3 py-1.5 text-green-600 hover:text-green-800'
                  }
                  title={addr.active ? 'Desativar' : 'Ativar'}
                >
                  {addr.active ? 'Desativar' : 'Ativar'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(addr)}
                  className="text-xs px-3 py-1.5 text-red-600 hover:text-red-800"
                  title="Excluir"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
