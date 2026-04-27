# Tecnikos — Instrucoes para o Claude

## REGRAS DE SESSAO (NUNCA IGNORAR)
1. Ao INICIAR sessao: LER `ARCHITECTURE.md` e `CURRENT_TASK.md` ANTES de qualquer coisa
2. Claude decide toda a parte tecnica sozinho e executa sem perguntar — so para em decisoes de NEGOCIO
3. NUNCA confiar que a sessao vai durar — salvar progresso incrementalmente
4. Se a sessao anterior ficou incompleta, retomar do ponto exato registrado em CURRENT_TASK.md
5. Ao finalizar estudo/pesquisa: GRAVAR resultado em arquivo IMEDIATAMENTE
6. Quando o usuario der instrucao global/permanente: PERGUNTAR se quer gravar no CLAUDE.md
7. Ao fazer mudancas estruturais: ATUALIZAR ARCHITECTURE.md antes de encerrar
8. A CADA tarefa concluida: ATUALIZAR CURRENT_TASK.md

## REGRA ABSOLUTA: Financeiro e Saldos (NUNCA VIOLAR)
**Financeiro e EXATO. Nao tolera erro de R$ 0,01. E matematica, e ciencia exata.**

### Antes de QUALQUER alteracao em dados financeiros:
1. **SIMULAR o impacto** em TODOS os calculos dependentes (balance-compare, conferencia de saldo, DRE)
2. **NUNCA alterar currentBalanceCents** sem verificar que março, abril e TODOS os meses continuam batendo
3. **NUNCA mover cashAccountId** de uma entry sem calcular o efeito em movsAfterD de cada periodo
4. **NUNCA alterar paidAt** — afeta conferencia de saldo retroativa. Usar cardBillingDate pra ciclo de fatura
5. **NUNCA fazer UPDATE direto em saldo** sem AccountTransfer rastreavel (exceto correcao pontual aprovada)
6. **NUNCA criar entry PAID via SQL** sem confirmar com usuario se realmente foi recebido/pago

### Antes de QUALQUER mudanca de codigo financeiro:
1. **ESTUDAR e ANALISAR** antes de implementar — nao agir por impulso
2. **SIMULAR com query SQL** o resultado ANTES de aplicar
3. **Verificar conferencia de saldo** de TODOS os meses apos qualquer alteracao
4. Se a conferencia de saldo JA BATE, **NAO MEXER** no calculo — o risco de quebrar e maior que o beneficio
5. **Reverter IMEDIATAMENTE** se algum saldo quebrar — nao tentar "consertar o conserto"
6. **Toda movimentacao entre contas** deve ter AccountTransfer com transferDate (balance-compare depende disso)

### Timezone (regra de ouro):
- **USAR SEMPRE** os helpers de `backend/src/common/util/tenant-date.util.ts`:
  - `tenantNoon(year, month, day)` pra criar dates financeiras
  - `parseTenantDate(string)` pra parsear strings
  - `breakInTenantTz(date)` pra extrair year/month/day no fuso BRT
  - `startOfTenantDay(date)` / `endOfTenantDay(date)` pra ranges
- **NUNCA** usar `new Date(year, month, day)` direto — fuso do servidor (UTC em prod) desloca pra dia anterior em BRT
- **NUNCA** usar midnight (`T00:00:00`) em paidAt, dueDate, transferDate, statementBalanceDate
- Datas financeiras SEMPRE no meio-dia BRT (12:00:00 -03:00 = 15:00 UTC) pra ficar dentro do mesmo dia em qualquer fuso
- O filtro do backend usa `-03:00` (Brasilia) — midnight UTC vira dia anterior em BRT
- Incidente v1.10.14 (25/04/2026): parser OFX criava `new Date(y,m,d,0,0,0)` no fuso UTC → DTASOF=20260331 virava 30/03 21:00 BRT, 339 registros backfillados (+15h)

## AUTORIZACAO GERAL DO USUARIO
O usuario (Juliano) autoriza TODAS as acoes sem pedir confirmacao:
- WebSearch, WebFetch, Bash, Read, Write, Edit, Glob, Grep — TUDO liberado
- Edicoes, builds, dev servers, testes, deploys — EXECUTAR DIRETO
- NUNCA pedir "Permitir que o Claude...?"
- `.claude/settings.local.json` ja esta configurado com permissoes totais

## Dados do Projeto
- **Produto**: Tecnikos — SaaS B2B Field Service Management
- **Empresa**: SLS Obras LTDA (CNPJ: 47.226.599/0001-40)
- **Dominio**: tecnikos.com.br
- **Dono**: Juliano (@jjtriaca no GitHub)
- **Git**: https://github.com/jjtriaca/tecnikos (privado)
- **Stack**: NestJS + Prisma + PostgreSQL 16 + Next.js 15 + Tailwind CSS
- **Servidor**: Hetzner CPX21, IP: 178.156.240.163
- **Login Admin**: admin@tecnikos.com.br / Tecnikos2026!

## Deploy
```bash
bash scripts/deploy-remote.sh          # patch (ex: 1.04.33 -> 1.04.34)
bash scripts/deploy-remote.sh minor    # minor (ex: 1.04.34 -> 1.05.01)
```

---

## REGRA ABSOLUTA: Pagamento Asaas (NUNCA VIOLAR)
**NADA muda no sistema ate o webhook PAYMENT_CONFIRMED do Asaas retornar.**
1. Signup: Subscription=PENDING, Tenant=PENDING_PAYMENT. So ativa no webhook.
2. Upgrade: pendingPlanId salvo. Plano/limites so mudam no webhook.
3. Add-on: AddOnPurchase=PENDING. Limites creditados so no webhook.
4. Downgrade: Sem pagamento, agenda via pendingPlanId pro proximo ciclo.
5. NUNCA alterar Tenant.status, Subscription.status, Company.max* antes do pagamento.
6. Excecao: credito pro-rata 100% -> aplicar imediatamente.

## ALERTA: APIs Externas com Risco de Ban
Ao trabalhar com Meta (WhatsApp) ou Focus NFe:
1. CONSULTAR `memory/whatsapp-audit-2026-03.md` ANTES de qualquer mudanca
2. NUNCA implementar baseado em suposicoes — estudar docs oficiais
3. NUNCA multiplos deploys rapidos com mudancas de comportamento
4. TESTAR com 1 caso primeiro, nunca em producao direto
5. ATUALIZAR arquivos de memoria ao aprender algo novo
6. IA embarcada tools: somente configs ADMIN, nunca janela de entrada

---

## Padroes de Codigo Obrigatorios

### Backend — Criar endpoint novo
1. DTO com class-validator (`@IsString()`, `@Min()`, etc.)
2. Controller com `@Roles()` guard + `@ApiOperation()`
3. Service com `companyId` filter em TODA query (tenant isolation)
4. Paginacao: `PaginationDto` -> `skip/take` + `$transaction([findMany, count])`
5. Erros: `BadRequestException`, `NotFoundException`, `ForbiddenException`, `ConflictException`
6. Audit: `AuditService.log()` para mudancas criticas

### Frontend — Criar pagina nova
1. Arquivo em `src/app/(dashboard)/[rota]/page.tsx`
2. `useAuth()` para verificar roles
3. `api.get/post()` para chamadas (lib/api.ts)
4. Tabelas: componentes padrao obrigatorios (ver abaixo)
5. Forms: useState + onChange handler + api.post no submit
6. Toast: `useToast()` para feedback

### Tabelas (System-Wide — OBRIGATORIO)
- SEMPRE usar: DraggableHeader + SortableHeader + FilterBar + Pagination
- SEMPRE usar: useTableParams({ persistKey }) + useTableLayout(tableId, columns)
- Tipos: ColumnDefinition<T> e FilterDefinition de @/lib/types/table
- NUNCA usar <th> plain ou renderPagination() customizado

### Variaveis em Campos de Texto (System-Wide)
- Campos textarea/input com variaveis: DEVEM ter botoes chip clicaveis
- Clicar insere {variavel} na posicao do cursor (useRef + selectionStart/selectionEnd)
- Visual: text-[10px], bg-slate-100, hover:bg-green-100
- TODOS os placeholders devem ter texto exemplo realista (NUNCA vazio)

### Tenant Isolation (CRITICO)
- Toda query Prisma DEVE filtrar por `companyId`
- JWT contem `tenantSlug` — PrismaService resolve o schema correto
- NUNCA acessar dados cross-tenant
- Guards: Throttler -> JWT -> Roles -> Verification

### Migrations Prisma em Multi-Tenant (CRITICO)
- Multi-tenant e schema-per-tenant: Prisma `migrate deploy` so roda no `public`. `TenantMigratorService` sincroniza a estrutura nos tenants via `information_schema` + `ADD COLUMN IF NOT EXISTS`
- **REGRA 1:** NAO adicionar coluna NOT NULL sem default em tabela ja populada — vai falhar silenciosamente nos tenants (pos sync ajusta o log com warning, mas nao preenche dado)
- **Receita certa:** (1) adicionar coluna como NULLABLE na migration; (2) data migration backfill no SQL da migration; (3) ALTER COLUMN SET NOT NULL no final
- **Se o backfill depende de logica do tenant:** escrever um script SQL separado que itera por `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'` e roda manualmente apos deploy
- **REGRA 2:** todo NOVO model Prisma que e por-tenant DEVE ser adicionado ao Set `TENANT_MODEL_DELEGATES` em `backend/src/prisma/prisma.service.ts`. Sem isso, queries vao pro schema public (vazio) e dados do tenant somem silenciosamente. Checklist ao criar um model novo: (1) schema.prisma; (2) migration SQL; (3) TENANT_MODEL_DELEGATES; (4) testar com tenant real
- Ver `memory/tenant-migrator-not-null-gotcha.md` — incidentes v1.08.87/88/89

### Convencoes Gerais
- Commits: conventional commits (feat:, fix:, release:)
- Codigo: ingles | UI: portugues brasileiro
- Sem acentos em nomes de arquivo
- CSS: Tailwind utility classes, design system slate/blue
- Codigos sequenciais: OS-00001, PAR-00001, FIN-00001 (via CodeCounter)
- NUNCA usar Preview Screenshot (trava o chat) — usar preview_snapshot/preview_inspect

### Importacao de Dados
- Modelo de importacao: CSV com separador `;`
- Botao "Baixar modelo CSV" no modal de importacao com linhas de exemplo
- Mapeamento automatico de colunas pelo cabecalho
- Validacao de duplicatas por documento (CPF/CNPJ)

### Wizards ChatIA (System-Wide)
- A cada feature nova: AVALIAR se precisa de wizard na ChatIA
- Se sim: adicionar triggers, steps e tools no system prompt (chat-ia.service.ts)
- Se tiver config: adicionar ao onboarding checklist (chat-ia.onboarding.ts)
- Se precisar de dados: criar tool em chat-ia.tools.ts
- Wizards existentes: Setup Geral, NFS-e Config, WhatsApp, Push, NFS-e Import, Billing
- Pendente wizard: (nenhum)

---

## Organizacao de Documentacao
| Arquivo | Funcao |
|---------|--------|
| CLAUDE.md | Regras e instrucoes para o Claude (este arquivo) |
| ARCHITECTURE.md | Mapa tecnico completo do sistema |
| CURRENT_TASK.md | Versao atual + lista de pendencias (maximo 20 linhas) |
| memory/ | Memorias persistentes (alertas, decisoes, estudos) |
