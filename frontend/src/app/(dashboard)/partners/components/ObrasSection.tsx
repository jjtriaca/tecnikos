'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { maskCep, toTitleCase, STATES } from '@/lib/brazil-utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Obra {
  id: string;
  name: string;
  cno: string;
  addressStreet: string;
  addressNumber: string;
  addressComp: string | null;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  ibgeCode: string | null;
  active: boolean;
}

interface Props {
  partnerId: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function maskCno(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 12);
  if (d.length <= 2) return d;
  if (d.length <= 5) return d.replace(/(\d{2})(\d+)/, '$1.$2');
  if (d.length <= 10) return d.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
  return d.replace(/(\d{2})(\d{3})(\d{5})(\d+)/, '$1.$2.$3/$4');
}

const EMPTY_FORM = {
  name: '',
  cno: '',
  cep: '',
  addressStreet: '',
  addressNumber: '',
  addressComp: '',
  neighborhood: '',
  city: '',
  state: '',
  ibgeCode: '',
};

type ObraForm = typeof EMPTY_FORM;

const inputClass =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ObrasSection({ partnerId }: Props) {
  const { toast } = useToast();

  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ObraForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Load obras                                                       */
  /* ---------------------------------------------------------------- */

  const loadObras = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Obra[]>(
        `/obras?partnerId=${partnerId}&activeOnly=false`,
      );
      setObras(data);
    } catch {
      toast('Erro ao carregar obras.', 'error');
    } finally {
      setLoading(false);
    }
  }, [partnerId, toast]);

  useEffect(() => {
    loadObras();
  }, [loadObras]);

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
            addressComp: d.complemento || f.addressComp,
            ibgeCode: d.ibge || f.ibgeCode,
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

  function handleEdit(obra: Obra) {
    setEditingId(obra.id);
    setForm({
      name: obra.name,
      cno: obra.cno,
      cep: obra.cep,
      addressStreet: obra.addressStreet,
      addressNumber: obra.addressNumber,
      addressComp: obra.addressComp || '',
      neighborhood: obra.neighborhood,
      city: obra.city,
      state: obra.state,
      ibgeCode: obra.ibgeCode || '',
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
    if (!form.name.trim() || !form.cno.trim() || !form.addressStreet.trim() ||
        !form.addressNumber.trim() || !form.neighborhood.trim() ||
        !form.city.trim() || !form.state) {
      toast('Preencha todos os campos obrigatórios.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        cno: form.cno.trim(),
        cep: form.cep.trim(),
        addressStreet: form.addressStreet.trim(),
        addressNumber: form.addressNumber.trim(),
        addressComp: form.addressComp.trim() || null,
        neighborhood: form.neighborhood.trim(),
        city: form.city.trim(),
        state: form.state,
        ibgeCode: form.ibgeCode.trim() || null,
        partnerId,
      };

      if (editingId) {
        await api.put(`/obras/${editingId}`, payload);
        toast('Obra atualizada com sucesso.', 'success');
      } else {
        await api.post('/obras', payload);
        toast('Obra criada com sucesso.', 'success');
      }

      setShowForm(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
      loadObras();
    } catch (err) {
      if (err instanceof ApiError) {
        toast(err.payload?.message || err.message, 'error');
      } else {
        toast('Erro ao salvar obra.', 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Toggle active                                                    */
  /* ---------------------------------------------------------------- */

  async function handleToggleActive(obra: Obra) {
    try {
      await api.patch(`/obras/${obra.id}/toggle`);
      toast(
        obra.active ? 'Obra desativada.' : 'Obra ativada.',
        'success',
      );
      loadObras();
    } catch (err) {
      if (err instanceof ApiError) {
        toast(err.payload?.message || err.message, 'error');
      } else {
        toast('Erro ao alterar status.', 'error');
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="border-t border-slate-200 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-800">Obras</h4>
        {!showForm && (
          <button
            type="button"
            onClick={handleNew}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Nova Obra
          </button>
        )}
      </div>

      {/* ----- Inline form ----- */}
      {showForm && (
        <div className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50">
          <p className="text-sm font-semibold text-slate-800 mb-3">
            {editingId ? 'Editar Obra' : 'Nova Obra'}
          </p>

          <div className="space-y-3">
            {/* Name + CNO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Nome da Obra *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  onBlur={() => setForm((f) => ({ ...f, name: toTitleCase(f.name) }))}
                  placeholder="Ex: Condomínio Vila Nova"
                  className={inputClass + ' w-full mt-1'}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">CNO *</label>
                <input
                  value={form.cno}
                  onChange={(e) => setForm((f) => ({ ...f, cno: maskCno(e.target.value) }))}
                  placeholder="XX.XXX.XXXXX/XX"
                  className={inputClass + ' w-full mt-1'}
                />
              </div>
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
                <label className="text-xs font-medium text-slate-600">Logradouro *</label>
                <input
                  value={form.addressStreet}
                  onChange={(e) => setForm((f) => ({ ...f, addressStreet: e.target.value }))}
                  onBlur={() => setForm((f) => ({ ...f, addressStreet: toTitleCase(f.addressStreet) }))}
                  placeholder="Rua, Av., etc."
                  className={inputClass + ' w-full mt-1'}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Numero *</label>
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
                <label className="text-xs font-medium text-slate-600">Bairro *</label>
                <input
                  value={form.neighborhood}
                  onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
                  onBlur={() => setForm((f) => ({ ...f, neighborhood: toTitleCase(f.neighborhood) }))}
                  placeholder="Bairro"
                  className={inputClass + ' w-full mt-1'}
                />
              </div>
            </div>

            {/* Cidade + UF + IBGE */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
              <div>
                <label className="text-xs font-medium text-slate-600">Cod. IBGE</label>
                <input
                  value={form.ibgeCode}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 7);
                    setForm((f) => ({ ...f, ibgeCode: v }));
                  }}
                  placeholder="7 digitos"
                  className={inputClass + ' w-full mt-1'}
                />
              </div>
            </div>

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
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----- Loading ----- */}
      {loading && (
        <p className="text-sm text-slate-400 py-4">Carregando obras...</p>
      )}

      {/* ----- Empty state ----- */}
      {!loading && obras.length === 0 && !showForm && (
        <p className="text-sm text-slate-400 py-4">
          Nenhuma obra cadastrada para este parceiro.
        </p>
      )}

      {/* ----- Obra list ----- */}
      {!loading && obras.length > 0 && (
        <div className="space-y-2">
          {obras.map((obra) => (
            <div
              key={obra.id}
              className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800 truncate">
                    {obra.name}
                  </span>
                  <span
                    className={
                      obra.active
                        ? 'text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700'
                        : 'text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700'
                    }
                  >
                    {obra.active ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  CNO: {obra.cno}
                  {obra.city && obra.state && (
                    <span className="ml-2">
                      {obra.city}/{obra.state}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleEdit(obra)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  title="Editar"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleActive(obra)}
                  className={
                    obra.active
                      ? 'text-xs px-3 py-1.5 text-red-600 hover:text-red-800'
                      : 'text-xs px-3 py-1.5 text-green-600 hover:text-green-800'
                  }
                  title={obra.active ? 'Desativar' : 'Ativar'}
                >
                  {obra.active ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
