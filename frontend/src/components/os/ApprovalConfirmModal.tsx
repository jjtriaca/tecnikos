"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

type PostableAccount = { id: string; code: string; name: string; type: string; parent?: { id: string; code: string; name: string } };

type FinancialPreview = {
  type: "RECEIVABLE" | "PAYABLE";
  partnerName: string | null;
  description: string;
  grossCents: number;
  netCents: number;
};

type ContactInfo = { partnerId: string; name: string; phone: string | null; email: string | null } | null;
type ContactRecord = { id: string; value: string; label: string | null; type: string };

type Props = {
  open: boolean;
  orderId: string;
  score: number;
  comment: string;
  onClose: () => void;
  onApproved: () => void;
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default function ApprovalConfirmModal({ open, orderId, score, comment, onClose, onApproved }: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<{
    entries: FinancialPreview[];
    osTitle: string;
    osCode: string;
    clientContact: ContactInfo;
    techContact: ContactInfo;
  } | null>(null);
  const [receivableDue, setReceivableDue] = useState(defaultDueDate());
  const [payableDue, setPayableDue] = useState(defaultDueDate());
  const [receivableAccountId, setReceivableAccountId] = useState("");
  const [payableAccountId, setPayableAccountId] = useState("");
  const [postableAccounts, setPostableAccounts] = useState<PostableAccount[]>([]);
  const [error, setError] = useState("");
  const [financialOnApproval, setFinancialOnApproval] = useState(true);

  // Checkboxes for optional financial launch
  const [launchReceivable, setLaunchReceivable] = useState(false);
  const [launchPayable, setLaunchPayable] = useState(false);

  // ── Contact state (client) ──
  const [clientEmailContacts, setClientEmailContacts] = useState<ContactRecord[]>([]);
  const [clientWaContacts, setClientWaContacts] = useState<ContactRecord[]>([]);
  const [clientSelEmailId, setClientSelEmailId] = useState("");
  const [clientSelWaId, setClientSelWaId] = useState("");
  const [clientSendEmail, setClientSendEmail] = useState(false);
  const [clientSendWa, setClientSendWa] = useState(false);
  const [clientShowNewEmail, setClientShowNewEmail] = useState(false);
  const [clientShowNewWa, setClientShowNewWa] = useState(false);
  const [clientNewEmailVal, setClientNewEmailVal] = useState("");
  const [clientNewEmailLabel, setClientNewEmailLabel] = useState("");
  const [clientNewWaVal, setClientNewWaVal] = useState("");
  const [clientNewWaLabel, setClientNewWaLabel] = useState("");

  // ── Contact state (tech) ──
  const [techEmailContacts, setTechEmailContacts] = useState<ContactRecord[]>([]);
  const [techWaContacts, setTechWaContacts] = useState<ContactRecord[]>([]);
  const [techSelEmailId, setTechSelEmailId] = useState("");
  const [techSelWaId, setTechSelWaId] = useState("");
  const [techSendEmail, setTechSendEmail] = useState(false);
  const [techSendWa, setTechSendWa] = useState(false);
  const [techShowNewEmail, setTechShowNewEmail] = useState(false);
  const [techShowNewWa, setTechShowNewWa] = useState(false);
  const [techNewEmailVal, setTechNewEmailVal] = useState("");
  const [techNewEmailLabel, setTechNewEmailLabel] = useState("");
  const [techNewWaVal, setTechNewWaVal] = useState("");
  const [techNewWaLabel, setTechNewWaLabel] = useState("");

  // Load preview + contacts
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    Promise.all([
      api.get(`/service-orders/${orderId}/finalize-preview`),
      api.get<PostableAccount[]>("/finance/accounts/postable").catch(() => []),
      api.get<any>("/companies/system-config").catch(() => null),
    ]).then(([data, accounts, cfg]: [any, PostableAccount[], any]) => {
      setPreview(data);
      setReceivableDue(defaultDueDate());
      setPayableDue(defaultDueDate());
      setPostableAccounts(accounts);
      const autoLaunch = cfg?.os?.financialOnApproval !== false;
      setFinancialOnApproval(autoLaunch);
      const recDefault = accounts.find(a => a.code === "1100");
      const payDefault = accounts.find(a => a.code === "2100");
      setReceivableAccountId(recDefault?.id || "");
      setPayableAccountId(payDefault?.id || "");
      if (!autoLaunch) {
        const recEntry = data?.entries?.find((e: any) => e.type === "RECEIVABLE" && e.grossCents > 0);
        const payEntry = data?.entries?.find((e: any) => e.type === "PAYABLE" && e.netCents > 0);
        setLaunchReceivable(!!recEntry);
        setLaunchPayable(!!payEntry);
      }

      // Load contacts for client and tech
      loadPartnerContacts(data.clientContact, "client");
      loadPartnerContacts(data.techContact, "tech");
    }).catch((err: any) => {
      setError(err?.message || "Erro ao carregar preview");
    }).finally(() => setLoading(false));
  }, [open, orderId]);

  async function loadPartnerContacts(contact: ContactInfo, target: "client" | "tech") {
    if (!contact?.partnerId) return;
    const pid = contact.partnerId;
    try {
      const [emails, whatsapps] = await Promise.all([
        api.get<ContactRecord[]>(`/partners/${pid}/contacts?type=EMAIL`).catch(() => []),
        api.get<ContactRecord[]>(`/partners/${pid}/contacts?type=WHATSAPP`).catch(() => []),
      ]);
      let emailList = emails || [];
      let wpList = whatsapps || [];
      // Add partner.email/phone as virtual contacts if not already in list
      if (contact.email && !emailList.some(c => c.value === contact.email)) {
        emailList = [{ id: "_partner_email", value: contact.email, label: "Cadastro", type: "EMAIL" }, ...emailList];
      }
      if (contact.phone && !wpList.some(c => c.value === contact.phone)) {
        wpList = [{ id: "_partner_phone", value: contact.phone, label: "Cadastro", type: "WHATSAPP" }, ...wpList];
      }

      if (target === "client") {
        setClientEmailContacts(emailList);
        setClientWaContacts(wpList);
        if (emailList.length > 0) { setClientSelEmailId(emailList[0].id); setClientSendEmail(true); }
        if (wpList.length > 0) { setClientSelWaId(wpList[0].id); setClientSendWa(true); }
      } else {
        setTechEmailContacts(emailList);
        setTechWaContacts(wpList);
        if (emailList.length > 0) { setTechSelEmailId(emailList[0].id); setTechSendEmail(true); }
        if (wpList.length > 0) { setTechSelWaId(wpList[0].id); setTechSendWa(true); }
      }
    } catch { /* ignore */ }
  }

  async function handleSaveNewContact(partnerId: string, type: string, value: string, label: string, target: "client" | "tech") {
    if (!partnerId || !value) return;
    try {
      const contact = await api.post<ContactRecord>(`/partners/${partnerId}/contacts`, { type, value, label: label || null });
      if (target === "client") {
        if (type === "EMAIL") {
          setClientEmailContacts(prev => [contact, ...prev]);
          setClientSelEmailId(contact.id);
          setClientShowNewEmail(false); setClientNewEmailVal(""); setClientNewEmailLabel("");
        } else {
          setClientWaContacts(prev => [contact, ...prev]);
          setClientSelWaId(contact.id);
          setClientShowNewWa(false); setClientNewWaVal(""); setClientNewWaLabel("");
        }
      } else {
        if (type === "EMAIL") {
          setTechEmailContacts(prev => [contact, ...prev]);
          setTechSelEmailId(contact.id);
          setTechShowNewEmail(false); setTechNewEmailVal(""); setTechNewEmailLabel("");
        } else {
          setTechWaContacts(prev => [contact, ...prev]);
          setTechSelWaId(contact.id);
          setTechShowNewWa(false); setTechNewWaVal(""); setTechNewWaLabel("");
        }
      }
    } catch { /* ignore */ }
  }

  if (!open) return null;

  const recEntry = preview?.entries?.find(e => e.type === "RECEIVABLE");
  const payEntryRaw = preview?.entries?.find(e => e.type === "PAYABLE");
  const payEntry = payEntryRaw && payEntryRaw.netCents > 0 ? payEntryRaw : null;
  const noFinancial = !recEntry && !payEntry;

  function getSelectedContact(contacts: ContactRecord[], selectedId: string): string | undefined {
    return contacts.find(c => c.id === selectedId)?.value;
  }

  async function handleConfirm() {
    setSubmitting(true);
    setError("");
    try {
      const body: any = {
        score,
        comment: comment || undefined,
      };

      if (financialOnApproval) {
        body.receivableDueDate = receivableDue || undefined;
        body.payableDueDate = payableDue || undefined;
        body.receivableAccountId = receivableAccountId || undefined;
        body.payableAccountId = payableAccountId || undefined;
      } else {
        body.skipReceivable = !launchReceivable;
        body.skipPayable = !launchPayable;
        if (launchReceivable) {
          body.receivableDueDate = receivableDue || undefined;
          body.receivableAccountId = receivableAccountId || undefined;
        }
        if (launchPayable) {
          body.payableDueDate = payableDue || undefined;
          body.payableAccountId = payableAccountId || undefined;
        }
      }

      // Contact fields
      const clientChannels: string[] = [];
      if (clientSendWa) clientChannels.push("WHATSAPP");
      if (clientSendEmail) clientChannels.push("EMAIL");
      if (clientChannels.length > 0) {
        body.clientChannels = clientChannels;
        body.clientPhone = getSelectedContact(clientWaContacts, clientSelWaId);
        body.clientEmail = getSelectedContact(clientEmailContacts, clientSelEmailId);
      }

      const techChannels: string[] = [];
      if (techSendWa) techChannels.push("WHATSAPP");
      if (techSendEmail) techChannels.push("EMAIL");
      if (techChannels.length > 0) {
        body.techChannels = techChannels;
        body.techPhone = getSelectedContact(techWaContacts, techSelWaId);
        body.techEmail = getSelectedContact(techEmailContacts, techSelEmailId);
      }

      await api.post(`/service-orders/${orderId}/approve-and-finalize`, body);
      onApproved();
    } catch (err: any) {
      setError(err?.message || "Erro ao aprovar");
    } finally {
      setSubmitting(false);
    }
  }

  function renderAccountSelect(value: string, onChange: (v: string) => void) {
    const grouped = new Map<string, PostableAccount[]>();
    for (const acc of postableAccounts) {
      const parentName = acc.parent?.name || "Outros";
      if (!grouped.has(parentName)) grouped.set(parentName, []);
      grouped.get(parentName)!.push(acc);
    }
    return (
      <select value={value} onChange={e => onChange(e.target.value)}
        className="text-xs border border-slate-200 rounded px-2 py-0.5 bg-white focus:outline-none focus:border-blue-300 flex-1">
        <option value="">Sem categoria</option>
        {Array.from(grouped.entries()).map(([group, items]) => (
          <optgroup key={group} label={group}>
            {items.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
          </optgroup>
        ))}
      </select>
    );
  }

  function renderEntry(entry: FinancialPreview, isOptional: boolean, checked: boolean, onCheck: (v: boolean) => void, dueValue: string, onDueChange: (v: string) => void, accountValue: string, onAccountChange: (v: string) => void) {
    const isRec = entry.type === "RECEIVABLE";
    const colorBorder = isRec ? "border-green-200 bg-green-50" : "border-blue-200 bg-blue-50";
    const colorBorderChecked = isRec ? "border-green-300 bg-green-50" : "border-blue-300 bg-blue-50";
    const colorBorderUnchecked = "border-slate-200 bg-white";
    const displayValue = isRec ? entry.grossCents : entry.netCents;

    return (
      <div className={`rounded-lg border p-3 transition-colors ${
        isOptional
          ? (checked ? colorBorderChecked : colorBorderUnchecked)
          : colorBorder
      }`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            {isOptional ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={checked} onChange={e => onCheck(e.target.checked)}
                  className={`rounded border-slate-300 ${isRec ? "text-green-600 focus:ring-green-500" : "text-blue-600 focus:ring-blue-500"}`} />
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                  isRec ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                }`}>
                  {isRec ? "A Receber" : "A Pagar"}
                </span>
              </label>
            ) : (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                isRec ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
              }`}>
                {isRec ? "A Receber" : "A Pagar"}
              </span>
            )}
            <span className="text-xs text-slate-600">{entry.partnerName}</span>
          </div>
          <span className="text-sm font-semibold text-slate-800">{formatBRL(displayValue)}</span>
        </div>
        {(!isOptional || checked) && (
          <div className="flex flex-col gap-1.5 mt-1.5">
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-slate-500 w-10">Venc:</label>
              <input type="date" value={dueValue} onChange={e => onDueChange(e.target.value)}
                className="text-xs border border-slate-200 rounded px-2 py-0.5 bg-white focus:outline-none focus:border-blue-300 flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-slate-500 w-10">Categ:</label>
              {renderAccountSelect(accountValue, onAccountChange)}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Contact section render (same pattern as NFS-e modal) ──
  function renderContactSection(
    label: string,
    partnerName: string | null,
    partnerId: string | undefined,
    emailContacts: ContactRecord[],
    waContacts: ContactRecord[],
    selEmailId: string, setSelEmailId: (v: string) => void,
    selWaId: string, setSelWaId: (v: string) => void,
    sendEmail: boolean, setSendEmailFn: (v: boolean) => void,
    sendWa: boolean, setSendWaFn: (v: boolean) => void,
    showNewEmail: boolean, setShowNewEmailFn: (v: boolean) => void,
    showNewWa: boolean, setShowNewWaFn: (v: boolean) => void,
    newEmailVal: string, setNewEmailValFn: (v: string) => void,
    newEmailLabel: string, setNewEmailLabelFn: (v: string) => void,
    newWaVal: string, setNewWaValFn: (v: string) => void,
    newWaLabel: string, setNewWaLabelFn: (v: string) => void,
    target: "client" | "tech",
  ) {
    const noContact = emailContacts.length === 0 && waContacts.length === 0;
    const radioName = `${target}_`;

    return (
      <div className="rounded-lg border border-slate-200 p-3 space-y-3">
        <p className="text-xs font-semibold text-slate-600">
          {label}: <span className="font-normal text-slate-500">{partnerName || "—"}</span>
        </p>

        {/* Email */}
        <div>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={sendEmail} onChange={e => setSendEmailFn(e.target.checked)}
              className="rounded border-slate-300 text-blue-600" />
            <span className="font-medium">Enviar por Email</span>
          </label>
          {sendEmail && (
            <div className="ml-6 mt-1.5 space-y-1">
              {emailContacts.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="radio" name={`${radioName}email`} checked={selEmailId === c.id}
                    onChange={() => setSelEmailId(c.id)} className="text-blue-600" />
                  <span className="text-slate-700">{c.value}</span>
                  {c.label && <span className="text-slate-400">({c.label})</span>}
                </label>
              ))}
              {emailContacts.length === 0 && !showNewEmail && (
                <p className="text-xs text-slate-400">Nenhum email cadastrado</p>
              )}
              {!showNewEmail ? (
                <button type="button" onClick={() => setShowNewEmailFn(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 mt-0.5">+ Novo email</button>
              ) : (
                <div className="flex gap-1.5 mt-1">
                  <input type="email" value={newEmailVal} onChange={e => setNewEmailValFn(e.target.value)}
                    placeholder="email@exemplo.com" className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs" />
                  <input type="text" value={newEmailLabel} onChange={e => setNewEmailLabelFn(e.target.value)}
                    placeholder="Rotulo" className="w-24 rounded border border-slate-300 px-2 py-1 text-xs" />
                  <button type="button" disabled={!newEmailVal}
                    onClick={() => partnerId && handleSaveNewContact(partnerId, "EMAIL", newEmailVal, newEmailLabel, target)}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">Salvar</button>
                  <button type="button" onClick={() => { setShowNewEmailFn(false); setNewEmailValFn(""); setNewEmailLabelFn(""); }}
                    className="px-1.5 py-1 text-xs text-slate-500 hover:text-slate-700">X</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* WhatsApp */}
        <div>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={sendWa} onChange={e => setSendWaFn(e.target.checked)}
              className="rounded border-slate-300 text-green-600" />
            <span className="font-medium">Enviar por WhatsApp</span>
          </label>
          {sendWa && (
            <div className="ml-6 mt-1.5 space-y-1">
              {waContacts.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="radio" name={`${radioName}wa`} checked={selWaId === c.id}
                    onChange={() => setSelWaId(c.id)} className="text-green-600" />
                  <span className="text-slate-700">{c.value}</span>
                  {c.label && <span className="text-slate-400">({c.label})</span>}
                </label>
              ))}
              {waContacts.length === 0 && !showNewWa && (
                <p className="text-xs text-slate-400">Nenhum WhatsApp cadastrado</p>
              )}
              {!showNewWa ? (
                <button type="button" onClick={() => setShowNewWaFn(true)}
                  className="text-xs text-green-600 hover:text-green-800 mt-0.5">+ Novo WhatsApp</button>
              ) : (
                <div className="flex gap-1.5 mt-1">
                  <input type="tel" value={newWaVal} onChange={e => setNewWaValFn(e.target.value)}
                    placeholder="(00) 00000-0000" className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs" />
                  <input type="text" value={newWaLabel} onChange={e => setNewWaLabelFn(e.target.value)}
                    placeholder="Rotulo" className="w-24 rounded border border-slate-300 px-2 py-1 text-xs" />
                  <button type="button" disabled={!newWaVal}
                    onClick={() => partnerId && handleSaveNewContact(partnerId, "WHATSAPP", newWaVal, newWaLabel, target)}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">Salvar</button>
                  <button type="button" onClick={() => { setShowNewWaFn(false); setNewWaValFn(""); setNewWaLabelFn(""); }}
                    className="px-1.5 py-1 text-xs text-slate-500 hover:text-slate-700">X</button>
                </div>
              )}
            </div>
          )}
        </div>

        {noContact && !sendEmail && !sendWa && (
          <p className="text-[10px] text-amber-600 bg-amber-50 rounded px-2 py-1">
            Sem contato — aprovacao sem notificacao
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <h3 className="text-sm font-semibold text-slate-800">Confirmar Aprovacao</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Score */}
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(s => (
                <svg key={s} className={`h-5 w-5 ${s <= score ? "text-yellow-400" : "text-slate-200"}`}
                  fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            <span className="text-sm font-medium text-slate-600">{score}/5</span>
          </div>
          {comment && (
            <p className="text-xs text-slate-500 italic">&ldquo;{comment}&rdquo;</p>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
              <p className="text-xs text-slate-400 mt-2">Calculando...</p>
            </div>
          )}

          {/* Financial Preview */}
          {preview && !loading && (
            <>
              <div className="border-t border-slate-200 pt-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Lancamentos Financeiros
                  {!financialOnApproval && (
                    <span className="ml-1 text-amber-500 normal-case font-normal">(opcional — marque os que deseja lancar)</span>
                  )}
                </p>

                {noFinancial ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                    <p className="text-xs text-slate-500">Nenhum lancamento (servico sem valor)</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recEntry && recEntry.grossCents > 0 && renderEntry(
                      recEntry, !financialOnApproval,
                      financialOnApproval ? true : launchReceivable, setLaunchReceivable,
                      receivableDue, setReceivableDue, receivableAccountId, setReceivableAccountId,
                    )}
                    {payEntry && renderEntry(
                      payEntry, !financialOnApproval,
                      financialOnApproval ? true : launchPayable, setLaunchPayable,
                      payableDue, setPayableDue, payableAccountId, setPayableAccountId,
                    )}
                  </div>
                )}
              </div>

              {/* ── Notification Contacts ── */}
              <div className="border-t border-slate-200 pt-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Notificacoes
                </p>
                <div className="space-y-2">
                  {renderContactSection(
                    "Cliente", preview.clientContact?.name || null, preview.clientContact?.partnerId,
                    clientEmailContacts, clientWaContacts,
                    clientSelEmailId, setClientSelEmailId, clientSelWaId, setClientSelWaId,
                    clientSendEmail, setClientSendEmail, clientSendWa, setClientSendWa,
                    clientShowNewEmail, setClientShowNewEmail, clientShowNewWa, setClientShowNewWa,
                    clientNewEmailVal, setClientNewEmailVal, clientNewEmailLabel, setClientNewEmailLabel,
                    clientNewWaVal, setClientNewWaVal, clientNewWaLabel, setClientNewWaLabel,
                    "client",
                  )}
                  {renderContactSection(
                    "Tecnico", preview.techContact?.name || null, preview.techContact?.partnerId,
                    techEmailContacts, techWaContacts,
                    techSelEmailId, setTechSelEmailId, techSelWaId, setTechSelWaId,
                    techSendEmail, setTechSendEmail, techSendWa, setTechSendWa,
                    techShowNewEmail, setTechShowNewEmail, techShowNewWa, setTechShowNewWa,
                    techNewEmailVal, setTechNewEmailVal, techNewEmailLabel, setTechNewEmailLabel,
                    techNewWaVal, setTechNewWaVal, techNewWaLabel, setTechNewWaLabel,
                    "tech",
                  )}
                </div>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          <button onClick={onClose} disabled={submitting}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={submitting || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2">
            {submitting ? (
              <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Aprovando...</>
            ) : "Confirmar Aprovacao"}
          </button>
        </div>
      </div>
    </div>
  );
}
