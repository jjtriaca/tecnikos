# TAREFA ATUAL

## Versao atual em prod: v1.12.21 — Linha tem tipo (Produto/Servico) + "Sem produto"/"Sem servico" placeholder

Sessao 211 (25/05/2026), 3 releases:

**v1.12.21** — Linha de orçamento ganha campo `kind` explicito (PRODUCT|SERVICE), removendo heuristica antiga que inferia tipo do productId/serviceId vinculado. Mudancas:
- **Schema**: `PoolBudgetItem.kind String @default("PRODUCT")`. Migration ADD COLUMN com backfill (SERVICE se serviceId not null).
- **Script SQL tenants**: `scripts/sql/v1.12.21-kind-backfill-tenants.sql` — TenantMigratorService propaga ADD COLUMN automaticamente (default NOT NULL), mas backfill SERVICE precisa script manual.
- **DTO**: `kind?: 'PRODUCT'|'SERVICE'` com `@IsIn`. Aceito tanto no create quanto update.
- **Modal**: toggle Produto/Servico (botoes grandes ao lado). Nome digitado agora vai pra `slotName` (coluna ITEM da tabela), nao mais pra `description`. `description` fica vazio — vira o placeholder "Sem produto"/"Sem servico" na tabela.
- **Tabela**: coluna DESCRICAO quando vazia mostra "Sem produto" ou "Sem servico" baseado em kind. Clicar abre picker.
- **Picker (🔍)**: filtra catalogo por kind. Toggle "So produtos"/"So servicos" no header (default ON, operador desativa pra ver tudo).
- **isServicoItem helper**: usa `item.kind === 'SERVICE'` direto. Heuristica unidade hora removida.
- **applyLinearTemplate**: define kind baseado em se o item do template vinculou a service (SERVICE) ou produto (PRODUCT).

## Sessao 211 anteriores: v1.12.19, v1.12.20

**v1.12.20** — usuario pediu refatoracao do v1.12.19. A abordagem do v1.12.19 (`customSectionKey` como bandagem + `poolSection=OUTROS` fallback) criava distincao tecnica entre etapas padrao e custom: siblings de formula misturavam entre etapas custom diferentes (todas com `poolSection=OUTROS`). Regra do usuario: **uma etapa criada nova nao tem distincao de uma que ja existe**.

Fix correto:
- **Schema**: `PoolBudgetItem.poolSection PoolSection` -> `String @default("CONSTRUCAO")`. Coluna `customSectionKey` REMOVIDA. Indice associado dropado.
- **Migration Prisma**: `ALTER COLUMN poolSection TYPE TEXT USING ... ::text` + `DROP COLUMN customSectionKey`. So no schema public — TenantMigratorService nao propaga ALTER COLUMN TYPE.
- **Script SQL standalone**: `scripts/sql/v1.12.20-poolsection-text-tenants.sql` itera schemas `tenant_*` e aplica a mesma mudanca. Rodado manualmente apos o deploy via SSH.
- **DTOs**: `@IsEnum(PoolSection)` -> `@IsString() @MinLength(1) @MaxLength(64) @Matches(/^[A-Z0-9_]+$/i)`. Aceita qualquer chave (enum padrao OU CUSTOM_*).
- **Service**: removido `customSectionKey` do create/update. Removido **auto-link silencioso por descricao** em 3 lugares (addItem PASSO inicial, updateItem, recalculateTotals PASSO -1). Linha sempre vem livre — operador vincula manualmente via ✨.
- **Frontend**: removido helper `effectiveSection`, type `customSectionKey`, transformacao CUSTOM_*->OUTROS+customSectionKey. Volta a usar `it.poolSection` direto. Itens em etapa custom enviam `poolSection: 'CUSTOM_*'` diretamente — backend aceita.
- Outros models (`PoolCatalogConfig`, `PoolProjectStage`, `PoolBudgetTemplate.itemsSnapshot`) continuam usando enum `PoolSection` (nao afetados pelo bug).

Continuam funcionando do v1.12.19:
- Modal `Adicionar item` super simples (Nome + Etapa).
- Orcamento vazio mostra 3 botoes (+ Adicionar linha, + Nova etapa, Carregar template Linear).
- "+ Nova etapa" no modal Adicionar item reabre o modal ja na etapa criada.

**v1.12.19** (substituido pelo v1.12.20) — primeira tentativa: campo `customSectionKey` como bandagem + `poolSection=OUTROS` fallback. Bagulho funcionava na criacao mas misturava siblings de formula entre etapas custom diferentes. Usuario corrigiu o approach. Mantido na historia git pra rastreabilidade.

## Sessao 210 (anterior): v1.12.16 → v1.12.18 — Financeiro

**v1.12.16** — bug do encargo de fatura de cartao quebrando conferencia retroativa (R$ 32,12 em marco e abril/2026 no SLS). Fix em `matchAsCardInvoice`: encargo sem cartao agora recebe `cashAccountId=bankAccountId` pra entrar no balance-compare. `unmatchLine` reverte corretamente. Correcao retroativa do FIN-00577 aplicada via SQL. Criado `ClosedMonthGuardService` que bloqueia qualquer mutacao financeira (match/unmatch/create/update/delete entry, transfer) em mes com conferencia ja batendo. Aplicado em ReconciliationService, FinanceService e TransferService. Ver `memory/bug-encargo-fatura-orfao.md`.

**v1.12.17** — filtro do modal de Conciliacao escondia 16 lancamentos no SLS (FIN-00373 com NFS-e nao aparecia). Causa: `{ notes: { not: { contains: '[REBALANCE_AJUSTE]' } } }` em Prisma+Postgres compila pra `NOT (notes LIKE ...)` que retorna NULL pra rows com `notes=NULL`, e WHERE NULL = FALSE → row excluida silenciosamente. Fix em `finance.service.ts:447` com OR explicito. FIN-00592 (duplicata criada pelo user durante o bug) soft-deletada + saldo TRANSITO ajustado. Ver `memory/bug-filtro-notes-null.md`.

**v1.12.18** — anti-regressao: criado `backend/src/common/util/prisma-null-safe.ts` com helpers `notContainsNullSafe / notEqualsNullSafe / notInNullSafe / notLikeNullSafe`. Aplicado no fix do v1.12.17 como exemplo vivo. Regra obrigatoria adicionada em CLAUDE.md (secao "Filtros Prisma `not:` em Campos Nullable") com tabela perigosos vs seguros. Auditoria do codebase confirmou: nenhum outro bug latente da mesma classe.

## Sessao 209 (anteriores): v1.12.11 → v1.12.15 — Simulador Solar maduro + cadastro de produto alinhado com Procel

Sessao 209 (21/05/2026) entregou 5 releases (v1.12.11 → v1.12.15). Simulador Solar: zoom proporcional auto + manual, catalog real do tenant no AutoSelectModal, cadastro estrito do coletor (description + missingSpecs + erro claro), ✨ Coletor + ✨ Bomba com AutoSelectModal real + persistencia da regra no tenant, vazaoSolarM3h em FORMULA_VARS + template "Bomba do Coletor Solar", aviso amarelo quando sem regra, etapas customizaveis no orcamento (renomear/adicionar/excluir), bug do scroll corrigido, eficiencia em %, alinhamento 100% Procel/Inmetro PBE (Area externa, Producao especifica, Eficiencia, Classificacao A-E, Pressao), imagem do produto (upload no cadastro + uso no header do Simulador), filtro hardcoded de tipoEquipamento substituido por regra do tenant (Company.systemConfig.pool.solarCollectorRule), gerenciador de tipos (poolType) com CRUD + campos obrigatorios por tipo + validacao em camadas, Tab pula '?' do FieldLabel system-wide.

## Pendentes (nao bloqueiam release)

- ⏳ **Rodar SQL `update-solis-procel-sls.sql`** (manual) — atualiza os 5 Solis no SLS pra NEW TROPICOS 2000-6000 oficial Procel (preserva preco, atualiza description + areaM2 + kwhPorM2 + eficiencia + classeEficiencia + pressao). Apos rodar, conferir Simulador.
- ⏳ **Configurar regra do Coletor Solar no SLS** — abrir Simulador, clicar ✨ Coletor, definir `filterDescription: "Coletor solar"` (ou outro filtro), Aplicar regra. Ate la o dropdown fica vazio com aviso amarelo.
- ⏳ Persistir overrides do modo MANUAL em `environmentParams` (tipoConstrucao, modoDimensao, lenOverride, etc — hoje state local UI-only).
- ⏳ Motor usar overrides em modo MANUAL no calculo.
- ⏳ Motor aplicar inclinacao otima ≈ latitude (hoje so persiste).
