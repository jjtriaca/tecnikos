---
name: plano_sistema_borda_infinita
description: PLANO da feature "Sistema de Borda Infinita" no orcamento de piscina (multi-linha, estilo dimensoes) — dimensiona reservatorios de compensacao + tubulacao de gravidade, e DEPOIS alimenta o Simulador de Aquecimento. Definido com o usuario em 01/06/2026 (sessao 215). Ler ANTES de iniciar.
metadata:
  type: project
  date: 2026-06-01
---

# Plano — Sistema de Borda Infinita (dimensionamento) + integracao no aquecimento

## Objetivo
Sistema de borda infinita no **orcamento de piscina**, **multi-linha** (estilo "Dimensoes da piscina":
o operador adiciona 1+ linhas). Dimensiona os reservatorios de compensacao + a tubulacao de gravidade,
e DEPOIS alimenta o Simulador de Aquecimento com o volume/evaporacao extra.

## ORDEM (decidida pelo usuario — NAO inverter)
1. **FASE 1 — Sistema de borda infinita (FOCO AGORA):** montar o dimensionamento (linhas de borda +
   mini-reservatorios + reservatorio master + tubulacao de gravidade). Objetivo: **ter os NUMEROS prontos**.
2. **FASE 2 — Aquecimento (DEPOIS):** com os numeros prontos, integrar no Simulador (volume total
   piscina+reservatorios -> tempo de aquecimento; lamina + reservatorios abertos -> evaporacao).

## Arquitetura (descrita pelo usuario)
- Piscina pode ter **1, 2 ou 3 bordas infinitas**. Cada borda tem **calha/mini-reservatorio** que recebe a lamina.
- Os mini-reservatorios escoam **POR GRAVIDADE** pra um **reservatorio MASTER**.
- Master: **cisterna plastica enterrada** (tampada -> so VOLUME conta no aquecimento) **OU** o **proprio
  tanque onde a agua cai**, se ja tiver volume suficiente (pode ser **aberto -> evapora + volume**).
- -> dai as **linhas**: cada linha = uma borda + seu mini-reservatorio. + um master. + **toggle aberto/enterrado por reservatorio**.

## UI proposta (multi-linha) — esquema RICO de linha (def. sessao 216)
Cada linha tem **Tipo: MASTER** (cisterna principal) ou **SLAVE** (borda).

**Linha SLAVE (borda):**
- **Lamina de transbordo:** comprimento da borda (m), altura de queda (m), espessura do filme (mm) OU vazao (L/min/m), horas/dia.
- **Ponto de captacao** (sub-tipo, toggle):
  - (a) **Reservatorio/calha com volume:** comp×larg×prof (m) OU auto (area × ~0,10 m); toggle aberto/enterrado.
  - (b) **Canaleta com ralos (sem volume relevante):** comprimento da canaleta (m), nº de ralos, diametro do ralo; (aberta -> evapora).
  - (c) **Derrama DIRETO no master:** sem intermediario e SEM tubo de gravidade — a borda cai direto na cisterna master, e a bomba do filtro puxa direto dela. (Tubo de gravidade so existe nos modos (a)/(b).)
- **Tubo de gravidade ate o master:** comprimento do tubo (m), **nº de curvas**, **diferenca de altura** captacao→master (m), material (PVC), diametro (AUTO-dimensionado por Manning OU manual).
- -> **resultados da linha:** vazao de transbordo (m³/h), **DN recomendado**, % cheio, velocidade, volume do reservatorio (se aplicavel).

**Linha MASTER (cisterna principal):**
- Reservatorio: comp×larg×prof (m) OU "eh o proprio tanque onde a agua cai"; toggle aberto/enterrado.
- -> **resultados:** volume total, soma das vazoes que chegam (Σ slaves), vazao de bomba sugerida, **alerta se o volume nao comporta o surge** (vs estudo do reservatorio).

**Totais do sistema** (alimentam FASE 2): volume termico extra (Σ reservatorios) + area de evaporacao (lamina(s) + reservatorios/canaletas ABERTOS).
**Topologia:** estrela — cada slave escoa direto pro master (NAO ha slave->slave em cascata).

## Calculos
- **Volume do reservatorio** — JA ESTUDADO: ver [study_borda_infinita_reservatorio.md](study_borda_infinita_reservatorio.md).
  Resumo: `V ≈ area_espelho × 0,10 m (+ N_banhistas × 0,075)`, limitado a 5-10% do volume da piscina;
  OU dimensoes reais do tanque. Vasos comunicantes (bomba off -> agua escoa por gravidade pro reservatorio).
- **Tubulacao por gravidade (JA ESTUDADO):** ver [study_borda_infinita_tubulacao_gravidade.md](study_borda_infinita_tubulacao_gravidade.md).
  Resumo: escoamento livre = **equacao de Manning** `Q=(1/n)·A·R^(2/3)·S^(1/2)` em tubo parcialmente cheio
  (geometria por angulo central). Algoritmo: `Q_design = Q_transbordo×1,2` -> iterar DN comerciais
  (50/75/100/150/200...) -> menor DN com capacidade ≥ Q_design no enchimento-alvo (default 50%) e
  0,6≤V≤7,5 m/s. Defaults: n=0,010 (PVC), S=1,5%, y=0,50. **DIFERENTE** do tubo PRESSURIZADO do solar
  (Darcy-Weisbach/Haaland em solar-budget/pipe-head-loss). **IMPLEMENTADO+VERIFICADO**: `backend/src/pool-budget/gravity-flow.service.ts`.
- **Vazao de transbordo:** relacionar a taxa de recirculacao / lamina (ver fontes do estudo do reservatorio).

## Integracao no aquecimento (FASE 2)
- **Volume termico total = piscina + Σ mini-reservatorios + master** -> afeta tempo de aquecimento + massa termica.
- **Evaporacao** = lamina(s) [modelo atual: comprimento × alt.queda × vazao × horas] + superficie dos
  reservatorios ABERTOS. Reservatorio enterrado/tampado = so volume.
- **Onde mexe hoje (entry points):**
  - `backend/src/pool-budget/heating-budget.service.ts` -> `aggregateExtrasFromItems` (borda detectada
    via item poolType ~'borda' OU `env.bordaInfinitaM` manual) + `extractInputs` (bordaInfinitaM/altura/vazao/horas).
  - `backend/src/pool-budget/heating.service.ts` -> `computeMonthlyHeatLoss` (modelo de filme da borda).
  - `backend/src/pool-budget/heating-constants.ts` -> `BORDA_INFINITA` (FILME_FACTOR, vazao, defaults).
  - Frontend: aba Bomba de Calor (BombaCalorTab) ja mostra card de Borda quando `report.extrasDetected.bordaInfinita` detectado.

## Decisoes travadas
- Reservatorio aberto/enterrado = **TOGGLE por reservatorio** (varia por projeto; NAO eh fixo).
- A borda infinita atual (item-based) nao reflete bem -> o novo sistema multi-linha substitui o input.
- **(sessao 216) Caimento do tubo:** usuario informa **diferenca de altura (m)** captacao→master; caimento `S = desnivel / comprimento_tubo`. (NAO pede % direto.)
- **(sessao 216) Curvas "roubam" caimento:** cada curva = comprimento equivalente extra -> reduz o caimento efetivo -> pode subir o DN. Modelo: `L_eff = L_tubo + nº_curvas × 30 × D` (30×D por curva 90°, **constante configuravel**); `S_eff = desnivel / L_eff`.
- **(sessao 216) Ponto de captacao do slave = 3 modos:** (a) reservatorio/calha COM volume; (b) canaleta com ralos SEM volume relevante; (c) derrama DIRETO no master (sem intermediario, sem tubo de gravidade). Todos -> cisterna master. Topologia ESTRELA (sem cascata).
- **(sessao 216) Bomba do filtro puxa DIRETO do master** -> o calculo SEMPRE valida o volume do master (surge + banhistas + 450 L/m) e ALERTA: BAIXO = cavitacao/transbordo, ALTO = superdimensionado. Implementado em `reservoir-volume.service.ts`.

## Contexto: validacao do motor de aquecimento (01/06/2026)
- A diferenca vista vs a planilha Tholz **TAB006** era **INPUTS** (vento Forte vs Moderado; cidade
  Primavera do Leste, mais fria, vs MT-generico/Cuiaba; extras cascata/SPA) — **NAO bug**. Formula
  validada (mesma fisica de evaporacao). Conferido com o usuario mudando vento -> bateu (~22,5 kW).

## Referencias
- [study_borda_infinita_reservatorio.md](study_borda_infinita_reservatorio.md) — volume reservatorio + vasos comunicantes.
- [plano_aba_bomba_calor.md](plano_aba_bomba_calor.md) — a aba Bomba de Calor (concluida).
