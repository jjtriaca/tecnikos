---
name: project-solar-regras-configuraveis
description: Regras de dimensionamento solar configuráveis por modelo (em vez de hardcoded). Botão "Cadastrar regras" no Diagrama do Simulador, vinculação 1 regra ↔ 1 modelo via Product.model.
metadata:
  type: project
---

# Regras Solares Configuráveis — proposta consolidada

**Sessão 213** (27/05/2026) — substitui constantes hardcoded `SOLAR_BATERIA_MIN_COLETORES` etc por sistema configurável por tenant + por modelo.

## Motivação

Constantes hardcoded em `backend/src/pool-budget/solar-constants.ts`:
- `SOLAR_BATERIA_MIN_COLETORES = 5` (origem: planilha Andreia Santana / Solis, não confirmada como regra oficial)
- `SOLAR_BATERIA_MAX_COLETORES = 7` (confirmada Solis)
- `SOLAR_BATERIA_MAX_M2 = 30` (confirmada Solis)
- `SOLAR_BATERIAS_MAX_SERIE = 3` (confirmada Solis)
- `SOLAR_VAZAO_FATOR = 0.252` (Solis/Sodramar)

Cliente Tecnikos pode usar coletor de outro fabricante (KS, Sodramar, TS Solar) com regras diferentes. Hoje precisa mudar código.

## Conceito

**Regras por MODELO**, não por marca nem por produto individual:
- Uma linha técnica (ex: "Trópicos") com vários tamanhos segue a mesma regra
- Cadastra 1 regra → vale pros N produtos do mesmo modelo
- Vinculação **1:1** — uma regra aplica a UM modelo (tipo + model)

## Storage

```
Company.systemConfig.pool.solarRules = [
  {
    id: "uuid",
    name: "Trópicos",
    poolType: "Coletor Solar Piscina",
    model: "Trópicos",
    rules: {
      minColetoresPorBateria: 5,
      maxColetoresPorBateria: 7,
      maxAreaPorBateriaM2: 30,
      maxBateriasEmSerie: 3,
      vazaoProjetoLhPorM2: 252
    }
  }
]
```

## Hierarquia de resolução

```
resolveRulesForCollector(product, companyConfig):
  rule = solarRules.find(r =>
    r.poolType === product.poolType && r.model === product.model
  )
  return rule?.rules ?? SYSTEM_DEFAULTS
```

Sem nível intermediário. Ou tem regra cadastrada ou usa defaults do sistema.

## UI — Botão "Cadastrar regras" no Diagrama de Instalação

### Lista de regras
```
┌─ Regras Solares Cadastradas        [+ Nova]──┐
│  Trópicos · Coletor Solar Piscina · Trópicos│
│  5 produtos · MIN 5 / MAX 7 / 30m² / 3 série│
│  Vazão 252 L/h/m²                            │
│  [ Editar ] [ Excluir ]                      │
│                                              │
│  ⚠ 0 produtos sem regra (tipo X)            │
└──────────────────────────────────────────────┘
```

### Form
- **Nome** (texto livre, único por tenant)
- **Tipo de produto** (dropdown DINÂMICO via `GET /products/pool-types` — resolve renomeação)
- **Modelo** (dropdown DINÂMICO — `DISTINCT Product.model WHERE poolType=$tipo AND companyId=$tenant`)
- **MIN coletores por bateria** (int 1-10, default 5)
- **MAX coletores por bateria** (int 1-10, default 7)
- **MAX área por bateria** (int 10-50 m², default 30)
- **MAX baterias em série** (int 1-5, default 3)
- **Vazão de projeto** (int 150-400 L/h por m², default 252)

### Indicador no Simulador
Ao lado do coletor selecionado: badge `[regra: Trópicos]` ou `[sem regra — defaults]`. Click abre o modal.

## Validações

- Nome único por tenant
- Tupla `(poolType, model)` única (não pode 2 regras pro mesmo modelo)
- `MIN ≤ MAX`
- `maxArea ≥ 10`
- `maxBateriasEmSerie ≥ 1`
- `vazaoProjeto` entre 150-400

## Princípios

1. **Sem hardcode** — toda regra editável via UI
2. **Sem nomes de empresas** — UI fala "padrões do setor", não "Solis"/"Sodramar"
3. **Números inteiros** — vazão em L/h/m² (252), não fator decimal (0,252). Backend converte
4. **Tipos dinâmicos** — `pool-types` consultado em runtime, resolve renomeação
5. **Modelo via campo já existente** — `Product.model` (não cria entidade nova)

## Implementação

### Backend
- `solar-constants.ts` → defaults de fallback, sem citar fabricante
- `SolarRules` interface + DTO
- `solar-rules-resolver.ts` — função pura `resolveRulesForCollector`
- `solar.service.simulate(inputs)` aceita `inputs.rules` (override das constantes)
- `solar-budget.service` ganha CRUD: `listSolarRules`, `createSolarRule`, `updateSolarRule`, `deleteSolarRule`, `getRuleCoverage`
- `pool-budget.controller`: endpoints `GET/POST/PUT/DELETE /pool-budgets/solar-rules*`

### Frontend
- `SolarRulesModal.tsx` (componente novo) — lista + form
- `HeatingSimulatorModal.tsx` — botão no header do Diagrama, indicador no coletor
- Validações em tempo real
- Dropdown dinâmico de tipos e modelos

## Migração

Zero. Campo novo em `systemConfig.pool.solarRules` (array vazio se ausente). Sistemas existentes continuam usando defaults até cadastrar primeira regra.

## Estado da implementação

A implementar em sessão 213 (logo após esta proposta). Versão alvo: v1.12.63+.
