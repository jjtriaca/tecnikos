"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";

type SystemConfig = {
  os: {
    financialOnApproval: boolean;
    requirePhotoBeforeComplete: boolean;
    allowTechSelfAssign: boolean;
  };
  notifications: {
    emailOnNewOrder: boolean;
    emailOnStatusChange: boolean;
    pushEnabled: boolean;
  };
  financial: {
    autoGenerateReceivable: boolean;
    autoGeneratePayable: boolean;
    defaultDueDays: number;
  };
  evaluation: {
    requireGestorApproval: boolean;
    sendClientEvalLink: boolean;
  };
};

type SectionConfig = {
  key: string;
  title: string;
  icon: string;
  description: string;
  fields: FieldConfig[];
};

type FieldConfig = {
  section: string;
  key: string;
  label: string;
  description: string;
  type: "toggle" | "number";
};

const SECTIONS: SectionConfig[] = [
  {
    key: "os",
    title: "Ordens de Servico",
    icon: "📋",
    description: "Configuracoes de comportamento das OS",
    fields: [
      {
        section: "os",
        key: "financialOnApproval",
        label: "Lancar financeiro ao aprovar OS",
        description: "Ao aprovar e avaliar uma OS, cria automaticamente os lancamentos financeiros (a receber e a pagar)",
        type: "toggle",
      },
      {
        section: "os",
        key: "requirePhotoBeforeComplete",
        label: "Exigir foto antes de concluir",
        description: "O tecnico precisa tirar ao menos uma foto antes de poder concluir a OS",
        type: "toggle",
      },
      {
        section: "os",
        key: "allowTechSelfAssign",
        label: "Permitir tecnico auto-atribuir",
        description: "Tecnico pode aceitar OS sem aprovacao do gestor",
        type: "toggle",
      },
      {
        section: "os",
        key: "allowZeroValueOs",
        label: "Permitir OS com valor zero",
        description: "Util para OS de avaliacao/orcamento com preco zero. Quando ativado, mostra confirmacao e permite criar. O sistema nao lanca financeiro a receber, mas lanca a pagar se houver valor fixo do tecnico.",
        type: "toggle",
      },
    ],
  },
  {
    key: "financial",
    title: "Financeiro",
    icon: "💰",
    description: "Regras de lancamentos financeiros",
    fields: [
      {
        section: "financial",
        key: "autoGenerateReceivable",
        label: "Gerar lancamento A Receber",
        description: "Cria automaticamente o lancamento a receber do cliente ao finalizar a OS",
        type: "toggle",
      },
      {
        section: "financial",
        key: "autoGeneratePayable",
        label: "Gerar lancamento A Pagar",
        description: "Cria automaticamente o lancamento a pagar do tecnico ao finalizar a OS",
        type: "toggle",
      },
      {
        section: "financial",
        key: "defaultDueDays",
        label: "Prazo padrao de vencimento (dias)",
        description: "Quantidade de dias apos a aprovacao para o vencimento do lancamento financeiro",
        type: "number",
      },
    ],
  },
  {
    key: "notifications",
    title: "Notificacoes",
    icon: "🔔",
    description: "Controle de envio de notificacoes",
    fields: [
      {
        section: "notifications",
        key: "emailOnNewOrder",
        label: "E-mail ao criar OS",
        description: "Envia e-mail para o tecnico quando uma nova OS e criada e atribuida",
        type: "toggle",
      },
      {
        section: "notifications",
        key: "emailOnStatusChange",
        label: "E-mail ao mudar status",
        description: "Envia e-mail quando o status da OS muda (ex: atribuida, concluida)",
        type: "toggle",
      },
      {
        section: "notifications",
        key: "pushEnabled",
        label: "Notificacoes push",
        description: "Ativar notificacoes push no navegador/PWA do tecnico",
        type: "toggle",
      },
    ],
  },
  {
    key: "quotes",
    title: "Orcamentos",
    icon: "📝",
    description: "Configuracoes de orcamentos",
    fields: [
      {
        section: "quotes",
        key: "showProductValue",
        label: "Campo Valor de Produtos",
        description: "Exibe campo para informar o valor dos produtos/materiais no orcamento. O valor e somado ao total.",
        type: "toggle",
      },
      {
        section: "quotes",
        key: "showPartnerQuotes",
        label: "Orcamentos de Parceiros",
        description: "Permite anexar PDFs de orcamentos de lojas parceiras (materiais, equipamentos) ao orcamento.",
        type: "toggle",
      },
    ],
  },
  {
    key: "evaluation",
    title: "Avaliacao",
    icon: "⭐",
    description: "Configuracoes de avaliacao e aprovacao",
    fields: [
      {
        section: "evaluation",
        key: "requireGestorApproval",
        label: "Exigir aprovacao do gestor",
        description: "O gestor deve avaliar e aprovar a OS antes de ser considerada finalizada",
        type: "toggle",
      },
      {
        section: "evaluation",
        key: "sendClientEvalLink",
        label: "Enviar link de avaliacao ao cliente",
        description: "Apos a OS ser concluida, envia automaticamente um link para o cliente avaliar o tecnico",
        type: "toggle",
      },
    ],
  },
  {
    key: "clt",
    title: "Jornada CLT",
    icon: "⏰",
    description: "Regras trabalhistas para tecnicos CLT",
    fields: [
      {
        section: "clt",
        key: "enabled",
        label: "Ativar controle CLT",
        description: "Habilita registro de ponto, alertas de jornada e controle de pausas obrigatorias",
        type: "toggle",
      },
      {
        section: "clt",
        key: "alertMealBreak4h",
        label: "Alerta pausa refeicao (4h)",
        description: "Alerta o tecnico e notifica o gestor quando atingir 4h sem pausa de refeicao",
        type: "toggle",
      },
      {
        section: "clt",
        key: "alertJourney8h",
        label: "Alerta jornada diaria (8h)",
        description: "Alerta quando o tecnico atingir 8h de trabalho no dia",
        type: "toggle",
      },
      {
        section: "clt",
        key: "alertOvertime",
        label: "Registrar hora extra automaticamente",
        description: "Registra como hora extra o tempo trabalhado alem da jornada diaria",
        type: "toggle",
      },
      {
        section: "clt",
        key: "alertInterjourneyInterval",
        label: "Alerta intervalo interjornada (11h)",
        description: "Alerta ao atribuir OS se o tecnico trabalhou menos de 11h atras",
        type: "toggle",
      },
      {
        section: "clt",
        key: "journeyHoursDaily",
        label: "Jornada diaria (horas)",
        description: "Quantidade de horas da jornada normal de trabalho",
        type: "number",
      },
      {
        section: "clt",
        key: "mealBreakMinMinutes",
        label: "Pausa refeicao minima (minutos)",
        description: "Duracao minima obrigatoria da pausa para refeicao",
        type: "number",
      },
    ],
  },
];

export default function SystemConfigPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api.get<SystemConfig>("/companies/system-config")
      .then((data) => setConfig(data))
      .catch(() => toast("Erro ao carregar configuracoes", "error"))
      .finally(() => setLoading(false));
  }, []);

  function getValue(section: string, key: string): any {
    if (!config) return false;
    return (config as any)[section]?.[key] ?? false;
  }

  function setValue(section: string, key: string, value: any) {
    if (!config) return;
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: {
          ...prev[section as keyof SystemConfig],
          [key]: value,
        },
      } as SystemConfig;
    });
    setDirty(true);
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      const updated = await api.patch<SystemConfig>("/companies/system-config", config);
      setConfig(updated);
      setDirty(false);
      toast("Configuracoes salvas com sucesso!", "success");
    } catch {
      toast("Erro ao salvar configuracoes", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => router.push("/settings")}
              className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-slate-800">Configuracoes do Sistema</h1>
          </div>
          <p className="text-sm text-slate-500 ml-7">
            Controle o comportamento geral do sistema
          </p>
        </div>
        {dirty && (
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? (
              <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Salvando...</>
            ) : "Salvar"}
          </button>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {SECTIONS.map((section) => (
          <div key={section.key} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Section header */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-base">{section.icon}</span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">{section.title}</h3>
                  <p className="text-[11px] text-slate-500">{section.description}</p>
                </div>
              </div>
            </div>

            {/* Fields */}
            <div className="divide-y divide-slate-100">
              {section.fields.map((field) => (
                <div key={field.key} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm font-medium text-slate-700">{field.label}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{field.description}</p>
                  </div>

                  {field.type === "toggle" ? (
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={getValue(field.section, field.key) === true}
                        onChange={(e) => setValue(field.section, field.key, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  ) : field.type === "number" ? (
                    <input
                      type="number"
                      value={getValue(field.section, field.key) || 0}
                      onChange={(e) => setValue(field.section, field.key, parseInt(e.target.value) || 0)}
                      min={0}
                      max={365}
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm text-center focus:outline-none focus:border-blue-300"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Info footer */}
      <div className="mt-6 rounded-lg bg-slate-50 border border-slate-200 p-4">
        <p className="text-[11px] text-slate-400">
          Estas configuracoes afetam o comportamento do sistema para toda a empresa.
          Alteracoes sao aplicadas imediatamente apos salvar.
        </p>
      </div>
    </div>
  );
}
