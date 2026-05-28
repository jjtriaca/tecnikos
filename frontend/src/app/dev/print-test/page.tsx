"use client";
// Pagina de teste isolada do print do Simulador Solar.
// Reproduz a estrutura DOM/CSS exata do #solar-pdf-area pra debug do print sem precisar
// de backend/login. Usar localhost:3000/dev/print-test
//
// Botoes: 👁️ Simular preview, 🖨️ Simular printing-mode, ❌ Limpar
// Tudo controlado via JS injetado no DOM (mesmo padrao do componente real).

import { useEffect, useRef, useState } from "react";

const today = "28/05/2026";

export default function PrintTestPage() {
  const [mode, setMode] = useState<"normal" | "preview" | "print" | "debug">("normal");
  const rootRef = useRef<HTMLDivElement>(null);

  // Clonagem mimicada (sem auth, sem dados reais — soh layout)
  useEffect(() => {
    // Remove qualquer clone anterior
    document.querySelectorAll(".solar-pdf-clone-container").forEach((el) => el.remove());
    document.documentElement.classList.remove("simulating-print", "printing-mode");

    if (mode === "normal") return;

    const original = document.getElementById("solar-pdf-area");
    if (!original) return;

    const container = document.createElement("div");
    container.className = `solar-pdf-clone-container ${mode === "preview" ? "preview-clone" : "printing-clone"}`;
    const clone = original.cloneNode(true) as HTMLElement;
    clone.id = "solar-pdf-clone";

    // Prefixa IDs descendentes (gradients SVG)
    const prefix = "clone-";
    clone.querySelectorAll("[id]").forEach((el) => {
      const oldId = el.getAttribute("id")!;
      el.setAttribute("id", `${prefix}${oldId}`);
    });
    clone.querySelectorAll("[fill], [stroke]").forEach((el) => {
      ["fill", "stroke"].forEach((attr) => {
        const v = el.getAttribute(attr);
        if (v?.startsWith("url(#")) {
          const ref = v.slice(5, -1);
          el.setAttribute(attr, `url(#${prefix}${ref})`);
        }
      });
    });

    container.appendChild(clone);
    document.body.appendChild(container);

    // Forca min-height=0 + height=auto via DOM (v1.12.74)
    clone.style.minHeight = "0";
    clone.style.height = "auto";

    const clsToAdd =
      mode === "preview" ? "simulating-print"
      : mode === "print" ? "printing-mode"
      : "debug-print-mode";
    document.documentElement.classList.add(clsToAdd);

    return () => {
      document.documentElement.classList.remove("simulating-print", "printing-mode", "debug-print-mode");
      document.querySelectorAll(".solar-pdf-clone-container").forEach((el) => el.remove());
    };
  }, [mode]);

  return (
    <div ref={rootRef}>
      {/* Toolbar fixa no topo */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: "#1e293b",
          color: "#fff",
          padding: "8px 16px",
          display: "flex",
          gap: 8,
          alignItems: "center",
          fontSize: 12,
        }}
        className="pdf-preview-toolbar"
      >
        <strong>Print Test</strong>
        <button
          onClick={() => setMode("normal")}
          style={{
            padding: "4px 10px",
            background: mode === "normal" ? "#10b981" : "#475569",
            borderRadius: 4,
            border: 0,
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Normal
        </button>
        <button
          onClick={() => setMode("preview")}
          style={{
            padding: "4px 10px",
            background: mode === "preview" ? "#10b981" : "#475569",
            borderRadius: 4,
            border: 0,
            color: "#fff",
            cursor: "pointer",
          }}
        >
          👁️ Preview (simulating-print)
        </button>
        <button
          onClick={() => setMode("print")}
          style={{
            padding: "4px 10px",
            background: mode === "print" ? "#10b981" : "#475569",
            borderRadius: 4,
            border: 0,
            color: "#fff",
            cursor: "pointer",
          }}
        >
          🖨️ Print Clone (printing-mode)
        </button>
        <button
          onClick={() => setMode("debug")}
          style={{
            padding: "4px 10px",
            background: mode === "debug" ? "#ef4444" : "#475569",
            borderRadius: 4,
            border: 0,
            color: "#fff",
            cursor: "pointer",
          }}
        >
          🐛 Debug print (sem @media)
        </button>
        <button
          onClick={() => window.print()}
          style={{
            padding: "4px 10px",
            background: "#f59e0b",
            borderRadius: 4,
            border: 0,
            color: "#fff",
            cursor: "pointer",
          }}
        >
          🖨️ window.print()
        </button>
        <span style={{ marginLeft: "auto", fontSize: 10 }}>
          Pagina isolada — sem auth. Toda mudanca em /dev/print-test reflete o componente real.
        </span>
      </div>

      <div style={{ paddingTop: 50 }}>
        <div className="mx-auto max-w-[820px] print:max-w-none solar-screen-wrapper">
          <div
            id="solar-pdf-area"
            className="bg-white text-slate-900 font-sans border border-slate-200 shadow-sm print:border-0 print:shadow-none flex flex-col min-h-[1120px]"
          >
            {/* HEADER */}
            <header className="bg-gradient-to-r from-slate-900 to-blue-900 text-white px-5 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded bg-white/10 flex items-center justify-center text-xs font-bold flex-shrink-0">SLS</div>
                <div className="min-w-0">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-amber-300 font-medium">Aquecimento solar para piscinas</div>
                  <h2 className="text-base font-bold mt-0.5 leading-tight">Dimensionamento para Coletor Solar</h2>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[9px] uppercase tracking-[0.18em] text-slate-300">Orçamento</div>
                <div className="text-xl font-bold tabular-nums leading-tight">ORCP-00001</div>
                <div className="text-[10px] text-slate-300 mt-0.5">{today}</div>
              </div>
            </header>

            {/* SECTION: CLIENTE + DIM + CONFIG + IMAGEM */}
            <section className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-slate-200 avoid-break">
              <div className="col-span-8 flex flex-col gap-2">
                <div className="text-[11px] leading-tight">
                  <div className="font-bold text-slate-900 text-[12px]">ANDERSON DA SILVA PRADO</div>
                  <div className="text-slate-700 mt-0.5 flex flex-wrap gap-x-4">
                    <span><span className="text-slate-500 uppercase text-[8.5px] tracking-wide font-semibold">Local:</span> Primavera do Leste</span>
                    <span><span className="text-slate-500 uppercase text-[8.5px] tracking-wide font-semibold">Projeto:</span> Piscina 8x4 alvenaria — ANDERSON</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-stretch flex-1">
                  {/* Dimensões */}
                  <div className="flex flex-col h-full">
                    <div className="text-[8.5px] uppercase tracking-wide text-slate-500 font-semibold">Dimensões da piscina</div>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      <Stat label="Comp." value="7,00" unit="m" />
                      <Stat label="Larg." value="3,00" unit="m" />
                      <Stat label="Prof. mín" value="0,00" unit="m" />
                      <Stat label="Prof. máx" value="1,40" unit="m" />
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      <SelectCard label="Tipo de piscina" value="Privativa" />
                      <SelectCard label="Tipo de construção" value="Aberta" />
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      <BigHighlight label="Área" value="28.5" unit="m²" />
                      <BigHighlight label="Volume" value="33.309" unit="m³" />
                    </div>
                    <div className="mt-1 print:hidden">
                      <SelectCard label="Modo de dimensão da piscina" value="Automático" fullWidth />
                    </div>
                  </div>

                  {/* Configuração */}
                  <div className="flex flex-col h-full">
                    <div className="text-[8.5px] uppercase tracking-wide text-slate-500 font-semibold">Configuração do aquecimento</div>
                    <div className="mt-1 space-y-1 flex-1">
                      <div className="grid grid-cols-2 gap-1">
                        <SelectCard label="Capa térmica" value="Sim" />
                        <SelectCard label="Vento" value="Moderado" />
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <SelectCard label="Orientação telhado" value="Norte" />
                        <SelectCard label="Inclinação" value="20°" />
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <SelectCard label="Cidade" value="Primavera do Leste" />
                        <SelectCard label="Estado" value="MT" />
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <BigHighlight label="Temp. inicial" value="22" unit="°C" />
                        <BigHighlight label="Temp. final" value="35" unit="°C" />
                      </div>
                      <div className="print:hidden">
                        <SelectCard label="Modo da configuração do aquecimento" value="Automático" fullWidth />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* IMAGEM COLETOR */}
              <div className="col-span-4">
                <div className="w-full aspect-square print:aspect-auto print:h-[52mm] rounded border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                    <div className="text-amber-400 text-center px-2">
                      <div className="text-[10px] uppercase tracking-wider">A MAIOR</div>
                      <div className="text-sm font-bold">DURABILIDADE</div>
                      <div className="text-[10px] uppercase tracking-wider">DO MERCADO</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* BANNER DIMENSIONAMENTO */}
            <div className="bg-blue-900 text-white px-5 py-1.5 print:mb-1">
              <span className="text-[10px] uppercase tracking-[0.18em] font-bold">Dimensionamento</span>
            </div>

            {/* SECTION KPIS + COLETOR + BOMBA + TUBULAÇÃO */}
            <section className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-slate-200 avoid-break">
              <div className="col-span-5 grid grid-cols-1 gap-1">
                <Kpi label="Área da piscina" value="28,50" unit="m²" />
                <Kpi label="m² necessário de coletor" value="40" unit="m²" />
                <Kpi label="Qtd. de coletores" value="10,0" unit="un" accent />
                <Kpi label="Coletores por bateria" value="5" unit="un" />
                <Kpi label="Baterias (total)" value="2" unit="un" />
                <Kpi label="Baterias em série" value="2" unit="un" />
                <Kpi label="Baterias em paralelo" value="0" unit="un" />
                <Kpi label="Vazão necessária" value="5,64" unit="m³/h" />
                <Kpi label="Cobertura piscina × coletores" value="157,2" unit="%" />

                {/* Diagrama */}
                <div className="mt-1.5 rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/30 p-2">
                  <div className="text-[8.5px] uppercase tracking-wider font-bold text-slate-600 mb-1">Diagrama da instalação</div>
                  <div className="bg-white border border-slate-200 rounded p-2 text-center text-[10px] text-slate-500" style={{ height: 110 }}>
                    [Diagrama: 2 baterias em série]
                  </div>
                </div>
              </div>

              <div className="col-span-7 flex flex-col gap-2">
                <div>
                  <div className="text-[8.5px] uppercase tracking-wide text-slate-500 font-semibold">Coletor selecionado</div>
                  <div className="mt-1.5">
                    <div className="hidden print:block text-[12px] font-semibold bg-amber-50 px-2 py-1 border border-amber-200 rounded">
                      Coletor Solar Trop Piscin 1.12x4m 4,48m²
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[8.5px] uppercase tracking-wide text-slate-500 font-semibold">Aumento da eficiência (coletores extras)</div>
                  <div className="hidden print:block mt-1">
                    <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-300 rounded px-3 py-1 text-[11px] font-bold text-emerald-800">
                      +4 coletores extras <span className="text-[10px] text-emerald-600">(40%)</span>
                    </div>
                    <span className="text-[9px] text-slate-600 italic ml-2">Aumenta a eficiência em meses frios.</span>
                  </div>
                </div>

                <div>
                  <div className="text-[8.5px] uppercase tracking-wide text-slate-500 font-semibold">🚰 Tubulação — perda de carga</div>
                  <div className="mt-1 rounded border border-slate-200 bg-slate-50/50 p-1.5 space-y-1">
                    <div className="hidden print:flex gap-3 text-[9px] uppercase tracking-wider text-slate-600 font-semibold">
                      <span>Comp.: <span className="text-slate-900 normal-case font-bold text-[10px]">36 m</span></span>
                      <span>Desnív.: <span className="text-slate-900 normal-case font-bold text-[10px]">4 m</span></span>
                    </div>
                    <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-[8.5px] uppercase tracking-wider font-bold text-amber-800">Altura manométrica total</div>
                        <div className="text-base font-bold tabular-nums leading-none text-amber-900">6.76 <span className="text-[10px] font-semibold">mca</span></div>
                      </div>
                      <div className="text-[9.5px] mt-0.5 text-amber-800">
                        = 2.76 mca perda dinâmica + 4 m desnível · velocidade 1.03 m/s
                      </div>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <label className="text-[10px] uppercase tracking-wider font-bold text-amber-800">📏 Tubo:</label>
                        <span className="text-[11px] font-semibold text-amber-900">PVC</span>
                        <span className="hidden print:inline-block text-xs font-bold text-amber-900">50 mm DN</span>
                        <span className="text-[9px] uppercase tracking-wider text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">manual</span>
                        <span className="text-[10px] text-amber-800">(DI 44 mm)</span>
                      </div>
                      <div className="text-[9px] mt-1 italic text-amber-700">Defaults: PVC, fator 20%, 10 joelhos, 4 tês, 1 registro, 1 válvula.</div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[8.5px] uppercase tracking-wide text-slate-500 font-semibold">Bomba recomendada</div>
                  <div className="mt-1.5">
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5 flex gap-3 items-start shadow-sm">
                      <div className="w-24 h-24 flex-shrink-0 rounded border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                        <div className="text-[9px] text-slate-400 text-center px-1">[Img bomba]</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-bold text-slate-900 leading-tight truncate">Bomba Impulse Syllent 1/3cv</div>
                        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-slate-700">
                          <div><span className="text-slate-500">Potência:</span> <span className="font-semibold tabular-nums">0.33 cv</span></div>
                          <div><span className="text-slate-500">Vazão:</span> <span className="font-semibold tabular-nums">5.30 m³/h</span></div>
                          <div><span className="text-slate-500">Pressão:</span> <span className="font-semibold tabular-nums">18.00 mca</span></div>
                          <div><span className="text-slate-500">Preço:</span> <span className="font-semibold tabular-nums">R$ 1954.00</span></div>
                          <div className="text-[9px] text-emerald-700 font-semibold">📈 com curva característica</div>
                          <div className="text-[10px] font-semibold text-amber-600">Dimensionamento: -6,1% (Vazão limitada)</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-[9px] text-slate-500 mt-1 leading-tight">
                      4 bomba(s) atendem · ordem definida pela regra ✨ · vazão 5.64 m³/h + altura 6.76 mca
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* BANNER SIMULAÇÃO TÉRMICA */}
            <div className="bg-blue-900 text-white px-5 py-1.5 flex items-center gap-3 print:mb-1">
              <span className="text-[10px] uppercase tracking-[0.18em] font-bold">Simulação térmica mensal</span>
              <span className="hidden print:inline text-[10px] text-slate-600">— Junho</span>
            </div>

            {/* ESPACADOR FLEX-1 — alvo do CSS de print pra ser escondido */}
            <div className="flex-1" />

            {/* GRAFICO + TABELA */}
            <section className="grid grid-cols-12 gap-3 px-5 py-3 print:py-1 border-b border-slate-200 avoid-break items-stretch print:items-start">
              <div className="col-span-7 flex flex-col">
                <div className="border border-slate-200 rounded bg-white p-2 print:p-1 print:border-slate-300 flex-1 flex flex-col print:max-h-[62mm]">
                  <div className="text-[9px] uppercase tracking-wide text-slate-500 font-semibold mb-0.5">Variação Térmica em 4 dias — <span className="text-slate-900">Junho</span></div>
                  <svg viewBox="0 0 400 200" className="w-full h-auto flex-1" preserveAspectRatio="xMidYMid meet">
                    <rect x="0" y="0" width="400" height="200" fill="#f8fafc" />
                    <text x="200" y="100" textAnchor="middle" fontSize="14" fill="#64748b">[Grafico SVG]</text>
                  </svg>
                </div>
              </div>
              <div className="col-span-5 flex flex-col">
                <div className="border border-slate-200 rounded overflow-hidden h-full flex flex-col print:h-auto">
                  <table className="w-full text-[9.5px] tabular-nums">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="text-left px-1.5 py-1 font-semibold uppercase tracking-wide text-[8.5px]">Mês</th>
                        <th className="text-right px-1.5 py-1 font-semibold uppercase tracking-wide text-[8.5px]">Amb.</th>
                        <th className="text-right px-1.5 py-1 font-semibold uppercase tracking-wide text-[8.5px]">1° dia</th>
                        <th className="text-right px-1.5 py-1 font-semibold uppercase tracking-wide text-[8.5px]">2° dia</th>
                        <th className="text-right px-1.5 py-1 font-semibold uppercase tracking-wide text-[8.5px]">3° dia</th>
                        <th className="text-right px-1.5 py-1 font-semibold uppercase tracking-wide text-[8.5px]">4° dia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Janeiro", 24.5, 31.5, 35.0, 35.0, 35.0],
                        ["Fevereiro", 24.6, 31.2, 35.0, 35.0, 35.0],
                        ["Marco", 24.4, 30.7, 35.0, 35.0, 35.0],
                        ["Abril", 23.8, 29.5, 33.4, 35.0, 35.0],
                        ["Maio", 21.4, 26.4, 29.5, 32.5, 35.0],
                        ["Junho", 20.0, 24.5, 26.8, 29.1, 31.4],
                        ["Julho", 20.3, 25.1, 27.6, 30.2, 32.7],
                        ["Agosto", 22.5, 28.2, 31.9, 35.0, 35.0],
                        ["Setembro", 24.2, 30.5, 35.0, 35.0, 35.0],
                        ["Outubro", 24.5, 31.2, 35.0, 35.0, 35.0],
                        ["Novembro", 24.6, 31.6, 35.0, 35.0, 35.0],
                        ["Dezembro", 24.5, 31.6, 35.0, 35.0, 35.0],
                      ].map(([m, a, d1, d2, d3, d4], idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                          <td className="px-1.5 py-0.5 font-semibold text-slate-900 text-[9.5px] capitalize">{m}</td>
                          <td className="px-1.5 py-0.5 text-right text-slate-600">{(a as number).toFixed(1).replace(".", ",")}</td>
                          <td className="px-1.5 py-0.5 text-right font-semibold">{(d1 as number).toFixed(1).replace(".", ",")}</td>
                          <td className="px-1.5 py-0.5 text-right font-semibold">{(d2 as number).toFixed(1).replace(".", ",")}</td>
                          <td className="px-1.5 py-0.5 text-right font-semibold">{(d3 as number).toFixed(1).replace(".", ",")}</td>
                          <td className="px-1.5 py-0.5 text-right font-semibold">{(d4 as number).toFixed(1).replace(".", ",")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* FOOTER */}
            <footer className="px-5 py-2 bg-slate-50 print:bg-white">
              <div className="grid grid-cols-12 gap-3 items-start">
                <div className="col-span-7">
                  <div className="text-[8.5px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Observações</div>
                  <ol className="text-[8.5px] text-slate-700 leading-tight space-y-0.5 list-decimal list-inside">
                    <li>Os valores acima são estimativos e podem sofrer variações conforme temperatura ambiente real.</li>
                    <li>Perda térmica acima do tolerado (sem capa, vento forte) reduz a temperatura final.</li>
                    <li>Dias frios e nublados podem reiniciar o ciclo de aquecimento.</li>
                  </ol>
                </div>
                <div className="col-span-5">
                  <div className="rounded border border-red-200 overflow-hidden bg-white print:bg-white">
                    <div className="bg-gradient-to-r from-red-700 via-red-600 to-amber-700 text-white px-2 py-1 print:bg-red-700">
                      <div className="text-[9.5px] font-bold leading-tight">NBR 10339:2018 — ABNT</div>
                      <div className="text-[8px] text-red-100 leading-tight">Faixas de temperatura recomendadas por uso</div>
                    </div>
                    <div className="px-1.5 py-1 grid grid-cols-2 gap-x-2 text-[8px] leading-[1.15]">
                      <div className="flex justify-between"><span className="text-slate-600">SPA</span><span className="font-bold text-slate-900 tabular-nums">36–38°</span></div>
                      <div className="flex justify-between"><span className="text-slate-600">Competição</span><span className="font-bold text-slate-900 tabular-nums">25–28°</span></div>
                      <div className="flex justify-between"><span className="text-slate-600">Recreação</span><span className="font-bold text-slate-900 tabular-nums">27–29°</span></div>
                      <div className="flex justify-between"><span className="text-slate-600">Bebês/Hidro</span><span className="font-bold text-slate-900 tabular-nums">30–34°</span></div>
                      <div className="flex justify-between"><span className="text-slate-600">Crianças</span><span className="font-bold text-slate-900 tabular-nums">29–32°</span></div>
                      <div className="text-red-700 font-medium">⚠ médico &gt;38°</div>
                    </div>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </div>

      {/* CSS de print/preview — copia EXATA do HeatingSimulatorModal.tsx */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          /* v1.12.75: display:none ao inves de visibility:hidden + position:static */
          html.printing-mode body > *:not(.solar-pdf-clone-container) {
            display: none !important;
          }
          html.printing-mode .solar-pdf-clone-container.printing-clone,
          html.printing-mode .solar-pdf-clone-container.printing-clone * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html.printing-mode .solar-pdf-clone-container.printing-clone {
            position: static !important;
            width: 100% !important; padding: 0 !important; margin: 0 !important; background: #fff !important;
            display: block !important;
          }
          html.printing-mode #solar-pdf-clone {
            width: 100% !important; padding: 3mm !important; margin: 0 !important;
            font-size: 10px !important; line-height: 1.2 !important;
            min-height: 0 !important; height: auto !important;
            box-shadow: none !important; border: 0 !important; display: block !important;
          }
          .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          html.printing-mode #solar-pdf-clone > div.flex-1,
          html.printing-mode #solar-pdf-clone .flex-1:not(section):not([class*="col-span"]):empty {
            display: none !important; flex: none !important; height: 0 !important; min-height: 0 !important;
          }
          html.printing-mode #solar-pdf-clone[class*="min-h-"] { min-height: 0 !important; }
          html.printing-mode #solar-pdf-clone header {
            display: flex !important; visibility: visible !important;
            padding: 4px 16px !important;
            background: linear-gradient(to right, #0f172a, #1e3a8a) !important;
            color: #ffffff !important;
          }
          html.printing-mode #solar-pdf-clone header h2,
          html.printing-mode #solar-pdf-clone header div { color: #ffffff !important; }
          html.printing-mode #solar-pdf-clone header .text-amber-300 { color: #fcd34d !important; }
          html.printing-mode #solar-pdf-clone header .text-slate-300 { color: #cbd5e1 !important; }
          html.printing-mode #solar-pdf-clone .bg-blue-900 {
            background-color: #1e3a8a !important; color: #ffffff !important;
          }
          html.printing-mode #solar-pdf-clone .bg-blue-900 * { color: #ffffff !important; }
          html.printing-mode #solar-pdf-clone section { padding-top: 2px !important; padding-bottom: 2px !important; }
          html.printing-mode #solar-pdf-clone footer { padding-top: 2px !important; padding-bottom: 2px !important; }
          html.printing-mode #solar-pdf-clone .px-5 { padding-left: 10px !important; padding-right: 10px !important; }
          html.printing-mode #solar-pdf-clone .print-hide-interactive { display: none !important; }
          html.printing-mode #solar-pdf-clone select { display: none !important; }
          html.printing-mode #solar-pdf-clone input[type=range] { display: none !important; }
          html.printing-mode #solar-pdf-clone .print\\:inline-block { display: inline-block !important; }
          html.printing-mode #solar-pdf-clone .print\\:hidden { display: none !important; }
          html.printing-mode #solar-pdf-clone .print\\:block { display: block !important; }
          html.printing-mode #solar-pdf-clone .print\\:inline { display: inline !important; }
          html.printing-mode #solar-pdf-clone .print\\:flex { display: flex !important; }
          html.printing-mode #solar-pdf-clone .print\\:bg-white { background: #fff !important; background-image: none !important; }
          html.printing-mode #solar-pdf-clone .print\\:text-blue-900 { color: #1e3a8a !important; }
          html.printing-mode #solar-pdf-clone svg { max-height: 60mm !important; width: 100% !important; height: auto !important; }
          html.printing-mode #solar-pdf-clone img { max-height: none !important; }
          html.printing-mode #solar-pdf-clone .print\\:aspect-auto { aspect-ratio: auto !important; }
          html.printing-mode #solar-pdf-clone .print\\:h-full { height: 100% !important; }
          html.printing-mode #solar-pdf-clone .print\\:h-auto { height: auto !important; }
          html.printing-mode #solar-pdf-clone .print\\:max-h-\\[52mm\\] { max-height: 52mm !important; }
          html.printing-mode #solar-pdf-clone .print\\:h-\\[52mm\\] { height: 52mm !important; }
          html.printing-mode #solar-pdf-clone .print\\:max-h-\\[58mm\\] { max-height: 58mm !important; }
          html.printing-mode #solar-pdf-clone .print\\:max-h-\\[62mm\\] { max-height: 62mm !important; }
          html.printing-mode #solar-pdf-clone .print\\:items-start { align-items: flex-start !important; }
          html.printing-mode #solar-pdf-clone .print\\:py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
          html.printing-mode #solar-pdf-clone .print\\:p-1 { padding: 0.25rem !important; }
          html.printing-mode #solar-pdf-clone .print\\:mb-1 { margin-bottom: 0.25rem !important; }
          html.printing-mode #solar-pdf-clone .print\\:border-slate-300 { border-color: #cbd5e1 !important; }
          .print\\:hidden { display: none !important; }
          html:not(.printing-mode) body * { visibility: hidden; }
          html:not(.printing-mode) #solar-pdf-area,
          html:not(.printing-mode) #solar-pdf-area * { visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html:not(.printing-mode) #solar-pdf-area {
            width: 100%; padding: 3mm !important; margin: 0;
            font-size: 10px; line-height: 1.2;
            min-height: 0 !important; height: auto !important;
            box-shadow: none !important; border: 0 !important;
          }
        }

        /* === Simulacao do @media print === */
        html.simulating-print body { background: #6b7280 !important; overflow: auto !important; }
        html.simulating-print body > *:not(.solar-pdf-clone-container):not(.pdf-preview-toolbar) { display: none !important; }
        html.simulating-print .solar-pdf-clone-container {
          display: block !important; padding: 30px 0 30px 0 !important; min-height: 100vh !important;
        }
        html.simulating-print .solar-pdf-clone-container #solar-pdf-clone {
          margin: 0 auto !important; width: 210mm !important; max-width: 210mm !important;
          background: #fff !important; box-shadow: 0 6px 32px rgba(0,0,0,0.4) !important;
          font-size: 10px !important; line-height: 1.2 !important;
          padding: 0 !important; min-height: 0 !important; height: auto !important;
          display: block !important; border: 0 !important;
        }
        html.simulating-print #solar-pdf-clone > div.flex-1,
        html.simulating-print #solar-pdf-clone .flex-1:empty { display: none !important; }
        html.simulating-print #solar-pdf-clone[class*="min-h-"] { min-height: 0 !important; }
        html.simulating-print #solar-pdf-clone section { padding-top: 4px !important; padding-bottom: 4px !important; }
        html.simulating-print #solar-pdf-clone footer { padding-top: 3px !important; padding-bottom: 3px !important; }
        html.simulating-print #solar-pdf-clone header { padding-top: 6px !important; padding-bottom: 6px !important; }
        html.simulating-print #solar-pdf-clone .px-5 { padding-left: 10px !important; padding-right: 10px !important; }
        html.simulating-print #solar-pdf-clone svg { max-height: 60mm !important; width: 100% !important; height: auto !important; }
        html.simulating-print #solar-pdf-clone img { max-height: 38mm !important; }
        html.simulating-print #solar-pdf-clone select { display: none !important; }
        html.simulating-print #solar-pdf-clone input[type=range] { display: none !important; }
        html.simulating-print #solar-pdf-clone .print\\:aspect-auto { aspect-ratio: auto !important; }
        html.simulating-print #solar-pdf-clone .print\\:h-full { height: 100% !important; }
        html.simulating-print #solar-pdf-clone .print\\:h-auto { height: auto !important; }
        html.simulating-print #solar-pdf-clone .print\\:max-h-\\[52mm\\] { max-height: 52mm !important; }
        html.simulating-print #solar-pdf-clone .print\\:max-h-\\[58mm\\] { max-height: 58mm !important; }
        html.simulating-print #solar-pdf-clone .print\\:max-h-\\[62mm\\] { max-height: 62mm !important; }
        html.simulating-print #solar-pdf-clone .print\\:items-start { align-items: flex-start !important; }
        html.simulating-print #solar-pdf-clone .print\\:py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
        html.simulating-print #solar-pdf-clone .print\\:p-1 { padding: 0.25rem !important; }
        html.simulating-print #solar-pdf-clone .print\\:mb-1 { margin-bottom: 0.25rem !important; }
        html.simulating-print #solar-pdf-clone header {
          background: linear-gradient(to right, #0f172a, #1e3a8a) !important; color: #ffffff !important;
        }
        html.simulating-print #solar-pdf-clone header h2,
        html.simulating-print #solar-pdf-clone header div { color: #ffffff !important; }
        html.simulating-print #solar-pdf-clone .bg-blue-900 {
          background-color: #1e3a8a !important; color: #ffffff !important;
        }
        html.simulating-print #solar-pdf-clone .bg-blue-900 * { color: #ffffff !important; }
        html.simulating-print #solar-pdf-clone .print\\:inline-block { display: inline-block !important; }
        html.simulating-print #solar-pdf-clone .print\\:hidden { display: none !important; }
        html.simulating-print #solar-pdf-clone .print\\:block { display: block !important; }
        html.simulating-print #solar-pdf-clone .print\\:inline { display: inline !important; }
        html.simulating-print #solar-pdf-clone .print\\:flex { display: flex !important; }
        html.simulating-print #solar-pdf-clone .print\\:bg-white { background: #fff !important; background-image: none !important; }
        html.simulating-print #solar-pdf-clone .print\\:text-blue-900 { color: #1e3a8a !important; }
        html.simulating-print #solar-pdf-clone .print\\:border-slate-300 { border-color: #cbd5e1 !important; }

        /* === DEBUG print mode — FIX: usa display:none ao inves de visibility:hidden === */
        html.debug-print-mode body > *:not(.solar-pdf-clone-container):not(.pdf-preview-toolbar) {
          display: none !important;
        }
        html.debug-print-mode .solar-pdf-clone-container.printing-clone {
          display: block !important;
          position: relative !important;
          width: 210mm !important; max-width: 210mm !important;
          padding: 0 !important; margin: 50px auto 0 auto !important;
          background: #fff !important;
          box-shadow: 0 6px 32px rgba(0,0,0,0.4) !important;
        }
        html.debug-print-mode #solar-pdf-clone {
          width: 100% !important; padding: 3mm !important; margin: 0 !important;
          font-size: 10px !important; line-height: 1.2 !important;
          min-height: 0 !important; height: auto !important;
          box-shadow: none !important; border: 0 !important; display: block !important;
        }
        html.debug-print-mode #solar-pdf-clone > div.flex-1,
        html.debug-print-mode #solar-pdf-clone .flex-1:not(section):not([class*="col-span"]):empty {
          display: none !important; flex: none !important; height: 0 !important; min-height: 0 !important;
        }
        html.debug-print-mode #solar-pdf-clone[class*="min-h-"] { min-height: 0 !important; }
        html.debug-print-mode #solar-pdf-clone header {
          display: flex !important; padding: 4px 16px !important;
          background: linear-gradient(to right, #0f172a, #1e3a8a) !important;
          color: #ffffff !important;
        }
        html.debug-print-mode #solar-pdf-clone header h2,
        html.debug-print-mode #solar-pdf-clone header div { color: #ffffff !important; }
        html.debug-print-mode #solar-pdf-clone header .text-amber-300 { color: #fcd34d !important; }
        html.debug-print-mode #solar-pdf-clone header .text-slate-300 { color: #cbd5e1 !important; }
        html.debug-print-mode #solar-pdf-clone .bg-blue-900 { background-color: #1e3a8a !important; color: #ffffff !important; }
        html.debug-print-mode #solar-pdf-clone .bg-blue-900 * { color: #ffffff !important; }
        html.debug-print-mode #solar-pdf-clone section { padding-top: 2px !important; padding-bottom: 2px !important; }
        html.debug-print-mode #solar-pdf-clone footer { padding-top: 2px !important; padding-bottom: 2px !important; }
        html.debug-print-mode #solar-pdf-clone .px-5 { padding-left: 10px !important; padding-right: 10px !important; }
        html.debug-print-mode #solar-pdf-clone select { display: none !important; }
        html.debug-print-mode #solar-pdf-clone .print\\:inline-block { display: inline-block !important; }
        html.debug-print-mode #solar-pdf-clone .print\\:hidden { display: none !important; }
        html.debug-print-mode #solar-pdf-clone .print\\:block { display: block !important; }
        html.debug-print-mode #solar-pdf-clone .print\\:inline { display: inline !important; }
        html.debug-print-mode #solar-pdf-clone .print\\:flex { display: flex !important; }
        html.debug-print-mode #solar-pdf-clone .print\\:bg-white { background: #fff !important; background-image: none !important; }
        html.debug-print-mode #solar-pdf-clone svg { max-height: 60mm !important; width: 100% !important; height: auto !important; }
        html.debug-print-mode #solar-pdf-clone img { max-height: none !important; }
        html.debug-print-mode #solar-pdf-clone .print\\:aspect-auto { aspect-ratio: auto !important; }
        html.debug-print-mode #solar-pdf-clone .print\\:h-full { height: 100% !important; }
        html.debug-print-mode #solar-pdf-clone .print\\:h-auto { height: auto !important; }
        html.debug-print-mode #solar-pdf-clone .print\\:max-h-\\[52mm\\] { max-height: 52mm !important; }
        html.debug-print-mode #solar-pdf-clone .print\\:h-\\[52mm\\] { height: 52mm !important; }
        html.debug-print-mode #solar-pdf-clone .print\\:max-h-\\[58mm\\] { max-height: 58mm !important; }
        html.debug-print-mode #solar-pdf-clone .print\\:max-h-\\[62mm\\] { max-height: 62mm !important; }
        html.debug-print-mode #solar-pdf-clone .print\\:items-start { align-items: flex-start !important; }
        html.debug-print-mode #solar-pdf-clone .print\\:py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
        html.debug-print-mode #solar-pdf-clone .print\\:p-1 { padding: 0.25rem !important; }
        html.debug-print-mode #solar-pdf-clone .print\\:mb-1 { margin-bottom: 0.25rem !important; }
        html.debug-print-mode #solar-pdf-clone .print\\:border-slate-300 { border-color: #cbd5e1 !important; }
        /* Guia visual A4: linha vermelha em 297mm = ~1123px desde topo do clone */
        html.debug-print-mode #solar-pdf-clone::after {
          content: "← Limite A4 (297mm)";
          display: block;
          position: absolute;
          top: 297mm;
          left: 0; right: 0;
          border-top: 2px dashed #ef4444;
          color: #ef4444;
          font-size: 10px;
          font-weight: bold;
          padding-top: 2px;
          pointer-events: none;
        }
        html.debug-print-mode #solar-pdf-clone { position: relative !important; }
      `}} />
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="border border-slate-200 rounded px-1.5 py-0.5 bg-white">
      <div className="text-[8px] uppercase tracking-wide text-slate-500 font-semibold leading-none">{label}</div>
      <div className="text-[10.5px] font-bold text-slate-900 leading-tight tabular-nums">{value} <span className="text-[9px] font-semibold text-slate-500">{unit}</span></div>
    </div>
  );
}

function SelectCard({ label, value, fullWidth }: { label: string; value: string; fullWidth?: boolean }) {
  return (
    <div className={`border border-slate-200 rounded px-1.5 py-0.5 bg-white ${fullWidth ? "col-span-2" : ""}`}>
      <div className="text-[8px] uppercase tracking-wide text-slate-500 font-semibold leading-none">{label}</div>
      <div className="text-[10.5px] font-bold text-slate-900 leading-tight">{value}</div>
    </div>
  );
}

function BigHighlight({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="border-2 border-amber-300 rounded px-1.5 py-1 bg-amber-50">
      <div className="text-[8px] uppercase tracking-wide text-amber-700 font-semibold leading-none">{label}</div>
      <div className="text-[14px] font-bold text-amber-900 leading-tight tabular-nums">{value} <span className="text-[9px] font-semibold text-amber-700">{unit}</span></div>
    </div>
  );
}

function Kpi({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 border-b border-slate-200 py-0.5 ${accent ? "bg-amber-50/30" : ""}`}>
      <span className="text-[8.5px] uppercase tracking-wide text-slate-500 font-semibold">{label}</span>
      <span className={`text-[11px] font-bold tabular-nums ${accent ? "text-amber-700" : "text-slate-900"}`}>
        {value} <span className="text-[8.5px] font-semibold text-slate-500">{unit}</span>
      </span>
    </div>
  );
}
