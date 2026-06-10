"use client";
// Preview ISOLADO da V1 (datasheet "curva sazonal" da Bomba de Calor) — sem login/backend.
// Renderiza o datasheet na largura de conteudo do A4 (clone usa 3mm de padding => ~772px)
// e mede a altura vs A4 util (~1101px) pra garantir 1 pagina. Dados mock fieis.
// URL: localhost:3000/dev/print-test-bomba
import { useEffect, useState } from "react";

// A4 retrato: 794x1123px @96dpi. Clone de impressao usa padding 3mm (~11px) => area util ~772x1101.
const A4_W = 772;
const A4_H_UTIL = 1101;

const V1_HTML = `
<style>
  .ds-bomba * { box-sizing: border-box; margin:0; padding:0; }
  .ds-bomba { width:100%; background:#fff; color:#0f172a; font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; font-size:11px; line-height:1.3; }
  .ds-bomba .num { font-variant-numeric: tabular-nums; }
  .ds-bomba .lbl { font-size:8px; text-transform:uppercase; letter-spacing:.08em; color:#64748b; font-weight:700; line-height:1; }
  .ds-bomba .sec { font-size:8.5px; text-transform:uppercase; letter-spacing:.14em; color:#64748b; font-weight:700; border-bottom:1px solid #e2e8f0; padding-bottom:3px; }
  .ds-bomba .banner { background:#1e3a8a; color:#fff; padding:5px 18px; font-size:9px; text-transform:uppercase; letter-spacing:.18em; font-weight:700; }
  .ds-bomba .card { border:1px solid #e2e8f0; border-radius:8px; background:#fff; }
  .ds-bomba .chip { display:inline-flex; align-items:center; gap:4px; border:1px solid #e2e8f0; background:#f1f5f9; color:#475569; border-radius:4px; font-size:9px; font-weight:700; padding:1px 7px; }
  .ds-bomba .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:5px; }
  .ds-bomba .pico { border:1px solid #e2e8f0; border-radius:4px; padding:3px 6px; background:#fff; }
  .ds-bomba .pico .lbl { color:#64748b; }
  .ds-bomba .pico .v { font-size:11px; font-weight:700; color:#0f172a; line-height:1.2; }
  .ds-bomba table { width:100%; border-collapse:collapse; }
  .ds-bomba .ex { display:inline-flex; flex-direction:column; align-items:center; gap:1px; border:1px solid #bae6fd; background:#f0f9ff; border-radius:5px; padding:2px 6px 3px; line-height:1; }
  .ds-bomba .exn { font-size:7px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:.02em; line-height:1; }
  .ds-bomba .exr { display:inline-flex; align-items:center; gap:3px; line-height:1; }
</style>
<div class="ds-bomba">
  <div style="background:linear-gradient(90deg,#0f172a,#1e3a8a); color:#fff; padding:7px 18px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
    <div style="display:flex; align-items:center; gap:10px; min-width:0;">
      <div style="height:30px; width:30px; border-radius:6px; background:rgba(255,255,255,.1); display:flex; align-items:center; justify-content:center; font-size:8px; font-weight:800; flex-shrink:0;">LOGO</div>
      <div style="min-width:0;"><div style="font-size:8px; text-transform:uppercase; letter-spacing:.18em; color:#fcd34d; font-weight:600;">Aquecimento para piscinas</div><div style="font-size:14.5px; font-weight:800; margin-top:1px; line-height:1.1;">Dimensionamento para Bomba de Calor</div></div>
    </div>
    <div style="text-align:right; flex-shrink:0;"><div style="font-size:8px; text-transform:uppercase; letter-spacing:.18em; color:#cbd5e1;">Orçamento</div><div style="font-size:17px; font-weight:800; line-height:1.05;" class="num">ORCP-00004</div><div style="font-size:9px; color:#cbd5e1;">10/06/2026</div></div>
  </div>

  <div style="display:grid; grid-template-columns:2fr 1fr; gap:14px; padding:7px 18px; border-bottom:1px solid #e2e8f0;">
    <div style="display:flex; flex-direction:column;">
      <div style="display:flex; gap:14px; align-items:flex-start;">
        <div style="flex:1; min-width:0;">
          <div style="font-weight:800; font-size:11.5px;">WILSON FAGOTTI</div>
          <div style="font-size:10.5px; color:#334155; margin-top:2px;"><span class="lbl">Projeto:</span> PISCINA DE FIBRA</div>
          <div style="font-size:10.5px; color:#334155; margin-top:1px;"><span class="lbl">Local:</span> Primavera do Leste</div>
        </div>
        <div style="flex-shrink:0; max-width:200px;">
          <div style="font-size:7.5px; text-transform:uppercase; letter-spacing:.06em; color:#94a3b8; font-weight:700; margin-bottom:3px; text-align:right;">Extras · kW no calor</div>
          <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end;">
            <div class="ex" title="Cascata"><span class="exn">Cascata</span><span class="exr"><span style="font-size:12px;">🌊</span><span style="font-size:8.5px; color:#0e7490; font-weight:700;" class="num">+2,8</span></span></div>
            <div class="ex" title="SPA / Hidromassagem"><span class="exn">SPA</span><span class="exr"><span style="font-size:12px;">💦</span><span style="font-size:8.5px; color:#0e7490; font-weight:700;" class="num">+1,5</span></span></div>
            <div class="ex" title="Borda infinita"><span class="exn">Borda</span><span class="exr"><span style="font-size:12px;">🏞</span><span style="font-size:8.5px; color:#0e7490; font-weight:700;" class="num">+3,4</span></span></div>
          </div>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:9px;">
        <div>
          <div class="sec">Dimensões da piscina</div>
          <div class="grid2" style="margin-top:5px;">
            <div class="pico"><div class="lbl">Comp.</div><div class="v num">9,10</div></div>
            <div class="pico"><div class="lbl">Larg.</div><div class="v num">3,60</div></div>
            <div class="pico"><div class="lbl">Prof. mín</div><div class="v num">0,00</div></div>
            <div class="pico"><div class="lbl">Prof. máx</div><div class="v num">1,40</div></div>
            <div class="pico"><div class="lbl">Tipo piscina</div><div class="v">Privativa</div></div>
            <div class="pico"><div class="lbl">Construção</div><div class="v">Aberta</div></div>
          </div>
          <div class="grid2" style="margin-top:5px;">
            <div style="border:1.5px solid #fcd34d; border-radius:4px; padding:3px 6px; background:#fffbeb;"><div class="lbl" style="color:#b45309;">Área</div><div style="font-size:14px; font-weight:800; color:#78350f; line-height:1.15;" class="num">34,47 <span style="font-size:9px;">m²</span></div></div>
            <div style="border:1.5px solid #fcd34d; border-radius:4px; padding:3px 6px; background:#fffbeb;"><div class="lbl" style="color:#b45309;">Volume</div><div style="font-size:14px; font-weight:800; color:#78350f; line-height:1.15;" class="num">47,32 <span style="font-size:9px;">m³</span></div></div>
          </div>
        </div>
        <div>
          <div class="sec">Configuração do aquecimento</div>
          <div class="grid2" style="margin-top:5px;">
            <div class="pico"><div class="lbl">Capa térmica</div><div class="v">Sim</div></div>
            <div class="pico"><div class="lbl">Vento</div><div class="v">Moderado</div></div>
            <div class="pico"><div class="lbl">Cidade</div><div class="v" style="font-size:10px;">Primavera do Leste</div></div>
            <div class="pico"><div class="lbl">Estado</div><div class="v">MT</div></div>
          </div>
          <div class="grid2" style="margin-top:5px;">
            <div style="border:1.5px solid #fcd34d; border-radius:4px; padding:3px 6px; background:#fffbeb;"><div class="lbl" style="color:#b45309;">Temp. inicial</div><div style="font-size:14px; font-weight:800; color:#78350f; line-height:1.15;" class="num">23 <span style="font-size:9px;">°C</span></div></div>
            <div style="border:1.5px solid #fcd34d; border-radius:4px; padding:3px 6px; background:#fffbeb;"><div class="lbl" style="color:#b45309;">Temp. final</div><div style="font-size:14px; font-weight:800; color:#78350f; line-height:1.15;" class="num">32 <span style="font-size:9px;">°C</span></div></div>
          </div>
          <div style="margin-top:4px; border:1.5px solid #fcd34d; border-radius:4px; padding:2px 7px; background:#fffbeb;"><div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-size:8.5px; font-weight:700; color:#b45309; text-transform:uppercase; letter-spacing:.03em;">Aquecimento ΔT</span><span style="font-size:11px; font-weight:800; color:#78350f;" class="num">+9 <span style="font-size:7.5px;">°C</span></span></div><div style="height:6px; border-radius:3px; margin-top:2px; background:linear-gradient(90deg,#38bdf8 0%,#fbbf24 55%,#f97316 100%);"></div></div>
        </div>
      </div>
    </div>
    <div style="display:flex; flex-direction:column;">
      <div style="flex:1; border:1px solid #e2e8f0; border-radius:8px; background:linear-gradient(135deg,#334155,#0f172a); overflow:hidden; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:10px; min-height:148px;">[ Imagem da bomba de calor ]</div>
    </div>
  </div>

  <div class="banner">Dimensionamento</div>
  <div style="display:grid; grid-template-columns:5fr 7fr; gap:14px; padding:7px 18px; border-bottom:1px solid #e2e8f0;">
    <div style="display:flex; flex-direction:column;">
      <div class="sec">Resultado do cálculo</div>
      <div style="margin-top:4px;">
        <div style="display:flex; align-items:center; justify-content:space-between; padding:3px 6px; border-bottom:1px solid #e2e8f0; background:#fffbeb;"><span class="lbl" style="color:#92400e;">Calor necessário · mês crítico</span><span style="font-size:12px; font-weight:800; color:#b45309;" class="num">16.164 <span style="font-size:8px; color:#a16207;">Kcal/h</span></span></div>
        <div style="display:flex; align-items:center; justify-content:space-between; padding:3px 6px; border-bottom:1px solid #e2e8f0;"><span class="lbl">Potência térmica</span><span style="font-size:11px; font-weight:800;" class="num">18,8 <span style="font-size:8px; color:#64748b;">kW</span></span></div>
        <div style="display:flex; align-items:center; justify-content:space-between; padding:3px 6px; border-bottom:1px solid #e2e8f0;"><span class="lbl">Equivalente</span><span style="font-size:11px; font-weight:800;" class="num">64.147 <span style="font-size:8px; color:#64748b;">Btu/h</span></span></div>
        <div style="display:flex; align-items:center; justify-content:space-between; padding:3px 6px; border-bottom:1px solid #e2e8f0;"><span class="lbl">Vazão de água · mín–máx</span><span style="font-size:11px; font-weight:800;" class="num">8 – 10 <span style="font-size:8px; color:#64748b;">m³/h</span></span></div>
        <div style="display:flex; align-items:center; justify-content:space-between; padding:3px 6px; border-bottom:1px solid #e2e8f0;"><span class="lbl">Mês crítico</span><span style="font-size:11px; font-weight:800; color:#0e7490;">Julho</span></div>
      </div>
      <div class="sec" style="margin-top:9px;">Rendimento (COP) por estação</div>
      <div style="margin-top:6px; display:flex; flex-direction:column; gap:5px;">
        <div style="display:grid; grid-template-columns:62px 1fr 30px; align-items:center; gap:6px;"><span style="font-size:9px; color:#475569; font-weight:600;">COP máx</span><div style="height:9px; background:#f1f5f9; border-radius:3px; overflow:hidden;"><div style="width:100%; height:100%; background:#475569;"></div></div><span style="font-size:10px; font-weight:800; text-align:right;" class="num">22,2</span></div>
        <div style="display:grid; grid-template-columns:62px 1fr 30px; align-items:center; gap:6px;"><span style="font-size:9px; color:#b45309; font-weight:600;">Verão 50%</span><div style="height:9px; background:#f1f5f9; border-radius:3px; overflow:hidden;"><div style="width:63.5%; height:100%; background:#d97706;"></div></div><span style="font-size:10px; font-weight:800; text-align:right; color:#b45309;" class="num">14,1</span></div>
        <div style="display:grid; grid-template-columns:62px 1fr 30px; align-items:center; gap:6px;"><span style="font-size:9px; color:#0e7490; font-weight:600;">Inverno 50%</span><div style="height:9px; background:#f1f5f9; border-radius:3px; overflow:hidden;"><div style="width:32.9%; height:100%; background:#0e7490;"></div></div><span style="font-size:10px; font-weight:800; text-align:right; color:#0e7490;" class="num">7,3</span></div>
      </div>
      <div style="margin-top:6px; border-radius:4px; background:#ecfeff; border:1px solid #cffafe; padding:4px 7px; font-size:9.5px; color:#155e75;">COP efetivo no clima local <strong class="num">12,4</strong> · varia mês a mês com a temperatura do ar</div>
      <div class="sec" style="margin-top:9px;">Capacidade × Demanda</div>
      <div style="margin-top:6px; display:flex; flex-direction:column; gap:5px;">
        <div style="display:grid; grid-template-columns:62px 1fr 52px; align-items:center; gap:6px;"><span style="font-size:9px; color:#475569; font-weight:600;">Demanda</span><div style="height:11px; background:#f1f5f9; border-radius:3px; overflow:hidden;"><div style="width:73.7%; height:100%; background:#94a3b8;"></div></div><span style="font-size:9.5px; font-weight:800; text-align:right;" class="num">18,8 kW</span></div>
        <div style="display:grid; grid-template-columns:62px 1fr 52px; align-items:center; gap:6px;"><span style="font-size:9px; color:#047857; font-weight:600;">Capacidade</span><div style="height:11px; background:#f1f5f9; border-radius:3px; overflow:hidden;"><div style="width:100%; height:100%; background:#047857;"></div></div><span style="font-size:9.5px; font-weight:800; text-align:right; color:#047857;" class="num">25,5 kW</span></div>
        <div style="display:flex; justify-content:flex-end;"><span class="chip" style="background:#ecfdf5; border-color:#a7f3d0; color:#047857;">+36% de folga</span></div>
      </div>
    </div>
    <div style="display:flex; flex-direction:column; gap:8px;">
      <div>
        <div class="sec">Bomba de calor selecionada</div>
        <div style="margin-top:5px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;"><span style="font-size:12.5px; font-weight:800;">Bomba De Calor Tholz X23-26c Full Inverter 220v</span><span class="chip">1 unidade</span></div>
        <div class="card" style="margin-top:5px; padding:7px 8px;">
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px;">
            <div style="background:#f8fafc; border-radius:4px; padding:4px 7px;"><div class="lbl">Capacidade</div><div style="font-size:11px; font-weight:800;" class="num">21.924 Kcal/h</div></div>
            <div style="background:#f8fafc; border-radius:4px; padding:4px 7px;"><div class="lbl">Pot. térmica</div><div style="font-size:11px; font-weight:800;" class="num">25,5 kW</div></div>
            <div style="background:#f8fafc; border-radius:4px; padding:4px 7px;"><div class="lbl">Consumo médio</div><div style="font-size:11px; font-weight:800;" class="num">2,04 kW</div></div>
          </div>
          <div style="margin-top:7px; display:grid; grid-template-columns:auto 1fr; gap:8px; align-items:center;">
            <div style="font-size:10px; color:#047857; white-space:nowrap;">Carga <strong class="num" style="font-size:12px;">74%</strong> · <span style="color:#047857;">folga adequada</span></div>
            <div style="position:relative; height:12px; background:#f1f5f9; border-radius:4px; overflow:hidden;"><div style="position:absolute; left:60%; width:25%; top:0; bottom:0; background:#ecfdf5;"></div><div style="position:absolute; left:0; top:0; bottom:0; width:74%; background:#047857; border-radius:4px 0 0 4px;"></div><div style="position:absolute; left:74%; top:-2px; bottom:-2px; width:2px; background:#0f172a;"></div></div>
          </div>
          <div style="margin-top:5px; font-size:9.5px; color:#475569; border-top:1px solid #f1f5f9; padding-top:4px;">Aquece de 23 → 32 °C em <strong class="num" style="color:#0f172a;">22 h</strong> <span style="color:#94a3b8;">(0,39 °C/h)</span> · zona ideal de carga 60–85% (faixa verde)</div>
        </div>
      </div>
      <div style="border:1px solid #fcd34d; border-radius:8px; background:#fffbeb; padding:5px 8px;">
        <div style="display:flex; align-items:baseline; justify-content:space-between; gap:8px;"><div style="font-size:8px; text-transform:uppercase; letter-spacing:.07em; color:#92400e; font-weight:700;">Tubulação — perda de carga</div><div style="font-size:14px; font-weight:800; color:#78350f;" class="num">4,49 <span style="font-size:8.5px; font-weight:700;">mca</span></div></div>
        <div style="font-size:8.5px; color:#92400e; margin-top:1px;">= 4,49 mca de atrito · circuito fechado — opera no atrito, mas vence 4 m pra romper a inércia · vel. 1,46 m/s</div>
        <div style="display:grid; grid-template-columns:1fr 1fr auto; gap:6px; align-items:center; margin-top:4px;">
          <span style="font-size:9px; color:#92400e;"><span class="lbl" style="color:#a16207;">Comp.</span> <b style="color:#78350f;" class="num">30 m</b></span>
          <span style="font-size:9px; color:#92400e;"><span class="lbl" style="color:#a16207;">Desnív.</span> <b style="color:#78350f;" class="num">4 m</b></span>
          <span style="display:inline-flex; align-items:center; gap:5px; justify-content:flex-end;"><b style="color:#92400e; font-size:8.5px; text-transform:uppercase; letter-spacing:.05em;">Tubo de PVC:</b><b style="font-size:11.5px; color:#78350f;" class="num">50 mm DN</b><span style="font-size:8px; text-transform:uppercase; letter-spacing:.05em; color:#047857; background:#d1fae5; padding:1px 5px; border-radius:3px; font-weight:700;">auto</span></span>
        </div>
      </div>
      <div class="card" style="padding:5px 8px;">
        <div style="font-size:8px; text-transform:uppercase; letter-spacing:.07em; color:#64748b; font-weight:700; margin-bottom:3px;">Bomba de circulação recomendada</div>
        <div style="display:flex; gap:9px; align-items:stretch;">
          <div style="width:64px; flex-shrink:0; border:1px solid #e2e8f0; border-radius:6px; background:#f8fafc; display:flex; align-items:center; justify-content:center; font-size:9px; color:#94a3b8;">[Img]</div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:11px; font-weight:800; line-height:1.15;">Bomba Pré-filtro Autoescorvante 1/2cv</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1px 12px; margin-top:3px; font-size:9px; color:#334155;">
              <div><span style="color:#64748b;">Potência</span> <b class="num">0,5 cv</b></div>
              <div><span style="color:#64748b;">Vazão</span> <b class="num">9,84 m³/h</b></div>
              <div><span style="color:#64748b;">Pressão</span> <b class="num">12,00 mca</b></div>
              <div style="color:#047857; font-weight:700;">📈 com curva característica</div>
              <div style="grid-column:1 / -1; color:#059669; font-weight:700;">Dimensionamento 0,0% · dentro da faixa</div>
            </div>
            <div style="margin-top:4px; padding-top:3px; border-top:1px solid #f1f5f9; display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
              <div style="font-size:9px; color:#334155;"><span style="color:#64748b;">⚡ Consumo</span> <b class="num" style="font-size:11px;">177</b> <span style="font-size:8px; color:#64748b;">kWh/mês</span> <span style="font-size:8px; color:#94a3b8;">(10,3 h/dia · 0,57 kW)</span></div>
              <div style="font-size:11px; font-weight:800; color:#b45309;" class="num">R$ 203,80<span style="font-size:8px; color:#d97706;">/mês</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="banner">Simulação de consumo mensal</div>
  <div style="display:grid; grid-template-columns:7fr 5fr; gap:14px; padding:7px 18px;">
    <div style="display:flex; flex-direction:column;">
      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:7px;">
        <div style="border:1px solid #cffafe; background:#ecfeff; border-radius:8px; padding:4px 8px;"><div class="lbl" style="color:#0e7490;">Bomba calor · ano</div><div style="font-size:15px; font-weight:800; color:#155e75; line-height:1.1;" class="num">5.805</div><div style="font-size:8px; color:#0e7490; font-weight:600;">kWh</div></div>
        <div style="border:1px solid #cffafe; background:#ecfeff; border-radius:8px; padding:4px 8px;"><div class="lbl" style="color:#0e7490;">Recirculação · ano</div><div style="font-size:15px; font-weight:800; color:#155e75; line-height:1.1;" class="num">2.127</div><div style="font-size:8px; color:#0e7490; font-weight:600;">kWh</div></div>
        <div style="border:1px solid #fed7aa; background:#fff7ed; border-radius:8px; padding:4px 8px;"><div class="lbl" style="color:#c2410c;">Consumo TOTAL · ano</div><div style="font-size:15px; font-weight:800; color:#9a3412; line-height:1.1;" class="num">7.932</div><div style="font-size:8px; color:#c2410c; font-weight:600;">kWh (bomba+recirc)</div></div>
        <div style="border:1px solid #fed7aa; background:#fff7ed; border-radius:8px; padding:4px 8px;"><div class="lbl" style="color:#c2410c;">Custo total · ano</div><div style="font-size:13.5px; font-weight:800; color:#9a3412; line-height:1.1;" class="num">R$ 9.122,82</div><div style="font-size:8px; color:#c2410c; font-weight:600;">por ano</div></div>
      </div>
      <div class="card" style="margin-top:8px; padding:7px 9px 4px; flex:1; display:flex; flex-direction:column;">
        <div style="display:flex; align-items:baseline; justify-content:space-between;"><div class="sec" style="border:0; padding:0;">Curva sazonal de consumo · kWh/mês</div><div style="font-size:9px; color:#64748b;">pico no <b style="color:#0e7490;">inverno</b></div></div>
        <svg viewBox="0 0 520 168" width="100%" style="display:block; margin-top:4px;" preserveAspectRatio="none">
          <line x1="34" y1="20" x2="512" y2="20" stroke="#f1f5f9" stroke-width="1"/><line x1="34" y1="58" x2="512" y2="58" stroke="#f1f5f9" stroke-width="1"/><line x1="34" y1="96" x2="512" y2="96" stroke="#f1f5f9" stroke-width="1"/><line x1="34" y1="134" x2="512" y2="134" stroke="#e2e8f0" stroke-width="1"/>
          <text x="30" y="23" text-anchor="end" font-size="8" fill="#94a3b8">700</text><text x="30" y="61" text-anchor="end" font-size="8" fill="#94a3b8">500</text><text x="30" y="99" text-anchor="end" font-size="8" fill="#94a3b8">300</text><text x="30" y="137" text-anchor="end" font-size="8" fill="#94a3b8">100</text>
          <path d="M44,114.5 C62,118 80,121 98,121.8 C116,122.6 134,113 152,105.7 C170,98.4 188,71 206,53.6 C224,36.2 242,31 260,29.3 C278,27.6 296,49 314,66.8 C332,84.6 350,93 368,101.5 C386,110 404,113 422,114.9 C440,116.8 458,119 476,118.1 C494,117.2 503,116 512,116.3 L512,148 L44,148 Z" fill="#ecfeff"/>
          <path d="M44,114.5 C62,118 80,121 98,121.8 C116,122.6 134,113 152,105.7 C170,98.4 188,71 206,53.6 C224,36.2 242,31 260,29.3 C278,27.6 296,49 314,66.8 C332,84.6 350,93 368,101.5 C386,110 404,113 422,114.9 C440,116.8 458,119 476,118.1 C494,117.2 503,116 512,116.3" fill="none" stroke="#0e7490" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
          <line x1="260" y1="29.3" x2="260" y2="148" stroke="#0e7490" stroke-width="1" stroke-dasharray="2 2" opacity="0.5"/><circle cx="260" cy="29.3" r="3.4" fill="#0e7490" stroke="#fff" stroke-width="1.5"/>
          <circle cx="44" cy="114.5" r="1.8" fill="#0e7490"/><circle cx="98" cy="121.8" r="1.8" fill="#0e7490"/><circle cx="152" cy="105.7" r="1.8" fill="#0e7490"/><circle cx="206" cy="53.6" r="1.8" fill="#0e7490"/><circle cx="314" cy="66.8" r="1.8" fill="#0e7490"/><circle cx="368" cy="101.5" r="1.8" fill="#0e7490"/><circle cx="422" cy="114.9" r="1.8" fill="#0e7490"/><circle cx="476" cy="118.1" r="1.8" fill="#0e7490"/>
          <rect x="196" y="6" width="128" height="17" rx="4" fill="#0e7490"/><text x="260" y="17.5" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">Jul 642 kWh · R$ 738,01</text>
          <g font-size="8" fill="#64748b" text-anchor="middle"><text x="44" y="161">Jan</text><text x="98" y="161">Fev</text><text x="152" y="161">Mar</text><text x="206" y="161">Abr</text><text x="260" y="161" fill="#0e7490" font-weight="700">Jul</text><text x="314" y="161">Ago</text><text x="368" y="161">Set</text><text x="422" y="161">Out</text><text x="476" y="161">Nov</text><text x="512" y="161">Dez</text></g>
        </svg>
      </div>
      <div style="display:grid; grid-template-columns:auto 1fr; gap:12px; align-items:center; margin-top:7px; border:1px solid #e2e8f0; border-radius:8px; padding:7px 10px;">
        <svg viewBox="0 0 84 84" width="84" height="84">
          <circle cx="42" cy="42" r="32" fill="none" stroke="#f1f5f9" stroke-width="14"/>
          <circle cx="42" cy="42" r="32" fill="none" stroke="#0e7490" stroke-width="14" stroke-dasharray="147.2 53.8" stroke-dashoffset="0" transform="rotate(-90 42 42)"/>
          <circle cx="42" cy="42" r="32" fill="none" stroke="#f59e0b" stroke-width="14" stroke-dasharray="53.8 147.2" stroke-dashoffset="-147.2" transform="rotate(-90 42 42)"/>
          <text x="42" y="40" text-anchor="middle" font-size="13" font-weight="800" fill="#0f172a">7.932</text><text x="42" y="51" text-anchor="middle" font-size="7.5" fill="#64748b">kWh/ano</text>
        </svg>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div class="lbl" style="margin-bottom:1px;">Composição do consumo anual</div>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;"><span style="display:flex; align-items:center; gap:6px; font-size:10px;"><span style="width:10px; height:10px; border-radius:2px; background:#0e7490;"></span>Bomba de calor</span><span style="font-size:10px;"><b class="num">5.805</b> kWh · <b style="color:#0e7490;">73%</b></span></div>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;"><span style="display:flex; align-items:center; gap:6px; font-size:10px;"><span style="width:10px; height:10px; border-radius:2px; background:#f59e0b;"></span>Recirculação</span><span style="font-size:10px;"><b class="num">2.127</b> kWh · <b style="color:#b45309;">27%</b></span></div>
          <div style="border-top:1px solid #f1f5f9; padding-top:4px; display:flex; align-items:center; justify-content:space-between; gap:8px;"><span style="font-size:9.5px; color:#64748b;">Custo da bomba (ano)</span><span style="font-size:10.5px; font-weight:800; color:#b45309;" class="num">R$ 6.679,02</span></div>
        </div>
      </div>
    </div>
    <div class="card" style="overflow:hidden; display:flex; flex-direction:column;">
      <table style="font-size:10px;">
        <thead><tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0;"><th style="text-align:left; padding:4px 9px; font-size:9px; color:#334155; font-weight:700;">Mês</th><th style="text-align:right; padding:4px 9px; font-size:9px; color:#334155; font-weight:700;">kWh</th><th style="text-align:right; padding:4px 9px; font-size:9px; color:#334155; font-weight:700;">R$</th></tr></thead>
        <tbody>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:3.4px 9px; color:#334155;">Janeiro</td><td style="padding:3.4px 9px; text-align:right;" class="num">336</td><td style="padding:3.4px 9px; text-align:right; color:#047857; font-weight:700;" class="num">386,11</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:3.4px 9px; color:#334155;">Fevereiro</td><td style="padding:3.4px 9px; text-align:right;" class="num">294</td><td style="padding:3.4px 9px; text-align:right; color:#047857; font-weight:700;" class="num">338,36</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:3.4px 9px; color:#334155;">Março</td><td style="padding:3.4px 9px; text-align:right;" class="num">341</td><td style="padding:3.4px 9px; text-align:right; color:#047857; font-weight:700;" class="num">391,95</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:3.4px 9px; color:#334155;">Abril</td><td style="padding:3.4px 9px; text-align:right;" class="num">382</td><td style="padding:3.4px 9px; text-align:right; color:#047857; font-weight:700;" class="num">439,05</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:3.4px 9px; color:#334155;">Maio</td><td style="padding:3.4px 9px; text-align:right;" class="num">526</td><td style="padding:3.4px 9px; text-align:right; color:#047857; font-weight:700;" class="num">605,11</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9; background:#ecfeff;"><td style="padding:3.4px 9px; color:#155e75; font-weight:700;">Junho</td><td style="padding:3.4px 9px; text-align:right; color:#155e75; font-weight:700;" class="num">617</td><td style="padding:3.4px 9px; text-align:right; color:#0e7490; font-weight:800;" class="num">709,88</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9; background:#cffafe;"><td style="padding:3.4px 9px; color:#155e75; font-weight:800;">Julho ▲</td><td style="padding:3.4px 9px; text-align:right; color:#155e75; font-weight:800;" class="num">642</td><td style="padding:3.4px 9px; text-align:right; color:#0e7490; font-weight:800;" class="num">738,01</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9; background:#ecfeff;"><td style="padding:3.4px 9px; color:#155e75; font-weight:700;">Agosto</td><td style="padding:3.4px 9px; text-align:right; color:#155e75; font-weight:700;" class="num">521</td><td style="padding:3.4px 9px; text-align:right; color:#0e7490; font-weight:800;" class="num">599,15</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:3.4px 9px; color:#334155;">Setembro</td><td style="padding:3.4px 9px; text-align:right;" class="num">388</td><td style="padding:3.4px 9px; text-align:right; color:#047857; font-weight:700;" class="num">446,20</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:3.4px 9px; color:#334155;">Outubro</td><td style="padding:3.4px 9px; text-align:right;" class="num">332</td><td style="padding:3.4px 9px; text-align:right; color:#047857; font-weight:700;" class="num">381,80</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:3.4px 9px; color:#334155;">Novembro</td><td style="padding:3.4px 9px; text-align:right;" class="num">318</td><td style="padding:3.4px 9px; text-align:right; color:#047857; font-weight:700;" class="num">365,70</td></tr>
          <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:3.4px 9px; color:#334155;">Dezembro</td><td style="padding:3.4px 9px; text-align:right;" class="num">330</td><td style="padding:3.4px 9px; text-align:right; color:#047857; font-weight:700;" class="num">379,50</td></tr>
          <tr style="background:#f1f5f9;"><td style="padding:5px 9px; color:#0f172a; font-weight:800; white-space:nowrap;">Total bomba de calor:</td><td style="padding:5px 9px; text-align:right; color:#0f172a; font-weight:800; white-space:nowrap;" class="num">5.805 <span style="font-size:8px; font-weight:600; color:#64748b;">kWh</span></td><td style="padding:5px 9px; text-align:right; color:#0e7490; font-weight:800; white-space:nowrap;" class="num">R$ 6.679,02</td></tr>
        </tbody>
      </table>
      <div style="padding:5px 9px; border-top:1px solid #e2e8f0; font-size:8.5px; color:#64748b; line-height:1.35;">Valores da <b style="color:#0e7490;">bomba de calor</b>. Recirculação adiciona <b class="num" style="color:#0f172a;">2.127 kWh</b> ao ano → total geral <b class="num" style="color:#9a3412;">7.932 kWh / R$ 9.122,82</b>.</div>
    </div>
  </div>

  <div style="display:grid; grid-template-columns:2fr 1fr; gap:14px; padding:6px 18px; border-top:1px solid #e2e8f0; align-items:stretch;">
    <div style="font-size:9px; color:#64748b; line-height:1.45; display:flex; flex-direction:column;">
      <div style="font-size:8.5px; text-transform:uppercase; letter-spacing:.08em; color:#475569; font-weight:700; margin-bottom:3px;">Observações</div>
      <div>Dimensionamento conforme NBR 10.339. Capacidade da bomba de calor selecionada para o mês mais frio (crítico) da localidade. Consumo estimado com COP ajustado pela temperatura média de cada mês (clima local) e tarifa de energia configurada no sistema. A curva sazonal evidencia o maior consumo nos meses mais frios, quando o ΔT é maior e o COP cai.</div>
    </div>
    <div style="border:1px solid #fecaca; border-radius:8px; overflow:hidden; background:#fff; display:flex; flex-direction:column;">
      <div style="background:#b91c1c; color:#fff; padding:3px 8px;"><div style="font-size:9px; font-weight:800; line-height:1.1;">NBR 10339:2018 — ABNT</div><div style="font-size:7.5px; color:#fecaca; line-height:1.1;">Faixas de temperatura por uso</div></div>
      <div style="padding:4px 8px; display:grid; grid-template-columns:1fr 1fr; gap:0 14px; font-size:8.5px; line-height:1.5; flex:1; align-content:center;">
        <div style="display:flex; justify-content:space-between;"><span style="color:#475569;">SPA</span><span style="font-weight:800;" class="num">36–38°</span></div>
        <div style="display:flex; justify-content:space-between;"><span style="color:#475569;">Competição</span><span style="font-weight:800;" class="num">25–28°</span></div>
        <div style="display:flex; justify-content:space-between;"><span style="color:#475569;">Recreação</span><span style="font-weight:800;" class="num">27–29°</span></div>
        <div style="display:flex; justify-content:space-between;"><span style="color:#475569;">Bebês/Hidro</span><span style="font-weight:800;" class="num">30–34°</span></div>
        <div style="display:flex; justify-content:space-between;"><span style="color:#475569;">Crianças</span><span style="font-weight:800;" class="num">29–32°</span></div>
        <div style="color:#b91c1c; font-weight:700;">⚠ médico &gt;38°</div>
      </div>
    </div>
  </div>
</div>
`;

export default function PrintTestBombaV1() {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.getElementById("bomba-pdf-area");
      if (el) setH(el.scrollHeight);
    }, 150);
    return () => clearTimeout(t);
  }, []);
  const over = h != null && h > A4_H_UTIL;
  return (
    <div>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999, background: "#1e293b", color: "#fff", padding: "8px 16px", fontSize: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <strong>V1 — Curva sazonal · preview impressão A4 ({A4_W}px)</strong>
        <span style={{ marginLeft: "auto", fontWeight: 700, color: over ? "#f87171" : "#4ade80" }}>
          altura {h ?? "—"}px / útil {A4_H_UTIL}px {h != null && (over ? `(estoura ${h - A4_H_UTIL}px → 2ª pág)` : `(cabe ✓ · folga ${A4_H_UTIL - h}px)`)}
        </span>
      </div>
      <div style={{ paddingTop: 50, background: "#6b7280", minHeight: "100vh" }}>
        <div style={{ width: A4_W, margin: "0 auto", position: "relative", boxShadow: "0 6px 32px rgba(0,0,0,0.4)" }}>
          <div id="bomba-pdf-area" dangerouslySetInnerHTML={{ __html: V1_HTML }} />
          <div style={{ position: "absolute", top: A4_H_UTIL, left: 0, right: 0, borderTop: "2px dashed #ef4444", color: "#ef4444", fontSize: 11, fontWeight: 700, paddingTop: 2, pointerEvents: "none" }}>← Limite A4 útil ({A4_H_UTIL}px)</div>
        </div>
      </div>
    </div>
  );
}
