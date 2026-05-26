# Estudo — Vazão em aquecimento solar de piscina (base teórica → confirmada)

**Data:** 26/05/2026
**Status:** ✅ IMPLEMENTADO em v1.12.48 (confirmado contra 2 exemplos oficiais Solis)

## Regras oficiais Solis (suporte técnico, 26/05/2026)

- **Vazão:** 4,2 L/min/m² = **0,252 m³/h/m²**
- **Máx coletores por bateria:** 7
- **Máx m² por bateria:** 30 m² (limite alternativo — o que vier primeiro)
- **Máx baterias em série:** 3
- **Quando > 3 baterias:** abrir nova série em paralelo
- **Vazão total = `num_séries_paralelas × área_primeira_bateria × 0,252`**

## Validação contra exemplos Solis

| Cenário | Solis (oficial) | Fórmula proposta | OK? |
|---|---|---|---|
| Exemplo 1: 15 col, 3 bat de 5, 1 série | 2,8 m³/h | `1 × 5 × 2,24 × 0,252 = 2,82` | ✅ |
| Exemplo 2: 20 col, 4 bat de 5, 2 séries | 5,64 m³/h | `2 × 5 × 2,24 × 0,252 = 5,64` | ✅ |

## 1. Vazão recomendada por m² de coletor (indústria)

| Fonte | Vazão recomendada (m³/h por m²) | Comentário |
|---|---|---|
| **Sodramar (BR)** | **0,252** | Recomendação fabricante — "vazão ideal" |
| KS Aquecedores (BR) | 0,200 | Mínima recomendada |
| SIS Inteligência Sustentável (BR) | 0,200 | Mínima recomendada |
| EUA (Build It Solar) | 0,122–0,196 | 0,05–0,08 GPM/sqft (5–8 GPM/100sqft) |
| TS Solar (BR) | n/d (PDF binário) | Manual recomenda profissional habilitado |

**Constante atual do código:** `SOLAR_VAZAO_FATOR = 0.254` — alinha com Sodramar (topo do range BR). Não é o bug.

**Melhoria possível:** tornar configurável por modelo de coletor (`technicalSpecs.vazaoProjetoM3hPorM2` no Product), com default 0.254. Cada fabricante tem sua vazão de projeto.

## 2. Configuração paralelo vs série (consenso)

### Dentro de uma bateria → coletores em PARALELO
- Cada coletor recebe sua fração da vazão simultaneamente
- Cada coletor opera com sua vazão de projeto = `area_coletor × vazao_unit`
- Limites práticos:
  - **Máx 5 coletores por bateria** (conservador — Soletrol, manual da indústria)
  - **Comprimento linear máx 5 metros por bateria** (piscinasplanalto)
  - Alguns fabricantes aceitam até 8 (Sodramar)

### Entre baterias → opções
- **Paralelo entre baterias (padrão):** cada bateria tem entrada/saída próprias conectadas ao tronco principal
- **Série entre baterias (raro):** saída de uma alimenta entrada da próxima — máx 2 séries em paralelo

> "Acima de 5 coletores, ligar em série não deve ultrapassar 2 séries. Quando ultrapassar, criar outras séries em paralelo." (piscinasplanalto)

## 3. Fórmula CORRETA segundo literatura

### Vazão por coletor individual
```
vazão_coletor = área_coletor × vazão_unitaria
              = área_coletor × 0,254 m³/h por m²  (default Sodramar)
```

### Vazão de UMA bateria (entrada da bateria)
> "A vazão no ponto de entrada da bateria seja igual ao número de coletores na bateria multiplicado pela vazão recomendada para cada coletor."
> — fonte piscinasplanalto + manual Soletrol

```
vazão_bateria = num_coletores_na_bateria × vazão_coletor
              = num_coletores_na_bateria × area_coletor × 0,254
```

### Vazão TOTAL do sistema
**Caso 1: baterias em PARALELO (padrão)**
```
vazão_total = SOMA das vazões de cada bateria
            = qtd_TOTAL_coletores × area_coletor × 0,254
```

**Caso 2: baterias em SÉRIE**
```
vazão_total = vazão_da_maior_bateria (mesma vazão passa por todas)
```

## 4. Por que a regra `×2 se ≥4 baterias` antiga funcionava parcialmente

A regra original do código (`SOLAR_VAZAO_DOBRA_BATERIAS = 4`) na verdade era uma APROXIMAÇÃO grosseira do método Solis:
- 1-3 baterias → 1 série → ×1 ✅
- 4-6 baterias → 2 séries → ×2 ✅ (acaso coincide)
- 7+ baterias → 3+ séries → deveria ser ×3, código dizia ×2 ❌

**Fórmula correta substitui** `(×2 se ≥4 bat)` por `ceil(num_baterias / 3)`. Funciona pra qualquer quantidade.

## 5. Exemplo numérico

Orçamento ANDERSON DA SILVA PRADO (piscina 8×4, área 32m², com capa, coletor 4,7m²):
- **1 bateria com 5 coletores** (qtd_total=5):
  - Código atual: `5 × 4,7 × 0,254 × 1 = 5,97 m³/h`
  - Fórmula correta: `5 × 4,7 × 0,254 = 5,97 m³/h`
  - ✅ Bate (case-edge: 1 bateria → fórmulas idênticas)

Piscina maior (área 80m²):
- **2 baterias com 8+8=16 coletores**:
  - Código atual: `8 × 4,7 × 0,254 × 1 = 9,55 m³/h` ❌
  - Fórmula correta: `16 × 4,7 × 0,254 = 19,10 m³/h` ✅
  - Divergência: **−50%** (subdimensionamento crítico)
- **4 baterias com 4×6=24 coletores**:
  - Código atual: `6 × 4,7 × 0,254 × 2 = 14,33 m³/h` ❌
  - Fórmula correta: `24 × 4,7 × 0,254 = 28,65 m³/h` ✅
  - Divergência: **−50%** (mesma proporção, dobra do código não compensa)

**Conclusão:** o `×2` arbitrário do código compensa metade da subdimensionamento em 4+ baterias, mas continua errado em ~50%.

## 6. Quantidade de coletores (m² necessário)

### Código atual
```
m² necessário = area_piscina × mult_capa × (1 + extra% × 0.1)
mult_capa = 1.0 (com capa) ou 1.8 (sem capa)
```

**Não há equação termodinâmica explicita** — é regra empírica da planilha Solis. Procel/INMETRO usa balanço energético: `m²_coletor = perda_diaria_kcal / (insolação_kWh × eficiencia × 24)`.

A regra `1.0 / 1.8` (com vs sem capa) reflete fatos físicos conhecidos:
- Capa reduz perda evaporativa em 50-70% (literatura: ABNT NBR 10339)
- Sem capa exige cobertura ~80% maior de coletor pra compensar perda diária
- O `1.8` é coerente com `1 / (1 - 0.45) ≈ 1.82`

## 7. Número de baterias

### Código atual
```
num_baterias = ceil(qtd_inicial / 8)  # MAX_COLETORES = 8
coletores_por_bateria = clamp[5, 8](round(qtd_inicial / num_baterias))
```

Limites Solis: 5–8 coletores/bateria. Literatura mais conservadora: **5 coletores/bateria como teto** (manuais Soletrol e indústria).

**Melhoria possível:** tornar configuráveis `max_coletores_por_bateria` (default 8) e `min_coletores_por_bateria` (default 5) por tenant/fabricante.

## 8. Implementação v1.12.48

**Constantes atualizadas em `solar-constants.ts`:**
- `SOLAR_VAZAO_FATOR`: 0,254 → **0,252** (= 4,2 L/min/m²)
- `SOLAR_BATERIA_MAX_COLETORES`: 8 → **7**
- `SOLAR_BATERIA_MAX_M2 = 30` (nova)
- `SOLAR_BATERIAS_MAX_SERIE = 3` (nova)
- ~~`SOLAR_VAZAO_DOBRA_BATERIAS`~~ (removido)

**Lógica em `solar.service.ts`:**
```typescript
const maxColetoresPorM2 = floor(30 / area_coletor);
const tetoColetoresBateria = min(7, maxColetoresPorM2);
const numBaterias = ceil(qtdInicial / tetoColetoresBateria);
const coletoresPorBateria = clamp(round(qtdInicial / numBaterias), 5, tetoColetoresBateria);
const numRamosParalelos = ceil(numBaterias / 3);  // Solis: máx 3 baterias em série
const vazaoTotal = numRamosParalelos × coletoresPorBateria × area_coletor × 0,252;
```

**SolarReport ganhou:** `numRamosParalelos: number` (exibido no Simulador quando > 1).

## 9. Sources

- [Sodramar — Slideshare](https://www.slideshare.net/solelazerpiscinas/aquecedor-solar-10348739)
- [Globaltechbrasil (Sodramar 36m²)](https://www.globaltechbrasil.com/aquecedores-para-piscinas/aquecedor-solar/placas-aquecimento-solar-para-piscinas-36-m-ks-aquecedores)
- [SIS Inteligência Sustentável](https://www.sisinteligenciasustentavel.com.br/aquecimentosolarparapiscina1-mpc)
- [Piscinas Planalto — interligação placas](https://www.piscinasplanalto.com.br/interligacao-de-placas-de-aquecedor-solar/)
- [Soletrol — manual Metaliplast](https://www.soletrol.com.br/extras/manuais/pdfs/metaliplast.pdf)
- [Build It Solar — Collector Flow Rate](https://www.builditsolar.com/References/ColFlowRate.htm)
- [Florida Solar Design Group — best flow rate](https://floridasolardesigngroup.com/solar-pool-heater-best-flow-rate)
- [US DOE — Solar Swimming Pool Heaters](https://www.energy.gov/energysaver/solar-swimming-pool-heaters)
- [Tese Téc Lisboa — sistema solar térmico](https://fenix.tecnico.ulisboa.pt/downloadFile/1407770020545754/TESE_67786.pdf)
- [UFG — Piscinas: Tipologias e Dimensionamento](https://files.cercomp.ufg.br/weby/up/140/o/PISCINAS_-_TIPOLOGIAS__COMPONENTES_E_METODOLOGIAS_DE_DIMENSIONAMENTO.pdf)
- ABNT NBR 15569:2020 — Sistema de Aquecimento Solar de Água (norma brasileira oficial)
