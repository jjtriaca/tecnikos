---
name: plano_aba_trocador_calor
description: Plano de implementacao da aba Trocador de Calor no Simulador, replicando estrutura da aba Solar. Mapeia campos compartilhados, especificos, removidos. Guia pra sessao 215.
metadata:
  type: project
---

# Plano: Aba Trocador de Calor

**Inicio sessao 215.**

## Objetivo

Adicionar nova aba **"Trocador"** ao `HeatingSimulatorModal.tsx`, ao lado de **Solar** e **Bomba de Calor**, dedicada ao **trocador de calor** (heat exchanger) usado pra aquecer piscina com fonte externa (caldeira a gas, queimador a oleo, retorno de bomba de calor central, etc).

## O que eh um Trocador de Calor pra piscina?

Equipamento que transfere calor de um fluido quente (PRIMARIO — gas combustivel, oleo, agua quente) pra agua da piscina (SECUNDARIO). Tipicamente:
- Tubo em tubo (concentrico) — entrada/saida em ambos os lados
- Casco e tubo (industrial) — feixe de tubos dentro de casco
- Placas (compacto, alta eficiencia)

Materiais: **inox 316** (resistente a cloro) ou **titanio** (resistente a agua salina).

Diferenca da bomba de calor: o trocador NAO gera calor, apenas transfere. A fonte primaria pode ser qualquer coisa (caldeira, calefacao predial, energia solar termica).

## Estrutura visual (replicar Solar)

```
┌─────────────────────────────────────────────────────────┐
│ Aba Trocador                                           │
├─────────────────────────────────────────────────────────┤
│ [Dimensoes Piscina]   [Configuracao Aquecimento]       │
│ (compartilhado)       (compartilhado)                  │
├─────────────────────────────────────────────────────────┤
│ DIMENSIONAMENTO                                         │
│ ┌─KPIs─┐  ┌─Trocador selecionado──────────────────────┐ │
│ │Area  │  │ Modelo · capacidade kcal/h · material     │ │
│ │Vol   │  │ vazao primaria + secundaria + pressao max │ │
│ │Carga │  │ Eficiencia troca (%)                      │ │
│ │termi │  └──────────────────────────────────────────┘ │
│ │ca    │  ┌─Aumento eficiencia (qtd trocadores)──────┐ │
│ │      │  │ [+] [+0] [-] (em paralelo, mais area)    │ │
│ │      │  └──────────────────────────────────────────┘ │
│ │      │  ┌─Tubulacao perda carga─────────────────────┐ │
│ │      │  │ (compartilhado — perda incluiu trocador)  │ │
│ │      │  └──────────────────────────────────────────┘ │
│ │      │  ┌─Bomba recomendada (secundario)────────────┐ │
│ │      │  │ (compartilhado — vazao secundario alvo)   │ │
│ │      │  └──────────────────────────────────────────┘ │
│ └──────┘                                              │ │
├─────────────────────────────────────────────────────────┤
│ SIMULACAO TERMICA MENSAL (gráfico + tabela)            │
│ (compartilhado — mesmo motor thermal-demand)           │
├─────────────────────────────────────────────────────────┤
│ Observacoes + NBR (footer compartilhado)                │
└─────────────────────────────────────────────────────────┘
```

## Mapeamento detalhado de campos

### Campos a REMOVER (especificos solar, sem sentido no trocador)

| Campo | Onde | Por que nao se aplica |
|---|---|---|
| Coletor selecionado | Card direito | Nao tem coletor — fonte primaria eh externa |
| qtdColetores | KPIs + stepper | Nao tem coletor |
| coletoresPorBateria | KPIs + diagrama | Nao tem coletor |
| numBaterias, batPorRamo, numRamosParalelos | KPIs + diagrama | Nao tem coletor |
| Diagrama da instalacao (baterias) | Card esquerdo | Nao tem coletor — trocador eh 1 unidade central |
| Orientacao + inclinacao telhado | Configuracao | Trocador fica no chao (casa de maquinas) |
| Indicator HSE / radSol | Card sol | Nao precisa de sol — fonte eh combustivel |
| Cobertura piscina × coletores | KPIs | Nao tem coletor |
| Fator instalacao | Calculo + debug | Nao tem coletor |
| Producao por m² (kwhPorM2) | Specs coletor | Nao tem coletor |
| Coletores extras (slider +X%) | Card direito | Equivalente eh "+1 trocador em paralelo" |
| Botao ✨ regras solar | Diagrama | Nao tem coletor |

### Campos NOVOS (especificos do Trocador)

| Campo | Tipo | Default |
|---|---|---|
| **Modelo trocador** | dropdown | Lista catalogo (filtro por tipo "Trocador de Calor") |
| **Capacidade nominal** | kcal/h | Do produto cadastrado |
| **Material** | inox / titanio | Do produto cadastrado |
| **Eficiencia de troca** | % (0..100) | 85% default |
| **Fonte primaria** | enum (CALDEIRA_GAS / CALDEIRA_OLEO / BOMBA_CALOR_RETORNO / OUTRO) | CALDEIRA_GAS |
| **Vazao primaria** | m³/h ou L/min | Cadastrado no produto |
| **Vazao secundaria (piscina)** | m³/h | Cadastrado no produto |
| **Pressao maxima primaria** | mca | Cadastrado |
| **ΔT primario** | °C (entrada-saida lado quente) | 20°C default |
| **Temp combustivel** | °C (entrada lado quente) | 90°C default (caldeira gas) |
| **Qtd trocadores em paralelo** | int 1-N | 1 default (analogo a "+coletores extras") |

### Campos COMPARTILHADOS (manter igual)

| Campo | Onde | Comportamento |
|---|---|---|
| Dimensoes piscina (area, volume, prof) | Top | Igual |
| Configuracao aquecimento (capa, vento, temp inicial, alvo) | Top | Igual |
| Cidade + UF | Top | Igual (afeta T_amb, nao radiacao) |
| Tipo piscina + construcao | Top | Igual |
| Tubulacao perda de carga | Card direito | Igual — perda interna do trocador entra no calculo (similar a perda das baterias do solar) |
| Bomba recomendada (secundaria) | Card direito | Igual logica — vazao alvo agora = `vazaoSecundaria` do trocador |
| Simulacao termica mensal (grafico + tabela) | Bottom | Mesmo motor thermal-demand. Mas oferta = capacidade trocador × horas ativas (NAO HSE solar) |
| Observacoes + NBR | Footer | Igual |
| Print PDF | Botao Imprimir | Mesma estrutura, troca campos solar por trocador |
| Tarifa kWh (icone 💡) | Card bomba | Igual |
| Consumo eletrico (linha + R$/mes) | Card bomba | Igual mas: horas/dia = horas de uso configuradas (nao HSE) |

## Cuidados especiais

### 1. Calculo de horas de operacao

**Solar:** horas/dia = HSE × fator × 1.3 × fatorVazao
- HSE vem do clima
- Bomba liga quando ha sol

**Trocador:** horas/dia = horas_uso_configuradas × fator × fatorVazao
- Operador define horas de uso (ex: 4h/dia)
- Bomba liga quando trocador eh ativado
- Sem floor 0.85 (controlador eh diferente — eh termostatico, liga/desliga pela temp)

Novo campo: **"Horas de uso/dia"** (input numerico, default 4h).

### 2. Calculo de oferta termica

**Solar:** qSolar = qtd × area × HSE × eficiencia × fatorInstalacao
**Trocador:** qTrocador = qtdTrocadores × capacidade_kcalH × eficiencia / 1000 (kWh/h) × horas_uso

### 3. Dimensionamento da bomba secundaria

Trocador precisa de vazao secundaria especifica (cadastrada no produto). A bomba do secundario tem que atender:
- Vazao >= vazao_secundaria_trocador × qtdTrocadores
- Pressao >= pressao_tubulacao + perda_interna_trocador + desnivel

Reutilizar `auto-select.helper` mas com `vazaoAlvo = vazaoSecundariaTrocador` em vez de `vazaoSolarM3h`.

### 4. Perda de carga interna do trocador

Cada modelo de trocador tem perda interna cadastrada (ex: 1-3 mca a vazao nominal). Somar em `alturaManometricaTotal` igual fizemos pras baterias do solar.

Campo novo em Product: `perdaCargaTrocadorMca` (default 2.0).

### 5. Print PDF

Adaptar [HeatingSimulatorModal.tsx#solar-pdf-area] pra ter variante trocador:
- Header: "Aquecimento por Trocador de Calor"
- Imagem do trocador (do produto)
- KPIs adaptados
- Esconder diagrama de baterias
- Mostrar diagrama do trocador (entrada/saida primario + secundario + bomba)

## Arquitetura sugerida

### Backend

Novo service: [trocador-budget.service.ts](../backend/src/pool-budget/trocador-budget.service.ts) ou estender `solar-budget.service.ts` com metodos `computeAndSaveTrocadorReport`.

Ou MELHOR: criar um service generico `aquecimento-budget.service.ts` que aceita `tipo: 'SOLAR' | 'TROCADOR' | 'BOMBA_CALOR'` e despacha pra logica especifica.

DTOs:
- `TrocadorRecomputeDto` (analogo SolarRecomputeDto)
- Endpoints: `POST /pool-budgets/:id/trocador-report/recompute`, `GET /pool-budgets/:id/trocador-active-rule`, etc.

### Frontend

Replicar o pattern do SolarTab criando `TrocadorTab` (mesmo arquivo `HeatingSimulatorModal.tsx` ou separado).

Aba switcher (linha ~1268):
```tsx
<button onClick={() => setActiveTab("trocador")}>🔥 Trocador</button>
```

Componente `TrocadorTab` que aceita props equivalentes mas com inputs especificos.

### Modelo de dados

Salvar relatorio em `environmentParams.trocadorReport`:
```ts
{
  modeloTrocador: { productId, modelName, capacidadeKcalH, material, eficiencia },
  qtdTrocadores: 1,
  vazaoPrimariaM3h: ...,
  vazaoSecundariaM3h: ...,
  pressaoMaxMca: ...,
  fontePrimaria: 'CALDEIRA_GAS',
  tempPrimaria: 90,
  horasUsoDia: 4,
  ...
}
```

E `selectedBombaSecundariaId`, `bombaManuallySelected`, `solarPipe` reutilizado pra perda de carga.

## Reutilizacao maxima

- **thermal-demand.service** — usado pra calcular qPerdas (mesmo motor)
- **pipe-head-loss.service** — usado pra perda de carga (mesmo)
- **bomba auto-select** — usado pra selecionar bomba secundaria (mesmo)
- **tarifa kWh** — popover 💡 igual
- **print clone + CSS @media print** — mesma estrutura

## Estimativa de esforço

- **Backend:** 3-4h (DTOs + service + endpoints + integracao com thermal-demand)
- **Frontend:** 6-8h (TrocadorTab + UI completa + integracao)
- **Print PDF:** 2-3h (ajuste do template)
- **Testes + calibracao:** 2-3h
- **Total estimado:** ~15h

## Etapas sugeridas (incremental)

1. Criar `TrocadorTab` minimo — so dimensoes + config (compartilhado)
2. Adicionar dropdown de trocador + dados do produto
3. Adicionar campo qtd trocadores + horas uso
4. Integrar com thermal-demand (qPerdas)
5. Calcular oferta = capacidade × qtd × horas × eficiencia
6. Bomba secundaria (reutilizar auto-select)
7. Tubulacao + perda interna do trocador
8. Simulacao termica mensal
9. Print PDF
10. Calibracao com casos reais

## Referencias

- [memory/sistema_impressao_pdf_simulador.md](sistema_impressao_pdf_simulador.md) — sistema de print
- [memory/modelo_consumo_bomba_solar.md](modelo_consumo_bomba_solar.md) — modelo de consumo (parte vai reutilizar)
- [memory/thermal_demand_service.md](thermal_demand_service.md) — motor unico
- [memory/project_solar_regras_configuraveis.md](project_solar_regras_configuraveis.md) — pattern de regras configuraveis (replicar pra trocador)
- [frontend/src/components/pool/HeatingSimulatorModal.tsx](../frontend/src/components/pool/HeatingSimulatorModal.tsx) — componente atual
