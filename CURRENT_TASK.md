# TAREFA ATUAL

## Versao atual em prod: v1.12.10 — Solar v5.6 (header redesign + AutoSelectModal integrado)

Ultima release entregou: Dimensoes da piscina em 5 linhas com modo Auto/Manual, Configuracao do aquecimento com Orientacao/Inclinacao/Cidade/Temp inicial-final, comportamento Auto/Manual (campos amber readonly vs verde editavel), banner azul marinho (bg-blue-900), botao "Pre-visualizar PDF" via clone+Portal, icone ✨ ao lado do Coletor e da Bomba, AutoSelectModal real integrado no Coletor (exportado de quotes/pool/[id]/page.tsx).

## Pendentes (nao bloqueiam release — Solar v5.6+)

- ⏳ Passar `catalog` real (lista de produtos do tenant) pro AutoSelectModal via props do SolarTab. Hoje passa `[]` — em prod "Nenhum candidato" aparece ate implementar essa propagacao.
- ⏳ Persistir `rule` salva (callback `onSave`) em `PoolBudget.environmentParams.solarColetorAutoSelectRule` via PATCH `/pool-budgets/:id`.
- ⏳ Mesmo tratamento ✨ + AutoSelectModal pra Bomba Recomendada.
- ⏳ Persistir overrides do modo MANUAL em `environmentParams`: `tipoConstrucao`, `tipoPiscinaSel`, `modoDimensao`, `modoConfigAquec`, `lenOverride`, `widOverride`, `profMin/MaxOverride`, `area/volumeOverride`. Hoje sao state local UI-only (perdem ao recarregar).
- ⏳ Quando `modoDimensao=MANUAL`, motor usar os overrides em vez de `budget.poolDimensions` no calculo.
- ⏳ Motor aplicar inclinacao otima ≈ latitude (hoje so persiste, nao usa no calculo — v5.1 aplicou orientacao+inclinacao basico).
