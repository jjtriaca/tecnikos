---
name: bug-editor-env-replace-drops-keys
description: Bug v1.13.08 — editor de orcamento de piscina (PUT /pool-budgets/:id) sobrescrevia environmentParams do zero e dropava customSections (nomes de etapas custom renomeadas). Fix v1.13.09: update() faz MERGE do env. Padrao de risco recorrente.
metadata:
  type: project
  date: 2026-06-02
---

# Bug: editor remontando JSON blob do zero dropa chaves nao-gerenciadas (v1.13.08 -> v1.13.09)

## Sintoma
Etapa custom renomeada (ex: "Borda Infinita") voltava a mostrar a CHAVE crua
`CUSTOM_BORDA_INFINITA_2G4W`. O usuario renomeava, salvava, e o nome sumia depois de editar
qualquer coisa na tela "Editar dados".

## Causa raiz
O nome das etapas custom fica em `PoolBudget.environmentParams.customSections.labels[KEY]`
(salvo por `updateSections`, endpoint `POST :id/sections`, que faz MERGE). MAS a tela do **editor**
(`quotes/pool/new?edit=`) monta um `environmentParams` NOVO so com os campos do formulario
(uf, temp, capa, vento, tipoPiscina, ...) e manda no `PUT /pool-budgets/:id`. O `update()` do
backend gravava `environmentParams: dto.environmentParams` (**REPLACE**) -> dropava `customSections`
e qualquer outra chave que o editor nao conhece. (O simulador re-adicionava `solarReport`/`heatingOverride`
porque eles tambem fazem merge; por isso esses sobreviviam e o customSections nao.)

Confirmado em prod com `SELECT jsonb_object_keys("environmentParams")` — tinha solarReport/solarOverride
mas NAO tinha customSections.

## Fix (v1.13.09)
`pool-budget.service.ts` `update()`: environmentParams passa a fazer **MERGE** com o existente:
`{ ...(before.environmentParams ?? {}), ...dto.environmentParams }`. Preserva customSections +
heatingOverride/solarReport/solarOverride. `before` ja vinha do findFirst no inicio do update().

## Regra geral (padrao de risco)
**Qualquer código que reconstrói um blob JSON (environmentParams, poolDimensions, systemConfig, etc.)
a partir de um formulário PARCIAL e grava com REPLACE vai dropar silenciosamente as chaves que o
formulário não conhece.** Sintoma: dado "some sozinho" depois de salvar em outra tela.
- Preferir MERGE no backend (`{...existing, ...incoming}`) quando o caller gerencia so um subconjunto.
- Ou o frontend carregar o blob inteiro e dar spread antes dos campos do form.
- Suspeitar disso sempre que: "editei em X, salvei em Y, e o que fiz em X sumiu".

Dados ja perdidos (nomes de etapa) NAO sao recuperaveis (a menos que estejam num template salvo) —
o usuario re-renomeia uma vez e ai sim persiste.
