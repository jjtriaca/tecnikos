---
name: sessao_214_summary
description: Sessao 214 (28-29/05/2026) — 19 releases v1.12.75 → v1.12.93. Foco principal: modelo fisico de consumo eletrico da bomba solar (5 iteracoes ate calibrar) + thermal-demand.service unificado + PDF fixes + perda das baterias no MCA.
metadata:
  type: project
---

# Sessao 214 — 28-29/05/2026

**Versao em prod ao final:** v1.12.93 (19 releases na sessao: v1.12.75 → v1.12.93)

## Releases por tema

### Tema 1: PDF Print Fixes (v1.12.75 → v1.12.77) ✅
Sequencia de fixes pra finalizar o PDF do Simulador Solar — sessao 213 deixou pendencia.

| Release | Foco |
|---------|------|
| v1.12.75 | Falhou no docker pull, recovery em v1.12.76 |
| v1.12.76 | **Fix da 2a pagina em branco** — `display: none` em `body > *:not(.solar-pdf-clone-container)` em vez de `visibility: hidden` (que mantinha elemento no flow). Fix da imagem coletor pequena: `print:h-[52mm]` fixo em vez de `print:h-full + max-h-[52mm]` |
| v1.12.77 | **Limpeza** — removeu botao 👁️ PDF (preview interno via simulating-print), ~100 linhas de CSS, portal toolbar, import createPortal. Botao Imprimir ficou com icone 🖨️ |

Documentado em [memory/sistema_impressao_pdf_simulador.md](sistema_impressao_pdf_simulador.md) e [memory/bug-print-visibility-hidden-2nd-page.md](bug-print-visibility-hidden-2nd-page.md).

### Tema 2: Card de Consumo Eletrico da Bomba (v1.12.78 → v1.12.82) ✅
Adicionou linha de consumo eletrico no card da bomba do Simulador Solar, com tarifa configuravel via popover.

| Release | Foco |
|---------|------|
| v1.12.78 | **Linha de consumo + tarifa** — calculo HSE × fator + custo em R$/mes. Icone 💡 abre popover pra editar tarifa (R$/kWh). Backend: `Company.systemConfig.pool.tarifaKwhBRLCents` (default 95) + endpoints `GET/PATCH /pool-budgets/solar-tarifa-kwh` |
| v1.12.79 | **Modelo fisico** — horas/dia = HSE × min(1, perda/ganho). Reduzir coletores extras aumenta o consumo (controlador diferencial) |
| v1.12.80 | **Escala termica** — perda escala com ΔT(alvo-ambiente)/13. Mudar temp alvo agora afeta consumo |
| v1.12.81 | Hotfix URL — `/pool-budget/` singular era `/pool-budgets/` plural (popover quebrava) |
| v1.12.82 | Fix do floor (inclinacao reduzida) — coletores extras voltaram a influenciar (antes batiam todos no floor alto) |

### Tema 3: Fix Capa/Vento no Recompute Solar (v1.12.83) ✅
**Bug critico** — `SolarRecomputeDto` nao tinha campos `capa`/`vento`. Mudar UI nao afetava calculo (backend usava banco). Frontend tambem nao enviava. Mudou:
- `SolarRecomputeDto` aceita `capa?: 'SIM'|'NAO'` e `vento?: 'FRACO'|'MODERADO'|'FORTE'`
- `computeAndSaveReport` usa overrides + persiste `capaTermica`/`velocidadeVento` no env
- Frontend `recomputeSolar` envia `capa: capaTermica ? 'SIM' : 'NAO'` e `vento: normEnum(...)`

### Tema 4: ThermalDemandService Unificado (v1.12.84) ✅
Criou `backend/src/pool-budget/thermal-demand.service.ts` — calculo CENTRAL de demanda termica + oferta solar + horas bomba + consumo eletrico. Substitui calculo local heuristico do frontend.

Endpoint: `POST /pool-budgets/:id/thermal-demand`

Considera 14 fatores: capa, vento, ΔT alvo-ambiente, orientacao+inclinacao telhado, clima (UF/cidade), area/volume piscina, tipo construcao+piscina, utilizacao, extras (hidro/cascata/borda), qtd coletores, latitude (UF), umidade, eficiencia coletor.

Documentado em [memory/thermal_demand_service.md](thermal_demand_service.md).

### Tema 5: Perda das Baterias no MCA (v1.12.85 → v1.12.87) ✅
Cada coletor em serie tem ~0.20 mca perda. Antes ignoravamos — bomba ficava subdimensionada quando havia varias baterias em serie.

| Release | Foco |
|---------|------|
| v1.12.85 | **Adicionado em pipe-head-loss.service** — `perdaBateriasMca = coletoresPorBateria × batPorRamo × 0.20`. Override per-tenant em `Company.systemConfig.pool.pipeDefaults.perdaPorColetorMca` |
| v1.12.86 | useEffect frontend pra disparar recomputePipe quando solar report muda (com bug de race condition) |
| v1.12.87 | **Fix race condition** — backend `computeAndSaveReport` agora recalcula pipe INTERNAMENTE e devolve `solarPipeAfter` no response. Sem dependencia de useEffect |

Card mostra: `= 3.84 mca tubulacao + 3.60 mca baterias (6col × 3serie) + 4 m desnivel · velocidade 1.61 m/s`

### Tema 6: Fix Scroll Volta pro Topo (v1.12.88) ✅
Cada recompute disparava `onSaved?.()` que chamava `load()` no pai → refetch + rerender pesado durante edicao. Scroll voltava pro topo.

**Fix:** difere `onSaved` pro fechamento do modal via `pendingReloadRef + handleClose`. Trocou 6 ocorrencias de `onSaved?.()` por `notifyPendingSave()`.

### Tema 7: Painel Debug + Investigacao Saturacao (v1.12.89 → v1.12.90) ✅
v1.12.89 adicionou painel violeta DEBUG no card da bomba. Revelou que **heating.service.computeMonthlyHeatLoss (Tabela78)** estava retornando **1032 kWh/dia** pra piscina 28m² (equivalente a 1500 W/m², absurdo — referencia Carrier/ASHRAE = 250-600 W/m²).

Causa: `BETA_INV = 1/133.32` na formula gerava conversao errada de Pa → mmHg.

v1.12.90: **Formula simplificada calibrada** — substitui heating.service.computeMonthlyHeatLoss no thermal-demand. Tabelas em [Modelo de Consumo](#modelo-de-consumo-da-bomba-v11293-modelo-final).

heating.service continua intocado pra dimensionamento de bomba de calor (aba separada).

### Tema 8: Modelo Bomba Solar — 5 Iteracoes (v1.12.90 → v1.12.93) ✅

| Release | O que mudou | Por que |
|---------|-------------|---------|
| v1.12.90 | Formula simplificada de perdas (base × vento × construcao × ΔT) | Tabela78 inflava 5-10x |
| v1.12.91 | + Floor 0.85 + Multiplicador 1.3 + fatorInstalacao no HSE | 3.3h/dia muito baixo (usuario disse 5-6h no inverno) |
| v1.12.92 | **Reverter fatorInstalacao no HSE** | Usuario apontou que orientacao ruim NAO faz bomba operar menos — coletor ainda esquenta, controlador liga durante todo o sol. fatorInst deve estar SO em qSolar |
| v1.12.93 | + Rendimento 0.65 + Fator vazao + Painel compacto | Bombas com mesma potencia (cv) davam mesmo consumo. Vazao da bomba afeta — bomba maior vazao faz coletor esfriar antes |

## Modelo de Consumo da Bomba (v1.12.93 — Modelo Final)

### Formula completa

```
qPerdas/dia (kWh) = (Wm²_efetivo × area_piscina_m² / 1000) × 24 + extras_kWh/dia

Onde:
  Wm²_efetivo = max(30, perdaBase × ventoMult × construcaoMult × ΔT_mes/13)
  perdaBase = 120 (capa SIM) ou 330 (capa NÃO)  [W/m²]
  ventoMult = {NULO: 0.5, FRACO: 0.7, MODERADO: 1.0, FORTE: 1.5, INTERNA: 0.5}
  construcaoMult = {ABERTA: 1.0, COBERTA/FECHADA: 0.7, CLIMATIZADA: 0.5}
  ΔT_mes = max(0, tempAlvo - tempAmbiente_mes)
  extras_kWh/dia = hidromassagem(4kW/un) + cascata(3kW/m) + borda_infinita(2kW/m), ponderados por horas/168

qSolar/dia (kWh) = qtd_coletores × area_coletor × radSol_mes × eficiencia × fatorInstalacao
  fatorInstalacao = calcFatorInstalacao(orientacao, inclinacao, latitudeAbs)

fatorBase = qSolar > 0 ? min(1, qPerdas/qSolar) : 1
fator = max(0.85, fatorBase)   ← FLOOR controlador diferencial
fatorVazao = clamp(0.7, 1.3, vazaoSolarNecessaria / vazaoBomba)
horas/dia = HSE_mes × fator × 1.3 × fatorVazao

potencia_eletrica_kW = potenciaCv × 0.7355 / 0.65   ← rendimento medio
consumo_kWh/mes = potencia_eletrica × horas/dia × 30
```

### Tabelas de coeficientes

#### Perda termica BASE (W/m²) — perda media 24h em ref (vento moderado, ΔT 13°C, ABERTA)

| Capa | Wm² base |
|---|---|
| **COM_CAPA (SIM)** | **120** |
| **SEM_CAPA (NÃO)** | **330** |

Calibrado vs Carrier/ASHRAE.

#### Multiplicador de vento

| Vento | Mult |
|---|---|
| NULO / INTERNA | 0.5 |
| FRACO | 0.7 |
| MODERADO | 1.0 |
| FORTE | 1.5 |

#### Multiplicador de construcao

| Tipo | Mult |
|---|---|
| ABERTA | 1.0 |
| COBERTA / FECHADA | 0.7 |
| CLIMATIZADA | 0.5 |

#### Floor minimo + multiplicadores fixos

| Constante | Valor | Significado |
|---|---|---|
| FLOOR_FATOR_BOMBA | 0.85 | Controlador diferencial nao para mesmo com piscina quente — bomba opera ≥85% do HSE |
| FATOR_HORAS_OPERACAO_REAL | 1.30 | Bomba opera ~1.3x o HSP (Horas de Sol Pleno) — luminosidade difusa manha/tarde |
| RENDIMENTO_BOMBA_MEDIO | 0.65 | Rendimento global tipico bomba centrifuga piscina (motor × hidraulico × eletrico) |
| FATOR_VAZAO_MIN | 0.70 | Cap min — bomba muito sobre-vazao nao para instantaneo (histerese controlador) |
| FATOR_VAZAO_MAX | 1.30 | Cap max — bomba sub-vazao nao opera >30% extra |
| MIN_PERDA_WM2 | 30 | Floor — sempre tem alguma perda residual |
| DELTA_T_BASE | 13 | °C ref (35 alvo − 22 ambiente) — escala linear de perda |

#### Extras (kW de referencia)

| Item | kW ref (uso continuo 24h) | Peso |
|---|---|---|
| Hidromassagem (por unidade) | 4.0 | horas/168 |
| Cascata (por metro de largura) | 3.0 | horas/168 |
| Borda infinita (por metro) | 2.0 | horas/24 |

### Decisoes do modelo

1. **HSE bruto nas horas (nao multiplicar fatorInstalacao)**: orientacao ruim NAO faz bomba operar menos. Coletor ainda esquenta (mesmo que menos), controlador diferencial liga durante todo o sol. Efeito de orientacao captura via qSolar → fatorBase sobe → mais horas.

2. **Floor 0.85**: controlador diferencial padrao nao mede temp_alvo. Mantem bomba rodando enquanto T_coletor > T_piscina + ΔT_min, mesmo apos atingir alvo.

3. **Multiplicador 1.3 (sol difuso)**: HSE eh tempo de sol DIRETO equivalente. Bomba opera tambem em horas com luminosidade difusa (manha cedo, tarde).

4. **Rendimento 0.65**: bomba real consome ~50% mais que P_mecanica (0.7355 × cv). Pode variar 0.55 (econ. BR) a 0.85 (VSD premium). Default conservador.

5. **Fator vazao**: bomba com vazao > necessaria circula rapido, coletor esfria, controlador desliga antes. Inversamente.

### Arquivos relevantes

- [thermal-demand.service.ts](../backend/src/pool-budget/thermal-demand.service.ts) — motor unico
- [HeatingSimulatorModal.tsx](../frontend/src/components/pool/HeatingSimulatorModal.tsx) — UI + painel debug
- [solar-constants.ts](../backend/src/pool-budget/solar-constants.ts) — `calcFatorInstalacao` (orientacao+inclinacao+lat)
- [heating-constants.ts](../backend/src/pool-budget/heating-constants.ts) — Tabela78 (NAO usar pra bomba solar, apenas bomba de calor)

## Painel debug (v1.12.93 — compacto)

Card da bomba mostra debug em 4 colunas, fonte 6px, com todos os componentes da formula:
- qPerdas (med/pico) · qSolar med · cobertura · fator · HSE · capa · vento · qtd col · area · fInst · T_alvo
- Componentes formula: base W/m² × vento × construcao × ΔT × extras
- Operacao bomba: HSE · floor · ×real · =h/dia · pot eletrica · rendimento · vazao bomba · vazao solar · fator vazao

## Pendentes pra sessao 215

### Principal: Aba Trocador de Calor (estilo aba Solar)

Criar nova aba **"Trocador"** no Simulador, replicando o pattern visual e funcional da aba **Solar**, modificando:

**Campos que NAO fazem sentido no Trocador:**
- Coletor (modelo, area, eficiencia, qtd, baterias em serie/paralelo)
- Orientacao + inclinacao do telhado
- Diagrama de baterias
- Cobertura piscina × coletores
- Fator instalacao (sem coletor)

**Campos novos que sao especificos do Trocador:**
- Modelo do trocador (com capacidade kcal/h × cv)
- Vazao primaria (caldeira/bomba calor)
- Vazao secundaria (piscina)
- Pressao maxima
- Material (inox/titanio)
- Eficiencia da troca (~80-95%)

**Campos compartilhados (manter):**
- Dimensoes piscina + tipo
- Configuracao aquecimento (capa, vento, ΔT, tipo construcao)
- Tubulacao perda de carga
- Bomba recomendada (mesma logica de vazao + altura manometrica)
- Simulacao termica mensal
- Consumo eletrico (mesmo motor thermal-demand)

### Outros pendentes
- Remover painel debug violeta apos validacao final dos numeros
- Sessao 209 legado: SQL `update-solis-procel-sls.sql`, configurar regra do Coletor Solar no SLS
- Aguardando Solis: confirmar 7+ baterias (3 ramos paralelos)
- Roadmap: Defaults de tubulacao em Configuracoes > Piscina, autoSelectRule.followProductLine

## Memorias criadas/atualizadas nesta sessao

- [bug-print-visibility-hidden-2nd-page.md](bug-print-visibility-hidden-2nd-page.md) — 2a pagina em branco no PDF
- [sistema_impressao_pdf_simulador.md](sistema_impressao_pdf_simulador.md) — sistema de print completo (tabela 18 problemas)
- [thermal_demand_service.md](thermal_demand_service.md) — service central de demanda termica

## Stats

- **19 releases** v1.12.75 → v1.12.93
- ~5 iteracoes ate calibrar o modelo de consumo da bomba (refletindo dificuldade de modelo fisico empirico)
- Principal aprendizado: heating.service.computeMonthlyHeatLoss (Tabela78) tem bug de unidades — usar apenas pra bomba de calor (dimensionamento relativo), nao pra calculos absolutos
- Iteracao com usuario foi critica pra calibrar (controlador diferencial, vazao, rendimento) — modelos puramente fisicos sem feedback de mercado nao chegam ao valor real
