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
   - **Copiar token vs inserir (decisão Juliano 29/06):** clicar no **`+`** = INSERE a caixa de campo na folha
     (comportamento atual). Clicar no **endereço/`{token}`** = deixa o código **selecionável e copia pro clipboard**
     (NÃO insere), pra colar dentro de um bloco de texto. Hoje a `Row` inteira (ReportFieldLibrary.tsx) é um
     `<button>` que insere — separar: token = copiar/selecionar; `+` = inserir. Mostrar feedback "copiado".
7. **Alertas/validação:** (a) origem/template incompatível, (b) campo-lista numa caixa de texto (deveria ser bloco),
   (c) célula etapa/linha inexistente no template, (d) token vazio pro doc-exemplo. Painel lateral com severidade + "ir até".

## Fases (rollout incremental — nada quebra graças a sourceType default + alias)
**EXECUÇÃO:** Juliano pediu "tudo de uma vez" (29/06). TUDO DEPLOYADO em **v1.14.85** (Fases 0–5 + picker etapa/linha +
copiar-token + rename + path resolver + alertas). Houve incidente de deploy (sobrecarga) — ver [[incident-deploy-multiplo-sobrecarga]].
Pendências de limpeza/escopo abaixo seguem valendo (dedup do LineRefPicker na página central; providers das outras origens).

- **Fase 0 (FEITO, deploy v1.14.78):** formatação 2 casas (`dim()`: 7→7,00) + medidas de obra no catálogo. MinDepth fora.
- **Fase 1 — FEITA ponta a ponta (working tree, sem deploy):**
  - ✅ Renomear "Template" → "Modelo de obra".
  - ✅ Backend: `sourceType`+`templateId` no `PoolPrintLayout` (schema + migração `20260629120000_add_print_layout_source_type`
    + backfill POOL_BUDGET; TenantMigrator propaga). DTO `REPORT_SOURCE_TYPES` (IsIn) + persiste no create/update. Backend tsc verde.
  - ✅ Front criação: seletor de ORIGEM no modal "Novo layout" (`pool/print-layouts/page.tsx`) → posta `sourceType`.
  - ✅ Front editor: painel `ReportFieldLibrary` ganhou prop `sourceId` → escopa o catálogo à origem do layout
    (`SOURCE_CATALOG_ID[layout.sourceType]`). Frontend tsc verde.
  - ⏳ FALTA: picker de MODELO DE OBRA na criação (templateId) — fica junto da wiring do LineRefPicker (usa as linhas do modelo).
- **Fase 2 — parcial (working tree):** regex do resolver ampliada (`/\{[a-zA-Z][\w.:-]*\}/`) + fallback. Path
  genérico/alias completo FALTA (vem junto da Fase 3/DMMF).
- **Fase 4 — motor FEITO (working tree), PICKER a fazer:** célula endereçada etapa/linha. `resolveAddressedToken`
  em BudgetReport.tsx: `{linha:Lx.produto|descricao|qtd|valor|unitario|papel|etapa}` e `{etapa:SECTION.total|linhas|nome}`.
  `cellRef` carregado em buildReportData + ReportItem. Catálogo: subgrupo "Etapas e linhas (avançado)" (tokens de
  exemplo — fallback manual). **CORREÇÃO (Juliano 29/06):** a escolha da linha NÃO é copia-e-edita; tem que REUSAR o
  `LineRefPicker` (accordion etapa→linha, já existe em `quotes/pool/[id]/page.tsx:2732`, criado no AutoSelect — REGRA #9).
  - ✅ FEITO (working tree): `LineRefPicker` extraído pra `components/pool/LineRefPicker.tsx` (+ modo `refKind:'ALL'`).
    Editor: botão "🔗 Campo de etapa/linha…" no `ReportFieldLibrary` (prop `onPickLine`, só obras) → modal com seletor de
    MODELO + atributo + o LineRefPicker alimentado pelas LINHAS REAIS do modelo (`GET /pool-budget-templates/:id` →
    `itemsSnapshot` tem cellRef/poolSection/slotName/kind/qty) → insere `{linha:Lx.atributo}`. Criação do layout: select
    de modelo (templateId). Editor: troca o modelo no próprio picker (`api.put` templateId). Frontend tsc verde.
  - ⏳ DEDUP PENDENTE: a página `quotes/pool/[id]/page.tsx` ainda tem a CÓPIA LOCAL do LineRefPicker — migrar pra importar
    o compartilhado (edit grande na página central, fazer com cuidado + typecheck). Labels custom de etapa no picker do
    editor: passar `environmentParams` do template (defaults.customSections) — hoje mostra código cru p/ etapa custom.
- **UX copiar-token (FEITO, working tree):** ReportFieldLibrary — `+` insere, clique no `{código}` copia/seleciona.
- **Fase 3 — resolver por path FEITO (working tree); DMMF amplo DEFERIDO por segurança:**
  - ✅ Resolver genérico por PATH no BudgetReport.tsx: `buildFieldContext` (budget.*/client.*/company.*/budget.pool.*,
    valores JÁ formatados) + `resolveContextPath` (anda no path pontilhado) + ligado na cadeia. Aditivo, tokens flat
    seguem como alias. Frontend tsc verde.
  - **DECISÃO de segurança (Claude, conservadora):** NÃO auto-expor o banco inteiro via DMMF (risco: senha/token/id
    interno/cross-tenant). "Qualquer campo" = grafo do DOCUMENTO da origem (já é o que entra no relatório). Ampliar pra
    um modelo específico = só com blacklist explícita, sob demanda.
  - ⏳ FALTA: providers de data-context das outras origens (Serviços→OS→Financeiro) p/ tokens resolverem com dado real
    quando o layout for daquela origem; catálogo auto-listar os paths do contexto (opcional).
- **Fase 5 — FEITA (working tree):** `components/pool/report/reportValidate.ts` (`validateLayoutTokens`) varre todo o
  HTML do layout (FIXED/caixas/nós/cab/rodapé) e classifica tokens: linha inexistente no modelo (erro), campo de outra
  origem (aviso), campo desconhecido (aviso). Editor: `useMemo reportIssues` + painel fixo bottom-right "⚠ N avisos".
  Frontend tsc verde. (Falta opcional: alerta de "lista em caixa de texto" — bloco no lugar errado.)
- **Pendências de limpeza/escopo (não bloqueiam deploy):** (1) DEDUP do LineRefPicker na página `quotes/pool/[id]` (a
  cópia local segue lá — migrar com cuidado, é arquivo central sem preview); (2) providers de data-context das outras
  origens (Serviços/OS/Financeiro) p/ tokens resolverem com dado real; (3) labels de etapa custom no picker do editor.

## Picker de ÍCONES (FEITO, deploy v1.14.86 — pedido do Juliano)
Resolve o atrito #1 do dogfooding (Estilo 3 precisa de ícone). `components/pool/report/reportIcons.ts` = biblioteca
de ~23 ícones inline SVG (contorno 24x24, stroke=currentColor — seguro no PDF via printViaClone). Tipo de caixa novo
`ICON` (campo `box.icon`) renderizado no `BoxContent` (cor = `style.textColor` || branding.primaryColor; tamanho = caixa).
Editor: botão "Ícone" no Inserir → modal grid (`iconPicker`) → `addBox("ICON",{icon})`; rótulo/ícone na hierarquia;
controle **"Cor"** novo na aba Layout (`patchSelStyle({textColor})`, serve ícone E texto). Testado ao vivo: insere,
renderiza (navy), recolore. **Estilo 3 agora é montável** (ícone + valor {pool*} + rótulo por métrica).
**Atrito que ainda fica:** sem alinhar/distribuir/grade — a faixa de 6 métricas ainda é posicionada à mão (mm). Próxima
alavanca: ferramenta "distribuir/alinhar" OU um bloco "Características" data-driven (Estilo 3 como preset de 1 clique).

### Montagem MANUAL da página 3 (29/06, no navegador) — feita + novos atritos
Montei a faixa Estilo 3 na página "Itens" do layout SLS: 6 ícones (↔↕⊞↓💧📏) + 6 valores ({poolLength/Width/Area/Depth/
Volume/Perimeter}, formatados 2 casas) posicionados em mm. FUNCIONA, mas a montagem manual confirmou os atritos (e revelou
novos), reforçando que o caminho certo é o PRESET/distribuir:
- **Posição X de 3 dígitos no campo Layout não pega** (digita 104/134 → vira 100); contornei arrastando (left_click_drag).
- **Busca do painel é sensível a acento** ("perimetro" não acha "Perímetro"; "poolPerim" pelo token acha). Melhoria: normalizar acento na busca.
- **Edição de texto in-place não é drivável por automação cega** (clique não foca o contentEditable; Ctrl+A pega a página).
  Por isso os RÓTULOS (Comprimento/Área…) não entraram — fáceis pro Juliano (clica no valor, digita), inviáveis pro robô.
- Insert de campo cai em X21/Y21 sobre o conteúdo (já conhecido).
Conclusão reforçada: bloco "Características" data-driven (1 clique, já alinhado, com ícones+valor+rótulo) é a entrega certa.

## Decisões de negócio (29/06 — Juliano respondeu "pode fazer todas")
1. **Renomear "Template" → "Modelo de obra"** ✅ DECIDIDO (Juliano, 29/06).
2. **"Menor profundidade"** → default recomendado: menor profundidade entre TODAS as partes (determinístico).
   Refinar depois se precisar ignorar degraus. (Claude decide — pode fazer todas.)
3. **Endereçar linha** → `cellRef` (L1,L2 estável, já usado em fórmulas) como chave; `slotName` só como rótulo
   amigável no picker. (Claude decide.)
4. **Ordem das próximas origens** → Serviços (Quote) → OS → Financeiro. (Claude decide.)
