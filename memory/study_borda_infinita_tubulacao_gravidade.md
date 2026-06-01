---
name: study_borda_infinita_tubulacao_gravidade
description: Estudo de engenharia — tubulacao de escoamento POR GRAVIDADE (mini-reservatorio/calha -> reservatorio master) na piscina de borda infinita. Equacao de Manning / tubo parcialmente cheio (escoamento livre), DIFERENTE do tubo PRESSURIZADO do solar (Darcy-Weisbach/Haaland). Dimensiona o diametro do tubo dado caudal de transbordo + declividade. Pesquisado 01/06/2026 (pre-requisito da FASE 1 do plano_sistema_borda_infinita).
metadata:
  type: study
  date: 2026-06-01
---

# Estudo — Tubulacao por gravidade (calha/mini-reservatorio -> reservatorio master)

**Motivo:** o plano da Borda Infinita (FASE 1) dimensiona a tubulacao que leva a agua transbordada
da calha/mini-reservatorio ate o reservatorio MASTER **por gravidade** (escoamento livre, tubo
nao cheio). Isso eh **escoamento em canal/conduto livre = equacao de MANNING**, fundamentalmente
**DIFERENTE** do tubo PRESSURIZADO do solar (que usa Darcy-Weisbach + Haaland em
`solar-budget`/`pipe-head-loss`). Aqui nao tem bomba empurrando: a agua desce pela inclinacao do tubo,
com superficie livre (ar em cima). O tubo trabalha PARCIALMENTE CHEIO de proposito.

## 1. Por que NAO eh o calculo do solar
| | Solar (sucao/recalque) | Borda infinita (transbordo -> master) |
|---|---|---|
| Regime | Pressurizado (tubo cheio, bomba) | Gravidade, superficie livre (tubo parcial) |
| Equacao | Darcy-Weisbach + Haaland (perda de carga) | **Manning** (escoamento uniforme em canal) |
| Incognita tipica | perda de carga / altura manometrica | **diametro** que escoa a vazao na declividade dada |
| Tubo cheio? | Sim | **Nao** — projeta-se pra rodar 1/3 a 1/2 cheio |

## 2. Equacao de Manning (SI)
`Q = (1/n) · A · R^(2/3) · S^(1/2)`
- `Q` = vazao (m³/s)
- `n` = coeficiente de rugosidade de Manning (adimensional)
- `A` = area molhada da secao (m²)
- `R` = raio hidraulico = A / P (m); `P` = perimetro molhado (m)
- `S` = declividade do tubo (m/m, ex.: 0,01 = 1%)
- Velocidade: `V = Q / A`

### Geometria do tubo circular PARCIALMENTE cheio (profundidade h, diametro D)
Com `y = h/D` (fracao de enchimento, 0 a 1) e angulo central `θ` em radianos:
- `θ = 2 · arccos(1 − 2y)`
- `A = (D²/8) · (θ − sin θ)`
- `P = (D · θ) / 2`
- `R = A / P = (D/4) · (1 − sin θ / θ)`

**Tubo CHEIO (y=1):** `A = π·D²/4`, `R = D/4`, `Q_cheio = (1/n)·(π·D²/4)·(D/4)^(2/3)·S^(1/2)`.
**Meio cheio (y=0,5):** `θ = π` -> `A = π·D²/8` (= metade da cheia), `R = D/4` (= IGUAL a cheia) ->
**`Q(50%) = 0,5 · Q_cheio`** e **`V(50%) = V_cheio`** (verificacao que confirma as formulas).

### Fato importante (capacidade vs enchimento)
- A vazao MAXIMA NAO ocorre com o tubo cheio: ocorre em **y ≈ 0,93–0,94** (~7–8% acima da cheia).
- A velocidade MAXIMA ocorre em **y ≈ 0,78–0,82**.
- Por isso, e por seguranca/ventilacao, NUNCA se projeta gravidade pra tubo 100% cheio.

### Razoes Q/Q_cheio por enchimento (uteis pro dimensionamento)
| y = h/D | A/A_cheio | Q/Q_cheio | V/V_cheio |
|---|---|---|---|
| 0,33 (1/3) | 0,29 | **0,24** | 0,82 |
| 0,50 (1/2) | 0,50 | **0,50** | 1,00 |
| 0,70 | 0,75 | **0,84** | 1,12 |
| 0,93 (pico Q) | 0,97 | **1,08** | 1,11 |
| 1,00 | 1,00 | 1,00 | 1,00 |

## 3. Parametros de projeto (consenso da literatura)
- **Rugosidade n (PVC liso):** **0,010** (Brasil; varia 0,007 diametro pequeno/alta vel. a 0,010 grande/baixa vel.).
  Concreto/RCP ≈ 0,013; PVC corrugado/estruturado mais alto. Usar **n = 0,010** pra PVC esgoto/dreno.
- **Declividade S:** minima **0,5%** (NBR 10844, condutores horizontais). Pratica de piscina:
  **¼ polegada por pe ≈ 2,08%** (~2%). Faixa util **1% a 2%**. NUNCA tubo vertical (cria golfada/vacuo).
- **Velocidade:** auto-limpante **≥ 0,6 m/s** (2 ft/s); maxima em PVC **≤ 7,5 m/s**. Faixa-alvo 0,6–3 m/s.
- **Enchimento de projeto (regra de piscina):** linha de transbordo por gravidade deve rodar
  **so 1/3 cheia** (margem pra ar/ventilacao/ruido). Linha de gravidade SEMPRE maior que a pressurizada
  equivalente; tipicamente **4", 6" ou 8"** (100/150/200 mm). Precisa de **respiro/ventilacao** — tubo
  pequeno ou vertical da golfada, restricao de fluxo e travamento por vacuo (vacuum lock).

## 4. Tabela de capacidade — PVC (n=0,010), por diametro/declividade (m³/h)
Calculada com as formulas acima. "50%" = meio cheio (recomendado pro nosso calculo); "cheio" = referencia.

| DN (mm) | Q 50% @1% | Q 50% @2% | Q cheio @1% | Q cheio @2% | V 50% @1% | V 50% @2% |
|---|---|---|---|---|---|---|
| 50  | 1,9  | 2,7  | 3,8   | 5,4   | 0,54 | 0,76 |
| 75  | 5,6  | 7,9  | 11,2  | 15,9  | 0,71 | 1,00 |
| 100 | 12,1 | 17,1 | 24,1  | 34,1  | 0,85 | 1,21 |
| 150 | 35,6 | 50,4 | 71,2  | 100,7 | 1,12 | 1,58 |
| 200 | 76,7 | 108,5| 153,4 | 217,0 | 1,36 | 1,92 |

(Q a 1/3 cheio ≈ 0,48 × Q 50%. Ex.: DN150 @2% a 1/3 ≈ 24 m³/h.)

## 5. Vazao de transbordo (a entrada do calculo)
- **Lamina de filme: 3 a 7 mm** pro efeito visual. A 6 mm: **2,593 m³/h por metro linear** de borda
  (tabela de descarga sobre vertedor). Cresce com a espessura da lamina.
- Ex.: borda de 8 m a 6 mm -> 2,593 × 8 = **20,74 m³/h** (= vazao da bomba de recirculacao).
- Metodo pratico alternativo: lamina de 2 cm transborda em 10 min -> `V = area × 0,02 m`; vazao = V × 6 (m³/h).
- Pratico ate ~**380 L/min/m** ainda mantem transbordo uniforme (limite superior).
- **A tubulacao de gravidade carrega ESSA vazao** (regime permanente = vazao da bomba). O "surge" de
  quando a bomba DESLIGA eh absorvido pelo VOLUME do reservatorio (ver
  [study_borda_infinita_reservatorio.md](study_borda_infinita_reservatorio.md)), **nao** pelo tubo.

## 6. RECOMENDACAO PRA O NOSSO SISTEMA (FASE 1)
**Funcao:** dado o caudal de transbordo da linha e a declividade, devolver o diametro comercial PVC.

**Entradas (por linha de borda) — modelo sessao 216:**
- `Q_transbordo` (m³/h) = `comprimento_lamina_m × vazao_L/min/m × 60 / 1000` — ou da tabela (2,593 m³/h/m @6mm).
- `desnivel` (m) = diferenca de altura captacao→master. `L_tubo` (m) = comprimento do tubo. `nº_curvas`.
  -> **caimento `S = desnivel / L_eff`**, com `L_eff = L_tubo + nº_curvas × 30 × D` (curvas "roubam" caimento;
  30×D por curva 90°, constante configuravel). `S` limitado a **min 0,5%** (NBR). (default desnivel se vazio: S=1,5%.)
- `n` rugosidade (default **0,010** PVC).
- `y_alvo` enchimento de projeto (default **0,50**; opcao conservadora "piscina" = 0,33).
- Fator de seguranca (default **1,2×** sobre Q_transbordo).

**Algoritmo (D entra no caimento via curvas -> iterar e reavaliar S por DN):**
1. `Q_design = Q_transbordo × fator_seguranca`.
2. Iterar diametros comerciais PVC esgoto/dreno: **DN 50, 75, 100, 150, 200, 250, 300 mm**.
3. Pra cada DN: `L_eff = L_tubo + nº_curvas × 30 × DN`; `S_eff = max(desnivel / L_eff, 0,005)`;
   calcular `Q_capacidade` no enchimento-alvo `y_alvo` via Manning (secao 2) com `S_eff`.
4. Escolher o **menor DN** com `Q_capacidade ≥ Q_design` **E** `0,6 ≤ V ≤ 7,5 m/s`.
5. (Opcional, regra de piscina) **subir um diametro comercial** pra folga de ventilacao/surge.
6. **Canaleta com ralos:** o tubo coletor canaleta→master eh dimensionado pelo Q_transbordo total da borda
   (mesmo algoritmo); nº de ralos + diametro do ralo entram como checagem de capacidade de drenagem da
   canaleta + contagem de material (NAO mudam o DN do coletor).

**Saidas:** DN recomendado, % de enchimento real, velocidade real, vazao-capacidade, flags
(velocidade baixa/alta, declividade abaixo do minimo). Avisos: "precisa de respiro/ventilacao"
e "nao instalar trecho vertical".

**Defaults travados:** `n=0,010`, `S=1,5%`, `y_alvo=0,50`, `fator=1,2`. Diametros comerciais como
constante configuravel (igual aos defaults de tubulacao do solar).

### Exemplo conferido
Borda 8 m, filme 6 mm -> 20,74 m³/h. ×1,2 = 24,9 m³/h. @S=2%, y=0,50: DN100=17,1 (insuficiente),
**DN150=50,4 (OK)** -> recomenda **DN150 (6")**, rodando ~35% cheio, V≈1,1 m/s. Bate com a pratica
de mercado (6"–8" pra transbordo de borda infinita).

## 7. Onde isso conversa com o resto
- **Reservatorio (volume):** [study_borda_infinita_reservatorio.md](study_borda_infinita_reservatorio.md) — surge/volume.
- **Plano da feature:** [plano_sistema_borda_infinita.md](plano_sistema_borda_infinita.md) — FASE 1 (UI multi-linha) usa este calculo.
- **NAO confundir** com `pipe-head-loss`/Darcy-Weisbach do solar (pressurizado). **IMPLEMENTADO** em
  `backend/src/pool-budget/gravity-flow.service.ts` (`@Injectable`, irmao do pipe-head-loss): `manningPartialFull(D, y, S, n)`,
  `solveFillForFlow(...)` e `sizeGravityPipe(inputs)`. Verificado numericamente (meio-cheio=0,5×cheio; tabela de referencia; 8m->DN150).

## Fontes
- [Manning Equation / Storm Drain Pipe Sizing — Calichi](https://calichi.com/blog/storm-drain-pipe-sizing-mannings/)
- [Gravity Flow in Pipes — Manning Formula (PDH Academy, PDF)](https://pdhacademy.com/wp-content/uploads/2022/12/Gravity_Flow_in_Pipes.pdf)
- [Hydraulic Analysis — Open Channel Pipe Flow (pipeeng.com)](https://www.pipeeng.com/gravity_flow.html) — pico Q ~93%, V ~78%.
- [Partially Full Pipe Flow Calculations (CED Engineering, PDF)](https://www.cedengineering.com/userfiles/Partially%20Full%20Pipe%20Flow%20Calculations.pdf)
- [Formula de Manning — Guia da Engenharia](https://www.guiadaengenharia.com/formula-manning-conceitos-retangular/)
- [NBR 10844 — Drenagem pluvial (declividade min 0,5%)](https://projetistapleno.com/nbr-10844-drenagem-pluvial/)
- [Equacao de Manning em condutos (hidrotec, PDF)](http://hidrotec.atspace.co.uk/Equacao_de_Manning.pdf)
- [Perimeter Overflow Pool — gravity lines oversized/vented (jdesigns)](https://www.jdesigns.com/blog/perimeter-overflow-pool-how-it-works-materials-mistakes-to-avoid)
- [Drainage Solutions for Infinity Pools (Slot Drain)](https://blog.slotdrainsystems.com/infinity-pool-catch-basin)
- [Piscinas de Borda Infinita — Calculo de Vazao (LinkedIn, S. Tarzia)](https://pt.linkedin.com/pulse/piscinas-de-borda-infinita-c%C3%A1lculo-vaz%C3%A3o-sinderval-tarzia) — 2,593 m³/h/m @6mm.
- [Dimensionamento piscinas borda infinita (Interplanus, PDF)](https://interplanus.com/wp-content/uploads/2020/11/dimensionamento-piscinas-com-borda-infinita.pdf)
