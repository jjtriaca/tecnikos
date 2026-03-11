# LOG DO PROJETO - Sistema de Terceirização (Field Service Management SaaS)
# Última atualização: 11/03/2026 (Sessão 94)

---

## REGRAS DE OPERAÇÃO (LEIA PRIMEIRO AO INICIAR NOVA SESSÃO)

### Para o Claude (ao reconectar a pasta):
1. **Leia este arquivo primeiro**, depois PLANO_MESTRE.md, depois CHAT_LOG.md
2. **Resumo automático:** Diga ao Juliano: qual é o projeto, onde parou, qual a próxima etapa
3. **Antes de executar qualquer etapa:** Registre no PLANO_MESTRE.md que está "🔨 EM ANDAMENTO (X%)"
4. **Depois de concluir:** Registre "✅ CONCLUÍDO" no PLANO_MESTRE.md e atualize este LOG
5. **Progresso:** Sempre mostre % de conclusão (não "Trabalhando nisso")
6. **Ideias novas:** Quando surgir uma ideia nova, registre no PLANO_MESTRE.md na fase apropriada
7. **Dependências:** Se uma tela pronta precisa de retrabalho futuro, está no MAPA DE RETRABALHO do PLANO_MESTRE.md

### Para o Juliano:
- Ao iniciar novo chat: selecione a pasta do projeto e diga "continuar" (ou qualquer coisa)
- O Claude vai ler os logs e retomar automaticamente
- Não precisa explicar nada de novo

---

## Stack
- **Backend:** NestJS 11, TypeScript, Prisma 6, PostgreSQL 16
- **Frontend:** Next.js 16, React 19, Tailwind CSS 4, Playwright
- **Infra:** Docker Compose (Postgres porta 5433)
- **Portas:** API 4000 | Frontend 3000 | DB 5433
- **API Proxy:** Next.js rewrites `/api/*` → `http://localhost:4000/*`

## Modelo de Versionamento — X.XX.XX
- **Formato:** `MAJOR.MINOR.PATCH` com zero-padding (ex: `2.00.02`)
- **Patch:** Incrementa a cada build (`2.00.02 → 2.00.03`)
- **Cascata:** Patch 99 → Minor+1, Patch=01 (`2.00.99 → 2.01.01`)
- **Cascata Major:** Minor 99 + Patch 99 → Major+1 (`2.99.99 → 3.00.01`)
- **Patch mínimo:** Sempre `01` (nunca `00`)
- **Como usar:** `node scripts/bump-build.js` (incrementa e salva em `version.json`)
- **Arquivo:** `version.json` na raiz do projeto (version, codename, releasedAt em ISO)
- **Detecção automática:** Health controller lê `version.json` sem cache a cada request
- **Frontend:** Settings faz polling de `/api/health` a cada 60 minutos
  - Se versão do backend difere da carregada: badge âmbar "Nova versão disponível!" + botão ativo
  - Se igual: badge verde "Sistema atualizado" + botão desabilitado
- **Versão atual:** 1.00.47 (codename: Polish & Docs)

## Seeds
- Empresa: SLS OBRAS LTDA (CNPJ: 47.226.599/0001-40, Primavera do Leste - MT)
- Admin: admin@demo.com / admin123
- Despacho: despacho@demo.com / despacho123
- Técnico: tecnico@demo.com / tech123

---

## ESTADO ATUAL DO PROJETO

### Progresso: 60 de 73 etapas MVP + v1.00.03 (Parceiros) + v1.00.04 (Blindagem)

### CONCLUÍDO:
- Fase 0 (Infraestrutura): 7/7 ✅
- Fase 1 (Auth): 6/6 ✅
- Fase 2 (Core Backend): 10/10 ✅
- Fase 3 (Telas do Gestor): 12/12 ✅
- Fase 4 (Mobile Técnico): 5/7 ✅
- Fase 5 (Workflow Engine): 5/5 ✅
- Fase 6 (Upload Fotos): 4/4 ✅
- Fase 7 (Relatórios): 3/4 ✅ — (falta 7.4 Exportar CSV/PDF)
- Fase 8 (Notificações): 4/5 ✅ — (falta 8.2 Proximidade GPS)
- Fase 9 (Polimento): 4/5 ✅ — (falta 9.4 Validação formulários)
- **v1.00.03 Parceiros:** Merge Technician → Partner (modelo unificado) ✅
- **v1.00.04 Blindagem:** Melhorias arquiteturais (indexes, DTOs, paginação, transactions, exception filter) ✅
- **v1.00.05 Filtros:** Sistema ERP-style de filtros e ordenação em todas as tabelas ✅
- **v1.00.06 Colunas:** Bug fix OS, colunas extras, drag & reorder, persistência layout ✅
- **v1.00.07 Ações:** Edição de OS, botões de ação, AuditLog polimórfico, histórico em todas as tabelas ✅
- **v1.00.08 Busca Global:** Componente de pesquisa reutilizável (SearchLookupModal + LookupField + useDebounce) ✅
- **v1.00.09 Endereço Inteligente:** Endereço estruturado + geocoding automático + ViaCEP + IBGE cidades ✅
- **v1.00.10 Mapa Interativo:** Botão "Definir localização" + modal na OS ✅
- **v1.00.11 Localização Google Maps:** Substituído Leaflet por fluxo Google Maps + cola de coordenadas (leve, busca precisa) ✅
- **v1.00.12 Dashboard Pro:** Redesign completo do dashboard — KPIs financeiros, gráfico sparkline, ranking parceiros, alertas pendentes ✅
- **v1.00.13 Workflow Blocos:** Redesign completo do workflow builder — sistema de blocos visuais com 16 tipos, canvas com branches SE/CONDIÇÃO, painel de propriedades, formato V2 com grafo ✅
- **v1.00.14 Exportar Dados:** Exportação CSV em todas as tabelas (OS, Parceiros, Financeiro) + CSV/PDF nos Relatórios + CSS print-optimized ✅
- **v1.00.15 Motor V2:** Motor de execução V2 para workflow em grafo — caminha blocos com branches CONDITION (Sim/Não), validação por tipo de bloco (STEP, PHOTO, NOTE, GPS, QUESTION, CHECKLIST, SIGNATURE, FORM, CONDITION), auto-complete de blocos sistema (NOTIFY, ALERT, STATUS), tela mobile do técnico com UI específica por bloco, backward-compatible com V1 ✅
- **v1.00.16 Motor de Automação:** AutomationRule + AutomationExecution models, AutomationEngineService (motor de execução), builder guiado QUANDO→SE→ENTÃO, automation-blocks.ts, ações SEND_NOTIFICATION/CHANGE_STATUS/LAUNCH_FINANCIAL, dispatch de eventos (os_created, os_updated, os_assigned, os_status_changed) ✅
- **v1.00.17 Financeiro Expandido:** FinancialEntry (RECEIVABLE/PAYABLE) com status tracking (PENDING→CONFIRMED→PAID→CANCELLED), summaryV2, página /finance com 4 abas (Resumo, A Receber, A Pagar, Repasses), frontend/src/types/finance.ts ✅
- **v1.00.18 Campos & Ações:** Novos campos condicionáveis (addressStreet, cep, deadlineAt, createdAt, title, description), tipo date com operadores gt/lt/gte/lte, 3 novas ações (ASSIGN_TECHNICIAN, DUPLICATE_OS, WEBHOOK) ✅
- **v1.00.19 Parceiro Automatizado:** PARTNER como segunda entidade automatizável, eventos partner_created/updated/status_changed/deleted, campos condicionáveis do Partner ✅
- **v1.00.20 Decisão Binária:** ConditionNode com trueBranch/falseBranch (árvore SIM/NÃO), BranchDef com conditions[]+actions[], conditionMode simple/advanced, walkConditionTree() no engine ✅
- **v1.00.21 Canvas Visual:** Canvas SVG com pan/zoom, BlockPalette com blocos arrastáveis, CanvasBlock com portas tipadas, ConnectionLine SVG, useCanvasState hook, campo layout JSON no AutomationRule, toggle formulário/canvas ✅
- **v1.00.22 Templates & Debug:** AutomationTemplate model, TemplateGallery, SimulationModal (dry run), ExecutionTimeline (histórico), endpoint POST /automations/:id/simulate ✅
- **v1.00.23 Fluxo Unificado:** Unificação Workflow + Automação em motor central "Fluxo de Atendimento", puzzle-piece blocks estilo MIT App Inventor, 22 tipos de bloco, formato v3, canvas escuro ✅
- **v1.00.24 Atribuir Técnico:** Campo de atribuição de técnico nos formulários de criação/edição de OS (3 modos: especialização, direcionado, por fluxo), MultiLookupField, TechAssignmentSection, endpoints paginados ✅
- **v1.00.25 NOTIFY Multi-Destinatário:** Bloco NOTIFY redesenhado com multi-destinatário (Gestor, Técnico, Cliente), templates por destinatário com variáveis dinâmicas ({titulo}, {valor}, {comissao}, {contato_local}, etc.), campo "Contato no Local" na OS, engine com substituição de variáveis ✅
- **v1.00.26 Aguardar Verificando:** Novo bloco WAIT_FOR para workflow — pausa o fluxo por tempo configurável com trigger antecipado por eventos (técnico aceitar, status mudar, etc.), @nestjs/schedule + PendingWorkflowWait model, WaitForService com cron + event-driven resume, integração com dispatchAutomation ✅
- **v1.00.27–v1.00.33:** Etapas enriquecidas, fluxos operacionais, persistência sólida, accordion etapas, seleção limpa ✅
- **v1.00.34 Aceite Completo:** Campo "Tempo para aceitar" na edição de OS (state/load/save/UI), textos explicativos anti-redundância em todos os formulários (criação OS, edição OS, workflow), diferenciação "Prazo de execução" vs "Tempo para aceitar" ✅
- **v1.00.35 Tempos e Variáveis:** Renomeado "aceite"→"aceitar", novo campo "Tempo para clicar a caminho" (enRouteTimeout) em workflow + OS criação + OS edição + backend, variáveis {tempo_aceitar} e {tempo_a_caminho} no NOTIFY_VARS + engine substituição ✅

### ⚠️ PROBLEMA ARQUITETURAL IDENTIFICADO (Sessão 26):
**Foram criados DOIS sistemas separados que deveriam ser UM SÓ:**
1. **"Fluxo de Atendimento"** (`/workflow`) — Builder de fluxo do técnico (vertical flowchart)
2. **"Automações"** (`/automation`) — Motor de regras QUANDO→SE→ENTÃO + canvas visual

**O correto:** O motor de automação deveria ser o **motor central único** de configuração de TODO o sistema, com blocos de encaixe tipo quebra-cabeça. O fluxo de atendimento deveria ser construído DENTRO do motor de automação. **Resolução pendente.**

### PENDENTE:
- 4.5: GPS Tracking + Notificação de Proximidade
- 4.7: PWA Manifest + Service Worker
- 8.2: Notificação de Proximidade (depende de 4.5)
- 9.4: Validação de formulários (react-hook-form + zod)
- Fase 10: Testes e Deploy (7 etapas)

### PRÓXIMA ETAPA:
- **Fase 10 — Testes e Deploy**

### ✅ CONCLUÍDO (Sessão 36):
- v1.00.34: Campo "Tempo para aceitar" na edição de OS + textos anti-redundância
- v1.00.35: "Tempo para clicar a caminho" + variáveis {tempo_aceitar} e {tempo_a_caminho} no disparo

### MELHORIAS PÓS-MVP (implementadas):
- Cadastro completo da empresa brasileira (CNPJ, IE, IM, endereço, responsável legal)
- CNPJ lookup via BrasilAPI (primário) + ReceitaWS (fallback) — auto-preenche todos os campos
- CEP lookup via ViaCEP — auto-preenche endereço
- Self-healing migrations (PrismaService cria colunas ausentes no startup via raw SQL)
- Visibilidade de inputs corrigida globalmente (globals.css com !important)
- Versionamento X.XX.XX com cascata em 99 (bump-build.js)
- Botão "Atualizar Sistema" com detecção de nova versão (polling health a cada 60min)
- Data de última atualização com hora e minutos (formato dd/mm/yyyy HH:mm)

### BLINDAGEM ARQUITETURAL (v1.00.04):
- **15+ database indexes** para performance em produção
- **DTOs com class-validator** em TODOS os endpoints (whitelist + forbidNonWhitelisted)
- **Paginação server-side** em todos endpoints de lista (PaginatedResult<T>)
- **Raw SQL eliminado** — CompanyService e EvaluationService reescritos com Prisma ORM
- **Transações atômicas** no WorkflowEngine (advanceStep) e paginação (count+findMany)
- **GlobalExceptionFilter** — erros padronizados, sem stack trace em produção
- **Frontend componentizado** — Partners page refatorada em 4 componentes

### NOTAS TÉCNICAS:
- Backend type-check limpo (NestJS build 0 errors)
- Sidebar com ícones SVG limpos
- Notification model adicionado ao Prisma
- Versão atual: 1.00.11 (Localização Google Maps)
- Health controller lê version.json a cada request (sem cache)
- Schema: Partner unificado (Technician removido), Specialization, PartnerSpecialization, TechnicianEvaluation
- Partner com partnerTypes String[] (CLIENTE, FORNECEDOR, TECNICO)
- Company expandida com configurações de avaliação (pesos, nota mínima)
- ValidationPipe global com whitelist + transform (forbidNonWhitelisted removido na v1.00.05)

---

## ARQUIVOS DO PLANO
- **PROJETO_LOG.md** — Este arquivo (estado do projeto + regras + histórico de sessões)
- **CHAT_LOG.md** — Histórico detalhado de conversas e decisões tomadas

---

## HISTÓRICO DE SESSÕES

### Sessão 1 (data desconhecida)
- Criada estrutura completa do projeto
- Backend: auth, service-order, technician, finance, public-offer, company
- Frontend: login, dashboard básico, service-orders, finance, public-offer
- Prisma schema com 9 modelos
- Docker Compose configurado
- Seeds criados

### Sessão 2 — 20/02/2026
- Reconectada pasta do projeto
- Auditoria completa do estado atual
- Log criado (PROJETO_LOG.md)
- Juliano decidiu criar plano mestre completo

### Sessão 3 — 20/02/2026
- Sessão anterior travou/caiu várias vezes
- Reconectada pasta
- Criado PLANO_MESTRE.md com 70 etapas detalhadas (10 fases)
- Criado CHAT_LOG.md para histórico de conversas
- Implementadas regras de operação para continuidade entre sessões
- **PRÓXIMA TAREFA:** Fase 3.1 — Layout Autenticado

### Sessão 4 — 21/02/2026
- Fase 3.1 completa (AuthLayout, Sidebar RBAC, Header, migração de diretórios)
- Grande refatoração: consolidada estrutura, substituído axios por fetch-based API client
- Fase 3.2-3.5 completas (Dashboard, Lista OS, Detalhe OS, Criar OS)
- Fase 3.6 parcial (Users backend + frontend) — sessão travou no final

### Sessão 5 — 20/02/2026 (continuação após compactação de contexto)
- Retomado automaticamente lendo logs
- Fase 3.6 Gestão de Usuários: ✅ (já estava pronta)
- Fase 3.7 Gestão de Técnicos: ✅ (tabela completa com busca, rating stars, phone formatting)
- Fase 3.8 Configurações do Tenant: ✅ (nome empresa + comissão BPS editável, apenas ADMIN)
- Fase 3.9 Financeiro Painel: ✅ (cards resumo, OS pendentes, repasses confirmados)
- Backend: adicionado GET /finance/summary, PUT /companies/:id aceita commissionBps
- Build verificado: 14 rotas compiladas com sucesso
- **Progresso: 32/70 etapas (46%)**

### Sessão 6 — 20/02/2026 (continuação da Sessão 5)
- Juliano pediu: visual Bling-like + construtor de workflow visual
- Fase 3.10 Relatórios: ✅ (placeholder com 4 cards de tipos)
- Fase 3.11 Workflow Builder: ✅ (builder visual com blocos, ícones, steps 1-50)
- Fase 3.12 Polish Visual Bling-like: ✅ (SVG, gradientes, blur, dashboard cards)
- WorkflowTemplate model + migration + backend CRUD
- Build: 15 rotas. **Fase 3 COMPLETA. Progresso: 35/73 (48%)**

### Sessão 7 — 21/02/2026 (continuação após compactação)
- Juliano disse "Sim" para continuar com Fase 4
- Fase 4.1 Auth + Layout: ✅ (TechAuthService, email/passwordHash no Technician, layout mobile bottom nav)
- Fase 4.2 Login: ✅ (tela login técnico, TechAuthContext, silentRefresh)
- Fase 4.3 Lista OS: ✅ (agrupada por status, cards coloridos, badge atraso)
- Fase 4.4 Detalhe OS: ✅ (info, Google Maps, ações por status)
- Fase 4.6 Perfil: ✅ (card com rating, info, logout)
- Build: 20 rotas. **Progresso: 40/73 (55%)**
- Pulou 4.5 (GPS) e 4.7 (PWA) — voltaremos depois
- **PRÓXIMA TAREFA:** Fase 5 (Workflow Engine)

### Sessão 7 (continuação) — 21/02/2026
- Fase 5 completa (Workflow Engine): schema WorkflowStepLog, advance/getProgress/resetStep
- Fase 6 completa (Upload Fotos): UploadService, Attachment model, galeria com upload
- Build: 20 rotas. **Progresso: 49/73 (67%)**

### Sessão 8 — 21/02/2026
- Fase 7 completa (Relatórios): ReportsService, 3 tabs com filtros e gráficos
- Fase 8 completa (Notificações): NotificationService mock, badge no Header, tela de log
- Fase 9 completa (Polimento): ToastProvider, ConfirmModal, CSS animations
- Build: 20 rotas. **Progresso: 60/73 (82%)**

### Sessão 9 — 21/02/2026
- Debugging extenso de login, navegação e sessão (cookies, refresh token, redirects)
- Cadastro completo da empresa brasileira na página de Configurações
  - 17 novos campos: CNPJ, IE, IM, telefone, email, endereço completo, responsável legal
  - Self-healing migration no PrismaService (cria colunas ausentes no startup)
  - CompanyService reescrito com raw SQL ($queryRawUnsafe)
- CNPJ lookup: BrasilAPI como primário, ReceitaWS como fallback
  - Card destacado "Importar Dados da Receita Federal" com campo CNPJ + botão buscar
  - Auto-preenche: razão social, nome fantasia, telefone, email, endereço completo
  - Testado com CNPJ real (47.226.599/0001-40 = SLS OBRAS LTDA)
- CEP lookup via ViaCEP integrado
- Fix visibilidade de inputs: fonte quase invisível corrigida globalmente via globals.css

### Sessão 10 — 22/02/2026
- Versionamento alterado de X.Y.Z+build para X.XX.XX (cascata em 99)
  - version.json: 1.00.02, codename MVP
  - bump-build.js reescrito com zero-padding e cascata
  - health.controller.ts: removido campo build, removido cache (lê version.json a cada request)
  - Sidebar e Settings atualizados para mostrar apenas v{version}
- Botão "Atualizar Sistema" redesenhado:
  - Polling do health a cada 60 minutos para detectar nova versão
  - Badge verde "Sistema atualizado" + botão desabilitado quando versões iguais
  - Badge âmbar pulsante "Nova versão disponível!" + botão ativo quando versão muda
  - Data de última atualização agora mostra dd/mm/yyyy HH:mm
  - releasedAt salvo como ISO completo (com hora/minutos)

### Sessão 11 — 21/02/2026
- **ATUALIZAÇÃO v1.00.03 — "Parceiros" ✅ COMPLETA**
- Migração do Cowork (Windsurf) para Claude Code CLI
- Planejamento completo: 11 sub-fases (A-K), ~35 etapas
- **Todas as 11 fases implementadas com sucesso:**
  - FASE A: Schema Prisma (4 novos models, campos expandidos)
  - FASE B: Backend Especializações (CRUD + seedDefaults)
  - FASE C: Backend Technician expandido + Partner (CRUD, rating, status)
  - FASE D: Backend Avaliações (gestor + cliente público via token)
  - FASE E: Backend Workflow + Smart Routing (filtro por especializações)
  - FASE F: Frontend Utils (brazil-utils.ts) + Página Parceiros
  - FASE G: Frontend Técnicos expandido (PF/PJ, CPF/CNPJ, especializações)
  - FASE H: Frontend Workflow Redesign (pasta suspensa visual)
  - FASE I: Frontend Avaliações (gestor na OS, rating público /rate/[token])
  - FASE J: Frontend Settings expandido (pesos avaliação + gerenciar especializações)
  - FASE K: Seed atualizado, versão 1.00.03, smoke test (22 rotas, 0 erros)
- Build backend: 0 erros TypeScript
- Build frontend: 22 rotas compiladas (inclui /partners, /rate/[token])

### Sessão 12 — 21/02/2026
- **Merge Technician → Partner (v1.00.03):** Model Technician removido, fundido em Partner
  - partnerTypes String[] (CLIENTE, FORNECEDOR, TECNICO) substitui partnerType String
  - Todas referências technician → partner no schema, services, controllers
  - TechnicianModule removido, PartnerService absorveu toda lógica
- **v1.00.04 "Blindagem" — Melhorias Arquiteturais:**
  - 15+ database indexes para performance/segurança
  - DTOs com class-validator em todos endpoints
  - Paginação server-side em todos endpoints de lista
  - Raw SQL eliminado (CompanyService, EvaluationService reescritos com Prisma ORM)
  - Transações atômicas no Workflow Engine
  - GlobalExceptionFilter para erros padronizados
  - Frontend Partners refatorado em 4 componentes

### Sessão 13 — 21/02/2026
- **v1.00.05 "Filtros" — Sistema ERP-style de Filtros e Ordenação ✅ COMPLETA**
- **Backend:**
  - PaginationDto: +sortBy, +sortOrder (validados com @IsIn)
  - buildOrderBy utility: validação contra allowlist de colunas (segurança anti-injection)
  - PartnerService: sort dinâmico (7 colunas) + filtros (status, personType)
  - ServiceOrderService: sort dinâmico (5 colunas) + filtros (dateFrom, dateTo, valueMin, valueMax)
  - FinanceService: novo findLedgers paginado (4 colunas sort, filtros de data, busca por título OS)
  - FinanceController: novo GET /finance/ledgers
- **Frontend — Componentes reutilizáveis:**
  - `lib/types/table.ts`: SortOrder, SortState, FilterDefinition, FilterValues
  - `hooks/useTableParams.ts`: hook centralizado (page, search, sort, filters, buildQueryString)
  - `components/ui/SortableHeader.tsx`: cabeçalho clicável com setas (▲▼), ciclo null→asc→desc→null
  - `components/ui/FilterBar.tsx`: barra de filtros declarativa (text, select, date, numberRange)
  - `components/ui/Pagination.tsx`: componente compartilhado promovido de partners/
- **Frontend — Integração nas páginas:**
  - Partners: FilterBar (status, personType) + SortableHeader (5 colunas) + Pagination
  - Orders: FilterBar (status, dateFrom, dateTo, valueMin, valueMax) + SortableHeader (4 colunas) + conversão R$→centavos
  - Finance: Summary cards (GET /summary) + Ledger table (GET /ledgers paginado) + FilterBar (dateFrom, dateTo, search) + SortableHeader (4 colunas)
- Build: backend 0 erros, frontend 21 rotas compiladas (0 erros)
- **Bug fix:** Removido `forbidNonWhitelisted: true` do ValidationPipe (rejeitava query params extras nos filtros)

### Sessão 14 — 21/02/2026
- **v1.00.06 "Colunas" — Bug fix + Colunas extras + Drag & Reorder + Persistência ✅ COMPLETA**
- **Bug fixes:**
  - `findOne` ServiceOrder: adicionado `companyId` no where clause (segurança + fix "OS não encontrada")
  - `orders/[id]/page.tsx`: trocado prop `params` por `useParams()` (Next.js 16 client component)
- **Schema:** 3 novos campos nullable (startedAt, completedAt, clientPartnerId) + relação ClientPartner
- **Backend:** auto-timestamps no updateStatus, clientPartner includes, SORTABLE_COLUMNS expandido, create aceita clientPartnerId
- **Frontend — Infraestrutura:**
  - `useTableLayout.ts`: persistência de layout no localStorage (version stamp, validação de IDs)
  - `DraggableHeader.tsx`: HTML5 Drag & Drop API (zero dependências)
  - `SortableHeader.tsx`: refatorado com prop `as` ("th"|"div")
  - `ColumnDefinition<T>` + `TableLayoutState` types
- **Frontend — 3 tabelas integradas:**
  - Orders: 11 colunas (título, cliente, status, técnico, valor, criada, aceite, iniciada, concluída, prazo, endereço)
  - Partners: PartnerTable com ColumnDefinition + drag + scroll
  - Finance: LEDGER_COLUMNS + drag + scroll
- **Frontend — Nova OS:** dropdown "Cliente (opcional)" com fetch de partners tipo CLIENTE
- **Seed:** clientPartnerId + startedAt nas OS demo
- Build: backend 0 erros, frontend 21 rotas (0 erros)

### Sessão 15 — 22/02/2026
- **v1.00.07 "Ações" — Edição de OS + Botões de Ação + AuditLog ✅ COMPLETA**
- **FASE 1 — Schema + AuditService:**
  - Novo modelo AuditLog polimórfico (entityType + entityId, sem FK)
  - AuditService reescrito: log() fire-and-forget, getForEntity()
  - Novo AuditController: GET /audit?entityType=X&entityId=Y&limit=N
  - prisma db push + prisma generate executados
- **FASE 2 — Backend OS edit/cancel/duplicate:**
  - UpdateServiceOrderDto (8 campos opcionais)
  - ServiceOrderService: update(), cancel(), duplicate() + audit em TODAS 7 operações
  - ServiceOrderController: PUT /:id, PATCH /:id/cancel, POST /:id/duplicate (ADMIN+DESPACHO)
- **FASE 3 — Backend audit em Partners e Users:**
  - PartnerService + UserService: AuditService injetado, audit em create/update/remove
  - Senha mascarada como "***alterada***" (NUNCA expõe hash)
- **FASE 4 — Frontend página de edição de OS:**
  - Nova página /orders/[id]/edit espelhando /orders/new
  - Badge de status read-only, fieldset disabled para status terminal
- **FASE 5 — Frontend botões de ação na tabela de OS:**
  - ActionsDropdown com menu contextual "⋯" (Ver, Editar, Duplicar, Cancelar, Excluir)
  - ConfirmModal para cancelar (warning) e excluir (danger)
  - Roles: ADMIN/DESPACHO para ações de mutação
- **FASE 6 — Frontend AuditLogDrawer:**
  - Componente reutilizável com fetch lazy, timeline compacta, traduções PT-BR
  - Integrado nas 3 tabelas: Orders (SERVICE_ORDER), Partners (PARTNER), Users (USER)
  - Ícone relógio toggle expand/collapse
- Build: backend 0 erros, frontend 22 rotas (0 erros)

### Sessão 16 — 22/02/2026
- **v1.00.08 "Busca Global" — Componente de Pesquisa Reutilizável ✅ COMPLETA**
- **Bug fixes:**
  - ActionsDropdown reescrito com position fixed (escapa overflow-x-auto)
  - Scrollbar vertical removida nas 3 tabelas (overflow-y: hidden)
  - Alinhamento do dropdown corrigido (text-left forçado)
- **Novos componentes:**
  - `useDebounce<T>` — hook genérico de debounce (300ms)
  - `SearchLookupModal` — popup de busca genérico (fetcher, renderItem, teclado, paginação)
  - `LookupField` — wrapper de formulário (lupa + limpar + display de seleção)
- **Integração:**
  - `orders/new/page.tsx` — `<select>` substituído por `<LookupField>` com busca server-side
  - `orders/[id]/edit/page.tsx` — mesma substituição + pre-populate com dados da OS
- Build: frontend 22 rotas (0 erros)

### Sessão 17 — 22/02/2026
- **v1.00.09 "Endereço Inteligente" — Endereço Estruturado + Geocoding Automático ✅ COMPLETA**
- **Schema:**
  - 7 novos campos nullable em ServiceOrder: addressStreet, addressNumber, addressComp, neighborhood, city, state, cep
  - lat/lng agora nullable (Float?) — geocoding automático pode falhar
- **Backend:**
  - CreateServiceOrderDto e UpdateServiceOrderDto atualizados com novos campos
  - lat/lng tornados opcionais no DTO
  - Service: create, update e duplicate lidam com novos campos estruturados
- **Frontend — brazil-utils.ts:**
  - `fetchCitiesByState(uf)` — IBGE API com cache em Map
  - `geocodeAddress(fullAddress)` — Nominatim/OpenStreetMap (gratuito, sem API key)
  - `composeAddressText(fields)` — composição automática do endereço completo
  - `STATE_NAMES` — mapa UF → nome completo dos 27 estados
- **Frontend — Formulários reestruturados:**
  - Estado (select UF) → Cidade (LookupField + IBGE) → CEP (ViaCEP auto-fill) → Rua/Número/Bairro
  - CEP preenche rua, bairro, estado e cidade automaticamente
  - Geocoding automático no submit (Nominatim) — sem campo lat/lng manual
  - Campos estruturados enviados ao backend + addressText composto automaticamente
  - Edição: pre-populate de todos os campos incluindo cidade via IBGE
  - Fallback: OS antiga sem campos estruturados usa addressText no campo rua
- Build: frontend 22 rotas (0 erros)

### Sessão 17 (continuação) — 22/02/2026
- **v1.00.10 "Mapa Interativo" → v1.00.11 "Localização Google Maps"**
- **Problema original:** Google Maps URLs não são confiáveis para cidades pequenas brasileiras
- **Tentativa 1 (v1.00.10):** Mapa Leaflet/OpenStreetMap embutido em popup
  - Leaflet + react-leaflet instalados, CSS conflitava com Tailwind CSS 4 (tiles não renderizavam)
  - Adicionado CSS fix para Tailwind reset, resolveu renderização mas busca do Nominatim muito imprecisa
  - Tentativa de barra de pesquisa Nominatim — endereços brasileiros não encontrados
  - **Juliano decidiu: Nominatim não serve, precisa do Google Maps**
- **Solução final (v1.00.11):** Google Maps + cola de coordenadas
  - Leaflet removido (npm uninstall leaflet react-leaflet @types/leaflet)
  - CSS Leaflet e fixes removidos do globals.css
  - LocationPickerModal reescrito: zero dependências externas, puro React
  - Popup com 3 passos guiados:
    1. "Buscar no Google Maps" → abre Google Maps com endereço da OS pré-pesquisado
    2. Instrução: clique direito no local → copie coordenadas
    3. Campo para colar coordenadas (parse automático "lat, lng")
  - Validação: ✓ verde quando formato correto, erro vermelho quando inválido
  - Botão "Salvar localização" → PUT /service-orders/:id
- Build: frontend 22 rotas (0 erros), zero dependências extras

### Sessão 18 — 22/02/2026
- **v1.00.12 "Dashboard Pro" — Redesign completo do dashboard ✅ COMPLETA**
- KPIs financeiros, gráfico sparkline SVG (14 dias), ranking parceiros, alertas pendentes
- Promise.allSettled para 5 chamadas paralelas (graceful degradation)
- Fix 404 links: /technicians→/partners, /reports/orders→/reports
- Build: frontend 22 rotas (0 erros)

### Sessão 19 — 23/02/2026
- **v1.00.13 "Workflow Blocos" — Sistema de Blocos Visuais para Workflow ✅ COMPLETA**
- Estudo de viabilidade com 2 mockups HTML (Scratch/Blockly/Node-RED/n8n como inspiração)
- Novo arquivo de tipos `workflow-blocks.ts`: 16 BlockTypes, grafo, catálogo, conversor V1→V2
- Reescrita completa da página workflow: builder 3 colunas (palette|canvas|properties)
- Canvas com branches (CONDITION split SIM/NÃO), FlowRenderer recursivo
- Painel de propriedades com config específica por tipo de bloco
- Zero mudança no backend — V2 format armazenado na mesma coluna Json
- Build: frontend 22 rotas (0 erros)

### Sessão 19 (continuação) — 23/02/2026
- **v1.00.14 "Exportar Dados" — CSV + PDF em todas as tabelas ✅ COMPLETA**
- Utilitário `export-utils.ts`: exportToCSV genérico, formatters (date, money, status), BOM UTF-8
- Botão CSV nas tabelas: Ordens (11 cols), Parceiros (13 cols), Financeiro (6 cols)
- Relatórios: botão CSV (por tab) + botão PDF (window.print)
- CSS @media print: esconde sidebar/header, full-width, print-color-adjust
- Build: frontend 22 rotas (0 erros)

### Sessão 20 — 23/02/2026
- **v1.00.15 "Motor V2" — Motor de execução V2 para workflow em grafo ✅ COMPLETA**
- Schema: blockId, responseData no WorkflowStepLog
- workflow-engine.service.ts reescrito (~530 linhas) com getProgressV1/V2, advanceStepV1/advanceBlockV2
- Validação por tipo de bloco, normalizeBranches(), auto-complete de blocos sistema
- Tela mobile técnico reescrita com UI específica por BlockType
- Build: 22 rotas, 0 erros

### Sessão 21 — 23/02/2026
- **v1.00.16 "Motor de Automação" — Sistema de automação event-driven ✅ COMPLETA**
- AutomationRule + AutomationExecution models no Prisma
- AutomationService (CRUD paginado), AutomationEngineService (motor de execução)
- Dispatch de eventos em ServiceOrderService (os_created, os_updated, os_assigned, os_status_changed)
- Frontend: builder guiado QUANDO→SE→ENTÃO, automation-blocks.ts com tipos/campos/operadores
- Ações: SEND_NOTIFICATION, CHANGE_STATUS, LAUNCH_FINANCIAL
- Build: 22 rotas, 0 erros

### Sessões 22-23 — 23/02/2026
- **v1.00.17 "Financeiro Expandido" ✅**
- **v1.00.18 "Campos & Ações" ✅**
- **v1.00.19 "Parceiro Automatizado" ✅**
- (Detalhes no CHAT_LOG.md)

### Sessões 24-25 — 23/02/2026
- **v1.00.20 "Decisão Binária" ✅** — ConditionNode com trueBranch/falseBranch
- **v1.00.21 "Canvas Visual" ✅** — Canvas SVG drag-and-drop com blocos e conexões
- **v1.00.22 "Templates & Debug" ✅** — Templates prontos, simulação, timeline de execuções

### Sessão 26 — 23/02/2026 (sessão atual)
- Continuação de sessão que ficou sem contexto
- Criado workflow complexo "Atendimento Técnico Completo" (21 blocos, 3 conditions)
- Testada resiliência da árvore (add/remove blocos no meio sem quebrar)
- Criadas 3 automações (financeiro, notificação, alerta por valor)
- Simulados 4 cenários completos de workflow (todos os caminhos)
- Verificados lançamentos financeiros (4 OS confirmadas, R$ 1.080 bruto)
- Fix V2 workflow na página de detalhe da OS (normaliseWfSteps)
- **⚠️ DESENTENDIMENTO IDENTIFICADO:** Juliano apontou que Automação e Fluxo de Atendimento deveriam ser UM ÚNICO sistema — motor central com blocos de encaixe tipo quebra-cabeça
- Logs consolidados: 5 arquivos → 2 (PROJETO_LOG.md + CHAT_LOG.md)

### Sessão 27 — 23/02/2026
- **v1.00.23 "Fluxo Unificado"** — Unificação dos sistemas Workflow + Automação
- Criado `flow-blocks.ts` — Sistema unificado de 22 tipos de blocos em 7 categorias:
  - TRIGGER (Gatilho), FIELD (Campo/Técnico), CONDITION (Condição), SYSTEM (Sistema),
  - COMMUNICATION (Comunicação), FINANCIAL (Financeiro), INTEGRATION (Integração)
- Implementados componentes puzzle-piece estilo MIT App Inventor:
  - `PuzzleBlock.tsx` — Bloco visual com SVG puzzle shape (cap/stack/wrap/end)
  - `PuzzlePalette.tsx` — Sidebar com blocos por categoria (accordion colapsável)
  - `BlockConfigPanel.tsx` — Painel de configuração com campos dinâmicos
  - `FlowBuilder.tsx` — Builder principal com empilhamento vertical e branching SIM/NÃO
- Reconstruída página `/workflow` com suporte a formatos v1/v2/v3:
  - v3 = FlowDefinition (children arrays) — novo formato
  - Conversão automática v2→v3 e v3→v2 para backward compat
  - Cards com trigger info, badges de categoria, contagem de blocos
- Sidebar atualizada: removido "Automações", mantido "Fluxo de Atendimento"
- WorkflowEngineService estendido:
  - Suporte v3 com conversão automática para v2 no engine
  - `executeSystemBlock()` executa ações de blocos auto-completados:
    STATUS_CHANGE, FINANCIAL_ENTRY, NOTIFY, ALERT, WEBHOOK, ASSIGN_TECH, DUPLICATE_OS, DELAY, SLA, RESCHEDULE
  - Injetado FinanceService para lançamento financeiro automático
- Ambos builds (backend + frontend) passando sem erros

### Sessão 28 — 23/02/2026
- **Visual Overhaul:** Redesign dos blocos puzzle para estilo MIT App Inventor autêntico
- `PuzzleBlock.tsx` reescrito com:
  - Preenchimento sólido colorido (antes: 12% opacidade → agora: 100%)
  - Texto branco sobre fundo colorido (antes: texto colorido sobre branco)
  - Tabs/notches maiores com curvas Bézier (TAB_H 10px, TAB_W 28px)
  - Notch lateral esquerda estilo MIT App Inventor
  - Drop-shadow com cor do bloco para destaque visual
  - Indicador de ação do técnico (dot branco)
- `FlowBuilder.tsx` redesenhado:
  - Canvas escuro (slate-800/900) com grid de pontos — faz blocos coloridos brilharem
  - Toolbar escura profissional com badge de contagem
  - Botões de ação translúcidos para canvas escuro
- `PuzzlePalette.tsx` atualizada:
  - Fundo escuro (slate-900) combinando com canvas
  - Blocos da paleta com fundo sólido colorido
  - Categorias accordion com estilo consistente
- Resultado: visual autêntico de MIT App Inventor com peças coloridas sobre fundo escuro
- Build frontend passando sem erros

### Sessão 29 — 23/02/2026
- **Rendering Blockly autêntico** — PuzzleBlock reescrito com SVG exato do Google Blockly
- **Fix NOTIFY block:** Removido campo "Especialização" (não pertencia a este bloco)
- **Fix ASSIGN_TECH block:** Adicionado multi-select checklist para especializações + estratégia "Técnico Atribuído (da OS)"
- **DynamicOptions pattern:** Campo `optionsFrom` resolve opções a partir de dados carregados do banco (especializations, technicians)
- **showWhen condicional:** Campos exibidos/ocultos baseado no valor de outros campos
- **Fix API limit:** Partners API retornava 400 com limit=500 (PaginationDto tem @Max(100)) → corrigido para limit=100&type=TECNICO
- Build: backend 0 erros, frontend 0 erros

### Sessão 30 — 23/02/2026
- **v1.00.24 "Atribuir Técnico"** — Campo de atribuição nos formulários de OS
- **Schema:** 3 novos campos em ServiceOrder: techAssignmentMode, requiredSpecializationIds, directedTechnicianIds
- **Backend DTOs:** Campos adicionados em CreateServiceOrderDto e UpdateServiceOrderDto
- **Backend Service:** create/update/duplicate salvam novos campos, update com checkField
- **Endpoints paginados:** GET /specializations e GET /workflows agora suportam search + paginação ({ data, meta })
- **MultiLookupField:** Novo componente reutilizável — multi-select com chips + SearchLookupModal (toggle on/off, checkbox visual)
- **TechAssignmentSection:** Componente compartilhado com 3 radio buttons:
  - "Todos com a seguinte especialização" → MultiLookupField para especializações
  - "Técnicos direcionados" → MultiLookupField para técnicos
  - "Por fluxo de atendimento" → LookupField para workflows
- **Integração:** Inserido entre Descrição e Endereço nos formulários new + edit de OS
- **Edit pré-população:** Resolve IDs salvos para objetos (specializations, technicians, workflow) no carregamento
- **Backward compat:** Consumidores antigos de /specializations e /workflows atualizados para { data, meta }
- Build: backend 0 erros, frontend 0 erros

### Sessão 31 — 23/02/2026
- **v1.00.25 "NOTIFY Multi-Destinatário"** — Redesign do bloco NOTIFY + campo Contato no Local
- **Schema:** Novo campo `contactPersonName String?` em ServiceOrder
- **Backend DTOs:** Campo adicionado em Create e Update DTOs
- **Backend Service:** create/update/duplicate salvam contactPersonName
- **Backend Engine (workflow-engine.service.ts):** NOTIFY case reescrito (~100 linhas):
  - Carrega OS completa com relações (assignedPartner, clientPartner, company)
  - 20+ variáveis de template: {titulo}, {descricao}, {valor}, {comissao}, {valor_tecnico}, {endereco}, {contato_local}, {cliente}, {tecnico}, {prazo}, etc.
  - Multi-destinatário via `config.recipients[]` array
  - Backward compat com formato antigo (single config.recipient)
  - Resolução de telefone/email por tipo de destinatário
- **Frontend — Campo "Contato no Local":**
  - Adicionado em ambos formulários (new + edit) entre Descrição e Atribuir Técnico
  - Pré-populado na edição a partir de `order.contactPersonName`
  - Incluído no payload de submit
- **Frontend — flow-blocks.ts redesenhado:**
  - Novo tipo de campo `recipients` no FlowConfigField
  - `NotifyRecipient` interface (type, enabled, channel, message)
  - `NOTIFY_TEMPLATE_VARS` — 15 variáveis agrupadas (OS, Financeiro, Pessoas)
  - `DEFAULT_NOTIFY_RECIPIENTS` — templates padrão para Gestor, Técnico, Cliente
  - Bloco NOTIFY com configField `recipients` em vez dos antigos channel/recipient/message
- **Frontend — BlockConfigPanel.tsx:**
  - Novo case `recipients` no ConfigField:
    - Checkbox enable/disable por destinatário (Gestor, Técnico, Cliente)
    - Select de canal (WhatsApp/SMS/Email) por destinatário
    - Textarea de mensagem com placeholder contextual
    - Chips de variáveis clicáveis para inserção rápida
- Build: backend 0 erros, frontend 0 erros (22 rotas)

### Sessão 32 — 24/02/2026
- **v1.00.26 "Aguardar Verificando"** — Novo bloco WAIT_FOR para workflow
- **Infraestrutura de Scheduler:**
  - Instalado `@nestjs/schedule` (cron nativo NestJS, sem Redis)
  - `ScheduleModule.forRoot()` registrado em app.module.ts
- **Schema:**
  - Novo enum `WaitStatus` (WAITING, TRIGGERED, EXPIRED, CANCELLED)
  - Novo model `PendingWorkflowWait` com indexes otimizados:
    - `@@index([status, expiresAt])` — cron polling eficiente
    - `@@index([serviceOrderId, status])` — busca por evento
  - Campos: blockId, nextBlockId, technicianId, stepOrder, expiresAt, triggerConditions (JSON), targetStatus, timeoutAction
- **Frontend — flow-blocks.ts:**
  - `WAIT_FOR` adicionado ao type union `FlowBlockType`
  - Entrada no FLOW_CATALOG com 4 configFields:
    - `timeoutMinutes` (number) — tempo limite em minutos
    - `triggerConditions` (checklist) — 4 condições de trigger antecipado
    - `targetStatus` (select, showWhen) — status alvo para condição "Status mudar"
    - `timeoutAction` (select) — ação ao expirar (continuar / encerrar)
- **Frontend — BlockConfigPanel.tsx:**
  - `shouldShowField` corrigido para arrays (checklist como currentVal)
- **Backend — WaitForService (novo):**
  - `checkEarlyTrigger()` — chamado por eventos da OS, mapeia eventType → conditionKey
  - `handleExpiredWaits()` — `@Cron(EVERY_MINUTE)` para expirar waits
  - `resolveWait()` — atualização atômica (previne processamento duplo)
  - `resumeWorkflow()` — chama `WorkflowEngineService.resumeFromBlock()`
  - Cancelamento automático de waits quando OS é cancelada
- **Backend — WorkflowEngineService modificado:**
  - While-loop em `advanceBlockV2()`: detecta WAIT_FOR → cria PendingWorkflowWait → BREAK
  - Novo método `resumeFromBlock()` — re-entra no loop de auto-execução a partir de blockId
  - `getProgressV2()` atualizado: WAIT_FOR com status WAITING = não completado
- **Integração:**
  - `WorkflowModule` registra e exporta WaitForService
  - `ServiceOrderModule` importa WorkflowModule
  - `ServiceOrderService.dispatchAutomation()` chama `waitForService.checkEarlyTrigger()` fire-and-forget
- Build: backend 0 erros, frontend 0 erros

### PLANO MESTRE (integrado do antigo PLANO_MESTRE.md)
- **Fases 0-9:** 61 de 73 etapas concluídas (84%)
- **Pendentes:** 4.5 GPS Tracking, 4.7 PWA, 8.2 Notificação Proximidade, 9.4 Validação Forms, Fase 10 (Testes/Deploy)
- **v1.00.16~v1.00.22:** Motor de automação com 6 fases implementadas
- **v1.00.23:** Unificação Workflow + Automação em motor central "Fluxo de Atendimento"
- **v1.00.24:** Campo Atribuir Técnico nos formulários de OS (3 modos + MultiLookupField)
- **v1.00.25:** NOTIFY Multi-Destinatário + campo Contato no Local + variáveis dinâmicas
- **v1.00.26:** Aguardar Verificando — bloco WAIT_FOR com timeout + early trigger por eventos
- **v1.00.27:** Pipeline Builder — redesign do workflow builder para interface intuitiva (Template + Pipeline + Recipes)

### Sessão 33 — 23/02/2026
- **v1.00.27 "Pipeline Builder"** — Redesign completo do workflow builder
- **Motivação:** Builder puzzle-piece muito complexo para gestores não-técnicos
- **Solução:** Pipeline Builder — camada UI intuitiva sobre FlowDefinition V3 existente
- **Arquitetura:**
  - PipelineDefinition (v4) → compilePipeline() → FlowDefinition (v3) → backend (sem mudança)
  - decompilePipeline() → converte V3 de volta para Pipeline (null se branching)
  - FlowBuilder mantido como "Modo Avançado" (toggle bidirecional)
- **Tipos e catálogos (`pipeline-types.ts`):**
  - 8 ações do técnico (STEP, PHOTO, NOTE, GPS, CHECKLIST, SIGNATURE, FORM, QUESTION)
  - 8 ações automáticas (NOTIFY, FINANCIAL_ENTRY, WEBHOOK, ALERT, ASSIGN_TECH, DUPLICATE_OS, DELAY, SLA)
  - 7 estágios padrão (incluindo A_CAMINHO)
  - 7 receitas prontas + 5 templates de pipeline completos
- **10 componentes criados:**
  - TemplateGallery, PipelineBuilder, PipelineStageBar, StageConfigPanel
  - TechActionList, AutoActionList, RecipeEditor, RecipeGallery
- **View state machine:** list → template_gallery → pipeline → advanced
- **Schema Prisma:** A_CAMINHO adicionado ao enum ServiceOrderStatus
- Build: backend 0 erros, frontend 0 erros

### Sessão 34 — 24/02/2026
- **v1.00.28 "Formulário de Etapas"** — Redesign radical do workflow builder
- **Motivação:** Pipeline Builder (v1.00.27) não funcionava — formato V3 rejeitado pela validação do backend que só aceita V2. Além disso, Juliano pediu abordagem muito mais simples: página scrollável com toggles.
- **Decisão:** Apagar TUDO do builder antigo (13 arquivos) e criar formulário de etapas
- **13 arquivos deletados:** FlowBuilder, PipelineBuilder, PuzzleBlock, PuzzlePalette, BlockConfigPanel, TemplateGallery, PipelineStageBar, StageConfigPanel, TechActionList, AutoActionList, RecipeEditor, pipeline-types.ts, pipeline-compiler.ts
- **Novo modelo de dados (`stage-config.ts`):**
  - StageConfig: cada status OS = seção com toggles (8 ações técnico + 8 auto + 3 tempo)
  - WorkflowFormConfig: nome + stages[] + triggerEvent
  - 5 presets prontos (Instalação, Manutenção, Vistoria, Urgente, Simples)
  - compileToV2(): converte StageConfig[] → WorkflowDefV2 (linked-list com next pointers)
  - decompileFromV2(): converte V2/V1/V3 → StageConfig[] (para edição de workflows existentes)
- **StageSection.tsx:** componente reutilizável para uma etapa (toggles + configs inline)
- **page.tsx reescrita:** 2 views simples (list + form), presets, save/load
- **Formato de salvamento:** V2 (version: 2, blocks com START/END) — compatível com validação backend
- Build: frontend 0 erros, 22 rotas

### Sessão 35 — 24/02/2026
- **v1.00.29 "Etapas Enriquecidas"** — Polimento e enriquecimento do formulário de etapas
- **Reordenação de seções:** Ações Automáticas agora vem ANTES de Ações do Técnico (pedido do Juliano)
- **discardBusyTechnicians:** Nova opção na seleção de técnicos — descartar técnicos em atendimento no prazo de aceite
- **Link reestruturado:** techLink movido para dentro de messageDispatch.toTechnicians.link (não mais separado)
- **LinkPageBlock & Layout:** 13 campos fixos (10 info + 3 texto livre), todos reordenáveis com ▲▼ e toggleáveis
- **GPS Button rename:** "Botão de navegação GPS" → "Botão de ativação GPS" com texto explicativo
- **Explicações:** Hint text adicionado para alert e webhook (notificação visual no painel / integração com ERP)
- **Pergunta para o técnico (techQuestion):**
  - Nova ação automática na etapa ABERTA com toggle + configuração completa
  - Campo de pergunta, lista de opções com ação por opção (accept, reject, reschedule, notify_gestor, none)
  - Checkboxes: obrigatória, exibir na página do link
  - Auto-sync bidirecional: techQuestion ↔ techActions.question
  - Compilador: gera bloco QUESTION com optionActions enriquecido
  - Decompilador: detecta optionActions → popula techQuestion (rich) vs question simples
  - QUESTION_ACTIONS constant com 5 ações possíveis
- **Regra estabelecida:** Atualizar version.json + PROJETO_LOG + CHAT_LOG a cada implementação (padrão do projeto)
- Build: frontend 0 erros, 22 rotas

### Sessão 35 (continuação) — 24/02/2026
- **v1.00.30 "Fluxos Operacionais"** — Bug fix edição + duplicar + melhorias
- **Bug fix:** handleEdit fazia `res.data` mas `api.get` já retorna o dado diretamente → fluxo não abria para edição
- **Bug fix:** loadWorkflows tinha `res.data?.data ?? res.data` redundante → simplificado para `res.data`
- **Botão Duplicar:** Adicionado entre Editar e Excluir nos cards de fluxo (cor violeta, cria cópia com nome "(cópia)")
- **Múltiplos fluxos:** Sistema já suporta criar, editar, duplicar e excluir múltiplos fluxos
- Build: frontend 0 erros, 22 rotas

### Sessão 35 (continuação 2) — 24/02/2026
- **v1.00.31 "Persistência Sólida"** — Fix 3 bugs de round-trip salvar/reabrir fluxo
- **Bug 1 (CRÍTICO):** Decompilador não setava `messageDispatch.enabled = true` ao processar NOTIFY blocks. Resultado: ao reabrir, a seção inteira ficava oculta e ao salvar novamente os dados ricos (linkConfig, pageLayout) eram perdidos permanentemente
- **Bug 2 (ALTO):** Compilador fazia `.filter(b => b.enabled)` no pageLayout, descartando blocos desabilitados. No round-trip, blocos desativados desapareciam. Fix: salva TODOS os blocos (flag enabled preservado). Decompilador agora faz merge com defaults (suporta blocos adicionados em futuras versões)
- **Bug 3 (MÉDIO):** Compilador gerava 2 blocos QUESTION duplicados quando techQuestion + techActions.question estavam ambos habilitados (auto-sync). Fix: pula techActions.question se techQuestion já emitiu o bloco
- Build: frontend 0 erros, 22 rotas

### Sessão 35 (continuação 3) — 24/02/2026
- **v1.00.32 "Accordion Etapas"** — Expandir/minimizar independente do toggle ativo/desativado
- Etapas agora podem ser minimizadas mesmo quando ativas (antes só colapsava ao desativar)
- Ao ativar uma etapa, ela expande automaticamente
- Quando minimizada, exibe badges resumo das ações configuradas (⚡ Auto, 👷 Técnico, ⏱️ Tempo)
- Seta ▶/▼ indica estado expandido/minimizado, clique no header alterna
- Toggle ativo/desativado no canto direito, independente do expand/collapse
- Build: frontend 0 erros, 22 rotas

### Sessão 35 (continuação 4) — 24/02/2026
- **v1.00.33 "Seleção Limpa"** — Remoção de campo redundante
- Juliano identificou que "Todos com a especialização da OS" (radio) e "Filtrar apenas técnicos com a especialização da OS" (checkbox) eram a mesma coisa
- Removido checkbox `filterBySpecialization` da UI — redundante com método de seleção `BY_SPECIALIZATION`
- Campo mantido no tipo/compiler/decompiler para backward compat (valor continua no JSON), apenas removido da interface visual
- Build: frontend 0 erros, 22 rotas

### Sessão 36 — 24/02/2026
- **v1.00.34 "Aceite Completo"** — Campo "Tempo para aceite" na edição de OS + textos anti-redundância
- Nova regra permanente: SEMPRE atualizar CHAT_LOG + PROJETO_LOG antes E depois de cada modificação
- **Edição de OS (edit/page.tsx):** adicionado state acceptTimeoutMode/Value, carrega do backend (converte minutos→horas quando divisível por 60), salva no handleSubmit (converte horas→minutos, null para from_flow)
- **Textos explicativos (anti-redundância):**
  - Criação/Edição OS: "Quanto tempo o técnico tem para aceitar esta OS antes de expirar", hints por opção, aviso âmbar "⚠️ Este valor sobrescreve a configuração do fluxo"
  - Workflow: "Quanto tempo o técnico tem para aceitar antes de expirar", hints por opção, aviso âmbar "⚠️ A OS pode sobrescrever este tempo com um valor próprio"
  - "Prazo" renomeado para "Prazo de execução" com hint "Data limite para concluir o serviço" (diferencia de tempo de aceitar)
- Build: frontend 0 erros, 22 rotas

### Sessão 36 (continuação) — 24/02/2026
- **v1.00.35 "Tempos e Variáveis"**
- Renomeado "aceite" → "aceitar" em todas as UIs (workflow, criação OS, edição OS)
- **Novo campo "Tempo para clicar a caminho" (enRouteTimeout):**
  - Workflow: `enRouteTimeout` em `techSelection` (mode fixed/from_os, value, unit) + UI com radio buttons verdes
  - OS Criação: state + localStorage + UI com radio buttons verdes + submit enRouteTimeoutMinutes
  - OS Edição: state + load do backend + UI + submit
  - Backend: `enRouteTimeoutMinutes Int?` no Prisma, CreateDTO, UpdateDTO, create/update/duplicate no service
- **Variáveis no disparo de mensagens:**
  - Frontend: `{tempo_aceitar}` e `{tempo_a_caminho}` adicionados ao NOTIFY_VARS (13 variáveis total)
  - Backend: variáveis no engine de substituição com formatação inteligente (ex: "2h" ou "30 min" ou "Definido no fluxo")
- Compiler/Decompiler atualizados para `enRouteTimeout` (round-trip seguro)
- Build: frontend 0 erros 22 rotas, backend 0 erros TypeScript
- Nota: Prisma generate bloqueado por processo em execução — self-healing cria coluna no startup

### Sessão 36 (continuação 2) — 24/02/2026
- **v1.00.36 "Etapas Inteligentes"**
- Auditoria completa de todas as 7 etapas do workflow identificou 9 problemas de campos em etapas erradas
- Nova regra: ser crítico com pedidos, questionar equívocos e redundâncias
- **Refatoração StageSection.tsx — renderização por etapa:**
  - ABERTA: seleção (método + máx. técnicos + discardBusy), despacho de mensagens, pergunta ao técnico
  - OFERTADA: card amber para acceptTimeout/onTimeout
  - ATRIBUÍDA: card green para enRouteTimeout
  - financialEntry apenas em CONCLUÍDA/APROVADA, duplicateOS apenas em CONCLUÍDA
  - assignTech (simples) removido de ABERTA/OFERTADA/ATRIBUÍDA/A_CAMINHO
  - techActions (ações do técnico) removidos de ABERTA/OFERTADA com hint explicativo
  - Textos explicativos sobre dependência entre etapas
- **Compiler cross-stage:** ASSIGN_TECH coleta dados de 3 etapas (ABERTA+OFERTADA+ATRIBUÍDA)
- **Decompiler cross-stage:** `mapBlockToStage` distribui ASSIGN_TECH para as 3 etapas (backward compat)
- **Correção pós-auditoria:** discardBusyTechnicians movido de OFERTADA → ABERTA (é critério de seleção, não de aceite)
- Build: frontend 0 erros 22 rotas, tsc 0 erros

### Sessão 37 — 24/02/2026
- **v1.00.37 "Etapas Inteligentes"** — Feature: Pergunta de tempo estimado de chegada (arrivalQuestion)
- **Nova interface ArrivalTimeOption** e campo `arrivalQuestion` em autoActions
- **Regras de negócio implementadas:**
  - Técnico não pode informar tempo > enRouteTimeout (validação visual no configurador + regra no mobile futuramente)
  - Fluxo de erro: re-informar ou "não vou poder atender"
  - onDecline configurável: notificar gestor, redistribuir, voltar fila, cancelar
  - useAsDynamicTimeout: tempo escolhido substitui timeout, enRouteTimeout vira teto
- **Compiler:** emite bloco ARRIVAL_QUESTION na ATRIBUÍDA
- **Decompiler:** reconstrói arrivalQuestion a partir de bloco ARRIVAL_QUESTION
- **UI (StageSection):** card azul na ATRIBUÍDA com opções de tempo, warnings visuais, toggles de notificação
- **NOTIFY_VARS:** nova variável `{tempo_estimado_chegada}` (14 total)
- **ON_DECLINE_OPTIONS:** 4 ações configuráveis para recusa
- Build: frontend 0 erros 22 rotas, tsc 0 erros

### Sessão 37 (continuação) — 24/02/2026
- **v1.00.38 "Etapas Inteligentes"** — Backend Fase 2: arrivalQuestion no engine
- **Prisma:** `estimatedArrivalMinutes Int?` no ServiceOrder + self-healing migration
- **Workflow Engine:**
  - ARRIVAL_QUESTION em ACTIONABLE_TYPES (engine pausa e espera resposta)
  - Validação: selectedMinutes >= 1 e <= enRouteTimeoutMinutes da OS
  - Salvamento de estimatedArrivalMinutes na transaction
  - **Fix crítico:** ARRIVAL_QUESTION NÃO transiciona ATRIBUÍDA → EM_EXECUÇÃO
- **Template variable:** `{tempo_estimado_chegada}` com formatação inteligente
- Build: backend tsc 0 erros, frontend tsc 0 erros

### Sessão 37 (continuação 2) — 24/02/2026
- **v1.00.39 "Etapas Inteligentes"** — Fase 3: Mobile arrivalQuestion
- **Backend endpoints públicos:**
  - `POST /p/:token/arrival-time` — valida tempo, salva estimatedArrivalMinutes
  - `POST /p/:token/decline` — executa onDecline (return_offered/reassign/cancel/notify_gestor)
  - `acceptWithOtp` retorna arrivalQuestion config do workflow
- **Frontend /p/[token] reescrita:**
  - Fluxo completo: loading → offer → otp → arrival → done/declined/error
  - UI mobile-first com cards, opções de tempo, validação visual, botão de recusa
- Build: backend tsc 0 erros, frontend tsc 0 erros, next build 22 rotas 0 erros

### Sessão 38 — 24/02/2026
- **v1.00.40 "Etapas Inteligentes"** — GPS Proximity Tracking (Rastreamento por Proximidade)
- **Frontend stage-config.ts:**
  - Novo tipo `proximityTrigger` em autoActions (radiusMeters, trackingIntervalSeconds, requireHighAccuracy, keepActiveUntil, onEnterRadius)
  - `KEEP_ACTIVE_OPTIONS` constante: 'radius' (desliga ao chegar) ou 'execution_end' (mantém até concluir)
  - Nova NOTIFY_VAR: `{distancia_tecnico}` (16 variáveis total)
  - Factory defaults: raio 200m, intervalo 30s, alta precisão, notifica cliente
  - Presets atualizados: Instalação (200m), Vistoria (100m + alta precisão + autoStart + execution_end)
  - Compiler: emite bloco `PROXIMITY_TRIGGER` na etapa A_CAMINHO
  - Decompiler: case `PROXIMITY_TRIGGER` reconstrói configuração
- **Frontend StageSection.tsx:**
  - Card roxo na A_CAMINHO: toggle, slider raio (50-5000m), intervalo, precisão
  - Radio keepActiveUntil (até raio / até fim do atendimento)
  - Eventos ao entrar no raio: notificar cliente/gestor, auto-iniciar execução, alerta dashboard
  - Mensagens com suporte a variáveis de template
- **Backend Prisma:**
  - `trackingStartedAt DateTime?`, `proximityEnteredAt DateTime?`, `proximityRadiusMeters Int?` na ServiceOrder
  - Novo modelo `TechnicianLocationLog` (id, companyId, serviceOrderId, partnerId, lat, lng, accuracy, speed, heading, distanceToTarget)
  - Self-healing migration: cria tabela e colunas se não existem
- **Backend endpoints públicos:**
  - `POST /p/:token/start-tracking` — inicia tracking, retorna config com target lat/lng
  - `POST /p/:token/position` — recebe posição, salva log, calcula distância via haversineMeters(), detecta proximidade
  - `GET /p/:token/tracking-config` — retorna config de proximidade do workflow
- **Frontend /p/[token]:**
  - Novos estados: `tracking` (GPS ativo) e `arrived` (chegou ao local)
  - Tela de tracking: distância em tempo real, barra de progresso, última atualização
  - watchPosition() com throttle por intervalo configurado
  - Botão manual "Cheguei no local" como fallback
  - Oferta de GPS na tela "done" após aceitar OS
  - Cleanup automático do watchPosition no unmount
- **Workflow Engine:** `{distancia_tecnico}` nas variáveis de substituição NOTIFY
- Build: backend tsc 0 erros, frontend tsc 0 erros, next build 22 rotas 0 erros

### Sessão 39 — 24/02/2026
- **v1.00.41 "Etapas Inteligentes"** — onEnterRadius Event Dispatch + {distancia_tecnico} dinâmico
- **TODO 1 resolvido: onEnterRadius event dispatch** no `submitPosition()`:
  - `PublicOfferModule` agora importa `NotificationModule` (injeção de `NotificationService`)
  - `PublicOfferService` recebe `NotificationService` + Logger
  - Novo método privado `executeOnEnterRadius()` executado fire-and-forget ao técnico entrar no raio:
    - Notifica cliente (se `onEnterRadius.notifyCliente.enabled`) via canal configurado com substituição de variáveis
    - Notifica gestor (se `onEnterRadius.notifyGestor.enabled`) via canal configurado com substituição de variáveis
    - Auto-inicia execução (se `autoStartExecution`) — muda status para EM_EXECUÇÃO + cria ServiceOrderEvent PROXIMITY_AUTO_START
    - Cria alerta no dashboard (se `onEnterRadius.alert.enabled`) como Notification PROXIMITY_ALERT
  - `submitPosition()` agora carrega OS com relações (workflowTemplate, assignedPartner, clientPartner, company) para ter dados completos
- **TODO 2 resolvido: {distancia_tecnico} dinâmico** no `WorkflowEngineService`:
  - Case NOTIFY agora consulta última entrada do `TechnicianLocationLog` via `$queryRawUnsafe` (ORDER BY createdAt DESC LIMIT 1)
  - Formata distância: >= 1000m → "X.X km", < 1000m → "Xm"
  - Fallback seguro com try/catch (tabela pode não existir)
- Build: backend tsc 0 erros, frontend tsc 0 erros, next build 22 rotas 0 erros

### Sessão 40 — 24/02/2026
- **v1.00.42 "Sistema de Pausas"** — ✅ CONCLUÍDO
- Pedido do Juliano: fotos do "durante" para atendimentos demorados (almoço, noite, final de semana)
- **Schema**: `ServiceOrder` + isPaused/pausedAt/pauseCount/totalPausedMs, novo model `ExecutionPause`
- **Config**: `pauseSystem` no timeControl (EM_EXECUÇÃO), `PAUSE_REASON_CATEGORIES` (10 motivos pré-configurados), compilador/decompilador bloco PAUSE_SYSTEM
- **Backend**: 3 novos endpoints `/p/:token/pause`, `/resume`, `/pause-status` com validação, notificações e transações atômicas
- **Mobile**: 4 novos estados (executing, pausing, paused, resuming) com seleção de motivo e botões pausar/retomar
- **Dashboard**: badge "⏸️ Pausada" na lista e detalhe de OS
- **Variáveis**: `{pausas}` e `{tempo_pausado}` no motor de notificações
- Build: backend tsc 0 erros, frontend tsc 0 erros, next build 22 rotas 0 erros

### Sessão 41 — 25/02/2026
- **v1.00.43 "Ajustes de Pausas + Financeiro"** — ✅ CONCLUÍDO
- Notificações de pausa expandidas: 3 destinatários × 2 eventos = 6 slots (canal + mensagem por slot)
- Redundância de fotos resolvida: removidas do pauseSystem, ficam apenas em photoRequirements (on_pause/on_resume)
- Financeiro expandido: 7 tipos de lançamento, 6 fontes de valor, lista editável com autoCreate
- Auditoria geral: nenhuma opção sem sentido grave — filtragem por etapa já bem feita
- Build: backend tsc 0 erros, frontend tsc 0 erros, next build 22 rotas 0 erros

### Sessão 42 — 25/02/2026
- **Página de Demo do Fluxo Completo** — ✅ CONCLUÍDO
- Pedido do Juliano: emular celular do técnico + WhatsApp do gestor e cliente para testar fluxo completo
- Nova rota `/demo` com 3 colunas: phone frame (técnico), WhatsApp (gestor), WhatsApp (cliente)
- Fluxo completo: Ofertada → Aceita → A Caminho → Chegou → Executando → Pausada → Retomada → Concluída
- Notificações simuladas em tempo real para gestor (7 msgs) e cliente (5 msgs)
- Lançamentos financeiros na conclusão, fotos obrigatórias na chegada, timer + checklist na execução
- Teste visual: todas as 8 etapas OK, notificações OK, pausas OK, financeiro OK

### Sessão 43 — 25/02/2026
- **Limpeza de campos desnecessários na CONCLUÍDA (etapa 6)** — ✅ CONCLUÍDO
- Removidos 4 campos que não faziam sentido: assignTech, duplicateOS, step, photo
- Motivo: redundância com EM_EXECUÇÃO (fotos/atividade) e incoerência lógica (atribuir tech/duplicar OS após conclusão)
- Build: frontend tsc 0 erros, next build 22 rotas 0 erros

### Sessão 44 — 25/02/2026
- **Auditoria completa — 7 etapas** — ✅ CONCLUÍDO
- Etapas 1,2,5,6: OK
- Etapa 3 ATRIBUÍDA: removida signature (cliente não presente)
- Etapa 4 A_CAMINHO: removida signature (técnico em trânsito)
- Etapa 7 APROVADA: removidos assignTech, duplicateOS, TODAS ações do técnico (etapa gerencial)
- Build: frontend tsc 0 erros, next build 22 rotas 0 erros

### Sessão 45 — 25/02/2026
- **Aprovação do gestor na CONCLUÍDA** — ✅ CONCLUÍDO
- Novo campo `gestorApproval`: gestor analisa fotos/checklist/documentos e aprova ou reprova
- Ao aprovar: avança para APROVADA + notificações configuráveis
- Ao reprovar: 3 ações (voltar execução, voltar atribuída, apenas notificar) + motivo obrigatório
- Variável `{motivo_rejeicao}` + compilador/decompilador GESTOR_APPROVAL
- Presets Instalação e Manutenção atualizados com aprovação ativada
- Build: frontend tsc 0 erros, next build 22 rotas 0 erros

### Sessão 46 — 25/02/2026
- **Aprovar com ressalvas no gestorApproval** — ✅ CONCLUÍDO
- Novo campo `onApproveWithReservations`: habilitar opção, exigir nota, ajuste de comissão (% ou fixo), flag qualidade
- Variável `{ressalvas}` + constante COMMISSION_ADJUSTMENT_TYPES
- Compilador/decompilador incluem onApproveWithReservations no bloco GESTOR_APPROVAL
- Presets: Instalação (reduz 10%), Manutenção (reduz 15%)
- UI: seção amber entre Aprovar e Reprovar com toggles, ajuste comissão e notificações
- Build: backend tsc 0 erros, frontend tsc 0 erros, next build 22 rotas 0 erros

### Sessão 47 — 25/02/2026
- **Auditoria completa do sistema** — ✅ CONCLUÍDO (apenas leitura)
- 5 agentes: backend, frontend, segurança, banco, qualidade de código
- Relatório: 6 críticas, 8 high, 12 medium. Nota 6.5/10

### Sessão 48 — 25/02/2026
- **Security Hardening para produção** — ✅ CONCLUÍDO
- JWT Secret: validação obrigatória (32+ chars), sem fallback inseguro
- Helmet instalado: headers XSS, HSTS, CSP, X-Frame-Options
- Rate limiting: login 10/15min, OTP 5/10min, avaliação 5/hora
- OTP log removido de produção (só debug em dev)
- Senha mínima 8 chars, CORS com env var, env validation no startup
- Middleware server-side no frontend (proteção de rotas)
- Error boundary (error.tsx) + 404 (not-found.tsx)
- Build: backend tsc 0 erros, frontend tsc 0 erros, next build 22 rotas + middleware 0 erros

### Sessão 49 — 25/02/2026
- **Infraestrutura de Deploy Docker + Nginx** — ✅ CONCLUÍDO
- Dockerfile backend multi-stage (builder + prod, non-root user, healthcheck)
- Dockerfile frontend atualizado (non-root, healthcheck)
- docker-compose.production.yml (postgres + backend + frontend + nginx, healthchecks)
- nginx.conf (HTTPS, gzip, rate limiting zones, reverse proxy, Let's Encrypt support)
- .env.production.example (template completo)
- scripts/deploy-production.sh (validação env + SSL auto + build + migrate + up)
- Build: backend tsc 0 erros, frontend tsc 0 erros

### Sessão 50 — 25/02/2026
- **Swagger, Logger, CI/CD, Health endpoint** — ✅ CONCLUÍDO
- Swagger/OpenAPI em /api/docs (dev only) com 14 tags e 20 controllers documentados
- Plugin @nestjs/swagger para introspecção automática de DTOs
- console.log/error → NestJS Logger em todo o backend (zero console.* restantes)
- Request logger com levels (error 5xx, warn 4xx, log 2xx)
- GitHub Actions CI: backend tsc+build, frontend tsc+build, docker build
- Health /health/db (verifica banco), /health com node version, env, startedAt
- Frontend Dockerfile com NEXT_PUBLIC_API_URL como build arg
- Build: backend tsc 0 erros, frontend tsc 0 erros

### Sessão 86 — 10/03/2026
- **Fix Foto Perfil Desfocada** (v1.01.86) — sharp v0.34.5 processa logo: quadrado + padding 10% + PNG
- **Tratamento Respostas CLT** (v1.01.87) — processWelcomeReply() classifica aceite/recusa por keywords configuráveis
  - Aceite: ativa técnico + envia mensagem retorno
  - Recusa: REJECTED + desativa e/ou notifica gestor
  - UI: seções verde (aceite) e vermelha (recusa) no workflow editor
- **Exibição Resposta Parceiro** (v1.01.88) — replyMessage no ContractsSection, status REJECTED, diferenciação CLT/PJ
- **Variáveis Clicáveis** (v1.01.89) — spans estáticos → botões com inserção na posição do cursor
- **Defaults + Fix Vírgula** (v1.01.90) — keywords pré-cadastradas, mensagens pré-preenchidas, filter só no onBlur
- Build: backend tsc 0 erros, frontend tsc 0 erros

### Sessoes 88-92 — 10/03/2026
- **Multi-Tenant Foundation** (v1.01.93-94) — schema por tenant, TenantConnectionService, provisionamento
- **SaaS Admin Panel** (v1.01.95-96) — painel admin em /ctrl-zr8k2x, gestao tenants/vouchers/planos
- **Landing Page + Signup** (v1.01.97-v1.02.04) — pagina publica, fluxo signup multi-step, integracao Asaas
- **Currency Input + Add-ons + Sidebar** (v1.02.05-09) — fix inputs monetarios, compra add-ons, reorganizacao sidebar
- **Tenant Onboarding** (v1.02.10) — sendSystemEmail, TenantOnboardingService (Company+User), CNPJ auto-fill BrasilAPI

### Sessao 93 — 10/03/2026
- **PPID Identity Verification** (v1.02.11) — integracao ppid.com.br no signup
  - PpidService: JWT auth, classify, OCR, liveness, face match
  - Pipeline fullVerification() com thresholds (liveness>=50, similaridade>=60)
  - Signup reescrito: 5 steps (Plano → Empresa → Verificacao Identidade → Pagamento → Sucesso)
  - Upload documento + selfie com preview, resultado aprovado/rejeitado
  - Graceful degradation: se PPID nao configurado, bypassa verificacao
- Build: backend tsc 0 erros, frontend tsc 0 erros
