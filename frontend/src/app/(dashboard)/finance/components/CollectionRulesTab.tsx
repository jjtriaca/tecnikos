"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import type { CollectionRule, CollectionExecution, OverdueAgingReport } from "@/types/finance";
import { ACTION_TYPE_OPTIONS } from "@/types/finance";

/* ── Helpers ────────────────────────────────────────────── */

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionTypeLabel(value: string): string {
  return ACTION_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

const ACTION_TYPE_COLORS: Record<string, string> = {
  STATUS_CHANGE: "bg-blue-50 text-blue-700 border-blue-200",
  INTEREST_APPLY: "bg-amber-50 text-amber-700 border-amber-200",
  WHATSAPP: "bg-green-50 text-green-700 border-green-200",
  EMAIL: "bg-purple-50 text-purple-700 border-purple-200",
  ENVIAR_RELATORIO: "bg-orange-50 text-orange-700 border-orange-200",
};

const EXECUTION_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SUCCESS: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  FAILED: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  SKIPPED: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
};

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PaginatedExecutions {
  data: CollectionExecution[];
  meta: PaginationMeta;
}

interface RuleFormData {
  name: string;
  daysAfterDue: string;
  actionType: string;
  messageTemplate: string;
  isActive: boolean;
  sortOrder: string;
}

const EMPTY_FORM: RuleFormData = {
  name: "",
  daysAfterDue: "1",
  actionType: "STATUS_CHANGE",
  messageTemplate: "",
  isActive: true,
  sortOrder: "0",
};

/* ══════════════════════════════════════════════════════════
   COLLECTION RULES TAB
   ══════════════════════════════════════════════════════════ */

export default function CollectionRulesTab() {
  return (
    <div className="space-y-8">
      <OverdueAgingSection />
      <CollectionRulesSection />
      <ExecutionHistorySection />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SECTION 1: OVERDUE AGING REPORT
   ══════════════════════════════════════════════════════════ */

function OverdueAgingSection() {
  const [data, setData] = useState<OverdueAgingReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<OverdueAgingReport>("/finance/overdue")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Inadimplência por Faixa</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Inadimplência por Faixa</h3>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400">
          Erro ao carregar dados de inadimplência.
        </div>
      </div>
    );
  }

  const buckets: { key: keyof OverdueAgingReport["buckets"]; label: string; borderColor: string; bgColor: string; textColor: string }[] = [
    { key: "0-30", label: "0-30 dias", borderColor: "border-amber-300", bgColor: "bg-amber-50", textColor: "text-amber-800" },
    { key: "31-60", label: "31-60 dias", borderColor: "border-orange-300", bgColor: "bg-orange-50", textColor: "text-orange-800" },
    { key: "61-90", label: "61-90 dias", borderColor: "border-red-300", bgColor: "bg-red-50", textColor: "text-red-700" },
    { key: "90+", label: "90+ dias", borderColor: "border-red-500", bgColor: "bg-red-100", textColor: "text-red-800" },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Inadimplência por Faixa</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {buckets.map((b) => {
          const bucket = data.buckets[b.key];
          return (
            <div key={b.key} className={`rounded-xl border ${b.borderColor} ${b.bgColor} p-5 shadow-sm`}>
              <span className={`text-xs font-medium ${b.textColor}`}>{b.label}</span>
              <p className={`mt-1 text-2xl font-bold ${b.textColor}`}>{formatCurrency(bucket.totalCents)}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {bucket.count} entrada{bucket.count !== 1 ? "s" : ""}
              </p>
            </div>
          );
        })}
      </div>

      {/* Total bar */}
      <div className="mt-4 rounded-xl border-2 border-slate-300 bg-white p-4 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">Total em Atraso</p>
          <p className={`text-2xl font-bold mt-0.5 ${data.totalOverdueCents > 0 ? "text-red-700" : "text-slate-700"}`}>
            {formatCurrency(data.totalOverdueCents)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">
            {data.totalOverdueCount} entrada{data.totalOverdueCount !== 1 ? "s" : ""} vencida{data.totalOverdueCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SECTION 2: COLLECTION RULES CRUD
   ══════════════════════════════════════════════════════════ */

function CollectionRulesSection() {
  const [rules, setRules] = useState<CollectionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CollectionRule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const loadRules = useCallback(async () => {
    try {
      const result = await api.get<CollectionRule[]>("/finance/collection-rules");
      setRules(result);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  function openNewForm() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(rule: CollectionRule) {
    setEditingId(rule.id);
    setFormData({
      name: rule.name,
      daysAfterDue: String(rule.daysAfterDue),
      actionType: rule.actionType,
      messageTemplate: rule.messageTemplate || "",
      isActive: rule.isActive,
      sortOrder: String(rule.sortOrder),
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast("Informe o nome da regra.", "error");
      return;
    }
    const days = parseInt(formData.daysAfterDue, 10);
    if (isNaN(days)) {
      toast("Informe um valor valido para dias.", "error");
      return;
    }

    setSaving(true);
    const payload = {
      name: formData.name.trim(),
      daysAfterDue: days,
      actionType: formData.actionType,
      messageTemplate: formData.messageTemplate.trim() || undefined,
      isActive: formData.isActive,
      sortOrder: parseInt(formData.sortOrder, 10) || 0,
    };

    try {
      if (editingId) {
        await api.patch(`/finance/collection-rules/${editingId}`, payload);
        toast("Regra atualizada com sucesso!", "success");
      } else {
        await api.post("/finance/collection-rules", payload);
        toast("Regra criada com sucesso!", "success");
      }
      closeForm();
      await loadRules();
    } catch {
      toast("Erro ao salvar regra.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(rule: CollectionRule) {
    try {
      await api.patch(`/finance/collection-rules/${rule.id}`, { isActive: !rule.isActive });
      toast(
        rule.isActive ? "Regra desativada." : "Regra ativada.",
        "success",
      );
      await loadRules();
    } catch {
      toast("Erro ao alterar status da regra.", "error");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/finance/collection-rules/${deleteTarget.id}`);
      toast("Regra excluida com sucesso!", "success");
      setDeleteTarget(null);
      await loadRules();
    } catch {
      toast("Erro ao excluir regra.", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleRunAll() {
    setRunningAll(true);
    try {
      await api.post("/finance/collection-rules/run");
      toast("Execucao de regras iniciada com sucesso!", "success");
    } catch {
      toast("Erro ao executar regras.", "error");
    } finally {
      setRunningAll(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Regras de Cobranca</h3>
        <div className="flex gap-2">
          <button
            onClick={handleRunAll}
            disabled={runningAll}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {runningAll ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Executando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Executar agora
              </>
            )}
          </button>
          <button
            onClick={openNewForm}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            + Nova Regra
          </button>
        </div>
      </div>

      {/* Rules list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">Nenhuma regra de cobranca criada ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`rounded-xl border bg-white p-4 shadow-sm transition-colors ${
                rule.isActive ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{rule.name}</span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                        ACTION_TYPE_COLORS[rule.actionType] || "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {actionTypeLabel(rule.actionType)}
                    </span>
                    {!rule.isActive && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {rule.daysAfterDue < 0
                      ? `${Math.abs(rule.daysAfterDue)} dia${Math.abs(rule.daysAfterDue) !== 1 ? "s" : ""} antes do vencimento`
                      : rule.daysAfterDue === 0
                      ? "No dia do vencimento"
                      : `${rule.daysAfterDue} dia${rule.daysAfterDue !== 1 ? "s" : ""} apos vencimento`}
                    {rule.sortOrder > 0 && (
                      <span className="ml-2 text-slate-400">Ordem: {rule.sortOrder}</span>
                    )}
                  </p>
                  {rule.messageTemplate && (
                    <p className="mt-1 text-xs text-slate-400 truncate max-w-md">
                      Template: {rule.messageTemplate}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggleActive(rule)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      rule.isActive ? "bg-blue-600" : "bg-slate-300"
                    }`}
                    title={rule.isActive ? "Desativar" : "Ativar"}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        rule.isActive ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  {/* Edit */}
                  <button
                    onClick={() => openEditForm(rule)}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                    title="Editar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => setDeleteTarget(rule)}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-red-600 hover:border-red-300 transition-colors"
                    title="Excluir"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rule form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl animate-scale-in">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {editingId ? "Editar Regra" : "Nova Regra de Cobranca"}
            </h3>
            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Lembrete 7 dias apos vencimento"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Dias + Tipo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Dias apos vencimento *
                  </label>
                  <input
                    type="number"
                    value={formData.daysAfterDue}
                    onChange={(e) => setFormData({ ...formData, daysAfterDue: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <p className="mt-0.5 text-xs text-slate-400">
                    Negativo = antes do vencimento
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Tipo de acao *
                  </label>
                  <select
                    value={formData.actionType}
                    onChange={(e) => setFormData({ ...formData, actionType: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                  >
                    {ACTION_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Template */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Template da mensagem
                </label>
                <textarea
                  value={formData.messageTemplate}
                  onChange={(e) => setFormData({ ...formData, messageTemplate: e.target.value })}
                  rows={3}
                  placeholder="Ex: Ola {{partner_name}}, o valor de {{amount}} venceu em {{due_date}} ({{days_overdue}} dias atras)."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                />
                <p className="mt-0.5 text-xs text-slate-400">
                  {"Variaveis: {{partner_name}}, {{amount}}, {{due_date}}, {{days_overdue}}"}
                </p>
              </div>

              {/* Ordem + Ativo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Ordem</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Ativa</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeForm}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Salvando...
                  </span>
                ) : editingId ? (
                  "Salvar Alteracoes"
                ) : (
                  "Criar Regra"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir Regra"
        message={
          deleteTarget
            ? `Deseja excluir a regra "${deleteTarget.name}"? Esta acao nao pode ser desfeita.`
            : ""
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SECTION 3: EXECUTION HISTORY
   ══════════════════════════════════════════════════════════ */

function ExecutionHistorySection() {
  const [executions, setExecutions] = useState<CollectionExecution[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const loadExecutions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      params.set("page", String(page));
      params.set("limit", "20");

      const result = await api.get<PaginatedExecutions>(
        `/finance/collection-executions?${params.toString()}`,
      );
      setExecutions(result.data);
      setMeta(result.meta);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, page]);

  useEffect(() => {
    loadExecutions();
  }, [loadExecutions]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo]);

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Historico de Execucoes</h3>

      {/* Date filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-slate-500">De</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-slate-500">Ate</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Limpar filtros
          </button>
        )}
        <span className="text-xs text-slate-400 ml-auto">
          {meta.total} registro{meta.total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
          ))}
        </div>
      ) : executions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">
            {dateFrom || dateTo
              ? "Nenhuma execucao encontrada no periodo selecionado."
              : "Nenhuma execucao registrada ainda."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="py-3 px-4 text-xs font-semibold uppercase text-slate-600 text-left">
                  Data/Hora
                </th>
                <th className="py-3 px-4 text-xs font-semibold uppercase text-slate-600 text-left">
                  Tipo
                </th>
                <th className="py-3 px-4 text-xs font-semibold uppercase text-slate-600 text-left">
                  Status
                </th>
                <th className="py-3 px-4 text-xs font-semibold uppercase text-slate-600 text-left">
                  Mensagem
                </th>
              </tr>
            </thead>
            <tbody>
              {executions.map((exec) => {
                const statusCfg = EXECUTION_STATUS_COLORS[exec.status] || EXECUTION_STATUS_COLORS.SKIPPED;
                return (
                  <tr key={exec.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-slate-700 whitespace-nowrap">
                      {formatDateTime(exec.executedAt)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          ACTION_TYPE_COLORS[exec.actionType] || "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        {actionTypeLabel(exec.actionType)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                      >
                        {exec.status === "SUCCESS"
                          ? "Sucesso"
                          : exec.status === "FAILED"
                          ? "Falha"
                          : "Ignorado"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 max-w-xs truncate">
                      {exec.message || exec.error || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-slate-500">
            Pagina {meta.page} de {meta.totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={meta.page <= 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            {Array.from({ length: meta.totalPages }, (_, i) => i + 1)
              .filter((p) => {
                // Show first, last, and pages near current
                if (p === 1 || p === meta.totalPages) return true;
                if (Math.abs(p - meta.page) <= 1) return true;
                return false;
              })
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0) {
                  const prev = arr[idx - 1];
                  if (p - prev > 1) acc.push("...");
                }
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === "..." ? (
                  <span key={`dots-${idx}`} className="px-2 py-1.5 text-xs text-slate-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item as number)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      meta.page === item
                        ? "bg-blue-600 text-white"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={meta.page >= meta.totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Proximo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
