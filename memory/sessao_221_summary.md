# Sessão 221 (18/06/2026) — v1.13.70 → v1.13.76 (Módulo Piscina: selo de modelo, UX do cadastro, fixes)

7 deploys, todos no Módulo Piscina (orçamento de obra). Frente: usabilidade do cadastro/edição de orçamento + correções de UX.

## v1.13.70 — Selo do Modelo/Layout no cabeçalho do orçamento
- Pedido: ver na página do orçamento qual "layout/modelo" está em uso.
- O sistema guarda 2 vínculos por orçamento: `templateId` (Modelo = botão "Salvar modelo") e `printLayoutId` (Layout de impressão/PDF). `findOne` (pool-budget.service ~L1548) já entregava ambos (`template`+`printLayout` {id,name}); o tipo `Budget` do front já tinha os campos.
- Fix FRONT-only ([quotes/pool/[id]/page.tsx]): selo `📋 Modelo: <nome>` (+ `🖨️ Layout` quando houver) no header (versão aberta + compacta), ao lado do código/cliente.
- Esclarecido: "Rascunho" = status (`PoolBudgetStatus`: RASCUNHO/ENVIADO/APROVADO/REJEITADO/CANCELADO/EXPIRADO), proposital. "Cadastrar" congela (`frozenAt`) mas mantém o status Rascunho até Aprovar.

## v1.13.71 — "Salvar modelo" APLICA o modelo ao orçamento
- Confusão: "Salvar modelo → Atualizar existente" EXPORTA o conteúdo do orçamento PRO modelo escolhido (sobrescreve o modelo); NÃO troca o modelo do orçamento. Por isso o selo seguia o antigo. (No teste, o Juliano sobrescreveu o modelo "Construção Manta Armada" com uma pré-moldada — decidiu não recuperar.)
- Fix: `saveAsTemplate` (backend) grava `budget.templateId = template.id` no orçamento de origem (SÓ o vínculo, NÃO re-aplica linhas). Front: `onSaved` do SaveAsTemplateModal faz `await load()` (selo atualiza na hora).
- Nota: trocar via "Editar dados → Template" também re-rotula (`update` grava templateId sem re-aplicar linhas).

## v1.13.72 — Fix ThrottlerException (429) ao reordenar linha
- Bug: mover linha ▲/▼ dava "Too Many Requests". Causa: `moveItem` (front) renumerava TODAS as linhas da etapa e disparava 1 `PUT /items/:id` por linha em PARALELO (`Promise.all`) → burst de 12-16 requests estourava o Throttler global (60 req/60s, `common/throttler.ts`).
- Fix (padrão `workflow.reorder`, REGRA #9): endpoint `PUT /pool-budgets/:id/items/reorder` (`ReorderItemsDto {orderedIds}`) + `reorderItems()` no service → atualiza sortOrder numa `$transaction` (1 request). NÃO recalcula (reordenar não muda valores; cellRef L1/L2 é estável). Front: `moveItem` faz 1 chamada em lote.

## v1.13.73 — Campo "Área da parede (m²)" (blocos) + 3 UX na tela de dimensões
- Campo MANUAL "Área da parede (m²)" (`poolDimensions.areaParedeM2`) → variável de fórmula `areaParede` (back: ALLOWED_VARS + extractDimensionVars; front: FORMULA_VARS + 3 montadores de vars + grupos + descrições = os ~6 lugares do incidente v1.12.41). Receita pronta "Blocos de parede (un)" = `ceil(areaParede / 0.0741)`. Decisão: campo MANUAL (sem sugestão).
- UX ([quotes/pool/new/page.tsx], 3 pedidos): (1) cards "Area/Volume total" saíram do MEIO → chips de resumo (Area/Volume/Perímetro) logo abaixo da tabela (`Calc` removido); (2) componente novo `NumInput` (controlado, state de string): apaga com backspace, digita decimais parciais (0.20), trava 2 casas, aceita vírgula → aplicado nos 13 inputs de medida (sections + bounding box + parede/radier/escavação).

## v1.13.74 — Template do orçamento: sem default automático + OBRIGATÓRIO
- Tirado o auto-select do `isDefault` no Template (na criação; printLayout segue auto). Label "Template *"; placeholder "Selecione um modelo..." (option disabled); validação no `handleSubmit` (criação E edição). Consequências (avisadas + OK): não dá mais criar "do zero" (sem modelo); editar orçamento antigo sem modelo pede escolher um (não-destrutivo, só vincula).

## v1.13.75 — Qty da fórmula arredondada a 2 casas (lixo de float)
- Bug: qty calculada vinha com lixo de ponto flutuante (85.59100000000001). Fix: `evaluateFormula` (backend [formula-eval.ts]) arredonda o retorno a 2 casas (`Math.round(r*100)/100`) — FONTE de todos os cálculos de qty (updateItem/addItem/recalculateTotals), cobre linhas existentes (no recalc) E novas. Front: helper `fmtQty` na exibição da qty das linhas (cobre valores ANTIGOS já salvos com lixo) + preview do FormulaModal `toFixed(4)`→`toFixed(2)`.

## v1.13.76 — Linha de SERVIÇO mostra "Sem Serviço" (era "Sem Produto")
- Linha `kind=SERVICE` sem item vinculado mostrava "Sem Produto". Fix (front, 7 pontos): (1) exibição traduz `kind==='SERVICE' && description==='Sem Produto'` → "Sem Serviço" (cobre linhas ANTIGAS já salvas); (2) onPick cenário A grava `description='Sem Serviço'` pra serviço; (3) botão do `CatalogPickModal` (já recebe `currentKind`) → "🚫 Sem Serviço" + onClick passa `__NONE__` (não vincula Product "Sem Produto" numa linha de serviço) + title/subtexto. Backend só tinha "Sem Produto" em comentário.

## Padrões/lições reforçados
- Módulo Piscina = deploy direto (sem preview). Sempre perguntar antes de deployar (feedback desta sessão respeitado — usuário autorizou cada deploy).
- Variável de fórmula nova precisa ir nos ~6 lugares front+back (incidente v1.12.41) — feito pra `areaParede`.
- `NumInput` (state de string local + sincroniza só quando não focado) resolve "input numérico type=number + value||0 preso no backspace" + trava de 2 casas decimais. Padrão reusável se o mesmo problema aparecer em outras telas/forms.
- Pré-deploy: `tsc --noEmit --incremental false` (evita false-pass do cache, lição v1.13.10) + `next build` completo em mudanças maiores de UI.
- Reorder/listas grandes: usar endpoint em LOTE (`$transaction`), nunca N requests paralelas (estoura o Throttler 60/60s). Padrão de referência: `workflow.reorder`.
