"use client";

/**
 * Datasheets de aquecimento como BLOCOS do relatorio (display-only).
 * Renderiza a partir do report CACHEADO no orcamento (heatingReport), SEM os
 * controles editaveis do Simulador (a edicao continua na HeatingSimulatorModal).
 *
 * ATENCAO (debito tecnico deliberado): os graficos (SeasonalCurve) e helpers
 * `ds*` sao uma COPIA do que existe em HeatingSimulatorModal.tsx. Optei por
 * duplicar (puro SVG/funcao) pra NAO arriscar o modal calibrado (que nao tem
 * preview). Reconciliar depois extraindo pra um modulo unico, com build verify.
 *
 * Recirc: o consumo da bomba de recirculacao vem live do TrocadorPumpPipeCard
 * (nao cacheado limpo) -> esta v1 mostra so o consumo da BOMBA DE CALOR (exato).
 */
import type { BudgetReportData } from "./BudgetReport";

const MESES = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const n = (v: any, casas = 2) => (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: casas });
const brl = (cents: any) => `R$ ${((Number(cents) || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dec = (v: any, d = 2) => (Number(v) || 0).toFixed(d).replace(".", ",");
const dsMoney = (cents: any) => ((Number(cents) || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function dsNiceCeil(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const r = v / base;
  const nice = r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10;
  return nice * base;
}
function dsSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}` : "";
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}
const dsAbbrev = (name: string) => (name || "").slice(0, 3).replace(/^\w/, (c) => c.toUpperCase());

// Curva sazonal de consumo (copia display-only do SeasonalCurve do modal).
function SeasonalCurve({ monthly, criticalIndex }: { monthly: { monthName: string; kwhConsumido: number; custoBRLCents: number }[]; criticalIndex: number }) {
  const X0 = 44, X1 = 512, YT = 20, YB = 148;
  const vals = monthly.map((m) => Number(m.kwhConsumido) || 0);
  const minVal = Math.min(...vals), maxVal = Math.max(1, ...vals);
  const span = Math.max(1, maxVal - minVal);
  const step = dsNiceCeil(span / 4) || 1;
  const scaleMin = Math.max(0, Math.floor((minVal - span * 0.2) / step) * step);
  const scaleMax = Math.ceil((maxVal + span * 0.12) / step) * step;
  const range = Math.max(1, scaleMax - scaleMin);
  const xFor = (i: number) => X0 + (i / 11) * (X1 - X0);
  const yFor = (v: number) => YB - ((v - scaleMin) / range) * (YB - YT);
  const pts = monthly.map((m, i) => ({ x: xFor(i), y: yFor(Number(m.kwhConsumido) || 0) }));
  const line = dsSmoothPath(pts);
  const area = `${line} L${X1.toFixed(1)},${YB} L${X0.toFixed(1)},${YB} Z`;
  const grid: { y: number; val: number }[] = [];
  for (let g = scaleMin + step; g <= scaleMax + 0.5; g += step) grid.push({ y: YB - ((g - scaleMin) / range) * (YB - YT), val: Math.round(g) });
  const ci = criticalIndex >= 0 && criticalIndex < pts.length ? criticalIndex : vals.indexOf(maxVal);
  const peak = pts[ci] ?? pts[0];
  const cm = monthly[ci];
  const calloutText = cm ? `${dsAbbrev(cm.monthName)} ${Math.round(cm.kwhConsumido).toLocaleString("pt-BR")} kWh` : "";
  const calloutW = Math.min(220, Math.max(96, calloutText.length * 5 + 14));
  const calloutCx = Math.max(X0 + calloutW / 2, Math.min(X1 - calloutW / 2, peak.x));
  return (
    <svg viewBox="0 0 520 168" width="100%" style={{ display: "block", marginTop: 4 }} preserveAspectRatio="none">
      {grid.map((g, i) => (<line key={i} x1={X0} y1={g.y} x2={X1} y2={g.y} stroke={i === 0 ? "#e2e8f0" : "#f1f5f9"} strokeWidth={1} />))}
      {grid.map((g, i) => (<text key={`t${i}`} x={X0 - 4} y={g.y + 3} textAnchor="end" fontSize={8} fill="#94a3b8">{g.val.toLocaleString("pt-BR")}</text>))}
      <path d={area} fill="#ecfeff" />
      <path d={line} fill="none" stroke="#0e7490" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <line x1={peak.x} y1={peak.y} x2={peak.x} y2={YB} stroke="#0e7490" strokeWidth={1} strokeDasharray="2 2" opacity={0.5} />
      {pts.map((p, i) => (<circle key={i} cx={p.x} cy={p.y} r={i === ci ? 3.4 : 1.8} fill="#0e7490" stroke={i === ci ? "#fff" : undefined} strokeWidth={i === ci ? 1.5 : undefined} />))}
      <rect x={calloutCx - calloutW / 2} y={6} width={calloutW} height={17} rx={4} fill="#0e7490" />
      <text x={calloutCx} y={17.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">{calloutText}</text>
      {monthly.map((m, i) => (<text key={i} x={xFor(i)} y={161} textAnchor="middle" fontSize={8} fill={i === ci ? "#0e7490" : "#64748b"} fontWeight={i === ci ? 700 : undefined}>{dsAbbrev(m.monthName)}</text>))}
    </svg>
  );
}

const DS_CSS = `
.ds-bomba-rep { width:100%; background:#fff; color:#0f172a; font-size:11px; line-height:1.3; }
.ds-bomba-rep * { box-sizing:border-box; }
.ds-bomba-rep .num { font-variant-numeric: tabular-nums; }
.ds-bomba-rep .lbl { font-size:8px; text-transform:uppercase; letter-spacing:.08em; color:#64748b; font-weight:700; line-height:1; }
.ds-bomba-rep .sec { font-size:8.5px; text-transform:uppercase; letter-spacing:.14em; color:#64748b; font-weight:700; border-bottom:1px solid #e2e8f0; padding-bottom:3px; }
.ds-bomba-rep .banner { background:#1e3a8a; color:#fff; padding:5px 18px; font-size:9px; text-transform:uppercase; letter-spacing:.18em; font-weight:700; }
.ds-bomba-rep .card { border:1px solid #e2e8f0; border-radius:8px; background:#fff; }
.ds-bomba-rep .chip { display:inline-flex; align-items:center; gap:4px; border:1px solid #e2e8f0; background:#f1f5f9; color:#475569; border-radius:4px; font-size:9px; font-weight:700; padding:1px 7px; }
.ds-bomba-rep .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:5px; }
.ds-bomba-rep .pico { border:1px solid #e2e8f0; border-radius:4px; padding:3px 6px; background:#fff; }
.ds-bomba-rep .pico .v { font-size:11px; font-weight:700; color:#0f172a; line-height:1.2; }
.ds-bomba-rep table { width:100%; border-collapse:collapse; }
`;

function Pico({ label, value, unit }: { label: string; value: any; unit?: string }) {
  return <div className="pico"><div className="lbl">{label}</div><div className="v num">{value}{unit ? <span style={{ fontSize: 8, color: "#64748b", fontWeight: 600 }}> {unit}</span> : null}</div></div>;
}
function Amber({ label, value, unit }: { label: string; value: any; unit?: string }) {
  return <div style={{ border: "1px solid #fcd34d", background: "#fffbeb", borderRadius: 4, padding: "3px 6px" }}><div className="lbl" style={{ color: "#b45309" }}>{label}</div><div className="num" style={{ fontSize: 11, fontWeight: 800, color: "#78350f" }}>{value}{unit ? <span style={{ fontSize: 8 }}> {unit}</span> : null}</div></div>;
}

/** Datasheet da BOMBA DE CALOR — display-only a partir do heatingReport cacheado. */
export function BombaDatasheetBlock({ data }: { data: BudgetReportData }) {
  const hr: any = (data as any).heatingReport;
  const ep: any = (data as any).environmentParams || {};
  const dims: any = data.dimensions || {};
  if (!hr || !hr.qtotalMaxKw) {
    return <div className="rp-empty">Simulacao de aquecimento (Bomba de Calor) nao calculada neste orcamento. Abra o Simulador e calcule.</div>;
  }
  const eq: any = hr.selectedEquipment || null;
  const localName = hr.cityResolved ? `${hr.cityResolved.name || ""}${hr.cityResolved.uf ? " - " + hr.cityResolved.uf : ""}` : (ep.cidade || "—");
  const tipoConstrucao = ep.tipoConstrucao || ep.construcao || "—";
  const tempIni = Number(ep.tempAguaInicial ?? hr?.inputs?.tempAguaInicial ?? 0);
  const tempFim = Number(ep.tempAguaDesejada ?? hr?.inputs?.tempAguaDesejada ?? 0);

  const demandaKw = Number(hr.qtotalMaxKw) || 0;
  const loadR = Number(eq?.loadRatio) || 0;
  const capacidadeKw = loadR > 0 ? demandaKw / loadR : (Number(eq?.kwNominal) || 0) * Math.max(1, eq?.quantity || 1);
  const folgaPct = demandaKw > 0 && capacidadeKw > 0 ? Math.round((capacidadeKw / demandaKw - 1) * 100) : 0;
  const demandaPct = capacidadeKw > 0 ? Math.min(100, (demandaKw / capacidadeKw) * 100) : 0;
  const copVals = eq ? [
    { lbl: "COP max", v: Number(eq.copMax) || 0, c: "#475569" },
    { lbl: "Verao 50%", v: Number(eq.copAt50Air26) || 0, c: "#b45309" },
    { lbl: "Inverno 50%", v: Number(eq.copAt50Air15) || 0, c: "#0e7490" },
  ].filter((c) => c.v > 0) : [];
  const copRef = Math.max(1, ...copVals.map((c) => c.v));
  const q = Math.max(1, eq?.quantity || 1);
  const vmin = Number(eq?.vazaoMinM3h) > 0 ? Number(eq?.vazaoMinM3h) * q : 0;
  const vmax = Number(eq?.vazaoMaxM3h) > 0 ? Number(eq?.vazaoMaxM3h) * q : 0;
  const vazaoStr = vmin <= 0 && vmax <= 0 ? "—" : (vmax > vmin && vmin > 0 ? `${dec(vmin, 1)} – ${dec(vmax, 1)}` : dec(vmin || vmax, 1));

  const mc: any[] = Array.isArray(hr.monthlyConsumption) ? hr.monthlyConsumption : [];
  const critIdx = mc.findIndex((m) => m.monthIndex === hr.qtotalMonthCritical);
  const bombaKwh = Number(hr.annualKwh) || 0;

  return (
    <div className="ds-bomba-rep">
      <style dangerouslySetInnerHTML={{ __html: DS_CSS }} />

      {/* HEADER */}
      <div style={{ background: "linear-gradient(90deg,#0f172a,#1e3a8a)", color: "#fff", padding: "7px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".18em", color: "#fcd34d", fontWeight: 600 }}>Aquecimento para piscinas</div>
          <div style={{ fontSize: 14.5, fontWeight: 800, marginTop: 1, lineHeight: 1.1 }}>Dimensionamento para Bomba de Calor</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".18em", color: "#cbd5e1" }}>Orcamento</div>
          <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.05 }} className="num">{data.code ?? "—"}</div>
        </div>
      </div>

      {/* CLIENTE + DIM/CONFIG */}
      <div style={{ padding: "7px 18px", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ fontWeight: 800, fontSize: 11.5 }}>{data.clientName ?? "—"}</div>
        <div style={{ fontSize: 10.5, color: "#334155", marginTop: 1 }}>Projeto: {data.title || "—"} · Local: {localName}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
          <div>
            <div className="sec">Dimensoes da piscina</div>
            <div className="grid2" style={{ marginTop: 5 }}>
              <Pico label="Comp." value={dec(dims.length)} />
              <Pico label="Larg." value={dec(dims.width)} />
              <Amber label="Area" value={dec(dims.area)} unit="m2" />
              <Amber label="Volume" value={dec(dims.volume)} unit="m3" />
            </div>
          </div>
          <div>
            <div className="sec">Configuracao do aquecimento</div>
            <div className="grid2" style={{ marginTop: 5 }}>
              <Pico label="Capa termica" value={ep.capaTermica ? "Sim" : "Nao"} />
              <Pico label="Vento" value={ep.vento ? String(ep.vento).toLowerCase() : "—"} />
              <Amber label="Temp. inicial" value={dec(tempIni, 0)} unit="C" />
              <Amber label="Temp. final" value={dec(tempFim, 0)} unit="C" />
            </div>
          </div>
        </div>
      </div>

      {/* DIMENSIONAMENTO */}
      <div className="banner">Dimensionamento</div>
      <div style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gap: 14, padding: "7px 18px", borderBottom: "1px solid #e2e8f0" }}>
        <div>
          <div className="sec">Resultado do calculo</div>
          <div style={{ marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 6px", borderBottom: "1px solid #e2e8f0", background: "#fffbeb" }}><span className="lbl" style={{ color: "#92400e" }}>Calor necessario · mes critico</span><span className="num" style={{ fontSize: 12, fontWeight: 800, color: "#b45309" }}>{n(hr.calorNecessarioKcalH, 0)} <span style={{ fontSize: 8, color: "#a16207" }}>Kcal/h</span></span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 6px", borderBottom: "1px solid #e2e8f0" }}><span className="lbl">Potencia termica</span><span className="num" style={{ fontSize: 11, fontWeight: 800 }}>{dec(hr.qtotalMaxKw, 1)} <span style={{ fontSize: 8, color: "#64748b" }}>kW</span></span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 6px", borderBottom: "1px solid #e2e8f0" }}><span className="lbl">Equivalente</span><span className="num" style={{ fontSize: 11, fontWeight: 800 }}>{n(hr.calorNecessarioBtuH, 0)} <span style={{ fontSize: 8, color: "#64748b" }}>Btu/h</span></span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 6px", borderBottom: "1px solid #e2e8f0" }}><span className="lbl">Vazao de agua · min–max</span><span className="num" style={{ fontSize: 11, fontWeight: 800 }}>{vazaoStr} <span style={{ fontSize: 8, color: "#64748b" }}>m3/h</span></span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 6px", borderBottom: "1px solid #e2e8f0" }}><span className="lbl">Mes critico</span><span style={{ fontSize: 11, fontWeight: 800, color: "#0e7490" }}>{MESES[hr.qtotalMonthCritical] ?? "—"}</span></div>
          </div>
          {copVals.length > 0 && (
            <>
              <div className="sec" style={{ marginTop: 9 }}>Rendimento (COP) por estacao</div>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 5 }}>
                {copVals.map((c) => (
                  <div key={c.lbl} style={{ display: "grid", gridTemplateColumns: "66px 1fr 30px", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 9, color: c.c, fontWeight: 600 }}>{c.lbl}</span>
                    <div style={{ height: 9, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${(c.v / copRef) * 100}%`, height: "100%", background: c.c }}></div></div>
                    <span className="num" style={{ fontSize: 10, fontWeight: 800, textAlign: "right", color: c.c }}>{dec(c.v, 1)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {capacidadeKw > 0 && demandaKw > 0 && (
            <>
              <div className="sec" style={{ marginTop: 9 }}>Capacidade × Demanda</div>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "grid", gridTemplateColumns: "66px 1fr 52px", alignItems: "center", gap: 6 }}><span style={{ fontSize: 9, color: "#475569", fontWeight: 600 }}>Demanda</span><div style={{ height: 11, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${demandaPct}%`, height: "100%", background: "#94a3b8" }}></div></div><span className="num" style={{ fontSize: 9.5, fontWeight: 800, textAlign: "right" }}>{dec(demandaKw, 1)} kW</span></div>
                <div style={{ display: "grid", gridTemplateColumns: "66px 1fr 52px", alignItems: "center", gap: 6 }}><span style={{ fontSize: 9, color: "#047857", fontWeight: 600 }}>Capacidade</span><div style={{ height: 11, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}><div style={{ width: "100%", height: "100%", background: "#047857" }}></div></div><span className="num" style={{ fontSize: 9.5, fontWeight: 800, textAlign: "right", color: "#047857" }}>{dec(capacidadeKw, 1)} kW</span></div>
                {folgaPct !== 0 && (<div style={{ display: "flex", justifyContent: "flex-end" }}><span className="chip" style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#047857" }}>{folgaPct > 0 ? "+" : ""}{folgaPct}% de folga</span></div>)}
              </div>
            </>
          )}
        </div>
        <div>
          {eq ? (
            <div>
              <div className="sec">Bomba de calor selecionada</div>
              <div style={{ marginTop: 5 }}><span style={{ display: "inline-block", border: "1px solid #fcd34d", background: "#fffbeb", borderRadius: 5, padding: "2px 7px", fontSize: 12.5, fontWeight: 800 }}>{eq.modelName}</span> {eq.quantity > 1 ? <span className="chip" style={{ background: "#fef3c7", borderColor: "#fcd34d", color: "#92400e", marginLeft: 6 }}>⚡ {eq.quantity}× em paralelo</span> : <span className="chip" style={{ marginLeft: 6 }}>1 unidade</span>}</div>
              <div className="card" style={{ marginTop: 5, padding: "7px 8px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                  <div style={{ background: "#f8fafc", borderRadius: 4, padding: "4px 7px" }}><div className="lbl">Capacidade</div><div className="num" style={{ fontSize: 11, fontWeight: 800 }}>{n(eq.kcalHNominal, 0)} Kcal/h</div></div>
                  {eq.kwNominal ? <div style={{ background: "#f8fafc", borderRadius: 4, padding: "4px 7px" }}><div className="lbl">Pot. termica</div><div className="num" style={{ fontSize: 11, fontWeight: 800 }}>{dec(eq.kwNominal, 1)} kW</div></div> : null}
                  {eq.consumoMedioW ? <div style={{ background: "#f8fafc", borderRadius: 4, padding: "4px 7px" }}><div className="lbl">Consumo medio</div><div className="num" style={{ fontSize: 11, fontWeight: 800 }}>{dec(Number(eq.consumoMedioW) / 1000, 1)} kW</div></div> : null}
                </div>
                <div style={{ marginTop: 7, fontSize: 10, color: "#047857" }}>Carga <strong className="num" style={{ fontSize: 12 }}>{(loadR * 100).toFixed(0)}%</strong> · {eq.isAdequate ? "folga adequada" : "fora da faixa"}</div>
                <div style={{ marginTop: 5, fontSize: 9.5, color: "#475569", borderTop: "1px solid #f1f5f9", paddingTop: 4 }}>
                  {hr.timeToHeatInfeasible ? <span style={{ color: "#be123c", fontWeight: 700 }}>⛔ Nao aquece nas condicoes atuais</span>
                    : <>Aquece de <strong className="num" style={{ color: "#0f172a" }}>{dec(tempIni, 0)} → {dec(tempFim, 0)} °C</strong> em <strong className="num" style={{ color: "#0f172a" }}>{hr.timeToHeatHours && isFinite(hr.timeToHeatHours) ? Math.floor(hr.timeToHeatHours) : "—"} h</strong>{hr.degreesPerHour ? <span style={{ color: "#94a3b8" }}> ({dec(hr.degreesPerHour)} °C/h)</span> : null}</>}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ borderRadius: 8, border: "1px solid #fcd34d", background: "#fffbeb", padding: "8px 12px", fontSize: 12, color: "#92400e" }}>Nenhum equipamento selecionado no Simulador.</div>
          )}
        </div>
      </div>

      {/* SIMULACAO */}
      <div className="banner">Simulacao de consumo mensal</div>
      {mc.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "7fr 5fr", gap: 14, padding: "7px 18px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
              <div style={{ border: "1px solid #cffafe", background: "#ecfeff", borderRadius: 8, padding: "4px 8px" }}><div className="lbl" style={{ color: "#0e7490" }}>Bomba calor · ano</div><div className="num" style={{ fontSize: 15, fontWeight: 800, color: "#155e75", lineHeight: 1.1 }}>{n(bombaKwh, 0)}</div><div style={{ fontSize: 8, color: "#0e7490", fontWeight: 600 }}>kWh</div></div>
              <div style={{ border: "1px solid #fed7aa", background: "#fff7ed", borderRadius: 8, padding: "4px 8px" }}><div className="lbl" style={{ color: "#c2410c" }}>Custo bomba · ano</div><div className="num" style={{ fontSize: 13.5, fontWeight: 800, color: "#9a3412", lineHeight: 1.1 }}>{brl(hr.annualCostBRLCents)}</div><div style={{ fontSize: 8, color: "#c2410c", fontWeight: 600 }}>por ano</div></div>
              <div style={{ border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 8, padding: "4px 8px" }}><div className="lbl">COP efetivo</div><div className="num" style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>{hr.copEstimated ? dec(hr.copEstimated, 1) : "—"}</div><div style={{ fontSize: 8, color: "#64748b", fontWeight: 600 }}>clima local</div></div>
            </div>
            <div className="card" style={{ marginTop: 8, padding: "7px 9px 4px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}><div className="sec" style={{ border: 0, padding: 0 }}>Curva sazonal de consumo · kWh/mes</div><div style={{ fontSize: 9, color: "#64748b" }}>pico no <b style={{ color: "#0e7490" }}>inverno</b></div></div>
              <SeasonalCurve monthly={mc as any} criticalIndex={critIdx} />
            </div>
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            <table style={{ fontSize: 10 }}>
              <thead><tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}><th style={{ textAlign: "left", padding: "4px 9px", fontSize: 9, color: "#334155", fontWeight: 700 }}>Mes</th><th style={{ textAlign: "right", padding: "4px 9px", fontSize: 9, color: "#334155", fontWeight: 700 }}>kWh</th><th style={{ textAlign: "right", padding: "4px 9px", fontSize: 9, color: "#334155", fontWeight: 700 }}>R$</th></tr></thead>
              <tbody>
                {mc.map((m, i) => { const isCrit = i === critIdx; return (
                  <tr key={m.monthIndex} style={{ borderBottom: "1px solid #f1f5f9", background: isCrit ? "#cffafe" : undefined }}>
                    <td style={{ padding: "3.4px 9px", color: isCrit ? "#155e75" : "#334155", fontWeight: isCrit ? 800 : undefined }}>{m.monthName}{isCrit ? " ▲" : ""}</td>
                    <td className="num" style={{ padding: "3.4px 9px", textAlign: "right", color: isCrit ? "#155e75" : undefined, fontWeight: isCrit ? 800 : undefined }}>{n(m.kwhConsumido, 0)}</td>
                    <td className="num" style={{ padding: "3.4px 9px", textAlign: "right", color: isCrit ? "#0e7490" : "#047857", fontWeight: isCrit ? 800 : 700 }}>{dsMoney(m.custoBRLCents)}</td>
                  </tr>
                ); })}
                <tr style={{ background: "#f1f5f9" }}><td style={{ padding: "5px 9px", fontWeight: 800 }}>Total bomba:</td><td className="num" style={{ padding: "5px 9px", textAlign: "right", fontWeight: 800 }}>{n(bombaKwh, 0)}</td><td className="num" style={{ padding: "5px 9px", textAlign: "right", color: "#0e7490", fontWeight: 800 }}>{brl(hr.annualCostBRLCents)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ padding: "10px 18px", fontSize: 11, color: "#64748b" }}>Consumo mensal nao disponivel.</div>
      )}

      {/* FOOTER */}
      <div style={{ padding: "6px 18px", borderTop: "1px solid #e2e8f0", fontSize: 9, color: "#64748b", lineHeight: 1.45 }}>
        Dimensionamento conforme NBR 10.339. Capacidade da bomba de calor selecionada para o mes mais frio (critico) da localidade. Consumo estimado com COP ajustado pela temperatura media de cada mes e tarifa configurada no sistema. Valores referentes a BOMBA DE CALOR (a recirculacao adiciona consumo, dimensionada no Simulador).
      </div>
    </div>
  );
}
