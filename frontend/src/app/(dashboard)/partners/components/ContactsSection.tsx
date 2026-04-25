'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface PartnerContact {
  id: string;
  type: string;
  value: string;
  label: string | null;
  lastUsedAt: string | null;
  active: boolean;
}

interface Props {
  partnerId: string;
}

const inputClass = 'rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500';

const TYPE_OPTIONS = [
  { value: 'EMAIL', label: 'Email', icon: '✉', color: 'bg-blue-100 text-blue-700' },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: '📱', color: 'bg-green-100 text-green-700' },
];

export default function ContactsSection({ partnerId }: Props) {
  const { toast } = useToast();

  const [contacts, setContacts] = useState<PartnerContact[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formType, setFormType] = useState('EMAIL');
  const [formValue, setFormValue] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<PartnerContact[]>(`/partners/${partnerId}/contacts`);
      setContacts(data || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  function handleNew() {
    setEditingId(null);
    setFormType('EMAIL');
    setFormValue('');
    setFormLabel('');
    setShowForm(true);
  }

  function handleEdit(c: PartnerContact) {
    setEditingId(c.id);
    setFormType(c.type);
    setFormValue(c.value);
    setFormLabel(c.label || '');
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
  }

  async function handleSave() {
    if (!formValue.trim()) {
      toast('Preencha o valor do contato.', 'warning');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/partners/${partnerId}/contacts/${editingId}`, {
          value: formValue.trim(),
          label: formLabel.trim() || null,
        });
        toast('Contato atualizado.', 'success');
      } else {
        await api.post(`/partners/${partnerId}/contacts`, {
          type: formType,
          value: formValue.trim(),
          label: formLabel.trim() || null,
        });
        toast('Contato adicionado.', 'success');
      }
      setShowForm(false);
      setEditingId(null);
      loadContacts();
    } catch (err: any) {
      toast(err?.message || 'Erro ao salvar contato.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: PartnerContact) {
    if (!confirm(`Excluir ${c.type === 'EMAIL' ? 'email' : 'WhatsApp'} ${c.value}?`)) return;
    try {
      await api.del(`/partners/${partnerId}/contacts/${c.id}`);
      toast('Contato excluido.', 'success');
      loadContacts();
    } catch (err: any) {
      toast(err?.message || 'Erro ao excluir.', 'error');
    }
  }

  const typeInfo = (type: string) => TYPE_OPTIONS.find((t) => t.value === type) || TYPE_OPTIONS[0];

  // Group by type
  const emailContacts = contacts.filter((c) => c.type === 'EMAIL');
  const whatsappContacts = contacts.filter((c) => c.type === 'WHATSAPP');

  return (
    <div className="border-t border-slate-200 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-800">Contatos</h4>
        {!showForm && (
          <button type="button" onClick={handleNew} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Novo Contato
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="border border-slate-200 rounded-lg p-4 mb-4 bg-slate-50">
          <p className="text-sm font-semibold text-slate-800 mb-3">{editingId ? 'Editar Contato' : 'Novo Contato'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {!editingId && (
              <div>
                <label className="text-xs font-medium text-slate-600">Tipo *</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value)} className={inputClass + ' w-full mt-1'}>
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div className={editingId ? 'sm:col-span-2' : 'sm:col-span-2'}>
              <label className="text-xs font-medium text-slate-600">{formType === 'EMAIL' ? 'Email *' : 'Telefone *'}</label>
              <input
                type={formType === 'EMAIL' ? 'email' : 'tel'}
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder={formType === 'EMAIL' ? 'email@exemplo.com' : '(66) 99999-0000'}
                className={inputClass + ' w-full mt-1'}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Rotulo</label>
              <input
                type="text"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="Ex: Financeiro, Comercial"
                className={inputClass + ' w-full mt-1'}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-3">
            <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar'}
            </button>
            <button type="button" onClick={handleCancel} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-slate-400 py-4">Carregando contatos...</p>}

      {!loading && contacts.length === 0 && !showForm && (
        <p className="text-sm text-slate-400 py-4">Nenhum contato adicional cadastrado.</p>
      )}

      {!loading && contacts.length > 0 && (
        <div className="space-y-3">
          {/* Emails */}
          {emailContacts.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Emails</p>
              <div className="space-y-1">
                {emailContacts.map((c) => (
                  <div key={c.id} className={`border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2 ${!c.active ? 'opacity-40' : ''}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeInfo(c.type).color}`}>{typeInfo(c.type).label}</span>
                      <span className="text-sm text-slate-800 truncate">{c.value}</span>
                      {c.label && <span className="text-xs text-slate-400">({c.label})</span>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => handleEdit(c)} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1">Editar</button>
                      <button type="button" onClick={() => handleDelete(c)} className="text-xs text-red-500 hover:text-red-700 px-2 py-1">Excluir</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WhatsApp */}
          {whatsappContacts.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">WhatsApp</p>
              <div className="space-y-1">
                {whatsappContacts.map((c) => (
                  <div key={c.id} className={`border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2 ${!c.active ? 'opacity-40' : ''}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeInfo(c.type).color}`}>{typeInfo(c.type).label}</span>
                      <span className="text-sm text-slate-800 truncate">{c.value}</span>
                      {c.label && <span className="text-xs text-slate-400">({c.label})</span>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => handleEdit(c)} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1">Editar</button>
                      <button type="button" onClick={() => handleDelete(c)} className="text-xs text-red-500 hover:text-red-700 px-2 py-1">Excluir</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
