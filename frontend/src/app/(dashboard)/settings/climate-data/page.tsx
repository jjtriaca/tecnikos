"use client";
// Tela de configuracao de dados climaticos por UF/cidade (Simulador de Aquecimento — Fase 2).
// Cada tenant tem seu proprio conjunto, semeado automaticamente com INMET/Atlas Solarimetrico
// na 1a leitura. Operador pode editar valores, adicionar cidades-polo e restaurar padrao.

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

const MES_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface MonthlyData {
  temp: number[];
  humidity: number[];
  radSol: number[];
}

interface ClimateRow {
  id: string;
  uf: string;
  ufName: string;
  cidade: string | null;
  monthlyData: MonthlyData;
  isCustom: boolean;
  isActive: boolean;
  isSeedAvailable: boolean;
}

type StateGroup = { uf: string; ufName: string; capital?: ClimateRow; cities: ClimateRow[] };

export default function ClimateDataPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ClimateRow[]>([]);
  const [expandedUf, setExpandedUf] = useState<string | null>(null);
  const [editing, setEditing] = useState<ClimateRow | null>(null);
  const [addingCityForUf, setAddingCityForUf] = useState<{ uf: string; ufName: string } | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const data = await api.get<ClimateRow[]>("/settings/climate-data");
      setRows(data);
    } catch (e: any) {
      toast(String(e?.message ?? e), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups: StateGroup[] = useMemo(() => {
    const byUf = new Map<string, StateGroup>();
    for (const r of rows) {
      let g = byUf.get(r.uf);
      if (!g) {
        g = { uf: r.uf, ufName: r.ufName, cities: [] };
        byUf.set(r.uf, g);
      }
      if (r.cidade === null) g.capital = r;
      else g.cities.push(r);
    }
    return Array.from(byUf.values()).sort((a, b) => a.ufName.localeCompare(b.ufName, "pt-BR"));
  }, [rows]);

  async function handleRestoreSeed(row: ClimateRow) {
    if (!confirm(`Restaurar valores padrao INMET pra ${row.ufName}${row.cidade ? " · " + row.cidade : ""}? As alteracoes serao perdidas.`)) return;
    try {
      const updated = await api.post<ClimateRow>(`/settings/climate-data/${row.id}/restore-seed`, {});
      setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
      toast("Valores padrao INMET restaurados.", "success");
    } catch (e: any) {
      toast(String(e?.message ?? e), "error");
    }
  }

  async function handleDeleteCity(row: ClimateRow) {
    if (!confirm(`Remover cidade "${row.cidade}" de ${row.ufName}?`)) return;
    try {
      await api.del(`/settings/climate-data/${row.id}`);
      setRows((rs) => rs.filter((r) => r.id !== row.id));
      toast("Cidade removida.", "success");
    } catch (e: any) {
      toast(String(e?.message ?? e), "error");
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">🌡️ Dados Climaticos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Temperatura, umidade e radiacao solar mensal por estado/cidade. Usados pelo Simulador de
          Aquecimento (Bomba de Calor e Solar) pra calcular perda termica, ganho solar e dimensionar
          equipamentos.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Cada estado tem um <strong>registro padrao (capital)</strong> usado quando nao ha cidade
          especifica. Voce pode <strong>adicionar cidades-polo</strong> com clima proprio (ex: Primavera
          do Leste no MT, Caxias do Sul no RS). Os valores iniciais vem do INMET/Atlas Solarimetrico —
          o botao <strong>Restaurar padrao INMET</strong> reverte alteracoes.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Carregando dados climaticos...</div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => {
            const isExpanded = expandedUf === g.uf;
            return (
              <div key={g.uf} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedUf(isExpanded ? null : g.uf)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-slate-900">{g.uf} · {g.ufName}</span>
                    <span className="text-xs text-slate-500">
                      {g.capital ? `${g.capital.monthlyData.temp.reduce((a, b) => a + b, 0) / 12} °C media` : ""}
                    </span>
                    {g.cities.length > 0 && (
                      <span className="text-[10px] bg-cyan-100 text-cyan-800 rounded-full px-2 py-0.5 font-semibold">
                        +{g.cities.length} cidade{g.cities.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 text-lg">{isExpanded ? "▼" : "▶"}</span>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-3">
                    {g.capital && (
                      <ClimateRowCard row={g.capital} onEdit={setEditing} onRestoreSeed={handleRestoreSeed} />
                    )}
                    {g.cities.map((c) => (
                      <ClimateRowCard
                        key={c.id}
                        row={c}
                        onEdit={setEditing}
                        onRestoreSeed={handleRestoreSeed}
                        onDelete={handleDeleteCity}
                      />
                    ))}
                    <div className="pt-1">
                      <button
                        onClick={() => setAddingCityForUf({ uf: g.uf, ufName: g.ufName })}
                        className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 hover:bg-cyan-50 rounded px-3 py-1.5 border border-dashed border-cyan-300"
                      >
                        + Adicionar cidade especifica em {g.uf}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <ClimateEditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
            setEditing(null);
            toast("Dados climaticos atualizados.", "success");
          }}
        />
      )}

      {addingCityForUf && (
        <AddCityModal
          uf={addingCityForUf.uf}
          ufName={addingCityForUf.ufName}
          baseRow={groups.find((g) => g.uf === addingCityForUf.uf)?.capital}
          onClose={() => setAddingCityForUf(null)}
          onSaved={(created) => {
            setRows((rs) => [...rs, created]);
            setAddingCityForUf(null);
            toast(`Cidade "${created.cidade}" adicionada.`, "success");
          }}
        />
      )}
    </div>
  );
}

function ClimateRowCard({ row, onEdit, onRestoreSeed, onDelete }: {
  row: ClimateRow;
  onEdit: (r: ClimateRow) => void;
  onRestoreSeed: (r: ClimateRow) => void;
  onDelete?: (r: ClimateRow) => void;
}) {
  const avgTemp = (row.monthlyData.temp.reduce((a, b) => a + b, 0) / 12).toFixed(1);
  const avgRad = (row.monthlyData.radSol.reduce((a, b) => a + b, 0) / 12).toFixed(1);
  const avgHum = ((row.monthlyData.humidity.reduce((a, b) => a + b, 0) / 12) * 100).toFixed(0);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">
            {row.cidade ?? `${row.ufName} (padrao do estado)`}
          </span>
          {row.cidade === null && (
            <span className="text-[10px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">capital/padrao</span>
          )}
          {row.isCustom && (
            <span className="text-[10px] bg-amber-100 text-amber-800 rounded px-1.5 py-0.5 font-semibold">customizado</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {row.isCustom && row.isSeedAvailable && (
            <button
              onClick={() => onRestoreSeed(row)}
              className="text-[11px] text-slate-600 hover:text-cyan-700 hover:bg-cyan-50 rounded px-2 py-1 border border-slate-300"
              title="Reverte pros valores INMET originais"
            >
              ↻ Restaurar padrao INMET
            </button>
          )}
          <button
            onClick={() => onEdit(row)}
            className="text-[11px] text-slate-700 hover:text-cyan-700 hover:bg-cyan-50 rounded px-2 py-1 border border-slate-300"
          >
            ✏️ Editar
          </button>
          {onDelete && row.cidade !== null && (
            <button
              onClick={() => onDelete(row)}
              className="text-[11px] text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded px-2 py-1 border border-rose-200"
            >
              🗑️ Remover
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-orange-50 rounded px-2 py-1">
          <div className="text-[10px] text-orange-700 font-semibold">Temp media</div>
          <div className="font-bold text-orange-900">{avgTemp} °C</div>
        </div>
        <div className="bg-amber-50 rounded px-2 py-1">
          <div className="text-[10px] text-amber-700 font-semibold">Rad solar media</div>
          <div className="font-bold text-amber-900">{avgRad} kWh/m²/dia</div>
        </div>
        <div className="bg-blue-50 rounded px-2 py-1">
          <div className="text-[10px] text-blue-700 font-semibold">Umidade media</div>
          <div className="font-bold text-blue-900">{avgHum}%</div>
        </div>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="text-[11px] tabular-nums w-full">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left pr-2 font-medium">Mes</th>
              {MES_LABELS.map((m) => <th key={m} className="px-1 font-medium">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-orange-700 font-semibold pr-2">Temp °C</td>
              {row.monthlyData.temp.map((v, i) => <td key={i} className="px-1 text-center">{v.toFixed(1)}</td>)}
            </tr>
            <tr>
              <td className="text-amber-700 font-semibold pr-2">Rad kWh</td>
              {row.monthlyData.radSol.map((v, i) => <td key={i} className="px-1 text-center">{v.toFixed(1)}</td>)}
            </tr>
            <tr>
              <td className="text-blue-700 font-semibold pr-2">Umid %</td>
              {row.monthlyData.humidity.map((v, i) => <td key={i} className="px-1 text-center">{Math.round(v * 100)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClimateEditModal({ row, onClose, onSaved }: {
  row: ClimateRow;
  onClose: () => void;
  onSaved: (r: ClimateRow) => void;
}) {
  const [temp, setTemp] = useState<string[]>(row.monthlyData.temp.map((v) => v.toFixed(1)));
  const [radSol, setRadSol] = useState<string[]>(row.monthlyData.radSol.map((v) => v.toFixed(1)));
  const [humidity, setHumidity] = useState<string[]>(row.monthlyData.humidity.map((v) => (v * 100).toFixed(0)));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const tempArr = temp.map((v) => parseFloat(v.replace(",", ".")));
    const radArr = radSol.map((v) => parseFloat(v.replace(",", ".")));
    const humArr = humidity.map((v) => parseFloat(v.replace(",", ".")) / 100);
    if (tempArr.some((v) => isNaN(v)) || radArr.some((v) => isNaN(v) || v < 0 || v > 15) || humArr.some((v) => isNaN(v) || v < 0 || v > 1)) {
      alert("Valores invalidos. Temp: numero. Rad: 0-15 kWh/m²/dia. Umidade: 0-100%.");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.patch<ClimateRow>(`/settings/climate-data/${row.id}`, {
        monthlyData: { temp: tempArr, humidity: humArr, radSol: radArr },
      });
      onSaved(updated);
    } catch (e: any) {
      alert(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-orange-50 to-amber-50">
          <h2 className="text-lg font-bold text-slate-900">
            Editar clima — {row.uf} · {row.cidade ?? `${row.ufName} (padrao do estado)`}
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Marca o registro como <strong>customizado</strong>. Use o botao "Restaurar padrao INMET" pra voltar.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <MonthlyRow label="Temperatura (°C)" color="orange" values={temp} onChange={setTemp} hint="Temperatura ambiente media mensal" />
          <MonthlyRow label="Radiacao solar (kWh/m²/dia)" color="amber" values={radSol} onChange={setRadSol} hint="Energia solar incidente media diaria — INMET/Atlas Solarimetrico" />
          <MonthlyRow label="Umidade relativa (%)" color="blue" values={humidity} onChange={setHumidity} hint="Umidade relativa media — afeta perda termica por evaporacao" />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 transition">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700 disabled:bg-slate-300 transition">
            {saving ? "Salvando..." : "💾 Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddCityModal({ uf, ufName, baseRow, onClose, onSaved }: {
  uf: string;
  ufName: string;
  baseRow: ClimateRow | undefined;
  onClose: () => void;
  onSaved: (r: ClimateRow) => void;
}) {
  const [cidade, setCidade] = useState("");
  const [temp, setTemp] = useState<string[]>(
    baseRow ? baseRow.monthlyData.temp.map((v) => v.toFixed(1)) : Array(12).fill("25.0"),
  );
  const [radSol, setRadSol] = useState<string[]>(
    baseRow ? baseRow.monthlyData.radSol.map((v) => v.toFixed(1)) : Array(12).fill("5.0"),
  );
  const [humidity, setHumidity] = useState<string[]>(
    baseRow ? baseRow.monthlyData.humidity.map((v) => (v * 100).toFixed(0)) : Array(12).fill("70"),
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!cidade.trim()) { alert("Informe o nome da cidade."); return; }
    const tempArr = temp.map((v) => parseFloat(v.replace(",", ".")));
    const radArr = radSol.map((v) => parseFloat(v.replace(",", ".")));
    const humArr = humidity.map((v) => parseFloat(v.replace(",", ".")) / 100);
    if (tempArr.some((v) => isNaN(v)) || radArr.some((v) => isNaN(v) || v < 0 || v > 15) || humArr.some((v) => isNaN(v) || v < 0 || v > 1)) {
      alert("Valores invalidos."); return;
    }
    setSaving(true);
    try {
      const created = await api.post<ClimateRow>("/settings/climate-data/custom-city", {
        uf, cidade: cidade.trim(),
        monthlyData: { temp: tempArr, humidity: humArr, radSol: radArr },
      });
      onSaved(created);
    } catch (e: any) {
      alert(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-cyan-50 to-blue-50">
          <h2 className="text-lg font-bold text-slate-900">+ Adicionar cidade em {uf} · {ufName}</h2>
          <p className="text-xs text-slate-600 mt-1">
            Valores iniciais copiados do registro padrao do estado. Ajuste conforme dados locais.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700">Nome da cidade</label>
            <input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)}
              placeholder="Ex: Primavera do Leste"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 outline-none" />
          </div>
          <MonthlyRow label="Temperatura (°C)" color="orange" values={temp} onChange={setTemp} hint="Temperatura ambiente media mensal" />
          <MonthlyRow label="Radiacao solar (kWh/m²/dia)" color="amber" values={radSol} onChange={setRadSol} hint="Energia solar incidente media diaria" />
          <MonthlyRow label="Umidade relativa (%)" color="blue" values={humidity} onChange={setHumidity} hint="Umidade relativa media" />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 transition">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700 disabled:bg-slate-300 transition">
            {saving ? "Salvando..." : "💾 Adicionar cidade"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MonthlyRow({ label, color, values, onChange, hint }: {
  label: string;
  color: "orange" | "amber" | "blue";
  values: string[];
  onChange: (v: string[]) => void;
  hint?: string;
}) {
  const colorClass: Record<string, string> = {
    orange: "text-orange-700 border-orange-200 bg-orange-50",
    amber: "text-amber-700 border-amber-200 bg-amber-50",
    blue: "text-blue-700 border-blue-200 bg-blue-50",
  };
  return (
    <div className="mb-4">
      <label className={`block text-sm font-semibold ${colorClass[color].split(" ")[0]}`}>{label}</label>
      {hint && <p className="text-[11px] text-slate-500 mb-1">{hint}</p>}
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
        {MES_LABELS.map((m, i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="text-[10px] text-slate-500">{m}</span>
            <input
              type="text"
              inputMode="decimal"
              value={values[i]}
              onChange={(e) => {
                const next = [...values];
                next[i] = e.target.value.replace(/[^0-9.,-]/g, "");
                onChange(next);
              }}
              className={`w-full text-center text-xs tabular-nums rounded border ${colorClass[color]} px-1 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-500`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
