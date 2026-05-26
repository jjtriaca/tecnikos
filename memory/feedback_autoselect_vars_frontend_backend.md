# Feedback — Auto-select tem motor DUPLICADO frontend + backend

**Incidente v1.12.40 → v1.12.42 (26/05/2026):** levou 3 releases pra arrumar "Nenhum candidato passa nos filtros + criterio" no AutoSelectModal da Bomba do Coletor Solar. Cada release arrumou um lado diferente, mas ate o ultimo o usuario ainda via o bug.

## A arquitetura tem AVALIACAO DUPLICADA

1. **Backend** (`backend/src/pool-budget/auto-select.helper.ts`) — motor de verdade, decide qual produto vincular quando o operador clica "Aplicar regra". Le do banco via `prisma.product.findMany` direto (TODOS os Products do tenant), interpola `pumpCurve`, etc.

2. **Frontend** (`frontend/src/app/(dashboard)/quotes/pool/[id]/page.tsx`) — preview interativo:
   - **AutoSelectModal** (`dimVars`, ~linha 3247): mostra o RESULTADO DA AUTO-SELECAO em tempo real ("Nenhum candidato passa nos filtros + criterio" / "X candidatos passam"). Avalia contra a prop `catalog` (PoolCatalogConfig + extras de v1.12.46).
   - **CatalogPickModal** (`ruleVars`, ~linha 4002): aplica filtro "Apenas que passam no criterio" na lista do catalogo

Os DOIS lados precisam ter as MESMAS variaveis populadas E a MESMA fonte de candidatos. Senao o backend aceita mas o preview sempre rejeita → usuario nao sabe que pode aplicar.

## Fonte de candidatos: catalog do preview ≠ Products do backend

Outro vetor de dessincronizacao independente das variaveis:
- **Backend** usa `prisma.product.findMany({ companyId, deletedAt: null, ...filtros })` → TODOS os Products do tenant.
- **Frontend preview** usa o array `catalog: CatalogConfig[]` que carrega de `/pool-catalog-config` → SO os Products que o tenant cadastrou no Catalogo do Simulador de Piscina (subset).

Resultado: bombas/produtos cadastrados em `Product` mas nao incluidos em `PoolCatalogConfig` aparecem na auto-selecao real mas NAO no preview. Sintoma: "Nenhum candidato passa" no modal, mas apos clicar "Aplicar regra" o dropdown da pagina mostra candidatos.

**Fix v1.12.46:** novo endpoint `GET /products/for-pool-simulator` (em `ProductController`) retorna Products com `poolType` definido. O frontend mescla esses Products no `catalog` como entradas "virtuais" (`id: 'virtual-<productId>'`, `poolSection: 'OUTROS'`) antes de passar pro AutoSelectModal. Resultado: preview e backend olham pra a mesma fonte.

## Sintoma: TODOS os candidatos sao rejeitados

`evalCondition` no frontend substitui apenas variaveis presentes em `vars`. Se a regra usa uma variavel ausente:
- A variavel fica como texto literal apos a substituicao
- O guard `if (/[a-zA-Z_]/.test(stripped)) return false` detecta letra residual
- Funcao retorna `false` pra TODO candidato
- Resultado: "Nenhum candidato passa"

## Checklist ao adicionar variavel nova ao motor de auto-select

Quando criar variavel nova em `formula-eval.ts` (backend) — ex: `vazaoSolarM3h`, `alturaTelhadoMca`, `calorNecessarioKcalH`:

1. **Backend**: adicionar em `extractEnvVars` / `extractSolarVars` / `extractHeatingVars` / etc. **E** em `ALLOWED_VARS` (lista no topo do `formula-eval.ts`).
2. **Frontend AutoSelectModal** (`dimVars` em quotes/pool/[id]/page.tsx ~3247): adicionar leitura da mesma fonte (`environmentParams.X`, `solarReport.X`, etc).
3. **Frontend CatalogPickModal** (`ruleVars` em quotes/pool/[id]/page.tsx ~4002): adicionar idem.
4. **Frontend FORMULA_VARS** (~linha 2070-2090 do mesmo arquivo): garantir que a chave esta na lista de tokens reconhecidos.

Se esquecer qualquer um dos 4, vai aparecer um bug. Os mais comuns:
- Esquecer frontend → preview sempre mostra "Nenhum candidato passa" mesmo com regra OK
- Esquecer `ALLOWED_VARS` ou `FORMULA_VARS` → variavel e tratada como nome desconhecido, vira 0

## Releases

- **v1.12.40**: backend `extractSolarVars` populou `vazaoSolarM3h` (faltava)
- **v1.12.41**: backend `auto-select.helper` passou a interpolar `pumpCurve` (faltava)
- **v1.12.42**: frontend `dimVars` populou `alturaTelhadoMca` (faltava — bug visivel intermediario)
- **v1.12.43**: backend novo endpoint `solar-bomba-candidates` + dropdown na pagina substituindo a string fixa de `getBombaRecomendadaSolar`
- **v1.12.46/47**: backend novo endpoint `/products/for-pool-simulator` + frontend mescla Products do tenant no `catalog` do AutoSelectModal — resolve dessincronizacao da FONTE de candidatos preview vs backend (alem das vars)

## Regra de ouro

Apos adicionar variavel nova ao motor: **abrir o AutoSelectModal e olhar a contagem de candidatos**. Se mudou de "Nenhum candidato" pra "X candidatos" (ou vice-versa, esperado), o frontend esta sincronizado. Se nao mudou nada, falta sincronizar `dimVars`/`ruleVars`.
