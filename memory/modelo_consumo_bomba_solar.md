---
name: modelo_consumo_bomba_solar
description: Modelo fisico completo do consumo eletrico da bomba do Simulador Solar (v1.12.93 — modelo final). Formulas, constantes, decisoes arquiteturais, calibracao empirica.
metadata:
  type: project
---

# Modelo de Consumo Eletrico da Bomba Solar

**Versao final:** v1.12.93 (29/05/2026)
**Arquivo:** [backend/src/pool-budget/thermal-demand.service.ts](../backend/src/pool-budget/thermal-demand.service.ts)

## Visao geral

A bomba solar circula a agua entre piscina e coletor enquanto ha sol. Seu consumo eletrico depende de:
1. **Quanto tempo opera** (horas/dia × dias/mes)
2. **Quanta potencia eletrica consome** (W → kWh)

O calculo modela o controlador diferencial padrao (mais comum em instalacoes brasileiras): liga quando T_coletor > T_piscina + ΔT_on (~5°C), desliga quando T_coletor < T_piscina + ΔT_off (~2°C). NAO mede temp_alvo.

## Formula completa

```
              ╔════ DEMANDA TERMICA ════════════════════════════╗
              ║                                                  ║
qPerdas/dia = (Wm²_efetivo × area_piscina_m² / 1000) × 24 +
              extras_kWh/dia

Wm²_efetivo = max(MIN_PERDA, perdaBase × ventoMult × construcaoMult × ΔT/13)

              ║                                                  ║
              ╚════════════════════════════════════════════════╝

              ╔════ OFERTA SOLAR ═══════════════════════════════╗
              ║                                                  ║
qSolar/dia = qtd_coletores × area_coletor × radSol × eficiencia × fatorInstalacao
fatorInstalacao = calcFatorInstalacao(orientacao, inclinacao, latitudeAbs)

              ║                                                  ║
              ╚════════════════════════════════════════════════╝

              ╔════ OPERACAO DA BOMBA ══════════════════════════╗
              ║                                                  ║
fatorBase = qSolar > 0 ? min(1, qPerdas/qSolar) : 1
fator     = max(FLOOR_FATOR_BOMBA, fatorBase)          # 0.85 minimo
fatorVazao = clamp(0.7, 1.3, vazaoSolar / vazaoBomba)
horas/dia = HSE × fator × FATOR_HORAS_REAL × fatorVazao   # HSE bruto, NAO inclinado

              ║                                                  ║
              ╚════════════════════════════════════════════════╝

              ╔════ CONSUMO ELETRICO ═══════════════════════════╗
              ║                                                  ║
P_eletrica_kW = potenciaCv × 0.7355 / RENDIMENTO     # = 0.65
consumo_kWh/mes = P_eletrica × horas/dia × 30

              ║                                                  ║
              ╚════════════════════════════════════════════════╝
```

## Constantes (todas em `thermal-demand.service.ts`)

### Perdas termicas — base por capa

```ts
const PERDA_BASE_WM2 = {
  COM_CAPA: 120,   // W/m² perda 24h media com capa termica
  SEM_CAPA: 330,   // W/m² perda 24h media sem capa (3x mais)
};
```

Calibrado com literatura Carrier/ASHRAE.

### Multiplicadores

```ts
const VENTO_MULT = {
  NULO: 0.5, INTERNA: 0.5, FRACO: 0.7, MODERADO: 1.0, FORTE: 1.5,
};

const CONSTRUCAO_MULT = {
  ABERTA: 1.0,      // externa, exposta
  COBERTA: 0.7,     // teto + paredes parciais
  FECHADA: 0.7,     // sinonimo
  CLIMATIZADA: 0.5, // ambiente controlado
};

const DELTA_T_BASE = 13;       // °C ref (35 alvo - 22 amb)
const MIN_PERDA_WM2 = 30;      // floor — sempre ha alguma perda
```

### Operacao da bomba

```ts
const FLOOR_FATOR_BOMBA = 0.85;       // controlador diferencial
const FATOR_HORAS_OPERACAO_REAL = 1.30; // sol difuso (manha cedo + tarde)
const RENDIMENTO_BOMBA_MEDIO = 0.65;   // motor + hidraulico + eletrico
const FATOR_VAZAO_MIN = 0.7;
const FATOR_VAZAO_MAX = 1.3;
```

### Extras (kW de referencia em uso continuo)

```ts
const EXTRAS_KW_REF = {
  hidromassagemPorUnidade: 4.0,    // SPA medio
  cascataPorMetroLargura: 3.0,
  bordaInfinitaPorMetro: 2.0,
};
// Ponderado por (horas_uso / 168) ou (horas_dia / 24) para borda
```

## Decisoes arquiteturais (com historico)

### 1. Floor 0.85 — por que?

**Contexto:** sem floor, em meses de verao com qSolar >> qPerdas, fatorBase caia pra 30-40% → bomba "operaria" 1-2h/dia. Irrealista pra Brasil.

**Razao:** controlador diferencial padrao NAO mede temp_alvo. Mantem bomba circulando enquanto T_coletor > T_piscina + ΔT_min. Apos atingir alvo, piscina superaquece (controlador nao para), entrando em equilibrio.

**Calibracao:** usuario validou que inverno deve dar 5-6h/dia. HSE inverno MT ~4.2h × 1.3 × 0.85 = 4.6h. Bate.

### 2. Multiplicador 1.30 — por que?

**Contexto:** HSE (Horas de Sol Equivalente) = radiacao integrada / 1 kW/m². Eh sol DIRETO equivalente, nao tempo total de luminosidade.

**Razao:** controlador diferencial liga em qualquer luminosidade que esquente o coletor acima da piscina. Manha cedo + tarde com sol baixo = luminosidade DIFUSA. Bomba opera ~1.3× HSE no total.

### 3. Rendimento 0.65 — por que?

**Contexto:** antes assumia rendimento 100% (potencia eletrica = potencia mecanica). Subestimava ~50%.

**Razao:** bomba real tem perdas:
- Motor eletrico: 80-90% rendimento
- Acoplamento + hidraulico: 70-80%
- Global: 0.55-0.85 dependendo da qualidade

**Calibracao:** 0.65 representa bomba media BR. Usuario pode ajustar pra:
- 0.55 — bomba chinesa/no-name
- 0.75 — premium (Pentair EcoStar)
- 0.85 — VSD em rotacao otimizada

### 4. Fator vazao — por que?

**Contexto:** bombas com mesma potencia CV mas vazoes diferentes davam mesmo consumo. Usuario apontou que vazao afeta o controlador.

**Razao:** bomba com maior vazao circula a agua rapido → menos tempo absorvendo calor → T_coletor cai mais rapido → controlador diferencial desliga antes.

**Inversamente:** bomba sub-dimensionada na vazao opera mais tempo.

**Clamp 0.7-1.3:** controlador tem histerese (nao para instantaneo) + nao opera mais que 30% extra do tempo de sol.

### 5. HSE bruto (nao multiplicar fatorInstalacao) — por que?

**Contexto:** v1.12.91 multiplicou fatorInstalacao no HSE → orientacao ruim → bomba operava MENOS. Fisicamente errado.

**Razao:** mesmo com orientacao ruim, o coletor AINDA ESQUENTA (so menos). Controlador continua ligando durante todo o sol. As HORAS sao as mesmas — so a TRANSFERENCIA de energia por hora cai.

**O efeito de orientacao ruim ja eh capturado via qSolar:** qSolar cai → fatorBase = qPerdas/qSolar SOBE → bomba opera MAIS (ate o cap).

### 6. Heating.service NAO eh usado — por que?

**Contexto:** o `heating.service.ts` tem `computeMonthlyHeatLoss()` baseado em Tabela78 (referencia indus tria). v1.12.84 tentou reusa-lo.

**Problema descoberto em v1.12.89:** retornava 1032 kWh/dia pra piscina 28m² (1500 W/m² absurdo). Causa: `BETA_INV = 1/133.32` na formula de evaporacao gerava conversao errada de mmHg.

**Decisao em v1.12.90:** substituir por formula simplificada calibrada. `heating.service` continua intocado pra dimensionamento de **bomba de calor** (aba separada), onde so importa o relativo entre meses (escolher o pior caso).

## Tabela de referencia — ORCP-00001

Piscina 28.5 m² em Primavera do Leste/MT, capa SIM, vento FORTE, alvo 35°C, T_amb medio ~25°C, construcao ABERTA, bomba 0.5 cv:

| Bomba | Vazao | qSolar (med) | fator | fatorVazao | horas/dia | P_eletrica | kWh/mes | R$/mes |
|---|---|---|---|---|---|---|---|---|
| Pre-filtro Auto 1/2cv | 6.92 m³/h | ~150 | 0.85 | 0.82 | 5.0h | 0.57 kW | ~85 | R$ 81 |
| Impulse Syllent 1/2cv | 4.86 m³/h | ~150 | 0.85 | 1.16 | 7.0h | 0.57 kW | ~120 | R$ 114 |
| Bomba ideal (~5.6 m³/h) | 5.64 m³/h | ~150 | 0.85 | 1.00 | 6.0h | 0.57 kW | ~98 | R$ 93 |

Variando potencia (vazao ideal):
| Bomba | P_eletrica | kWh/mes |
|---|---|---|
| 0.5 cv | 0.57 kW | 98 |
| 0.75 cv | 0.85 kW | 147 |
| 1 cv | 1.13 kW | 196 |
| 1.5 cv | 1.70 kW | 294 |

## Como debugar consumo estranho

O painel **🐛 DEBUG thermal-demand** no card da bomba (visivel apenas com role admin) mostra todos os componentes:

1. **Saturacao** (Fator bomba 100% ⚠ SATURADO): qPerdas > qSolar. Causas tipicas:
   - Piscina sem capa + vento forte (perda alta)
   - Coletores insuficientes (oferta baixa)
   - Orientacao ruim (qSolar cai)
   - **Bug:** Tabela78 inflando perdas (heating.service usado por engano)

2. **Horas baixas** (<3h/dia): fator base < floor + fatorVazao baixo. Causas:
   - Bomba muito super-dimensionada (vazao >> necessaria)
   - Piscina coberta + cobertura solar > 200%
   - Floor 0.85 nao acionando por algum bug

3. **Consumo muito alto/baixo:**
   - Verificar P_eletrica (cv × 0.7355 / 0.65)
   - Verificar rendimento aplicado (0.65)
   - Verificar potenciaCv do produto cadastrado

## Pontos de atencao

- **Tarifa kWh:** configurada globalmente por tenant em `Company.systemConfig.pool.tarifaKwhBRLCents` (default 95 cents = R$ 0,95/kWh). Editavel no popover do icone 💡.
- **Painel debug temporario** (violeta, marcado 🐛 DEBUG): remover quando o modelo for validado pelo usuario.
- **fatorInstalacao** vem de `calcFatorInstalacao(orientacao, inclinacao, latitudeAbs)` em [solar-constants.ts](../backend/src/pool-budget/solar-constants.ts). Tabela:
  - Norte ideal: 1.00
  - NE/NO: 0.85
  - L/O: 0.70
  - SE/SO: 0.40
  - Sul: 0.20

## Iteracoes ate o modelo final

| Versao | Mudou | Por que |
|---|---|---|
| v1.12.79 | min(1, perda/ganho) sem floor | Inicial |
| v1.12.80 | + escala termica ΔT/13 + floor variavel por temp_alvo | Capa/vento nao influenciava |
| v1.12.82 | Floor inclinacao reduzida 0.10-0.50 | Floor alto saturava extras |
| v1.12.84 | Migrou pra thermal-demand backend (Tabela78) | Centralizar calculo |
| v1.12.90 | Substituiu Tabela78 por formula simplificada calibrada | Tabela78 inflava 5-10x |
| v1.12.91 | + Floor 0.85 + Multiplicador 1.3 + ~~fatorInstalacao no HSE~~ | Horas baixas no inverno |
| v1.12.92 | Reverter fatorInstalacao no HSE | Erro fisico — orientacao ruim NAO reduz horas |
| v1.12.93 | + Rendimento 0.65 + Fator vazao + painel compacto | Bombas iguais davam mesmo consumo |
