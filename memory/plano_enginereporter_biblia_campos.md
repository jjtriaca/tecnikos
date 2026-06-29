---
name: plano-enginereporter-biblia-campos
description: PLANO (em projeto, sem pressa) — bíblia de campos escalável do EngineReporter: origem→template→campo, paths genéricos, célula etapa/linha, alertas. Ler antes de implementar.
metadata:
  type: project
---

# PLANO — Bíblia de Campos do EngineReporter (escalável a milhares)

**Status:** EM PROJETO (Juliano pediu pra planejar com calma, sem pressa — 29/06/2026, v1.14.77/78).
NÃO implementar ainda além da Fase 0. Ver [[engine_reporter]] e [[engine-reporter-field-catalog]].

## Requisitos (do Juliano)
- Alcançar **qualquer campo do sistema** (centenas/milhares), sem manter lista à mão.
- Painel "bíblia": cabeçalhos **minimizados**, expansíveis, com **busca**.
- Ao iniciar um relatório: escolher a **ORIGEM (cabeçalho)** de onde vêm os dados → e **também o TEMPLATE/modelo**,
  porque o template **vai filtrando** os campos (etapas/linhas) disponíveis.
- **Alertas** pra campos que não condizem com o layout/origem/template sendo montado.
- **Renomear o campo "Template"** do orçamento de obra pra algo intuitivo pro operador.
- Hoje há 2 templates de obra; pode chegar a 10/20/50.

## Fato-chave do domínio (obras/piscina)
- Ao criar orçamento de obra, o gestor escolhe um **template** (PoolBudgetTemplate). Após salvar, o sistema
  **cria automaticamente todas as ETAPAS daquele modelo** (1..N). Cada **ETAPA** (`poolSection`) tem **N LINHAS**
  (`PoolBudgetItem`). Cada linha tem: `slotName` (papel), `description`, `qty`, `unitPriceCents`, `totalCents`,
  `productId/serviceId`, **`cellRef`** (endereço estável L1, L2… já usado em fórmulas).
- Precisamos extrair "linha X da etapa Y": produto, descrição, valor, qtd.

## Modelo conceitual: 3 níveis de filtro
**ORIGEM (documento) → TEMPLATE (modelo, opcional, só obras) → CAMPO.**
O template estreita o universo de etapas/linhas endereçáveis → menos ruído no painel.

## 3 classes de campo
1. **Escalar** (token de path): `{budget.dimensions.area}`, `{client.name}`, `{company.cnpj}`. Resolver
   genérico por caminho + formatter por tipo.
2. **Lista → BLOCO** (N linhas, não cabe em caixa): PRODUCTS_BY_SECTION, INSTALLMENTS, etc. (já existem).
3. **Célula endereçada** (o pedido "linha X etapa Y"): `{etapa:CONSTRUCAO.total}`, `{linha:L5.descricao}`,
   `{linha:L5.produto}`, `{linha:L5.valor}`. Resolver acha o item por `cellRef`/`slotName`/`poolSection`.
   Picker etapa→linha no painel (lista as etapas/slots do template escolhido).

## Arquitetura recomendada
1. **Layout ligado a UMA origem (+ template opcional).** Add `sourceType` (e `templateId?` p/ obras) no layout.
   Migração: default `POOL_BUDGET`. Wizard ao criar relatório: origem → (se obras) template → painel já nasce filtrado.
2. **Registro de metadados = fonte única, auto-semeado.** `FieldMeta { path, label, group, origin, templateScope?,
   kind: scalar|list|cell, type, format, unit, decimals, enumLabels }`. Auto-semear o grosso via **Prisma DMMF**
   (scalars + relações curadas); camada de **curadoria** (labels PT, esconder sensível, unidades, grupos). Alimenta
   UI **e** resolver (não divergem). **Segurança:** blacklist (senha/tokens/ids internos/cross-tenant); gerar no
   **backend** (endpoint/JSON), não enviar Prisma pro front.
3. **Tokens por path + resolver genérico + ALIAS.** Path-walk + formatter por tipo. Alias dos tokens flat antigos
   (`{poolArea}`→`{budget.dimensions.area}`) pra **não quebrar** layouts salvos. (Por isso os tokens flat de hoje
   são seguros — viram alias depois.)
4. **Providers de data-context por origem.** `getReportContext(sourceType, docId)` com os includes certos. Hoje só
   PoolBudget (buildReportData); generalizar p/ Quote/OS/Financeiro (as outras origens viram "live").
5. **Picker de etapa/linha** (classe 3) quando há template.
6. **UI bíblia:** árvore escopada à origem/template; grupos minimizados; busca com sinônimos; virtualização (1000s);
   favoritos/recentes; chips de tipo (texto/moeda/data/lista/bloco/célula).
7. **Alertas/validação:** (a) origem/template incompatível, (b) campo-lista numa caixa de texto (deveria ser bloco),
   (c) célula etapa/linha inexistente no template, (d) token vazio pro doc-exemplo. Painel lateral com severidade + "ir até".

## Fases (rollout incremental — nada quebra graças a sourceType default + alias)
- **Fase 0 (FEITO, deploy v1.14.78):** formatação 2 casas (`dim()`: 7→7,00) + expor medidas de obra no catálogo
  (maxDepth, comprimento/largura total, perímetros, áreas parede/fundo, radier, escavação). MinDepth ficou de fora.
- **Fase 1:** `sourceType` no layout + wizard origem(+template); escopar painel; **renomear "Template"**.
- **Fase 2:** FieldMeta + resolver por path + alias (migrar PoolBudget).
- **Fase 3:** auto-semear DMMF + curadoria; providers das outras origens.
- **Fase 4:** célula endereçada etapa/linha (picker + resolver).
- **Fase 5:** alertas/validação.

## Decisões de negócio pendentes (pro Juliano)
1. Novo nome de "Template" (sugestões: "Modelo de orçamento", "Modelo da obra", "Tipo de projeto").
2. "Menor profundidade" — como derivar (ficou pendente; só maxDepth foi exposto).
3. Endereçar linha por `cellRef` (L1,L2 estável) ou por `slotName` (papel)?
4. Ordem das próximas origens depois de Piscina: Serviços / OS / Financeiro?
