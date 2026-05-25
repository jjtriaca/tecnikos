# Bug critico — Linhas em etapa custom rejeitadas pelo enum (v1.12.19)

## Sintoma (relatado em 25/05/2026)
Operador no SLS criou no orcamento de piscina uma etapa custom "AQUECEDOR SOLAR PISCINA"
(via "+ Nova etapa custom"). Ao clicar "+ Linha" e tentar adicionar uma linha, o modal
mostrava "Catalogo vazio" + varios campos desnecessarios (Secao, Unidade, Qty, Preco).
Mesmo preenchendo manualmente, **nenhuma linha conseguia ser salva**.

Operador nao percebia o erro 400 — modal fechava com toast generico e ele assumia
"vazio porque acabei de criar".

## Causa raiz
3 fatores combinados:

1. **`PoolBudgetItem.poolSection` é enum fixo no Prisma** com 12 valores:
   `CONSTRUCAO, FILTRO, CASCATA, SPA, AQUECIMENTO, ILUMINACAO, CASA_MAQUINAS,
   DISPOSITIVOS, ACIONAMENTOS, BORDA_CALCADA, EXECUCAO, OUTROS`

2. **DTO `CreateBudgetItemDto` validava com `@IsEnum(PoolSection)`** — qualquer string
   fora dos 12 valores eh 400 Bad Request pelo `ValidationPipe`.

3. **Frontend cria etapa custom com chave `CUSTOM_<slug>_<rand>`** (ex: `CUSTOM_AQUECEDOR_SOLAR_PISCINA_X3K2`)
   e o modal `AddItemModal` enviava essa chave direto como `poolSection`.

Resultado: `POST /pool-budgets/:id/items` com `poolSection='CUSTOM_*'` -> 400 silencioso.

A etapa em SI funcionava (salva em `environmentParams.customSections.labels`,
nao no enum). So as LINHAS dentro dela falhavam.

## Como detectar bugs similares no futuro
Sempre que um enum Prisma representa uma "categoria" que o operador pode customizar:

- Enum + UI que aceita valores custom = bug latente.
- Cheque: ha lugar no codigo onde o operador define a propria "tag/categoria"
  mas o backend valida com `@IsEnum`?
- Solucao padrao: campo paralelo `String?` que sobrescreve o enum quando nao-null.
  Nao mudar enum->String porque em multi-tenant schema-per-tenant o
  `TenantMigratorService` nao propaga `ALTER COLUMN TYPE` — so `ADD COLUMN` e
  `ADD/CREATE TYPE` (ver `tenant-migrator-not-null-gotcha.md`).

## Fix aplicado (v1.12.19)

### Schema
```prisma
model PoolBudgetItem {
  // ...
  poolSection PoolSection
  customSectionKey String?  // NOVO: quando preenchido, etapa eh custom
  // ...
  @@index([budgetId, customSectionKey, sortOrder])
}
```

Migration: `ALTER TABLE "PoolBudgetItem" ADD COLUMN IF NOT EXISTS "customSectionKey" TEXT;`
(nullable, seguro pra tabela populada — `TenantMigratorService` sincroniza nos tenants).

### DTO
- `CreateBudgetItemDto`: adicionado `customSectionKey?: string` opcional.
- `UpdateBudgetItemDto`: adicionado `poolSection?: PoolSection` (era stripado antes!) e
  `customSectionKey?: string | null` (com `@ValidateIf` pra aceitar null). O fix do
  `UpdateBudgetItemDto.poolSection` eh **bonus** — destravra a movimentacao de itens
  entre etapas via UI, que estava silenciosamente quebrada.

### Service
- `addItem`: salva `customSectionKey: dto.customSectionKey || null` no create.
- `updateItem`: aceita ambos campos no update spread.

### Frontend
- Type `BudgetItem` ganhou `customSectionKey?: string | null`.
- Novo helper `effectiveSection(it) = customSectionKey ?? poolSection`.
- `itemsBySection`, `moveItem`, `handleDeleteSection` usam `effectiveSection`.
- Funcao `addItem` detecta `poolSection.startsWith('CUSTOM_')` e separa em
  `{ poolSection: 'OUTROS', customSectionKey: 'CUSTOM_*' }` antes de POST.
- `handleDeleteSection` ao mover itens pra OUTROS limpa `customSectionKey: null`.

### Modal `AddItemModal`
Reescrito do zero. Antes: 200 linhas com toggle catalogo, busca, 6 campos.
Agora: 70 linhas com **2 campos** — Nome + Etapa (dropdown).
- Preco/qty/unidade vem do auto-link backend (ou 0/1/UN como default).
- Dropdown lista TODAS as etapas (12 padrao + custom criadas - hidden).
- Botao "+ Nova etapa" abre modal de etapa custom e **reabre** o modal de linha
  apos criar etapa, ja apontando pra ela (fluxo natural).

### Orcamento vazio
Card vazio agora mostra 3 botoes: + Adicionar linha, + Nova etapa, Carregar template Linear.
Antes era so o template + texto orientando a "usar botoes abaixo" que nao apareciam
(bug do early-return no IIFE quando `presentSections.length === 0`).

## Limitacao conhecida
Backend agrupa siblings de formula por `poolSection` direto (linhas 257, 301, 947, 964,
997, 1014, 1287, 1327 em `pool-budget.service.ts`). Se houver multiplas etapas custom
todas com `poolSection=OUTROS`, vars de sibling (siblingTuboEntradaMm, siblingVazaoM3h)
podem misturar entre elas.

Mitigacao: itens em etapa custom raramente terao formula (o modal simplificado nem
permite definir formula). Se virar problema, refatorar `buildSiblingVars` pra usar
`(customSectionKey ?? poolSection)` como chave de agrupamento.

## Checklist anti-regressao
Antes de adicionar `@IsEnum(X)` em DTO sobre campo que representa categoria:
1. Existe UI onde o usuario define a propria "categoria"?
2. Existe rota onde valores fora do enum podem chegar?
3. Se sim: usar `@IsString()` + regex, OU campo paralelo opcional `String?`.
