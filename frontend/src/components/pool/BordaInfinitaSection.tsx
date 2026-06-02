"use client";

// Sistema de Borda Infinita — SECAO INLINE COLAPSAVEL (igual a tabela "Dimensoes":
// fica na propria tela de edicao, sem popup; edita direto no form e salva junto).
// Cabecalho clicavel expande/colapsa. CONTROLADO: recebe lines + contexto da piscina
// e chama onChange(lines, bathers) a cada edicao. Campos compactos com "?" (HelpHint).
// Calcula ao vivo via POST /pool-budgets/borda-infinita/simulate: DN do tubo (Manning),
// volume do reservatorio + ALERTA do master. Master pode ser CISTERNA PRONTA (so da o
// volume necessario) ou, se aberto e insuficiente, complementar com cisterna plastica.
// Ver memory/plano_sistema_borda_infinita.md.

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { HelpHint } from "@/components/ui/HelpHint";

type Captacao = "RESERVATORIO" | "CANALETA" | "DIRETO";

export interface BordaLine {
  tipo: "MASTER" | "SLAVE";
  bordaLengthM?: number;
  alturaQuedaM?: number;
  filmeMm?: number;
  horasDia?: number;
  captacao?: Captacao;
  reservComprM?: number;
  reservLargM?: number;
  reservProfM?: number;
  reservAberto?: boolean;
  canaletaComprM?: number;
  ralosQty?: number;
  raloDiamMm?: number;
  canaletaAberta?: boolean;
  tuboComprimentoM?: number;
  curvas90Qty?: number;
  tuboDesnivelM?: number;
  masterComprM?: number;
  masterLargM?: number;
  masterProfM?: number;
  masterAberto?: boolean;
  masterIsTanqueOndeCai?: boolean;
  masterCisternaPronta?: boolean;
}

interface MasterVol {
  recomendadoM3: number;
  minimoM3: number;
  actualM3: number | null;
  pctDoVolumePiscina: number | null;
  status: "OK" | "BAIXO" | "ALTO" | "SEM_DADO";
  aviso: string | null;
}
interface LineResult {
  index: number;
  tipo: "MASTER" | "SLAVE";
  captacao?: Captacao;
  transbordoM3h?: number;
  reservatorioVolumeM3?: number;
  tubo?: { diametroMm: number; fillPercentReal: number; velocidadeMs: number; caimentoPct: number; suficiente: boolean; aviso: string | null } | null;
  masterVolume?: MasterVol;
  aviso?: string | null;
}
interface BordaReport {
  lines: LineResult[];
  totals: { bordaTotalLengthM: number; vazaoBombaSugeridaM3h: number; volumeTermicoExtraM3: number; areaEvaporacaoExtraM2: number };
  master: MasterVol | null;
  avisos: string[];
}

const parseNum = (v: string): number | undefined => (v === "" ? undefined : Number(v));

const STATUS_COLOR: Record<MasterVol["status"], string> = {
  OK: "bg-emerald-100 text-emerald-800 border-emerald-200",
  BAIXO: "bg-red-100 text-red-800 border-red-200",
  ALTO: "bg-amber-100 text-amber-800 border-amber-200",
  SEM_DADO: "bg-slate-100 text-slate-600 border-slate-200",
};

// Hints "?" por campo (HelpHint system-wide).
const H = {
  comprBorda: "Comprimento total da borda infinita por onde a agua transborda (m). Se houver mais de uma borda igual, some os comprimentos nesta linha.",
  altQueda: "Altura que a lamina d'agua cai da borda ate a calha/reservatorio (m). Quanto maior a queda, mais evaporacao.",
  filme: "Espessura da lamina d'agua sobre a borda (mm). Padrao aceitavel: 3 a 7 mm — 6 mm e o mais usado pro efeito visual. A 6 mm a vazao de transbordo e ~2,6 m³/h por metro de borda.",
  horas: "Horas por dia que a borda fica em operacao (bomba ligada). 24 = sempre ligada; reduza se a bomba desliga em parte do dia.",
  captacao: "Pra onde a agua transbordada vai: Reservatorio (calha com volume) · Canaleta (calha com ralos, sem volume) · Direto (cai direto no master, sem tubo).",
  reserv: "Dimensoes do mini-reservatorio/calha que recebe a lamina: comprimento × largura × profundidade (m).",
  reservAberto: "Marque se o reservatorio e aberto (a superficie evapora). Tampado/enterrado = so o volume conta.",
  canaleta: "Comprimento da canaleta (calha) que coleta a agua transbordada (m).",
  ralos: "Numero de ralos na canaleta que drenam pro master.",
  raloDiam: "Diametro de cada ralo (mm).",
  canaletaAberta: "Marque se a canaleta e aberta (evapora).",
  tuboC: "Comprimento do tubo de gravidade da captacao ate o master (m).",
  curvas: "Numero de curvas 90° no tubo. Cada curva 'rouba' caimento — pode exigir um tubo maior.",
  desnivel: "Diferenca de altura entre a captacao e o master (m). Define o caimento do tubo (caimento = desnivel ÷ comprimento).",
  master: "Dimensoes da cisterna master: comprimento × largura × profundidade (m). A bomba do filtro puxa daqui.",
  cisterna: "Use uma cisterna plastica pronta — nao precisa digitar dimensoes; o sistema te diz o volume minimo necessario (compre uma >= esse volume).",
  masterAberto: "Marque se o master e aberto (evapora). Tampado/enterrado = so volume.",
  tanqueOndeCai: "Marque se o master E o proprio tanque onde a agua da borda cai (sem reservatorio intermediario).",
  banhistas: "Numero de banhistas — refina o volume do master (cada pessoa desloca ~75 L de agua).",
};

// Campos COMPACTOS em nivel de MODULO (nao recriar dentro do componente — senao o
// input perde foco a cada tecla). Usam <div> (nao <label>) pra o "?" nao focar o input.
function CNum({ label, val, on, w = "w-24", step = "0.01", ph = "", hint }: { label: string; val?: number; on: (v?: number) => void; w?: string; step?: string; ph?: string; hint?: string }) {
  return (
    <div>
      <span className="flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-tight text-slate-500 leading-none mb-1 whitespace-nowrap">
        {label}{hint && <HelpHint text={hint} tone="cyan" width={260} />}
      </span>
      <input type="number" step={step} value={val ?? ""} placeholder={ph} onChange={(e) => on(parseNum(e.target.value))}
        className={`${w} rounded border border-slate-300 px-2 py-1.5 text-sm tabular-nums focus:border-blue-400 focus:outline-none`} />
    </div>
  );
}
function CChk({ label, checked, on, hint }: { label: string; checked?: boolean; on: (v: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-center gap-1 pb-1.5">
      <label className="flex items-center gap-1 text-[11px] text-slate-700 cursor-pointer select-none">
        <input type="checkbox" checked={!!checked} onChange={(e) => on(e.target.checked)} className="rounded border-slate-300" />
        {label}
      </label>
      {hint && <HelpHint text={hint} tone="cyan" width={260} />}
    </div>
  );
}

export function BordaInfinitaSection({
  poolAreaM2 = 0,
  poolVolumeM3 = 0,
  lines = [],
  bathers,
  onChange,
}: {
  poolAreaM2?: number;
  poolVolumeM3?: number;
  lines?: BordaLine[];
  bathers?: number;
  onChange?: (lines: BordaLine[], bathers?: number) => void;
}) {
  const [report, setReport] = useState<BordaReport | null>(null);
  const [computing, setComputing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const linesKey = JSON.stringify(lines);
  useEffect(() => {
    if (!lines || lines.length === 0) { setReport(null); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setComputing(true);
        const res = await api.post<BordaReport>("/pool-budgets/borda-infinita/simulate", {
          poolAreaM2, poolVolumeM3: poolVolumeM3 || undefined, nBathers: bathers || undefined, lines,
        });
        setReport(res);
      } catch { /* silencioso */ } finally { setComputing(false); }
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, bathers, poolAreaM2, poolVolumeM3]);

  const update = (next: BordaLine[]) => onChange?.(next, bathers);
  const set = (idx: number, patch: Partial<BordaLine>) => update(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = (tipo: "MASTER" | "SLAVE") => { setExpanded(true); update([...lines, tipo === "SLAVE" ? { tipo, captacao: "RESERVATORIO", filmeMm: 6, horasDia: 24 } : { tipo }]); };
  const removeLine = (idx: number) => update(lines.filter((_, i) => i !== idx));
  const resultFor = (idx: number) => report?.lines?.find((r) => r.index === idx);

  const slaveCount = lines.filter((l) => l.tipo === "SLAVE").length;
  const masterCount = lines.filter((l) => l.tipo === "MASTER").length;
  const summary = lines.length === 0
    ? "Opcional — clique pra dimensionar bordas, reservatorios e tubulacao por gravidade (Manning)"
    : `${slaveCount} borda(s) + ${masterCount} master${report ? ` · bomba ${report.totals.vazaoBombaSugeridaM3h} m³/h` : ""}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Cabecalho colapsavel */}
      <button type="button" onClick={() => setExpanded((e) => !e)} className="flex w-full items-center justify-between gap-2 px-6 py-3 text-left hover:bg-slate-50/60">
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-slate-400">{expanded ? "▼" : "▶"}</span>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">🌊 Sistema de Borda Infinita</h3>
            <p className="text-xs text-slate-500">{summary}{computing && expanded && <span className="ml-1 text-blue-500">· calculando…</span>}</p>
          </div>
        </div>
        {!expanded && report?.master?.status === "BAIXO" && (
          <span className="flex-shrink-0 rounded border border-red-200 bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">⚠ volume master baixo</span>
        )}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-slate-200 px-6 pb-5 pt-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => addLine("SLAVE")} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700">+ Borda</button>
            <button type="button" onClick={() => addLine("MASTER")} className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">+ Master</button>
          </div>

          {lines.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-center text-xs text-slate-500">
              Sem borda infinita. Se a piscina tiver, clique em <b>+ Borda</b> e <b>+ Master</b> (a cisterna de onde a bomba puxa).
            </p>
          )}

          {lines.map((line, idx) => {
            const r = resultFor(idx);
            if (line.tipo === "MASTER") {
              const mv = r?.masterVolume ?? report?.master ?? null;
              const cisterna = !!line.masterCisternaPronta;
              const deficit = mv && mv.actualM3 != null ? Number((mv.recomendadoM3 - mv.actualM3).toFixed(2)) : 0;
              return (
                <div key={idx} className="rounded-lg border-l-4 border-indigo-400 border border-slate-200 bg-indigo-50/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-800">🛢️ Reservatorio master (cisterna) — a bomba puxa daqui</span>
                    <button type="button" onClick={() => removeLine(idx)} className="text-[11px] text-red-500 hover:underline">remover</button>
                  </div>
                  <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                    {!cisterna && (
                      <>
                        <CNum label="Compr. (m)" val={line.masterComprM} on={(v) => set(idx, { masterComprM: v })} hint={H.master} />
                        <CNum label="Larg. (m)" val={line.masterLargM} on={(v) => set(idx, { masterLargM: v })} />
                        <CNum label="Prof. (m)" val={line.masterProfM} on={(v) => set(idx, { masterProfM: v })} />
                        <CChk label="Aberto (evapora)" checked={line.masterAberto} on={(v) => set(idx, { masterAberto: v })} hint={H.masterAberto} />
                        <CChk label="É o tanque onde cai" checked={line.masterIsTanqueOndeCai} on={(v) => set(idx, { masterIsTanqueOndeCai: v })} hint={H.tanqueOndeCai} />
                      </>
                    )}
                    <CChk label="Cisterna pronta (plástica)" checked={cisterna} on={(v) => set(idx, { masterCisternaPronta: v })} hint={H.cisterna} />
                  </div>
                  {mv && cisterna && (
                    <div className="mt-2 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-800">
                      🛒 Cisterna pronta: compre uma de <b>≥ {mv.recomendadoM3} m³</b>{mv.pctDoVolumePiscina != null && <> ({mv.pctDoVolumePiscina}% do volume da piscina)</>}.
                    </div>
                  )}
                  {mv && !cisterna && (
                    <div className={"mt-2 rounded border px-3 py-2 text-[11px] " + STATUS_COLOR[mv.status]}>
                      <b>Volume {mv.status}</b> · recomendado {mv.recomendadoM3} m³ (mín {mv.minimoM3})
                      {mv.actualM3 != null && <> · informado {mv.actualM3} m³</>}
                      {mv.pctDoVolumePiscina != null && <> · {mv.pctDoVolumePiscina}% da piscina</>}
                    </div>
                  )}
                  {mv && !cisterna && mv.status === "BAIXO" && mv.actualM3 != null && deficit > 0 && (
                    <div className="mt-1 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
                      ⚠ Faltam <b>{deficit} m³</b> — complemente com uma cisterna plástica pronta de <b>≥ {deficit} m³</b> (ou aumente o reservatorio).
                    </div>
                  )}
                </div>
              );
            }
            // SLAVE
            const cap = (line.captacao ?? "RESERVATORIO") as Captacao;
            return (
              <div key={idx} className="rounded-lg border-l-4 border-cyan-400 border border-slate-200 bg-cyan-50/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-800">🌊 Borda {idx + 1}</span>
                  <button type="button" onClick={() => removeLine(idx)} className="text-[11px] text-red-500 hover:underline">remover</button>
                </div>
                <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                  <CNum label="Compr. borda" val={line.bordaLengthM} on={(v) => set(idx, { bordaLengthM: v })} hint={H.comprBorda} />
                  <CNum label="Alt. queda" val={line.alturaQuedaM} on={(v) => set(idx, { alturaQuedaM: v })} w="w-20" hint={H.altQueda} />
                  <CNum label="Filme mm" val={line.filmeMm} on={(v) => set(idx, { filmeMm: v })} step="0.5" ph="6" w="w-16" hint={H.filme} />
                  <CNum label="Horas/dia" val={line.horasDia} on={(v) => set(idx, { horasDia: v })} step="1" ph="24" w="w-16" hint={H.horas} />
                  <div>
                    <span className="flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-tight text-slate-500 leading-none mb-1">Captacao<HelpHint text={H.captacao} tone="cyan" width={280} /></span>
                    <div className="flex gap-1">
                      {([["RESERVATORIO", "Reservat."], ["CANALETA", "Canaleta"], ["DIRETO", "Direto"]] as [Captacao, string][]).map(([c, lbl]) => (
                        <button key={c} type="button" onClick={() => set(idx, { captacao: c })}
                          className={"rounded border px-2 py-1.5 text-[11px] font-medium " + (cap === c ? "border-cyan-500 bg-cyan-100 text-cyan-800" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50")}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  {cap === "RESERVATORIO" && (
                    <>
                      <CNum label="Res. C" val={line.reservComprM} on={(v) => set(idx, { reservComprM: v })} w="w-20" hint={H.reserv} />
                      <CNum label="Res. L" val={line.reservLargM} on={(v) => set(idx, { reservLargM: v })} w="w-20" />
                      <CNum label="Res. P" val={line.reservProfM} on={(v) => set(idx, { reservProfM: v })} w="w-20" />
                      <CChk label="Aberto" checked={line.reservAberto} on={(v) => set(idx, { reservAberto: v })} hint={H.reservAberto} />
                    </>
                  )}
                  {cap === "CANALETA" && (
                    <>
                      <CNum label="Canal. C" val={line.canaletaComprM} on={(v) => set(idx, { canaletaComprM: v })} w="w-24" hint={H.canaleta} />
                      <CNum label="Ralos" val={line.ralosQty} on={(v) => set(idx, { ralosQty: v })} step="1" w="w-16" hint={H.ralos} />
                      <CNum label="Ø ralo" val={line.raloDiamMm} on={(v) => set(idx, { raloDiamMm: v })} step="1" w="w-16" hint={H.raloDiam} />
                      <CChk label="Aberta" checked={line.canaletaAberta} on={(v) => set(idx, { canaletaAberta: v })} hint={H.canaletaAberta} />
                    </>
                  )}
                  {cap !== "DIRETO" && (
                    <>
                      <CNum label="Tubo C" val={line.tuboComprimentoM} on={(v) => set(idx, { tuboComprimentoM: v })} w="w-24" hint={H.tuboC} />
                      <CNum label="Curvas" val={line.curvas90Qty} on={(v) => set(idx, { curvas90Qty: v })} step="1" w="w-16" hint={H.curvas} />
                      <CNum label="Desnível" val={line.tuboDesnivelM} on={(v) => set(idx, { tuboDesnivelM: v })} w="w-20" hint={H.desnivel} />
                    </>
                  )}
                </div>
                {r && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-700">
                    {r.transbordoM3h != null && <span>Transbordo <b className="tabular-nums">{r.transbordoM3h} m³/h</b></span>}
                    {r.tubo && <span>· Tubo <b className="tabular-nums">DN{r.tubo.diametroMm}</b> ({r.tubo.fillPercentReal}% · {r.tubo.velocidadeMs} m/s · caim. {r.tubo.caimentoPct}%)</span>}
                    {r.reservatorioVolumeM3 != null && r.reservatorioVolumeM3 > 0 && <span>· Reserv. <b className="tabular-nums">{r.reservatorioVolumeM3} m³</b></span>}
                    {cap === "DIRETO" && <span className="text-slate-400">· cai direto no master</span>}
                    {r.aviso && <span className="w-full text-amber-600">⚠ {r.aviso}</span>}
                  </div>
                )}
              </div>
            );
          })}

          {lines.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                Banhistas (opcional):<HelpHint text={H.banhistas} tone="cyan" width={260} />
                <input type="number" step="1" className="w-16 rounded border border-slate-300 px-2 py-1.5 text-sm" value={bathers ?? ""} onChange={(e) => onChange?.(lines, parseNum(e.target.value))} />
              </div>
              {report && (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {[
                    ["Vazão de bomba", `${report.totals.vazaoBombaSugeridaM3h} m³/h`, ""],
                    ["Volume térmico extra", `${report.totals.volumeTermicoExtraM3} m³`, "piscina + reservatórios (FASE 2)"],
                    ["Área de evaporação", `${report.totals.areaEvaporacaoExtraM2} m²`, "lâminas + superfícies abertas"],
                    ["Borda total", `${report.totals.bordaTotalLengthM} m`, ""],
                  ].map(([l, v, h]) => (
                    <div key={l} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{l}</div>
                      <div className="text-base font-bold text-slate-800 tabular-nums">{v}</div>
                      {h && <div className="text-[10px] text-slate-400">{h}</div>}
                    </div>
                  ))}
                </div>
              )}
              {report?.avisos && report.avisos.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  {report.avisos.map((a, i) => <div key={i}>⚠ {a}</div>)}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
