# TAREFA ATUAL

## Versao atual em prod: v1.12.18 — Fix encargo fatura orfao + trava mes fechado + fix filtro Prisma NULL + helper

Sessao 210 (22-23/05/2026), 3 releases:

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
