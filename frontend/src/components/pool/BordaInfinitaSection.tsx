"use client";

// Sistema de Borda Infinita — SECAO INLINE COLAPSAVEL. Cada linha eh uma LINHA ESTILO
// EXCEL: celulas com gridlines (bordas em cima/baixo e entre celulas), tudo numa
// linha so (flex-nowrap + scroll horizontal se nao couber — NUNCA quebra). Rotulos
// pequenos com "?" (HelpHint). CONTROLADO: lines + onChange a cada edicao -> salva no
// form. Calcula ao vivo via POST /pool-budgets/borda-infinita/simulate. Master pode ser
// CISTERNA PRONTA (so da o volume necessario) ou complementar com cisterna se faltar volume.
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
  canaletaLargM?: number;
  ralosQty?: number;
  raloDiamMm?: number;
  canaletaAberta?: boolean;
  tuboComprimentoM?: number;
  curvas90Qty?: number;
  tuboDesnivelM?: number;
  tubosQty?: number;
  masterComprM?: number;
  masterLargM?: number;
  masterProfM?: number;
  masterAberto?: boolean;
  masterIsTanqueOndeCai?: boolean;
  masterCisternaPronta?: boolean;
  masterCisternaVolumeM3?: number;
}

interface MasterVol {
  recomendadoM3: number; minimoM3: number; actualM3: number | null;
  pctDoVolumePiscina: number | null; status: "OK" | "BAIXO" | "ALTO" | "SEM_DADO"; aviso: string | null;
}
interface LineResult {
  index: number; tipo: "MASTER" | "SLAVE"; captacao?: Captacao; transbordoM3h?: number; reservatorioVolumeM3?: number;
  tubo?: { diametroMm: number; fillPercentReal: number; velocidadeMs: number; caimentoPct: number; suficiente: boolean; aviso: string | null } | null;
  ralosSugeridos?: number; raloCapacidadeM3h?: number; drenagemDesignM3h?: number; tubosQty?: number;
  masterVolume?: MasterVol; aviso?: string | null;
}
interface BordaReport {
  lines: LineResult[];
  totals: { bordaTotalLengthM: number; vazaoBombaSugeridaM3h: number; volumeTermicoExtraM3: number; areaEvaporacaoExtraM2: number };
  master: MasterVol | null; avisos: string[];
}

// Contexto de aquecimento (vem do formulario do editor) pro card "Calorias necessarias".
export interface BordaHeatingCtx {
  uf?: string; cidade?: string; tempAlvo?: number; tempInicial?: number;
  capa?: boolean; vento?: string; tipoConstrucao?: string; tipoPiscina?: string;
  utilizacaoAno?: string; utilizacaoSemana?: string;
}
interface DemandResult {
  comBordaKcalH: number; semBordaKcalH: number; deltaKcalH: number;
  comBordaKw: number; semBordaKw: number;
}

const parseNum = (v: string): number | undefined => (v === "" ? undefined : Number(v));

const STATUS_COLOR: Record<MasterVol["status"], string> = {
  OK: "bg-emerald-100 text-emerald-800 border-emerald-200",
  BAIXO: "bg-red-100 text-red-800 border-red-200",
  ALTO: "bg-amber-100 text-amber-800 border-amber-200",
  SEM_DADO: "bg-slate-100 text-slate-600 border-slate-200",
};

const H = {
  comprBorda: "Comprimento total da borda infinita por onde a agua transborda (m). Se houver mais de uma borda igual, some os comprimentos nesta linha.",
  altQueda: "Altura que a lamina d'agua cai da borda ate a calha/reservatorio, em CENTIMETROS. Tipico 5 a 100 cm; acima de 140 cm aparece um aviso (confira se nao digitou metros). Quanto maior a queda, mais evaporacao.",
  filme: "Espessura da lamina d'agua sobre a borda (mm). Padrao aceitavel: 3 a 7 mm — 6 mm e o mais usado pro efeito visual. A 6 mm a vazao de transbordo e ~2,6 m³/h por metro de borda.",
  horas: "Horas por dia que a borda fica em operacao (bomba ligada). 24 = sempre ligada; reduza se a bomba desliga em parte do dia.",
  captacao: "Pra onde a agua transbordada vai: Reservatorio (calha com volume) · Canaleta (calha com ralos, sem volume) · Direto (cai direto no master, sem tubo).",
  reserv: "Dimensoes do mini-reservatorio/calha que recebe a lamina (m).",
  reservAberto: "Marque se o reservatorio e aberto (a superficie evapora). Tampado/enterrado = so o volume conta.",
  canaleta: "Comprimento da canaleta (calha) que coleta a agua transbordada (m).",
  canaletaLarg: "Largura da canaleta (m). Se a canaleta for ABERTA, a area que evapora = comprimento × largura — entra na perda termica do aquecimento. Tipico 0,10 a 0,30 m. Em branco usa 0,15 m.",
  ralos: "Numero de ralos na canaleta que drenam pro master.",
  raloDiam: "Diametro de cada ralo (mm).",
  canaletaAberta: "Marque se a canaleta e aberta (evapora).",
  tuboC: "Comprimento do tubo de gravidade da captacao ate o master (m).",
  curvas: "Numero de curvas 90° no tubo. Cada curva 'rouba' caimento — pode exigir um tubo maior.",
  desnivel: "Diferenca de altura entre a captacao e o master (m). Define o caimento (caimento = desnivel ÷ comprimento).",
  tubos: "Quantos tubos de gravidade EM PARALELO da captacao ate o master. Em vez de 1 tubo grande, pode usar varios menores — a drenagem se divide e cada tubo eh dimensionado pra drenagem ÷ nº de tubos. Default 1.",
  master: "Dimensoes da cisterna master (m). A bomba do filtro puxa daqui.",
  cisterna: "Use uma cisterna plastica pronta — nao precisa digitar dimensoes; o sistema te diz o volume minimo necessario (compre uma >= esse volume).",
  cisternaVol: "Volume da cisterna plastica pronta que voce vai usar (m³). O sistema compara com o recomendado: se for >=, some o erro; se for menor, mostra erro em vermelho (risco de cavitacao/transbordo).",
  masterAberto: "Marque se o master e aberto (evapora). Tampado/enterrado = so volume.",
  tanqueOndeCai: "Marque se o master E o proprio tanque onde a agua da borda cai (sem reservatorio intermediario).",
  masterTipo: "Tipo do reservatorio master: Tampado (so o volume conta) · Aberto (a superficie evapora) · Cisterna pronta plastica (nao digita dimensoes — o sistema da o volume minimo necessario).",
  banhistas: "Numero de banhistas — refina o volume do master (cada pessoa desloca ~75 L de agua).",
  surge: "Fator de SURGE: quanto a drenagem (ralos+tubo) eh sobre-dimensionada vs a recirculacao, pra absorver o pico de ondas/banhistas (criancas brincando) e nao transbordar a canaleta. Minimo de norma = 1,25×. Uso intenso/criancas = 2 a 4×. O VOLUME do surge eh absorvido pelo reservatorio master. Default 2×.",
};

const INP = "rounded border border-slate-300 px-1.5 py-1 text-sm tabular-nums focus:border-blue-400 focus:outline-none";
const LBL = "flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-tight text-slate-500 leading-none mb-1 whitespace-nowrap";

// CELULA estilo Excel (em nivel de MODULO — nao recriar dentro do componente, senao
// o input perde foco a cada tecla). A gridline vertical vem do `divide-x` do pai.
function Cell({ label, hint, children }: { label?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-end px-2 py-1.5">
      {label && <span className={LBL}>{label}{hint && <HelpHint text={hint} tone="cyan" width={260} />}</span>}
      {children}
    </div>
  );
}
function NumCell({ label, hint, val, on, w = "w-16", step = "0.01", ph = "" }: { label: string; hint?: string; val?: number; on: (v?: number) => void; w?: string; step?: string; ph?: string }) {
  return <Cell label={label} hint={hint}><input type="number" step={step} value={val ?? ""} placeholder={ph} onChange={(e) => on(parseNum(e.target.value))} className={`${w} ${INP}`} /></Cell>;
}
function SelectCell({ label, hint, value, on, options, w = "w-32" }: { label: string; hint?: string; value: string; on: (v: string) => void; options: [string, string][]; w?: string }) {
  return <Cell label={label} hint={hint}><select value={value} onChange={(e) => on(e.target.value)} className={`${w} rounded border border-slate-300 bg-white px-1 py-1 text-xs focus:border-blue-400 focus:outline-none`}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Cell>;
}
function BoolSelectCell({ label, hint, val, on, trueLabel, falseLabel, w = "w-32" }: { label: string; hint?: string; val?: boolean; on: (v: boolean) => void; trueLabel: string; falseLabel: string; w?: string }) {
  return <SelectCell label={label} hint={hint} w={w} value={val ? "1" : "0"} on={(v) => on(v === "1")} options={[["0", falseLabel], ["1", trueLabel]]} />;
}

export function BordaInfinitaSection({
  poolAreaM2 = 0,
  poolVolumeM3 = 0,
  lines = [],
  bathers,
  surge,
  heatingCtx,
  onChange,
  onIssuesChange,
}: {
  poolAreaM2?: number;
  poolVolumeM3?: number;
  lines?: BordaLine[];
  bathers?: number;
  surge?: number;
  heatingCtx?: BordaHeatingCtx;
  onChange?: (lines: BordaLine[], bathers?: number, surge?: number) => void;
  onIssuesChange?: (issues: { mensagem: string; nivel: "erro" | "aviso" }[]) => void;
}) {
  const [report, setReport] = useState<BordaReport | null>(null);
  const [demand, setDemand] = useState<DemandResult | null>(null);
  const [computing, setComputing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const linesKey = JSON.stringify(lines);
  useEffect(() => {
    if (!lines || lines.length === 0) { setReport(null); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setComputing(true);
        const res = await api.post<BordaReport>("/pool-budgets/borda-infinita/simulate", {
          poolAreaM2, poolVolumeM3: poolVolumeM3 || undefined, nBathers: bathers || undefined, surgeFactor: surge || undefined, lines,
        });
        setReport(res);
      } catch { /* silencioso */ } finally { setComputing(false); }
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, bathers, surge, poolAreaM2, poolVolumeM3]);

  // Demanda termica AO VIVO (card "Calorias necessarias") — COM vs SEM borda. Depende das
  // linhas + dimensoes + contexto de aquecimento (clima/temps/capa/vento). Pra o operador
  // mudar altura/filme/canaleta e VER a perda termica mexer (garante que a borda alimenta o calculo).
  const ctxKey = JSON.stringify(heatingCtx ?? {});
  useEffect(() => {
    if (!lines || lines.length === 0 || !heatingCtx || !poolAreaM2 || !poolVolumeM3) { setDemand(null); return; }
    if (demandTimer.current) clearTimeout(demandTimer.current);
    demandTimer.current = setTimeout(async () => {
      try {
        const res = await api.post<DemandResult>("/pool-budgets/borda-infinita/heating-demand", {
          poolAreaM2, poolVolumeM3: poolVolumeM3 || undefined, nBathers: bathers || undefined, surgeFactor: surge || undefined,
          ...heatingCtx, lines,
        });
        setDemand(res);
      } catch { /* silencioso */ }
    }, 450);
    return () => { if (demandTimer.current) clearTimeout(demandTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, ctxKey, bathers, surge, poolAreaM2, poolVolumeM3]);

  // Reporta os avisos da borda pra Central de Avisos da pagina (erros do report + faixas).
  useEffect(() => {
    const issues: { mensagem: string; nivel: "erro" | "aviso" }[] = [];
    (report?.avisos ?? []).forEach((a) => issues.push({ mensagem: a, nivel: "erro" }));
    lines.forEach((l, i) => {
      if (l.tipo === "SLAVE" && l.alturaQuedaM != null && l.alturaQuedaM > 1.4) {
        issues.push({ mensagem: `Borda ${i + 1}: altura de queda ${Math.round(l.alturaQuedaM * 100)} cm e alta (esperado < 140 cm).`, nivel: "aviso" });
      }
    });
    (report?.lines ?? []).forEach((r) => {
      if (r.captacao === "CANALETA" && r.ralosSugeridos) {
        const l = lines[r.index];
        if (l?.ralosQty != null && l.ralosQty > 0 && l.ralosQty < r.ralosSugeridos) {
          issues.push({ mensagem: `Borda ${r.index + 1}: ralos informados (${l.ralosQty}) abaixo do sugerido (${r.ralosSugeridos}).`, nivel: "aviso" });
        }
      }
    });
    onIssuesChange?.(issues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, linesKey]);

  const update = (next: BordaLine[]) => onChange?.(next, bathers, surge);
  const set = (idx: number, patch: Partial<BordaLine>) => update(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = (tipo: "MASTER" | "SLAVE") => { setExpanded(true); update([...lines, tipo === "SLAVE" ? { tipo, captacao: "RESERVATORIO", filmeMm: 6, horasDia: 24 } : { tipo }]); };
  const removeLine = (idx: number) => update(lines.filter((_, i) => i !== idx));
  const resultFor = (idx: number) => report?.lines?.find((r) => r.index === idx);

  const slaveCount = lines.filter((l) => l.tipo === "SLAVE").length;
  const masterCount = lines.filter((l) => l.tipo === "MASTER").length;
  const summary = lines.length === 0
    ? "Opcional — clique pra dimensionar bordas, reservatorios e tubulacao por gravidade (Manning)"
    : `${slaveCount} borda(s) + ${masterCount} master${report ? ` · bomba ${report.totals.vazaoBombaSugeridaM3h} m³/h` : ""}`;

  // Classes da LINHA-celula (Excel): bordas em volta + divisorias entre celulas, sem quebra.
  const rowWrap = "overflow-x-auto";
  const rowInner = "flex min-w-max flex-nowrap items-stretch divide-x divide-slate-200";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
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
        <div className="space-y-2.5 border-t border-slate-200 px-6 pb-5 pt-3">
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
                <div key={idx} className="overflow-hidden rounded-lg border border-indigo-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-indigo-50/50 px-2 py-1">
                    <span className="text-xs font-bold text-indigo-800">🛢️ Reservatorio master (cisterna) — a bomba puxa daqui</span>
                    <button type="button" onClick={() => removeLine(idx)} className="text-[11px] text-red-500 hover:underline">remover</button>
                  </div>
                  <div className={rowWrap}>
                    <div className={rowInner}>
                      <SelectCell label="Tipo" hint={H.masterTipo} w="w-40" value={cisterna ? "CISTERNA" : line.masterAberto ? "ABERTO" : "TAMPADO"} on={(v) => set(idx, v === "CISTERNA" ? { masterCisternaPronta: true } : { masterCisternaPronta: false, masterAberto: v === "ABERTO" })} options={[["TAMPADO", "Reservatorio tampado"], ["ABERTO", "Reservatorio aberto"], ["CISTERNA", "Cisterna pronta"]]} />
                      {cisterna && (
                        <NumCell label="Vol. cisterna (m³)" hint={H.cisternaVol} val={line.masterCisternaVolumeM3} on={(v) => set(idx, { masterCisternaVolumeM3: v })} w="w-24" />
                      )}
                      {!cisterna && (
                        <>
                          <NumCell label="Compr. (m)" hint={H.master} val={line.masterComprM} on={(v) => set(idx, { masterComprM: v })} />
                          <NumCell label="Larg. (m)" val={line.masterLargM} on={(v) => set(idx, { masterLargM: v })} />
                          <NumCell label="Prof. (m)" val={line.masterProfM} on={(v) => set(idx, { masterProfM: v })} />
                        </>
                      )}
                    </div>
                  </div>
                  {mv && cisterna && mv.actualM3 == null && (
                    <div className="border-t border-slate-200 px-2 py-1.5 text-[11px] text-sky-800">
                      🛒 Cisterna pronta: compre uma de <b>≥ {mv.recomendadoM3} m³</b>{mv.pctDoVolumePiscina != null && <> ({mv.pctDoVolumePiscina}% do volume da piscina)</>}. Informe o volume da cisterna pra validar.
                    </div>
                  )}
                  {mv && cisterna && mv.actualM3 != null && mv.status !== "BAIXO" && (
                    <div className="border-t border-slate-200 px-2 py-1.5 text-[11px] text-emerald-700">
                      ✓ Cisterna de <b>{mv.actualM3} m³</b> OK (recomendado ≥ {mv.recomendadoM3} m³).
                    </div>
                  )}
                  {mv && cisterna && mv.actualM3 != null && mv.status === "BAIXO" && (
                    <div className="border-t border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
                      ⚠ Cisterna de <b>{mv.actualM3} m³</b> ABAIXO do recomendado (<b>≥ {mv.recomendadoM3} m³</b>) — insuficiente: a bomba pode secar/transbordar. Use uma maior ou complemente.
                    </div>
                  )}
                  {mv && !cisterna && (
                    <div className="border-t border-slate-200 px-2 py-1.5 text-[11px]">
                      <span className={"rounded border px-2 py-0.5 " + STATUS_COLOR[mv.status]}><b>Volume {mv.status}</b> · rec {mv.recomendadoM3} m³ (mín {mv.minimoM3}){mv.actualM3 != null && <> · tem {mv.actualM3} m³</>}{mv.pctDoVolumePiscina != null && <> · {mv.pctDoVolumePiscina}%</>}</span>
                      {mv.status === "BAIXO" && mv.actualM3 != null && deficit > 0 && (
                        <span className="ml-2 text-red-700">⚠ Faltam <b>{deficit} m³</b> — complemente com cisterna plástica de <b>≥ {deficit} m³</b>.</span>
                      )}
                    </div>
                  )}
                </div>
              );
            }
            // SLAVE
            const cap = (line.captacao ?? "RESERVATORIO") as Captacao;
            return (
              <div key={idx} className="overflow-hidden rounded-lg border border-cyan-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 bg-cyan-50/50 px-2 py-1">
                  <span className="text-xs font-bold text-cyan-800">🌊 Borda {idx + 1}</span>
                  <button type="button" onClick={() => removeLine(idx)} className="text-[11px] text-red-500 hover:underline">remover</button>
                </div>
                <div className={rowWrap}>
                  <div className={rowInner}>
                    <NumCell label="Compr. borda" hint={H.comprBorda} val={line.bordaLengthM} on={(v) => set(idx, { bordaLengthM: v })} />
                    <NumCell label="Alt. queda (cm)" hint={H.altQueda} val={line.alturaQuedaM != null ? Math.round(line.alturaQuedaM * 100) : undefined} on={(v) => set(idx, { alturaQuedaM: v != null ? v / 100 : undefined })} step="1" w="w-16" />
                    <NumCell label="Filme mm" hint={H.filme} val={line.filmeMm} on={(v) => set(idx, { filmeMm: v })} step="0.5" ph="6" w="w-12" />
                    <NumCell label="Horas/dia" hint={H.horas} val={line.horasDia} on={(v) => set(idx, { horasDia: v })} step="1" ph="24" w="w-12" />
                    <SelectCell label="Captacao" hint={H.captacao} w="w-32" value={cap} on={(v) => set(idx, { captacao: v as Captacao })} options={[["RESERVATORIO", "Reservatorio"], ["CANALETA", "Canaleta"], ["DIRETO", "Direto"]]} />
                    {cap === "RESERVATORIO" && (
                      <>
                        <NumCell label="Res. C" hint={H.reserv} val={line.reservComprM} on={(v) => set(idx, { reservComprM: v })} w="w-14" />
                        <NumCell label="Res. L" val={line.reservLargM} on={(v) => set(idx, { reservLargM: v })} w="w-14" />
                        <NumCell label="Res. P" val={line.reservProfM} on={(v) => set(idx, { reservProfM: v })} w="w-14" />
                        <BoolSelectCell label="Superficie" hint={H.reservAberto} w="w-36" val={line.reservAberto} on={(v) => set(idx, { reservAberto: v })} trueLabel="Aberta (evapora)" falseLabel="Tampada" />
                      </>
                    )}
                    {cap === "CANALETA" && (
                      <>
                        <NumCell label="Canal. C" hint={H.canaleta} val={line.canaletaComprM} on={(v) => set(idx, { canaletaComprM: v })} w="w-16" />
                        <NumCell label="Canal. L" hint={H.canaletaLarg} val={line.canaletaLargM} on={(v) => set(idx, { canaletaLargM: v })} ph="0.15" w="w-14" />
                        <NumCell label="Ralos" hint={H.ralos} val={line.ralosQty} on={(v) => set(idx, { ralosQty: v })} step="1" w="w-12" />
                        <NumCell label="Ø ralo" hint={H.raloDiam} val={line.raloDiamMm} on={(v) => set(idx, { raloDiamMm: v })} step="1" w="w-12" />
                        <BoolSelectCell label="Superficie" hint={H.canaletaAberta} w="w-36" val={line.canaletaAberta} on={(v) => set(idx, { canaletaAberta: v })} trueLabel="Aberta (evapora)" falseLabel="Tampada" />
                      </>
                    )}
                    {cap !== "DIRETO" && (
                      <>
                        <NumCell label="Tubos (nº)" hint={H.tubos} val={line.tubosQty} on={(v) => set(idx, { tubosQty: v })} step="1" ph="1" w="w-12" />
                        <NumCell label="Tubo C" hint={H.tuboC} val={line.tuboComprimentoM} on={(v) => set(idx, { tuboComprimentoM: v })} w="w-16" />
                        <NumCell label="Curvas" hint={H.curvas} val={line.curvas90Qty} on={(v) => set(idx, { curvas90Qty: v })} step="1" w="w-12" />
                        <NumCell label="Desnível" hint={H.desnivel} val={line.tuboDesnivelM} on={(v) => set(idx, { tuboDesnivelM: v })} w="w-14" />
                      </>
                    )}
                  </div>
                </div>
                {line.alturaQuedaM != null && line.alturaQuedaM > 1.4 && (
                  <div className="border-t border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                    ⚠ Altura de queda {Math.round(line.alturaQuedaM * 100)} cm é alta (esperado &lt; 140 cm) — confira se não digitou metros no lugar de cm.
                  </div>
                )}
                {r && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-slate-200 px-2 py-1.5 text-[11px] text-slate-700">
                    {r.transbordoM3h != null && <span>Transbordo <b className="tabular-nums">{r.transbordoM3h} m³/h</b></span>}
                    {r.drenagemDesignM3h != null && <span>· drenagem/surge <b className="tabular-nums">{r.drenagemDesignM3h} m³/h</b></span>}
                    {r.tubo && <span>· Tubo <b className="tabular-nums">{r.tubosQty && r.tubosQty > 1 ? `${r.tubosQty}× ` : ""}DN{r.tubo.diametroMm}</b> {r.tubo.suficiente ? <b className="text-emerald-700">✓ suficiente{r.tubo.fillPercentReal < 35 ? " (folgado, da pra reduzir)" : ""}</b> : <b className="text-red-600">⚠ insuficiente</b>} <span className="text-slate-500">({r.tubo.fillPercentReal}% do tubo no pico · {r.tubo.velocidadeMs} m/s · caim. {r.tubo.caimentoPct}%)</span></span>}
                    {cap === "CANALETA" && r.ralosSugeridos != null && (
                      <span>· Ralos: <b className="tabular-nums">{r.ralosSugeridos}× Ø{line.raloDiamMm || 100}mm</b> (~{r.raloCapacidadeM3h} m³/h cada){line.ralosQty != null && line.ralosQty > 0 && line.ralosQty < r.ralosSugeridos && <span className="text-red-600"> · ⚠ informado {line.ralosQty} {"<"} sugerido</span>}</span>
                    )}
                    {r.reservatorioVolumeM3 != null && r.reservatorioVolumeM3 > 0 && <span>· Reserv. <b className="tabular-nums">{r.reservatorioVolumeM3} m³</b></span>}
                    {cap === "DIRETO" && <span className="text-slate-400">· cai direto no master</span>}
                    {r.aviso && <span className="w-full text-red-600">⚠ {r.aviso}</span>}
                  </div>
                )}
              </div>
            );
          })}

          {lines.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">Banhistas (opcional):<HelpHint text={H.banhistas} tone="cyan" width={260} />
                  <input type="number" step="1" className="w-16 rounded border border-slate-300 px-2 py-1 text-sm" value={bathers ?? ""} onChange={(e) => onChange?.(lines, parseNum(e.target.value), surge)} /></span>
                <span className="flex items-center gap-1.5">Fator de surge (ondas):<HelpHint text={H.surge} tone="cyan" width={300} />
                  <input type="number" step="0.5" placeholder="2" className="w-16 rounded border border-slate-300 px-2 py-1 text-sm" value={surge ?? ""} onChange={(e) => onChange?.(lines, bathers, parseNum(e.target.value))} /></span>
              </div>
              {demand && (
                <div className="rounded-xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-orange-700">🔥 Calorias necessárias (com a borda)</div>
                      <div className="text-2xl font-bold text-orange-900 tabular-nums">{demand.comBordaKcalH.toLocaleString("pt-BR")} <span className="text-sm font-semibold">kcal/h</span></div>
                      <div className="text-[11px] text-orange-700/80 tabular-nums">{demand.comBordaKw.toFixed(1).replace(".", ",")} kW · pior mês</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500">Sem a borda: <b className="tabular-nums">{demand.semBordaKcalH.toLocaleString("pt-BR")}</b> kcal/h</div>
                      <div className={"text-sm font-bold tabular-nums " + (demand.deltaKcalH > 0 ? "text-orange-700" : "text-slate-500")}>
                        {demand.deltaKcalH > 0 ? "+" : ""}{demand.deltaKcalH.toLocaleString("pt-BR")} kcal/h da borda
                      </div>
                      <div className="text-[10px] text-slate-400">mude altura/filme/canaleta e veja mexer</div>
                    </div>
                  </div>
                </div>
              )}
              {report && (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {[
                    ["Vazão de bomba", `${report.totals.vazaoBombaSugeridaM3h} m³/h`, ""],
                    ["Volume térmico extra", `${report.totals.volumeTermicoExtraM3} m³`, "✓ somado ao volume total da piscina"],
                    ["Área de evaporação", `${report.totals.areaEvaporacaoExtraM2} m²`, "✓ entra no aquecimento (lâminas + superfícies)"],
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
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">
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
