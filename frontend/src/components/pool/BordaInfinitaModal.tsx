"use client";

// Sistema de Borda Infinita — modal multi-linha (estilo "Dimensoes"): o operador
// adiciona linhas MASTER (cisterna principal) e SLAVE (borda). Calcula ao vivo via
// POST /pool-budgets/borda-infinita/simulate: DN do tubo de gravidade (Manning),
// volume do reservatorio + ALERTA do master, e os totais (vazao/volume/evaporacao).
//
// CONTROLADO: recebe as linhas (initialLines) + contexto da piscina (area/volume) e
// devolve as linhas via onSave(lines, bathers). NAO persiste sozinho — o pai decide
// (form da pagina de edicao salva junto; pagina de detalhe faz PUT). Assim funciona
// tanto na tela de edicao do orcamento quanto na de detalhe, sem conflito de estado.
// Ver memory/plano_sistema_borda_infinita.md.

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

type Captacao = "RESERVATORIO" | "CANALETA" | "DIRETO";

export interface BordaLine {
  tipo: "MASTER" | "SLAVE";
  // SLAVE — lamina
  bordaLengthM?: number;
  alturaQuedaM?: number;
  filmeMm?: number;
  horasDia?: number;
  // SLAVE — captacao
  captacao?: Captacao;
  reservComprM?: number;
  reservLargM?: number;
  reservProfM?: number;
  reservAberto?: boolean;
  canaletaComprM?: number;
  ralosQty?: number;
  raloDiamMm?: number;
  canaletaAberta?: boolean;
  // SLAVE — tubo de gravidade
  tuboComprimentoM?: number;
  curvas90Qty?: number;
  tuboDesnivelM?: number;
  // MASTER
  masterComprM?: number;
  masterLargM?: number;
  masterProfM?: number;
  masterAberto?: boolean;
  masterIsTanqueOndeCai?: boolean;
}

interface LineResult {
  index: number;
  tipo: "MASTER" | "SLAVE";
  captacao?: Captacao;
  transbordoM3h?: number;
  reservatorioVolumeM3?: number;
  tubo?: {
    diametroMm: number;
    fillPercentReal: number;
    velocidadeMs: number;
    caimentoPct: number;
    capacidadeM3hNoAlvo: number;
    suficiente: boolean;
    aviso: string | null;
  } | null;
  masterVolume?: MasterVol;
  aviso?: string | null;
}
interface MasterVol {
  recomendadoM3: number;
  minimoM3: number;
  actualM3: number | null;
  pctDoVolumePiscina: number | null;
  status: "OK" | "BAIXO" | "ALTO" | "SEM_DADO";
  aviso: string | null;
}
interface BordaReport {
  lines: LineResult[];
  totals: {
    bordaTotalLengthM: number;
    vazaoTransbordoTotalM3h: number;
    vazaoBombaSugeridaM3h: number;
    volumeTermicoExtraM3: number;
    areaEvaporacaoExtraM2: number;
  };
  master: MasterVol | null;
  avisos: string[];
}

const parseNum = (v: string): number | undefined => (v === "" ? undefined : Number(v));

const INPUT_CLS =
  "w-full rounded-lg border border-slate-300 px-2 py-1 text-sm tabular-nums focus:border-blue-400 focus:outline-none disabled:bg-slate-100";
const LBL_CLS = "block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5";

const STATUS_COLOR: Record<MasterVol["status"], string> = {
  OK: "bg-emerald-100 text-emerald-800 border-emerald-200",
  BAIXO: "bg-red-100 text-red-800 border-red-200",
  ALTO: "bg-amber-100 text-amber-800 border-amber-200",
  SEM_DADO: "bg-slate-100 text-slate-600 border-slate-200",
};

function defaultLines(): BordaLine[] {
  return [
    { tipo: "SLAVE", captacao: "RESERVATORIO", filmeMm: 6, horasDia: 24 },
    { tipo: "MASTER" },
  ];
}

// NB: Num/Toggle/Stat ficam em NIVEL DE MODULO (NAO dentro do componente). Se
// definidos dentro, cada render recria a funcao -> React remonta o <input> ->
// o campo PERDE O FOCO a cada tecla. O modo read-only vem de <fieldset disabled>.
function Num({ label, val, on, step = "0.01", ph = "" }: { label: string; val?: number; on: (v?: number) => void; step?: string; ph?: string }) {
  return (
    <label className="block">
      <span className={LBL_CLS}>{label}</span>
      <input type="number" step={step} className={INPUT_CLS} value={val ?? ""} placeholder={ph} onChange={(e) => on(parseNum(e.target.value))} />
    </label>
  );
}
function Toggle({ label, checked, on }: { label: string; checked?: boolean; on: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
      <input type="checkbox" checked={!!checked} onChange={(e) => on(e.target.checked)} className="rounded border-slate-300" />
      {label}
    </label>
  );
}
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-base font-bold text-slate-800 tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-slate-400">{hint}</div>}
    </div>
  );
}

export function BordaInfinitaModal({
  open,
  onClose,
  poolAreaM2 = 0,
  poolVolumeM3 = 0,
  initialLines,
  initialBathers,
  onSave,
  locked = false,
}: {
  open: boolean;
  onClose: () => void;
  poolAreaM2?: number;
  poolVolumeM3?: number;
  initialLines?: BordaLine[];
  initialBathers?: number;
  onSave?: (lines: BordaLine[], bathers?: number) => void | Promise<void>;
  locked?: boolean;
}) {
  const [lines, setLines] = useState<BordaLine[]>(defaultLines());
  const [nBathers, setNBathers] = useState<number | undefined>(undefined);
  const [report, setReport] = useState<BordaReport | null>(null);
  const [computing, setComputing] = useState(false);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carrega as linhas ao ABRIR (so depende de `open` pra nao resetar o que o
  // usuario digita quando o pai re-renderiza com novo ref de initialLines).
  useEffect(() => {
    if (!open) return;
    setLines(Array.isArray(initialLines) && initialLines.length ? initialLines : defaultLines());
    setNBathers(initialBathers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Recalcula ao vivo (debounced).
  useEffect(() => {
    if (!open) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setComputing(true);
        const res = await api.post<BordaReport>("/pool-budgets/borda-infinita/simulate", {
          poolAreaM2,
          poolVolumeM3: poolVolumeM3 || undefined,
          nBathers: nBathers || undefined,
          lines,
        });
        setReport(res);
      } catch {
        /* erros de calculo ao vivo sao silenciosos */
      } finally {
        setComputing(false);
      }
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [lines, nBathers, open, poolAreaM2, poolVolumeM3]);

  if (!open) return null;

  const set = (idx: number, patch: Partial<BordaLine>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = (tipo: "MASTER" | "SLAVE") =>
    setLines((prev) => [...prev, tipo === "SLAVE" ? { tipo, captacao: "RESERVATORIO", filmeMm: 6, horasDia: 24 } : { tipo }]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const resultFor = (idx: number) => report?.lines?.find((r) => r.index === idx);

  async function save() {
    if (locked) return;
    try {
      setSaving(true);
      await onSave?.(lines, nBathers);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-cyan-50 to-blue-50 px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">🌊 Sistema de Borda Infinita</h2>
            <p className="text-xs text-slate-500">
              Piscina: {poolAreaM2.toFixed(1)} m² · {poolVolumeM3.toFixed(1)} m³ {computing && <span className="ml-2 text-blue-500">· calculando…</span>}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0 space-y-3">
            {/* Add buttons */}
            {!locked && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => addLine("SLAVE")} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-700">+ Borda</button>
                <button onClick={() => addLine("MASTER")} className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">+ Reservatório master</button>
              </div>
            )}

            {lines.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">Nenhuma linha. Adicione uma borda e o reservatório master.</p>}

            {/* Lines */}
            {lines.map((line, idx) => {
              const r = resultFor(idx);
              if (line.tipo === "MASTER") {
                const mv = r?.masterVolume ?? report?.master ?? null;
                return (
                  <div key={idx} className="rounded-xl border-l-4 border-indigo-400 border border-slate-200 bg-indigo-50/30 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-bold text-indigo-800">🛢️ Reservatório master (cisterna) — a bomba puxa daqui</span>
                      {!locked && <button onClick={() => removeLine(idx)} className="text-xs text-red-500 hover:underline">remover</button>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      <Num label="Comprimento (m)" val={line.masterComprM} on={(v) => set(idx, { masterComprM: v })} />
                      <Num label="Largura (m)" val={line.masterLargM} on={(v) => set(idx, { masterLargM: v })} />
                      <Num label="Profundidade (m)" val={line.masterProfM} on={(v) => set(idx, { masterProfM: v })} />
                      <div className="flex flex-col justify-end gap-1 pb-1">
                        <Toggle label="Aberto (evapora)" checked={line.masterAberto} on={(v) => set(idx, { masterAberto: v })} />
                        <Toggle label="É o tanque onde a água cai" checked={line.masterIsTanqueOndeCai} on={(v) => set(idx, { masterIsTanqueOndeCai: v })} />
                      </div>
                    </div>
                    {mv && (
                      <div className={"mt-2 rounded-lg border px-3 py-2 text-xs " + STATUS_COLOR[mv.status]}>
                        <span className="font-bold">Volume {mv.status}</span> · recomendado <b>{mv.recomendadoM3} m³</b> (mín {mv.minimoM3} m³)
                        {mv.actualM3 != null && <> · informado <b>{mv.actualM3} m³</b></>}
                        {mv.pctDoVolumePiscina != null && <> · {mv.pctDoVolumePiscina}% da piscina</>}
                        {mv.aviso && <div className="mt-1 font-medium">{mv.aviso}</div>}
                      </div>
                    )}
                  </div>
                );
              }
              // SLAVE
              const cap = (line.captacao ?? "RESERVATORIO") as Captacao;
              return (
                <div key={idx} className="rounded-xl border-l-4 border-cyan-400 border border-slate-200 bg-cyan-50/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-cyan-800">🌊 Borda {idx + 1}</span>
                    {!locked && <button onClick={() => removeLine(idx)} className="text-xs text-red-500 hover:underline">remover</button>}
                  </div>
                  {/* Lamina */}
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <Num label="Comprimento da borda (m)" val={line.bordaLengthM} on={(v) => set(idx, { bordaLengthM: v })} />
                    <Num label="Altura de queda (m)" val={line.alturaQuedaM} on={(v) => set(idx, { alturaQuedaM: v })} />
                    <Num label="Filme (mm)" val={line.filmeMm} on={(v) => set(idx, { filmeMm: v })} step="0.5" ph="6" />
                    <Num label="Horas/dia" val={line.horasDia} on={(v) => set(idx, { horasDia: v })} step="1" ph="24" />
                  </div>
                  {/* Captacao */}
                  <div className="mt-2">
                    <span className={LBL_CLS}>Captação</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(["RESERVATORIO", "CANALETA", "DIRETO"] as Captacao[]).map((c) => (
                        <button key={c} type="button" onClick={() => set(idx, { captacao: c })}
                          className={"rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-60 " + (cap === c ? "border-cyan-500 bg-cyan-100 text-cyan-800" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50")}>
                          {c === "RESERVATORIO" ? "Reservatório c/ volume" : c === "CANALETA" ? "Canaleta c/ ralos" : "Direto no master"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Campos por captacao */}
                  {cap === "RESERVATORIO" && (
                    <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                      <Num label="Reserv. compr. (m)" val={line.reservComprM} on={(v) => set(idx, { reservComprM: v })} />
                      <Num label="Reserv. larg. (m)" val={line.reservLargM} on={(v) => set(idx, { reservLargM: v })} />
                      <Num label="Reserv. prof. (m)" val={line.reservProfM} on={(v) => set(idx, { reservProfM: v })} />
                      <div className="flex items-end pb-1"><Toggle label="Aberto (evapora)" checked={line.reservAberto} on={(v) => set(idx, { reservAberto: v })} /></div>
                    </div>
                  )}
                  {cap === "CANALETA" && (
                    <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                      <Num label="Canaleta compr. (m)" val={line.canaletaComprM} on={(v) => set(idx, { canaletaComprM: v })} />
                      <Num label="Nº de ralos" val={line.ralosQty} on={(v) => set(idx, { ralosQty: v })} step="1" />
                      <Num label="Ø ralo (mm)" val={line.raloDiamMm} on={(v) => set(idx, { raloDiamMm: v })} step="1" />
                      <div className="flex items-end pb-1"><Toggle label="Aberta (evapora)" checked={line.canaletaAberta} on={(v) => set(idx, { canaletaAberta: v })} /></div>
                    </div>
                  )}
                  {/* Tubo de gravidade (modos RESERVATORIO/CANALETA) */}
                  {cap !== "DIRETO" && (
                    <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                      <Num label="Tubo: comprimento (m)" val={line.tuboComprimentoM} on={(v) => set(idx, { tuboComprimentoM: v })} />
                      <Num label="Tubo: nº de curvas" val={line.curvas90Qty} on={(v) => set(idx, { curvas90Qty: v })} step="1" />
                      <Num label="Desnível até o master (m)" val={line.tuboDesnivelM} on={(v) => set(idx, { tuboDesnivelM: v })} />
                    </div>
                  )}
                  {/* Resultado da linha */}
                  {r && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs text-slate-700">
                      {r.transbordoM3h != null && <span>Transbordo: <b className="tabular-nums">{r.transbordoM3h} m³/h</b></span>}
                      {r.tubo && <span>· Tubo: <b className="tabular-nums">DN{r.tubo.diametroMm}</b> ({r.tubo.fillPercentReal}% cheio · {r.tubo.velocidadeMs} m/s · caimento {r.tubo.caimentoPct}%)</span>}
                      {r.reservatorioVolumeM3 != null && r.reservatorioVolumeM3 > 0 && <span>· Reservatório: <b className="tabular-nums">{r.reservatorioVolumeM3} m³</b></span>}
                      {cap === "DIRETO" && <span className="text-slate-400">· cai direto no master (sem tubo)</span>}
                      {r.aviso && <span className="w-full text-amber-600">⚠ {r.aviso}</span>}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Banhistas (opcional, pro volume do master) */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-500">Banhistas (opcional, refina o volume do master):</span>
              <input type="number" step="1" className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100" value={nBathers ?? ""} onChange={(e) => setNBathers(parseNum(e.target.value))} />
            </div>
          </fieldset>
        </div>

        {/* Totais + footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
          {report && (
            <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label="Vazão de bomba" value={`${report.totals.vazaoBombaSugeridaM3h} m³/h`} />
              <Stat label="Volume térmico extra" value={`${report.totals.volumeTermicoExtraM3} m³`} hint="piscina + reservatórios (FASE 2)" />
              <Stat label="Área de evaporação extra" value={`${report.totals.areaEvaporacaoExtraM2} m²`} hint="lâminas + superfícies abertas" />
              <Stat label="Borda total" value={`${report.totals.bordaTotalLengthM} m`} />
            </div>
          )}
          {report?.avisos && report.avisos.length > 0 && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {report.avisos.map((a, i) => <div key={i}>⚠ {a}</div>)}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Fechar</button>
            {!locked && (
              <button onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {saving ? "Salvando…" : "Aplicar"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
