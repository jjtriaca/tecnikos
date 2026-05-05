"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

type PartnerLite = {
  id: string;
  name: string;
  document?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
};

interface Props {
  value: string;        // selected partner id (empty if none)
  onChange: (partner: PartnerLite | null) => void;
  partnerType?: "CLIENTE" | "FORNECEDOR" | "TECNICO";
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Callback after creating a new partner inline (gets the freshly-created partner) */
  onCreate?: (partner: PartnerLite) => void;
}

/**
 * Autocomplete de parceiros com criar-na-hora.
 * - Digite >= 2 chars: busca no /partners
 * - Sem resultado: oferece "+ Criar como novo: [nome]" que abre mini-form
 * - Selecao: chama onChange com o partner completo
 *
 * Cria como CLIENTE PF por padrao se nao especificar partnerType.
 */
export default function PartnerCombobox({
  value,
  onChange,
  partnerType = "CLIENTE",
  placeholder = "Buscar cliente por nome...",
  required = false,
  disabled = false,
  className = "",
  onCreate,
}: Props) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PartnerLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PartnerLite | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Hidrata o selected baseado no value (id) — busca no servidor 1x
  useEffect(() => {
    if (!value) { setSelected(null); setQuery(""); return; }
    if (selected?.id === value) return;
    api.get<PartnerLite>(`/partners/${value}`)
      .then((p) => { setSelected(p); setQuery(p.name); })
      .catch(() => { /* parceiro removido — limpa */ });
  }, [value, selected?.id]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Debounce search
  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get<{ data: PartnerLite[] }>(
        `/partners?search=${encodeURIComponent(q)}&limit=10&type=${partnerType}`,
      );
      setResults(res.data || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [partnerType]);

  useEffect(() => {
    const t = setTimeout(() => { if (open) search(query); }, 200);
    return () => clearTimeout(t);
  }, [query, open, search]);

  function pickPartner(p: PartnerLite) {
    setSelected(p);
    setQuery(p.name);
    setOpen(false);
    onChange(p);
  }

  function clear() {
    setSelected(null);
    setQuery("");
    setResults([]);
    onChange(null);
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          required={required && !selected}
          disabled={disabled}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-8 text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-200 disabled:bg-slate-100"
        />
        {selected && !disabled && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 text-sm"
            title="Limpar selecao"
          >
            ✕
          </button>
        )}
      </div>

      {open && !disabled && query.length >= 2 && (
        <div className="absolute left-0 right-0 z-30 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg max-h-72 overflow-y-auto">
          {searching ? (
            <div className="px-3 py-2 text-xs text-slate-400">Buscando...</div>
          ) : results.length > 0 ? (
            <>
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickPartner(p)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-cyan-50 border-b border-slate-100 last:border-0"
                >
                  <div className="font-medium text-slate-900">{p.name}</div>
                  <div className="text-xs text-slate-500">
                    {[p.document, p.phone, p.city && p.state ? `${p.city}/${p.state}` : null]
                      .filter(Boolean).join(" • ") || "—"}
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setShowCreateForm(true); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-cyan-600 hover:bg-cyan-50 border-t border-slate-200"
              >
                + Criar novo cliente como &quot;{query}&quot;
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => { setShowCreateForm(true); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm font-medium text-cyan-600 hover:bg-cyan-50"
            >
              + Criar novo cliente como &quot;{query}&quot;
            </button>
          )}
        </div>
      )}

      {showCreateForm && (
        <CreatePartnerInlineModal
          initialName={query}
          partnerType={partnerType}
          onClose={() => setShowCreateForm(false)}
          onCreated={(p) => {
            pickPartner(p);
            setShowCreateForm(false);
            onCreate?.(p);
            toast(`Cliente "${p.name}" criado`, "success");
          }}
        />
      )}
    </div>
  );
}

/* ── Inline create modal ────────────────────────────────────────────── */

function CreatePartnerInlineModal({
  initialName, partnerType, onClose, onCreated,
}: {
  initialName: string;
  partnerType: string;
  onClose: () => void;
  onCreated: (p: PartnerLite) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [personType, setPersonType] = useState<"PF" | "PJ">("PF");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [saving, setSaving] = useState(false);

  function maskDoc(v: string): string {
    const d = v.replace(/\D/g, "");
    if (personType === "PF") {
      return d.slice(0, 11)
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return d.slice(0, 14)
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  function maskPhone(v: string): string {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast("Nome obrigatorio", "error"); return; }
    setSaving(true);
    try {
      const payload: any = {
        partnerTypes: [partnerType],
        personType,
        name: name.trim(),
        phone: phone || undefined,
        email: email || undefined,
        city: city || undefined,
        state: state || undefined,
      };
      if (document.trim()) {
        payload.document = document.replace(/\D/g, "");
        payload.documentType = personType === "PF" ? "CPF" : "CNPJ";
      }
      const created = await api.post<PartnerLite>("/partners", payload);
      onCreated(created);
    } catch (err: any) {
      toast(err?.payload?.message || "Erro ao criar cliente", "error");
    } finally {
      setSaving(false);
    }
  }

  const STATES = [
    "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
    "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Criar novo cliente</h3>
        <p className="text-xs text-slate-500 mb-4">
          Preenche o que tiver — depois pode complementar em <strong>Parceiros</strong>.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Nome *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Tipo</label>
              <select value={personType} onChange={(e) => { setPersonType(e.target.value as any); setDocument(""); }}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                <option value="PF">Pessoa Física</option>
                <option value="PJ">Pessoa Jurídica</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">{personType === "PF" ? "CPF" : "CNPJ"}</label>
              <input value={document} onChange={(e) => setDocument(maskDoc(e.target.value))}
                placeholder={personType === "PF" ? "000.000.000-00" : "00.000.000/0000-00"}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Telefone</label>
              <input value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div className="col-span-1">
              <label className="block text-xs text-slate-600 mb-1">Cidade</label>
              <input value={city} onChange={(e) => setCity(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">UF</label>
              <select value={state} onChange={(e) => setState(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                <option value="">—</option>
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50">
              {saving ? "Criando..." : "Criar e selecionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
