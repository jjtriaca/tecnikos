"use client";
// Tela de configuracao de tarifas de energia (Simulador de Aquecimento — F3).
// Singleton por tenant — uma tarifa ativa por vez, historico no backend via validFrom/validTo.

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface Tariff {
  id?: string;
  kwhBRLCents: number;
  glpKgBRLCents: number;
  gnM3BRLCents: number;
  isDefault?: boolean;
}

export default function EnergyTariffPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tariff, setTariff] = useState<Tariff | null>(null);

  // State edicao (em REAIS, nao centavos — converte na hora de salvar)
  const [kwhBRL, setKwhBRL] = useState<string>("");
  const [glpBRL, setGlpBRL] = useState<string>("");
  const [gnBRL, setGnBRL] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    api.get<Tariff>("/settings/energy-tariff")
      .then((t) => {
        setTariff(t);
        setKwhBRL((t.kwhBRLCents / 100).toFixed(2));
        setGlpBRL((t.glpKgBRLCents / 100).toFixed(2));
        setGnBRL((t.gnM3BRLCents / 100).toFixed(2));
      })
      .catch((e) => toast({ type: "error", message: String(e?.message ?? e) }))
      .finally(() => setLoading(false));
  }, [toast]);

  async function handleSave() {
    const kwh = Math.round(Number(kwhBRL.replace(",", ".")) * 100);
    const glp = Math.round(Number(glpBRL.replace(",", ".")) * 100);
    const gn = Math.round(Number(gnBRL.replace(",", ".")) * 100);
    if (!kwh || !glp || !gn) {
      toast({ type: "error", message: "Preencha as 3 tarifas com valores maiores que zero." });
      return;
    }
    setSaving(true);
    try {
      const saved = await api.put<Tariff>("/settings/energy-tariff", {
        kwhBRLCents: kwh,
        glpKgBRLCents: glp,
        gnM3BRLCents: gn,
      });
      setTariff({ ...saved, isDefault: false });
      toast({ type: "success", message: "Tarifas salvas com sucesso." });
    } catch (e: any) {
      toast({ type: "error", message: String(e?.message ?? e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">⚡ Tarifas de Energia</h1>
        <p className="mt-1 text-sm text-slate-600">
          Valores usados pelo Simulador de Aquecimento pra calcular custo mensal e comparativo
          de fontes (GLP / Gas Natural / Eletrico vs Bomba de Calor).
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Carregando...</div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {tariff?.isDefault && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900">
              ⚠ Nenhuma tarifa cadastrada — exibindo defaults do sistema. Salve seus valores reais
              pra precisao no calculo.
            </div>
          )}

          <div className="p-6 space-y-4">
            <TariffField
              label="Energia eletrica"
              unit="R$ / kWh"
              hint="Tarifa media residencial. Padrao: R$ 1.15/kWh."
              value={kwhBRL}
              onChange={setKwhBRL}
            />
            <TariffField
              label="Gas GLP (botijao)"
              unit="R$ / Kg"
              hint="GLP em botijao P13 — divida o preco do botijao por 13. Padrao: R$ 8.50/Kg."
              value={glpBRL}
              onChange={setGlpBRL}
            />
            <TariffField
              label="Gas Natural (encanado)"
              unit="R$ / m³"
              hint="Tarifa do GN encanado. Padrao: R$ 8.50/m³."
              value={gnBRL}
              onChange={setGnBRL}
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
            <button onClick={handleSave} disabled={saving}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition">
              {saving ? "Salvando..." : "💾 Salvar tarifas"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
        <strong>Como sao usadas:</strong>
        <ul className="mt-1 ml-4 list-disc space-y-0.5">
          <li><strong>R$/kWh</strong>: custo mensal/anual de operacao da bomba de calor</li>
          <li><strong>R$/Kg GLP</strong>: comparativo de quanto custaria com GLP (PCi 11.100 Kcal/Kg, eficiencia 84%)</li>
          <li><strong>R$/m³ GN</strong>: comparativo com gas natural (PCi 8.800 Kcal/m³, eficiencia 70%)</li>
          <li>O comparativo usa essas tarifas pra mostrar quanto o cliente economiza com bomba de calor vs outras fontes</li>
        </ul>
      </div>
    </div>
  );
}

function TariffField({ label, unit, hint, value, onChange }: { label: string; unit: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700">{label}</label>
      <div className="mt-1 flex items-stretch gap-2">
        <div className="flex items-center rounded-lg border border-slate-300 bg-white pl-3 pr-1 focus-within:border-cyan-500">
          <span className="text-sm text-slate-500">R$</span>
          <input type="text" inputMode="decimal" value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))}
            className="w-28 px-2 py-2 text-sm tabular-nums focus:outline-none" placeholder="0,00" />
        </div>
        <div className="flex items-center text-xs text-slate-500">{unit}</div>
      </div>
      <div className="mt-1 text-[11px] text-slate-500">{hint}</div>
    </div>
  );
}
