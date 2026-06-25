# Datasheet V1 "curva sazonal" — aba Bomba de Calor (v1.13.47, 10/06/2026)

Port do redesign **V1 data-viz** (aprovado no mock `/dev/print-test-bomba`) pro componente real
`frontend/src/components/pool/HeatingSimulatorModal.tsx` → função `BombaCalorTab`. Ligado aos DADOS REAIS.

## Arquitetura `.ds-bomba`
- O datasheet vive em `#bomba-pdf-area` (classe `ds-bomba`). Estilo inline + classes `.ds-bomba .*`
  (`.lbl/.sec/.card/.chip/.grid2/.pico/.ex/.num/.banner`) definidas num `<style dangerouslySetInnerHTML>`
  GLOBAL dentro do `BombaCalorTab` (mesmo bloco do print CSS). NÃO tem `* {margin/padding:0}` (confia no
  preflight do Tailwind) — só `box-sizing:border-box`, pra coexistir com classes Tailwind nos cards de bomba.
- **Print = clone:** `printViaClone()` clona `#bomba-pdf-area` → `#bomba-pdf-clone` no body + `html.printing-mode`.
  Por isso o CSS é global (o clone está fora da árvore React). Reusa o sistema do Solar.

## Swap tela ↔ impressão (CRÍTICO — não quebrar)
- `.ds-edit` = controle editável (select/input/botão), some no print.
- `.ds-print` = texto estático, some na tela (`.ds-bomba .ds-print {display:none}`), aparece no print.
- Regras no `@media print` sob `html.printing-mode #bomba-pdf-clone`: `.ds-edit {display:none}` + `.ds-print {display:inline}`.
- Toda config editável (UF/cidade/capa/vento/temp/tipo, picker de equipamento, qtd, ✨ regras, tubulação
  comp/desnível/DN, tarifa, horas dos extras) usa esse par. Helper `PicoSel`/`AmberInput` já fazem o swap.

## Gráficos data-driven (componentes module-level, NÃO exportados)
- `SeasonalCurve({ monthly, criticalIndex })` — área + linha suave (Catmull-Rom→bezier `dsSmoothPath`) +
  pico destacado + gridlines. **Escala JUSTA** (`step = dsNiceCeil(span/4)`, scaleMin/Max arredondados ao step
  com padding 0.2/0.12) pra curva preencher a altura (pico perto do topo y≈35, vale perto da base) — senão
  `dsNiceCeil` sozinho salta o teto (ex 683→1000) e achata a curva. `criticalIndex` = `findIndex(monthIndex===qtotalMonthCritical)`.
  Classe `ds-curve` (o print CSS `svg{width:100%}` distorceria; override neutraliza).
- `ConsumoDonut({ bombaKwh, recircKwh })` — 2 arcos via `stroke-dasharray` (C=2π·32≈201). Classe `ds-donut`
  (override do print pra NÃO esticar a 100% de largura).
- `report.monthlyConsumption[]` = `{monthIndex, monthName(full), kwhConsumido, custoBRLCents}`. `recircConsumo`
  vem do `TrocadorPumpPipeCard` via `onConsumoChange`. **Células da tabela usam `dsMoney` (sem "R$"); totais/cards usam `fmtBRL` (com "R$").**

## Layout das 4 seções (cada uma = faithful port do mock)
1. Header (gradiente) + Cliente (nome→Projeto→Local) + **extras minicards no topo-direita** (`CompactExtraCard`:
   nome acima do ícone + kW + horas editáveis) + dim/config (`.pico`/amber) + **barra ΔT**.
2. Dimensionamento (grid 5fr/7fr): esq = KPIs em lista + barras COP por estação + Capacidade×Demanda;
   dir = card do equipamento (picker + qtd + barra de carga) + `TrocadorPumpPipeCard`.
3. Simulação (grid 7fr/5fr): esq = 4 stats + curva + donut; dir = tabela mensal.
4. Rodapé: Observações + card NBR 10339.

## Regras aprendidas
- **Textos NÃO soldam clima:** "pico no inverno" / "meses mais frios" (NUNCA "inverno seco"/"junho-agosto" —
  quebram em estado de inverno úmido; Juliano pegou isso).
- Componentes antigos `ExtraImpactCard`/`BigStatLegacy` ficaram órfãos (só a Bomba usava) → REMOVIDOS pra não
  arriscar lint no `next build`. `dsNiceFloor` idem.
- Pre-deploy gate: `tsc --noEmit --incremental false` (evita false-pass de cache).

## Cards Tubulação + Bomba de circulação (TrocadorPumpPipeCard) — V1 compacta (v1.13.48, 11/06)
- **RESOLVIDO (decisão #1):** o render do `TrocadorPumpPipeCard` foi portado pra V1 compacta (inline-style,
  igual ao mock). Root vira `flex column gap:8`. **Tubulação** = card âmbar (label + mca no topo, linha de
  explicação, comp/desnív/DN numa linha) — tirou a label "Altura manométrica (bomba)" e os 2 inputs soltos
  que sobravam altura. **Circulação** = card compacto: imagem **64px** (era `w-24 h-24`=96px) + specs 2col +
  consumo/R$ numa linha. Dropdown de troca / ✨ / 💡 tarifa + comp/desnív/DN = `ds-edit` (somem no print);
  valores estáticos = `ds-print`. Indicator color virou hex inline (era className ternário).
- **Causa do 2-páginas era ISSO:** os cards antigos (altos) faziam a coluna direita do dimensionamento
  estourar; a esquerda (Resultado/COP/Cap×Dem) já estava em 325px BALANCEADA com a direita do mock. Card
  alto → direita > esquerda → branco na esquerda + 2 páginas. Compacto → direita = esquerda → 1 folha.
  ⚠️ NÃO "aumentar a altura dos cards da esquerda" (empurra de volta pra 2 páginas) — o certo é a direita encolher.

## Porte pro RELATÓRIO (EngineReporter) — v1.14.20
- `frontend/src/components/pool/report/HeatingDatasheets.tsx` → `BombaDatasheetBlock` = versão **display-only** do datasheet (bloco dinâmico `HEATING_BOMBA`), a partir do `heatingReport` CACHEADO. SEM `.ds-edit`/`.ds-print`/pickers (a edição fica no Simulador). CSS escopado `.ds-bomba-rep`.
- **Débito deliberado:** `SeasonalCurve` + helpers `ds*` foram DUPLICADOS nesse arquivo (cópia pura SVG) pra NÃO mexer no modal calibrado sem preview. Reconciliar depois (extrair pra módulo único, build verify).
- **Recirc omitido** na v1 do bloco (vem live do `TrocadorPumpPipeCard`, não cacheado limpo) → mostra só consumo da bomba. Consumo médio = `selectedEquipment.consumoMedioW/1000` (cached tem watts, não `ratedInputPowerKW`).
- Pendente: datasheet SOLAR (mesmo esquema, `environmentParams.solarReport`).

## 🟡 PENDENTE (decisão #2 do usuário)
- **Horas dos extras** no `CompactExtraCard`: mantive um campinho editável (vira texto no print). Juliano
  pode querer display puro (sem editar ali). Aguardando decisão.
