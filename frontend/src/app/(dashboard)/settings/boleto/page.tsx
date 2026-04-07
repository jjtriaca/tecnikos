"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";

/* ===================================================================
   BOLETO SETTINGS — Configuracao de emissao de boletos bancarios
   =================================================================== */

interface SupportedBank {
  code: string;
  name: string;
  fields: BankConfigField[];
}

interface BankConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "file" | "select" | "number";
  required: boolean;
  helpText?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  group?: string;
}

interface DetectedAccount {
  id: string;
  name: string;
  bankCode: string | null;
  bankName: string | null;
  supported: boolean;
}

interface BoletoConfig {
  id?: string;
  bankCode: string;
  bankName: string;
  cashAccountId: string | null;
  clientId: string | null;
  clientSecret: string | null;
  apiKey: string | null;
  certificateBase64: string | null;
  certificatePassword: string | null;
  bankSpecificConfig: Record<string, any> | null;
  environment: string;
  convenio: string | null;
  carteira: string | null;
  especie: string;
  especieDoc: string;
  aceite: string;
  defaultInterestType: string | null;
  defaultInterestValue: number | null;
  defaultPenaltyPercent: number | null;
  defaultDiscountType: string | null;
  defaultDiscountValue: number | null;
  defaultDiscountDaysBefore: number | null;
  defaultInstructions1: string | null;
  defaultInstructions2: string | null;
  defaultInstructions3: string | null;
  autoRegisterOnEntry: boolean;
  isActive: boolean;
  cashAccount?: { id: string; name: string; bankCode: string; bankName: string } | null;
}

const EMPTY_CONFIG: Partial<BoletoConfig> = {
  bankCode: "",
  bankName: "",
  cashAccountId: null,
  clientId: null,
  clientSecret: null,
  apiKey: null,
  certificateBase64: null,
  certificatePassword: null,
  bankSpecificConfig: null,
  environment: "SANDBOX",
  convenio: null,
  carteira: null,
  especie: "R$",
  especieDoc: "DM",
  aceite: "N",
  defaultInterestType: null,
  defaultInterestValue: null,
  defaultPenaltyPercent: null,
  defaultDiscountType: null,
  defaultDiscountValue: null,
  defaultDiscountDaysBefore: null,
  defaultInstructions1: null,
  defaultInstructions2: null,
  defaultInstructions3: null,
  autoRegisterOnEntry: false,
  isActive: true,
};

export default function BoletoSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  const [config, setConfig] = useState<Partial<BoletoConfig>>(EMPTY_CONFIG);
  const [banks, setBanks] = useState<SupportedBank[]>([]);
  const [detectedAccounts, setDetectedAccounts] = useState<DetectedAccount[]>([]);

  const selectedBank = banks.find((b) => b.code === config.bankCode);

  const load = useCallback(async () => {
    try {
      const [banksRes, configRes, detectRes] = await Promise.all([
        api.get<SupportedBank[]>("/boleto/supported-banks"),
        api.get<BoletoConfig | null>("/boleto/config"),
        api.get<DetectedAccount[]>("/boleto/detect-bank"),
      ]);
      setBanks(banksRes || []);
      setDetectedAccounts(detectRes || []);
      if (configRes) {
        setConfig(configRes);
      }
    } catch {
      // Config pode nao existir ainda
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!config.bankCode || !config.bankName) {
      toast("Selecione um banco", "error");
      return;
    }
    setSaving(true);
    try {
      const saved = await api.put<BoletoConfig>("/boleto/config", config);
      setConfig(saved);
      toast("Configuração salva com sucesso", "success");
      setTestResult(null);
    } catch (err: any) {
      toast(err?.message || "Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.post<{ valid: boolean; message: string }>("/boleto/config/test-connection");
      setTestResult(result);
      toast(result.valid ? "Conexão OK!" : result.message, result.valid ? "success" : "error");
    } catch (err: any) {
      setTestResult({ valid: false, message: err?.message || "Erro ao testar" });
      toast("Erro ao testar conexão", "error");
    } finally {
      setTesting(false);
    }
  };

  const handleBankChange = (code: string) => {
    const bank = banks.find((b) => b.code === code);
    if (!bank) return;

    // Auto-detect cash account
    const matchingAccount = detectedAccounts.find((a) => a.bankCode === code);

    setConfig((prev) => ({
      ...prev,
      bankCode: code,
      bankName: bank.name,
      cashAccountId: matchingAccount?.id || prev.cashAccountId,
      // Reset credentials when changing bank
      clientId: null,
      clientSecret: null,
      apiKey: null,
      certificateBase64: null,
      certificatePassword: null,
      bankSpecificConfig: null,
    }));
    setTestResult(null);
  };

  const updateField = (key: string, value: any) => {
    // Handle nested bankSpecificConfig fields
    if (key.startsWith("bankSpecificConfig.")) {
      const subKey = key.replace("bankSpecificConfig.", "");
      setConfig((prev) => ({
        ...prev,
        bankSpecificConfig: { ...(prev.bankSpecificConfig || {}), [subKey]: value },
      }));
    } else {
      setConfig((prev) => ({ ...prev, [key]: value }));
    }
  };

  const handleFileField = (key: string, file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1] || (reader.result as string);
      updateField(key, base64);
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="h-64 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-bold text-slate-800 mb-1">Boleto Bancário</h1>
      <p className="text-sm text-slate-500 mb-6">
        Configure a emissão de boletos para cobrar seus clientes diretamente pelo seu banco.
      </p>

      {/* ========== STEP 1: SELECAO DE BANCO ========== */}
      <section className="bg-white rounded-lg border border-slate-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">1. Selecione o Banco</h2>

        <div className="grid grid-cols-2 gap-3">
          {banks.map((bank) => {
            const detected = detectedAccounts.find((a) => a.bankCode === bank.code);
            return (
              <button
                key={bank.code}
                onClick={() => handleBankChange(bank.code)}
                className={`text-left p-3 rounded-lg border-2 transition-colors ${
                  config.bankCode === bank.code
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="font-medium text-sm text-slate-800">{bank.name}</div>
                <div className="text-xs text-slate-500">Código: {bank.code}</div>
                {detected && (
                  <div className="text-xs text-green-600 mt-1">
                    ✓ Conta detectada: {detected.name}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Conta bancaria vinculada */}
        {detectedAccounts.length > 0 && config.bankCode && (
          <div className="mt-3">
            <label className="text-xs text-slate-600 block mb-1">Conta bancária vinculada</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={config.cashAccountId || ""}
              onChange={(e) => updateField("cashAccountId", e.target.value || null)}
            >
              <option value="">Nenhuma</option>
              {detectedAccounts
                .filter((a) => !config.bankCode || a.bankCode === config.bankCode)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.bankName})
                  </option>
                ))}
            </select>
          </div>
        )}
      </section>

      {/* ========== STEP 2: CREDENCIAIS ========== */}
      {selectedBank && (
        <section className="bg-white rounded-lg border border-slate-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">2. Credenciais {selectedBank.name}</h2>

          {/* Ambiente */}
          <div className="mb-4">
            <label className="text-xs text-slate-600 block mb-1">Ambiente</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={config.environment || "SANDBOX"}
              onChange={(e) => updateField("environment", e.target.value)}
            >
              <option value="SANDBOX">Sandbox (testes)</option>
              <option value="PRODUCTION">Produção</option>
            </select>
          </div>

          <div className="space-y-3">
            {selectedBank.fields.map((field) => (
              <div key={field.key}>
                <label className="text-xs text-slate-600 block mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {field.type === "select" ? (
                  <select
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={getNestedValue(config, field.key) || ""}
                    onChange={(e) => updateField(field.key, e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "file" ? (
                  <div>
                    <input
                      type="file"
                      className="text-sm"
                      onChange={(e) => handleFileField(field.key, e.target.files?.[0] || null)}
                    />
                    {getNestedValue(config, field.key) && (
                      <span className="text-xs text-green-600 ml-2">✓ Arquivo carregado</span>
                    )}
                  </div>
                ) : (
                  <input
                    type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder={field.placeholder || ""}
                    value={getNestedValue(config, field.key) || ""}
                    onChange={(e) =>
                      updateField(field.key, field.type === "number" ? parseFloat(e.target.value) || null : e.target.value)
                    }
                  />
                )}

                {field.helpText && <p className="text-xs text-slate-400 mt-1">{field.helpText}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ========== STEP 3: TESTAR CONEXAO ========== */}
      {config.bankCode && config.id && (
        <section className="bg-white rounded-lg border border-slate-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">3. Testar Conexão</h2>
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 bg-slate-700 text-white rounded text-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {testing ? "Testando..." : "Testar Conexão"}
          </button>
          {testResult && (
            <div
              className={`mt-3 p-3 rounded text-sm ${
                testResult.valid ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {testResult.valid ? "✓ " : "✕ "}
              {testResult.message}
            </div>
          )}
        </section>
      )}

      {/* ========== STEP 4: DEFAULTS ========== */}
      {config.bankCode && (
        <section className="bg-white rounded-lg border border-slate-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">4. Configurações Padrão do Boleto</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-600 block mb-1">Espécie do Documento</label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={config.especieDoc || "DM"}
                onChange={(e) => updateField("especieDoc", e.target.value)}
              >
                <option value="DM">DM - Duplicata Mercantil</option>
                <option value="DS">DS - Duplicata de Serviço</option>
                <option value="NP">NP - Nota Promissória</option>
                <option value="RC">RC - Recibo</option>
                <option value="OU">OU - Outros</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-600 block mb-1">Aceite</label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={config.aceite || "N"}
                onChange={(e) => updateField("aceite", e.target.value)}
              >
                <option value="N">N - Não</option>
                <option value="S">S - Sim</option>
              </select>
            </div>
          </div>

          {/* Juros */}
          <h3 className="text-xs font-semibold text-slate-600 mt-4 mb-2">Juros por Atraso</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-600 block mb-1">Tipo de Juros</label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={config.defaultInterestType || ""}
                onChange={(e) => updateField("defaultInterestType", e.target.value || null)}
              >
                <option value="">Sem juros</option>
                <option value="VALOR_DIA">Valor fixo por dia (R$)</option>
                <option value="PERCENTUAL_MES">Percentual ao mês (%)</option>
              </select>
            </div>
            {config.defaultInterestType && (
              <div>
                <label className="text-xs text-slate-600 block mb-1">
                  {config.defaultInterestType === "VALOR_DIA" ? "Valor por dia (R$)" : "Taxa mensal (%)"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={config.defaultInterestValue ?? ""}
                  onChange={(e) => updateField("defaultInterestValue", parseFloat(e.target.value) || null)}
                  placeholder={config.defaultInterestType === "VALOR_DIA" ? "1.00" : "2.0"}
                />
              </div>
            )}
          </div>

          {/* Multa */}
          <h3 className="text-xs font-semibold text-slate-600 mt-4 mb-2">Multa por Atraso</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-600 block mb-1">Multa (%)</label>
              <input
                type="number"
                step="0.1"
                className="w-full border rounded px-3 py-2 text-sm"
                value={config.defaultPenaltyPercent ?? ""}
                onChange={(e) => updateField("defaultPenaltyPercent", parseFloat(e.target.value) || null)}
                placeholder="2.0"
              />
            </div>
          </div>

          {/* Desconto */}
          <h3 className="text-xs font-semibold text-slate-600 mt-4 mb-2">Desconto por Antecipação</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-600 block mb-1">Tipo de Desconto</label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={config.defaultDiscountType || ""}
                onChange={(e) => updateField("defaultDiscountType", e.target.value || null)}
              >
                <option value="">Sem desconto</option>
                <option value="VALOR_FIXO">Valor fixo (R$)</option>
                <option value="PERCENTUAL">Percentual (%)</option>
              </select>
            </div>
            {config.defaultDiscountType && (
              <>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">
                    {config.defaultDiscountType === "VALOR_FIXO" ? "Valor (R$)" : "Percentual (%)"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={config.defaultDiscountValue ?? ""}
                    onChange={(e) => updateField("defaultDiscountValue", parseFloat(e.target.value) || null)}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">Dias antes do vencimento</label>
                  <input
                    type="number"
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={config.defaultDiscountDaysBefore ?? ""}
                    onChange={(e) => updateField("defaultDiscountDaysBefore", parseInt(e.target.value) || null)}
                    placeholder="5"
                  />
                </div>
              </>
            )}
          </div>

          {/* Instrucoes */}
          <h3 className="text-xs font-semibold text-slate-600 mt-4 mb-2">Instruções Impressas no Boleto</h3>
          <div className="space-y-2">
            {[1, 2, 3].map((n) => (
              <input
                key={n}
                type="text"
                className="w-full border rounded px-3 py-2 text-sm"
                value={(config as any)[`defaultInstructions${n}`] || ""}
                onChange={(e) => updateField(`defaultInstructions${n}`, e.target.value || null)}
                placeholder={
                  n === 1
                    ? "Ex: Não receber após o vencimento"
                    : n === 2
                    ? "Ex: Cobrar multa de 2% após vencimento"
                    : "Ex: Cobrar juros de 1% ao mês"
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* ========== STEP 5: COMPORTAMENTO ========== */}
      {config.bankCode && (
        <section className="bg-white rounded-lg border border-slate-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">5. Comportamento</h2>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoRegisterOnEntry || false}
              onChange={(e) => updateField("autoRegisterOnEntry", e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-500"
            />
            <span className="text-sm text-slate-700">Registrar boleto automaticamente ao criar lançamento a receber</span>
          </label>
          <p className="text-xs text-slate-400 ml-6 mt-1">
            Quando ativado, boletos serão gerados e registrados no banco automaticamente para cada parcela de lançamentos RECEIVABLE.
          </p>
        </section>
      )}

      {/* ========== BOTAO SALVAR ========== */}
      {config.bankCode && (
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar Configuração"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Helper: pegar valor de campo nested (ex: "bankSpecificConfig.cooperativa") */
function getNestedValue(obj: any, key: string): any {
  if (key.startsWith("bankSpecificConfig.")) {
    const subKey = key.replace("bankSpecificConfig.", "");
    return obj?.bankSpecificConfig?.[subKey] || "";
  }
  return obj?.[key] ?? "";
}
