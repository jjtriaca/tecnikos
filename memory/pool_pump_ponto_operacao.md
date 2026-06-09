# Bomba de calor — COP por temperatura (v1.13.30) + PONTO DE OPERAÇÃO da recirc (v1.13.31)

**08/06/2026.** Frente "tubulação/bomba do trocador" do Simulador de Aquecimento. Ler ANTES de mexer
em perda de carga, seleção da bomba de recirculação, ou consumo da bomba de calor.

## 1) COP por temperatura (v1.13.30) — e o GRANDE achado: o "15°C" era só RÓTULO
- **Mudança:** `copAt50ForTemp(tempAr, air15, air26)` em `heating.service` interpola a âncora copAt50
  do COP pela temperatura do AR de cada mês (linear entre copAt50Air15@15°C e copAt50Air26@26°C, clamp
  [10,32]°C, piso 2,5). Usado no `computeMonthlyConsumption`. `copEstimated` passou a ser o COP na temp
  MÉDIA local (não mais o inverno fixo).
- **ACHADO (não óbvio):** o consumo **NUNCA** usou o "COP 7 do inverno". A bomba (Tholz X23) tem
  **polinômio A/B/C** cadastrado (`copCurveA/B/C`), e `copFromCarga` usa o POLINÔMIO quando A/B/C existem
  — **ignora copAt50**. O polinômio dá COP ~10–13 conforme a carga, **já apropriado** pro clima de
  Primavera (~23°C). O "7" aparecia só no RÓTULO (copEstimated + rodapé "ar 15°C inverno"), enganando.
- **Resultado real (prod ORCP-00001):** `annualKwh` NÃO mudou (já estava certo); só `copEstimated` 7→11,9
  (agora bate com o polinômio efetivo). **O fix foi de DISPLAY/honestidade, não de número.**
- **LIÇÃO:** o "−18,6%" estimado ANTES de simular estava errado (calculado vs fórmula LINEAR simplificada,
  não o polinômio que a prod usa). Sempre simular contra o caminho REAL (polinômio vs linear). Quando A/B/C
  existem, mexer no copAt50 NÃO muda o consumo.
- Display: chip "Inverno 50%" sem "✓"/ring; linha "COP efetivo no clima local: X"; rodapé reescrito.

## 2) PONTO DE OPERAÇÃO da bomba de recirculação (v1.13.31) — o fix de verdade
- **Problema (caso real WILSON FAGOTTI / ORCP-00004, X23-26c, piscina de fibra):** sistema recomendava
  bomba **1,5 cv**; obra usa **1/2 cv** e funciona. Causa em 3 camadas:
  1. **Auto-pick do tubo parava em 2,5 m/s** (limite herdado do solar/Solis) → aceitava **40mm a 2,28 m/s**
     → perda enorme (13 mca; e 33 mca se 32mm). FIX: alvo **< 2,0 m/s** pro trocador → vai pro **50mm**
     (1,46 m/s, ~4,5 mca). `pickOptimalDiameter(...,maxVelocidadeMs)`; trocador passa 2,0
     (`HARDCODED_DEFAULTS.maxVelocidadeMs`, configurável via `pipeDefaults`). **Solar fica em 2,5.**
  2. **Seleção lia a vazão da bomba na ALTURA FIXA** (`interpolatePumpCurve(curve, alturaMca)`) = vazão a
     4,49 mca → 1/2 cv dava 13,44 m³/h (estoura o máx) → descartava e subia pra 1,5 cv. **ERRADO** pra
     circuito fechado. FIX: **PONTO DE OPERAÇÃO** = interseção da curva da bomba com a resistência do tubo
     `a = K·v²` (K = perda/vazãoProjeto²). `pumpOperatingPoint(pumpCurve, kResist)` NOVO em
     `auto-select.helper`. A 50mm a 1/2 cv dá **~10 m³/h real** (na faixa 8–10). Bate com a obra.
  3. **Default tinha válvula de retenção** (valvulaQty=1, ~7m equiv) → inflava a perda. FIX: trocador
     default **valvulaQty=0** (circuito fechado típico; usuário confirmou que não tem).
- **Threading (sem quebrar o Solar):** `listBombaCandidatesByFlow` calcula `frictionKResist` SÓ quando
  `ruleKey==='trocadorBombaRule'` e injeta no `baseVars`. `extractCandidateSpecs` usa `pumpOperatingPoint`
  quando `frictionKResist>0`, senão `interpolatePumpCurve` (altura fixa) — **Solar (circuito aberto,
  altura estática) NÃO passa K → comportamento original intacto.**
- **A FÓRMULA DE PERDA (Darcy-Weisbach) ESTÁ CERTA.** O "33 mca no 32mm" é real — mas é a perda SE forçar
  a vazão de projeto. A bomba NÃO força: ela acomoda num ponto mais baixo (ex: 1cv/20mca shutoff num 32mm
  entrega ~5,8 m³/h, não zero). O erro era a UX perguntar "que bomba faz 8 m³/h a 33 mca?" em vez de "que
  vazão essa bomba entrega NESSE tubo?" (ponto de operação). Insight do usuário (instalador), correto.

## 3) Ordenação da recomendação — MANTIDA por decisão do usuário
- `trocadorBombaRule.orderBy = 'vazaoM3h asc'` → recomenda a de MENOR vazão ≥ alvo = a **Syllent 1,5 cv**
  (alta-pressão/baixa-vazão, 8,3 m³/h). Critério "errado" pro objetivo (deveria ser `potenciaCv asc`),
  MAS o usuário escolheu **"manter como está"**. A LISTA agora mostra vazões reais (1/2 cv a 10,1, #3) e
  ele escolhe na mão, ou troca `orderBy` pra `potenciaCv asc` no ⚙ da regra. **NÃO alterado.**
- Catálogo de bombas (tenant_sls) tem 1/3, 1/2, 3/4, 1, 1.5 (Pré-filtro alta-vazão + Syllent alta-pressão),
  2, 3 cv. Pré-filtro 1/2 cv = curva [0.5→12mca, 4.5→10, 8.4→8, 11.1→6, 14.2→4, 18.2→2] (shutoff 12 mca).

## 4) PENDENTE (usuário levantou, faz sentido) — "tornar configurável, default atual"
- **Perdas das conexões ajustáveis** (joelho/tê/válvula). Tabela FITTING_LENGTHS é genérica da planilha
  Solis; válvula de retenção plástica (Cepex/Tigre, portinhola) perde menos que os 7,1m@50mm (≈K3,2) —
  real ~3–5m. Joelho 50mm = 3,4m (K~1,5) também na ponta alta. Afeta SOLAR (onde válvula é usada).
- **Fator de evaporação da capa ajustável** (hoje 0,6375 = corte de 36% da evaporação; usuário acha que
  manta real corta mais). Ver bloco "capa" — decisão foi tornar ajustável, default mantido.

## Arquivos / funções
- `backend/src/pool-budget/auto-select.helper.ts`: `pumpOperatingPoint` (NOVO), `interpolatePumpCurve`,
  `extractCandidateSpecs` (ramo frictionKResist).
- `backend/src/pool-budget/solar-budget.service.ts`: `listBombaCandidatesByFlow` (frictionKResist + OP no map).
- `backend/src/pool-budget/trocador-budget.service.ts`: `computeTrocadorPipe` (maxVelocidadeMs 2,0 + valvula 0).
- `backend/src/pool-budget/pipe-head-loss.service.ts`: `pickOptimalDiameter(...,maxVelocidadeMs)`.
- `backend/src/pool-budget/heating.service.ts`: `copAt50ForTemp` (NOVO), `computeMonthlyConsumption`, `copEstimated`.
- Teste autônomo: JWT mintado sem sessionId (`docker exec tecnikos_backend node -e jwt.sign(...)`) →
  endpoints `trocador-pipe/recompute`, `trocador-bomba-candidates`, `heating-report/recompute`.
</content>
