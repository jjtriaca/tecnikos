# CHAT LOG — Histórico de Conversas e Decisões

---

## REGRA PERMANENTE (decidida pelo Juliano):
- **Claude decide toda a parte técnica sozinho e executa sem perguntar**
- Juliano não tem conhecimento técnico de construção
- Claude só para se for uma decisão de NEGÓCIO (funcionalidade, UX, prioridade do produto)
- Decisões técnicas (arquitetura, libs, padrões, ordem de implementação): Claude decide e faz

---

## Sessão 2 — 20/02/2026
**Contexto:** Juliano voltou após travamentos. Projeto parcialmente construído.

### Decisões tomadas:
- Criar sistema de log para não perder progresso entre sessões
- Criar PROJETO_LOG.md na raiz do projeto

### Pedidos do Juliano:
- Criar plano mestre completo com todas as etapas
- Gravar no log antes e depois de cada ação
- Mostrar % de progresso em vez de "Trabalhando nisso"
- Separar log do projeto e log de conversa
- Quando tela pronta depender de tela futura, marcar como pendência
- Ao iniciar novo chat e conectar pasta, Claude deve ler logs e retomar sozinho
- Juliano está aberto a sugestões de boas práticas

---

## Sessão 3 — 20/02/2026
**Contexto:** Sessão anterior travou. Juliano reconectou.

### Decisões tomadas:
1. **Login do técnico:** Senha simples (técnico recebe email+senha do gestor)
2. **Ordem de execução:** Claude decide (escolheu começar pela Fase 3 — telas gestor)
3. **Autonomia:** Claude decide toda parte técnica e executa sem perguntar

### O que foi feito:
- Lido PROJETO_LOG.md existente
- Criado PLANO_MESTRE.md com 70 etapas em 10 fases
- Criado CHAT_LOG.md (este arquivo)
- Atualizado PROJETO_LOG.md com regras de operação

### Próxima ação:
- Iniciando Fase 3.1 — Layout Autenticado (sidebar + header + navegação)

---

## Sessão 4 — 21/02/2026
**Contexto:** Continuação direta da Sessão 3 (mesma janela).

### O que foi feito:
- **Fase 3.1 CONCLUÍDA** — Layout Autenticado
  - Criado AuthContext com silentRefresh + in-memory token
  - Criado Sidebar com navegação RBAC (itens filtrados por papel)
  - Criado Header com nome do usuário, empresa e botão sair
  - Criado AuthLayout com sidebar colapsável e proteção de rota
  - Migrada tela de login com design profissional
  - Criadas 8 páginas placeholder no route group (dashboard)
  - Migrada página pública de oferta (/p/[token])
  - **GRANDE REFATORAÇÃO:** Consolidada estrutura de diretórios
    - Removido /frontend/app/ (antigo) e /frontend/lib/ e /frontend/components/
    - Tudo consolidado em /frontend/src/
    - Substituído axios por fetch-based API client (zero dependências)
    - Corrigido bug do cookie path no backend (/auth/refresh → /auth)
  - Build passou: 13 rotas compiladas com sucesso

### Decisões técnicas tomadas (pelo Claude):
- API client fetch-based em vez de axios (mais leve, refresh integrado)
- Route groups: (auth) para login, (dashboard) para páginas autenticadas
- Sidebar com ícones emoji (será substituída por Lucide icons depois)
- Layout responsivo com sidebar colapsável

### Próxima ação:
- **Fase 3.2 — Dashboard do Gestor** (cards semáforo, contadores, gráficos)

---

## Sessão 5 — 20/02/2026
**Contexto:** Sessão anterior teve compactação de contexto. Claude retomou automaticamente lendo os logs.

### O que foi feito:
- **Fase 3.7 CONCLUÍDA** — Gestão de Técnicos
  - Tabela com nome, telefone formatado, rating em estrelas (★), status ativo/inativo
  - Busca por nome/telefone/status
  - Formulário inline para criar/editar
  - Botão desativar (soft delete)

- **Fase 3.8 CONCLUÍDA** — Configurações do Tenant
  - Formulário com nome da empresa e comissão da plataforma (%)
  - Comissão em basis points (BPS) — conversão automática %↔BPS
  - Cards informativos: ID da empresa, status, data de criação
  - Apenas ADMIN pode editar (outros veem read-only)
  - Backend: PUT /companies/:id agora aceita body com name + commissionBps

- **Fase 3.9 CONCLUÍDA** — Financeiro Painel
  - Cards resumo: Receita Bruta, Comissões, Repasse Líquido, OS Confirmadas
  - Seção de OS pendentes de confirmação (CONCLUIDA/APROVADA sem ledger)
  - Botão "Confirmar Repasse" com simulação automática
  - Tabela de repasses confirmados com bruto, comissão (%), líquido e data
  - Backend: adicionado GET /finance/summary com agregações

- **Build verificado:** 14 rotas compiladas com sucesso (Next.js 16.1.6 Turbopack)

### Decisões técnicas tomadas (pelo Claude):
- Finance summary calcula totais e lista OS pendentes de confirmação no backend
- Company update genérico (aceita qualquer campo do modelo)
- Rating de técnicos exibido com estrelas visuais (★) + valor numérico
- Telefone formatado automaticamente ((XX) XXXXX-XXXX)

### Próxima ação:
- **Fase 3.10 — Relatórios** (placeholder ou básico) e depois **Fase 4 — Mobile Técnico**

---

## Sessão 6 — 20/02/2026
**Contexto:** Continuação direta da Sessão 5.

### Decisões de NEGÓCIO tomadas pelo Juliano:
1. **Visual Bling-like:** Todas as telas devem ter aparência profissional, inspirada no ERP Bling (clean, moderno, bordas arredondadas, bom espaçamento)
2. **Construtor de Fluxo de Atendimento:** Nova tela onde o gestor configura o fluxo que o técnico segue:
   - Tela visual com blocos sequenciais (tipo flowchart vertical)
   - Bloco inicial fixo ("Início")
   - Botão "+" para adicionar novos blocos (ex: "Aceitar serviço", "A caminho", "Chegou", "Iniciou", "Finalizou")
   - Cada bloco = um passo do workflow do técnico
   - Limite de até 50 blocos
   - Fácil de configurar e visualmente claro
   - Isso afeta Fase 5 (Workflow Engine) — antecipando a configuração visual

### O que foi feito:
- **Fase 3.10 CONCLUÍDA** — Relatórios (placeholder melhorado com 4 cards de tipos de relatório)
- **Fase 3.11 CONCLUÍDA** — Construtor de Fluxo de Atendimento (builder visual completo)
- **Fase 3.12 CONCLUÍDA** — Polish Visual Bling-like (ícones SVG, gradientes, backdrop-blur)
- **Build:** 15 rotas compiladas com sucesso
- **Progresso: 35/73 (48%) — FASE 3 COMPLETA!**

### Decisões técnicas tomadas:
- WorkflowTemplate: steps como JSON, validação 1-50 steps
- Sidebar agora usa ícones SVG em vez de emoji
- Dashboard cards com gradiente e ícones SVG
- Migration pendente para WorkflowTemplate

### Próxima ação:
- **Fase 4 — Tela Mobile do Técnico**

---

## Sessão 7 — 21/02/2026
**Contexto:** Continuação após compactação de contexto. Retomado automaticamente.

### Decisões tomadas pelo Juliano:
- "Sim" para continuar com Fase 4 (Mobile Técnico)

### O que foi feito:
- **Fase 4.1 CONCLUÍDA** — Auth Técnico Backend
  - Adicionados campos email (unique) + passwordHash ao model Technician
  - Criado TechAuthService (login, refresh, logout, me) e TechAuthController (/tech-auth/*)
  - JWT com role='TECNICO' e technicianId no payload
  - Cookie path /tech-auth separado do gestor
  - Atualizado RolesGuard para aceitar 'TECNICO' como string role

- **Fase 4.2 CONCLUÍDA** — Login + TechAuthContext
  - TechAuthContext com techApi(), silentRefresh, login/logout
  - Tela de login com gradiente e formulário email+senha
  - API client separado com interceptor 401→refresh

- **Fase 4.3 CONCLUÍDA** — Lista de OS Técnico
  - OS agrupadas por status (Pendentes, Em Andamento, Ajustes, Concluídas, Aprovadas)
  - Cards com borda colorida por status, badge de atraso, valor formatado

- **Fase 4.4 CONCLUÍDA** — Detalhe OS Técnico
  - Info com endereço (pin), valor (R$), prazo (relógio)
  - Link "Navegar até o local" → Google Maps directions
  - Botões de ação dinâmicos por status

- **Fase 4.6 CONCLUÍDA** — Perfil Técnico
  - Card com gradiente, rating em estrelas, info, logout

- **Build:** 20 rotas compiladas com sucesso
- **Progresso: 40/73 (55%)**

### Decisões técnicas tomadas:
- Auth técnico totalmente separado (TechAuthService/TechAuthContext/cookies diferentes)
- Reuso da tabela Session com technicianId no campo userId (MVP)
- TECNICO como string role, não enum (evita migration de enum)
- Bottom navigation com 2 tabs (Minhas OS, Perfil) — design mobile first

### Próxima ação:
- **Fase 5 — Workflow Engine** (conectar templates à execução real)

---

## Sessão 7 (continuação) — 21/02/2026
**Contexto:** Continuação da mesma sessão (após compactação 2).

### O que foi feito:
- **Fase 5 COMPLETA — Workflow Engine**
  - 5.1: Schema WorkflowStepLog + workflowTemplateId em ServiceOrder
  - 5.2: WorkflowEngineService (advance, getProgress, resetStep) + controller
  - 5.3: Já feita em 3.11 (Workflow Builder visual)
  - 5.4: Tela técnico refeita com steps dinâmicos, progress bar, nota, foto por step
  - 5.5: Tela gestor com timeline vertical de steps, eventos de workflow

- **Fase 6 COMPLETA — Upload de Fotos**
  - 6.1: Backend UploadService + Attachment model + static files serving
  - 6.2: PhotoUpload component (galeria + upload multipart)
  - 6.3: Integração na tela técnico (fotos antes/depois + workflow step)
  - 6.4: Integração na tela gestor (galeria de fotos no detalhe)

- **Build:** 20 rotas compiladas com sucesso
- **Progresso: 49/73 (67%)**

### Decisões técnicas:
- WorkflowStepLog com unique(serviceOrderId, stepOrder) — um log por step
- Engine faz auto-transição: ATRIBUIDA→EM_EXECUCAO no 1º step, all steps done→CONCLUIDA
- Upload local em /uploads com static serving (pronto para S3 swap)
- Attachment types: ANTES, DEPOIS, WORKFLOW_STEP, OUTRO
- Migrations: 20260221100000_workflow_engine + 20260221110000_attachments

### Próxima ação:
- **Fase 7 — Relatórios e Financeiro Completo**

---

## Sessão 8 — 21/02/2026
**Contexto:** Continuação após compactação de contexto. Retomado automaticamente.

### O que foi feito:
- **Fase 7 COMPLETA — Relatórios**
  - 7.1: Backend ReportsService (financeReport, ordersReport, techniciansReport)
  - 7.2+7.3: Frontend com 3 tabs (Financeiro, OS, Técnicos) + filtros + gráficos
  - 7.4: Exportar CSV/PDF — PENDENTE (nice-to-have)

- **Fase 8 COMPLETA — Notificações**
  - 8.1: NotificationService (mock sender, pronto para WhatsApp)
  - 8.3: Integrado em ServiceOrderService.updateStatus(), assign(), WorkflowEngineService.advanceStep()
  - 8.4: Tela /notifications com lista real de notificações + badge no Header com polling 60s
  - 8.5: WHATSAPP_INTEGRATION.md criado com guia completo
  - 8.2: Proximidade GPS — PENDENTE (depende de 4.5)

- **Fase 9 COMPLETA — Polimento e UX**
  - 9.1: ToastProvider + useToast (slide-in animation, auto-dismiss 4s)
  - 9.2: ConfirmModal reutilizável (variants: danger/warning/default, loading state)
  - 9.3: Responsividade já implementada (Tailwind responsive classes)
  - 9.5: Empty states já implementadas em todas as listas
  - 9.4: Validação formulários — PENDENTE (nice-to-have)
  - Aplicado em: finance, orders/[id], users, technicians, workflow

- **Build:** 20 rotas compiladas com sucesso
- **Progresso: 60/73 (82%)**

### Decisões técnicas:
- NotificationService com @Optional() @Inject() para não bloquear módulos que não importam
- Notificações fire-and-forget (.catch(() => {})) — não bloqueia response
- Header faz polling de /notifications/count a cada 60s
- ConfirmModal acessível (backdrop click cancela, loading state desabilita botões)
- CSS animations customizadas (slide-in, scale-in, shimmer skeleton)

### Próxima ação:
- **Fase 10 — Testes e Deploy**

---

## Sessão 9 — 21/02/2026
**Contexto:** Continuação após compactação. Foco em melhorias do cadastro da empresa e UX.

### Pedidos do Juliano:
1. CNPJ como primeiro campo, com botão para buscar dados da Receita Federal (como no Sankhya)
2. CNPJ da empresa SLS Obras: 47.226.599/0001-40
3. Corrigir fonte quase invisível nos campos de input (em todo o sistema)
4. Mudar versionamento para formato X.XX.XX (último bloco incrementa, cascata em 99)

### O que foi feito:
- **Cadastro completo empresa brasileira** — 17 novos campos na página de Configurações
  - CNPJ, IE, IM, telefone, email, endereço completo (CEP, rua, número, complemento, bairro, cidade, UF), responsável legal (nome, CPF, telefone, email)
  - Masks: CNPJ (XX.XXX.XXX/XXXX-XX), CPF (XXX.XXX.XXX-XX), CEP (XXXXX-XXX), telefone ((XX) XXXXX-XXXX)

- **Self-healing migrations** — PrismaService verifica e cria colunas ausentes no startup
  - Sem necessidade de rodar `prisma migrate` manualmente para campos da Company
  - CompanyService reescrito com `$queryRawUnsafe` (bypass Prisma client types)

- **CNPJ Lookup** — Busca automática na Receita Federal
  - Card destacado azul "Importar Dados da Receita Federal"
  - BrasilAPI como fonte primária (`brasilapi.com.br/api/cnpj/v1/{cnpj}`)
  - ReceitaWS como fallback (`receitaws.com.br/v1/cnpj/{cnpj}`)
  - Auto-preenche: razão social, nome fantasia, telefone, email, endereço completo
  - Status: "Dados importados da Receita Federal - Situação: ATIVA"
  - Testado com sucesso: 47.226.599/0001-40 → SLS OBRAS LTDA, Primavera do Leste - MT

- **CEP Lookup** — ViaCEP integrado, auto-preenche endereço ao digitar CEP

- **Fix visibilidade de inputs** — globals.css com regras globais
  - `color: #1e293b !important` (slate-800) para todos inputs/selects/textareas
  - `-webkit-text-fill-color` para compatibilidade Chrome
  - Placeholder: #94a3b8 (slate-400), Disabled: #475569 (slate-600)

### Decisões técnicas:
- Raw SQL em vez de Prisma client para Company CRUD (evita necessidade de prisma generate)
- BrasilAPI gratuita sem limite como fonte primária de CNPJ
- Self-healing migrations como padrão para novos campos (ALTER TABLE via raw SQL)
- Import type separado para DTOs com isolatedModules + emitDecoratorMetadata

### Arquivos modificados:
- `backend/src/prisma/prisma.service.ts` — ensureCompanyColumns() no startup
- `backend/src/company/company.service.ts` — raw SQL para findOne/update
- `backend/src/company/company.controller.ts` — import type fix
- `frontend/src/app/(dashboard)/settings/page.tsx` — reescrito com CNPJ lookup + formulário completo
- `frontend/src/app/globals.css` — regras globais de visibilidade de inputs

---

## Sessão 10 — 22/02/2026
**Contexto:** Continuação após compactação. Foco em versionamento e botão de atualização.

### Pedidos do Juliano:
1. Mudar versionamento para formato X.XX.XX (último bloco incrementa por build, cascata em 99)
2. Botão "Atualizar Sistema" — campo ao lado mostrando se tem versão nova, botão ativo só quando há atualização
3. Data ao lado do botão deve mostrar data + hora + minutos da última atualização

### O que foi feito:
- **Versionamento X.XX.XX**
  - `version.json`: formato 1.00.02 com codename MVP
  - `bump-build.js`: incrementa patch, cascata patch>99→minor++, minor>99→major++
  - `health.controller.ts`: removido campo build, removido cache (lê version.json a cada request)
  - Sidebar: mostra apenas `v{version}`
  - Settings: seção Sistema com 3 colunas (sem Build separado)

- **Botão "Atualizar Sistema" inteligente**
  - Polling do `/api/health` a cada 60 minutos
  - Compara versão carregada no frontend vs versão do backend
  - **Quando igual:** badge verde "Sistema atualizado" + botão cinza desabilitado
  - **Quando diferente:** badge âmbar pulsante "Nova versão disponível!" + botão azul ativo
  - Botão limpa cache do navegador e recarrega a página

- **Data com hora e minutos**
  - `releasedAt` salvo como ISO completo (com horário)
  - Frontend formata como `dd/mm/yyyy HH:mm` (pt-BR)
  - Grid da seção Sistema expandido para 4 colunas: Versão, Codinome, Uptime, Última Atualização

### Arquivos modificados:
- `version.json` — releasedAt com ISO completo
- `scripts/bump-build.js` — releasedAt com hora
- `backend/src/health/health.controller.ts` — sem cache, lê version.json a cada request
- `frontend/src/app/(dashboard)/settings/page.tsx` — polling + indicador + botão condicional
- `frontend/src/components/layout/Sidebar.tsx` — display simplificado v{version}

---

## Sessão 11 — 21/02/2026
**Contexto:** Cowork (Windsurf) com problemas nativos. Juliano migrou para Claude Code CLI. Projeto rodando (Docker + Backend 4000 + Frontend 3000).

### Decisões de NEGÓCIO tomadas pelo Juliano:

1. **Cadastro de Parceiros (nível Brasil)**
   - Tipos: Cliente, Fornecedor, Técnico
   - Tipo pessoa: PF e PJ, com checkbox "Produtor Rural" dentro de PF
   - PJ: CNPJ com importação Receita Federal + consulta SEFAZ automática para IE
   - PF Produtor Rural: CPF + IE com consulta SEFAZ
   - PF comum: CPF manual, sem consulta externa
   - Ao vincular parceiro em OS: verificar situação SEFAZ, alertar se inativa

2. **Especializações de Técnicos**
   - Lista pré-definida (10 defaults) + gestor cria custom livremente
   - Técnico pode ter MÚLTIPLAS especializações (many-to-many, chips selecionáveis)

3. **Workflow Visual "Pasta Suspensa"**
   - Grid de cards (folder cards) em vez de split-panel
   - Criação: Nome → Especializações requeridas → Steps
   - Primeiro bloco: especialização do técnico (filtra quem recebe proposta)

4. **Smart Routing (Proposta Inteligente)**
   - Mostra lista filtrada ao gestor com perfil do técnico + rating
   - Técnicos EM_TREINAMENTO não aparecem

5. **Sistema de Avaliação**
   - Gestor avalia ao aprovar OS (1-5 estrelas + comentário)
   - Cliente avalia via link público /rate/[token]
   - Média ponderada: pesos configuráveis pelo gestor (default: gestor 40%, cliente 60%)
   - Nota mínima configurável → abaixo = status "EM_TREINAMENTO"

### Plano aprovado:
- 11 sub-fases (A-K), ~35 etapas
- Versão alvo: 2.00.00 (codename: "Parceiros")
- 4 novos modelos Prisma: Partner, Specialization, TechnicianSpecialization, TechnicianEvaluation
- 6 novos arquivos frontend, 9 novos arquivos backend
- Detalhes completos em `.claude/plans/sparkling-strolling-hamming.md`

### O que foi feito (todas as 11 fases):
- **FASE A** — Schema Prisma: 4 novos modelos, Technician expandido com 15+ campos, Company com campos de avaliação, requiredSpecializationIds no WorkflowTemplate
- **FASE B** — Backend Especializações: SpecializationService (CRUD + seedDefaults com 10 defaults), Controller, Module
- **FASE C** — Backend Technician expandido: findBySpecializations, updateRating, updateStatus + Partner CRUD (Cliente/Fornecedor)
- **FASE D** — Backend Avaliações: EvaluationService (gestor + cliente público via token), recálculo de rating com pesos configuráveis, auto-downgrade para EM_TREINAMENTO
- **FASE E** — Backend Workflow + Smart Routing: requiredSpecializationIds + getEligibleTechnicians (filtra por especializações + status ATIVO)
- **FASE F** — Frontend Utils (brazil-utils.ts: masks, lookups CNPJ/CEP) + Página /partners (tabs, PF/PJ, CNPJ import, CEP lookup)
- **FASE G** — Frontend Técnicos expandido: PF/PJ toggle, CPF/CNPJ com import, endereço com CEP, especializações multi-select com criação inline, status EM_TREINAMENTO
- **FASE H** — Frontend Workflow Redesign: grid de pasta suspensa (FolderCards), modal de criação com nome + especializações + steps
- **FASE I** — Frontend Avaliações: gestor avalia com estrelas ao aprovar OS, página pública /rate/[token] para cliente, smart routing na OS (lista de técnicos elegíveis)
- **FASE J** — Frontend Settings expandido: seção "Avaliação de Técnicos" (pesos gestor/cliente, nota mínima), seção "Especializações" (listar, criar, remover)
- **FASE K** — Seed atualizado (especializações, parceiros demo, assignments), versão 2.00.00, logs atualizados

### Decisões técnicas:
- Opção C (mínima disrupção): Technician mantido + expandido, Partner separado para Cliente/Fornecedor
- `import type` separado para DTOs com `isolatedModules + emitDecoratorMetadata`
- `prisma db push` em vez de `prisma migrate dev` (ambiente não-interativo)
- Avaliação: raw SQL para ler pesos da Company (bypass Prisma types), média ponderada calculada no serviço
- Smart routing: filtra técnicos que possuem TODAS as especializações requeridas + status ATIVO
- Página /rate/[token]: layout próprio sem sidebar, fetch nativo (sem auth)

### Build final:
- Backend: `npx nest build` — 0 erros TypeScript
- Frontend: `npm run build` — 22 rotas compiladas (vs 20 antes), incluindo /partners, /rate/[token]
- Versão: 2.00.00 (codename: "Parceiros")

### Novos arquivos criados:
- `backend/src/specialization/` (service, controller, module)
- `backend/src/partner/` (service, controller, module)
- `backend/src/evaluation/` (service, controller, module)
- `frontend/src/lib/brazil-utils.ts`
- `frontend/src/app/(dashboard)/partners/page.tsx`
- `frontend/src/app/rate/layout.tsx`
- `frontend/src/app/rate/[token]/page.tsx`

### Arquivos significativamente modificados:
- `backend/prisma/schema.prisma` — 4 novos modelos + campos expandidos
- `backend/prisma/seed.ts` — dados demo de parceiros, especializações, assignments
- `backend/src/technician/technician.service.ts` — reescrito com especializações, rating, filtro
- `backend/src/public-offer/public-offer.service.ts` — getEligibleTechnicians
- `backend/src/workflow/workflow.service.ts` — requiredSpecializationIds
- `frontend/src/app/(dashboard)/technicians/page.tsx` — reescrito com formulário completo
- `frontend/src/app/(dashboard)/workflow/page.tsx` — reescrito (pasta suspensa)
- `frontend/src/app/(dashboard)/orders/[id]/page.tsx` — avaliação gestor + smart routing
- `frontend/src/app/(dashboard)/settings/page.tsx` — seções de avaliação e especializações
- `frontend/src/components/layout/Sidebar.tsx` — ícone + nav item "Parceiros"

---

## Sessão 12 — 21/02/2026
**Contexto:** Continuação da Sessão 11. Foco em unificação Technician → Partner + melhorias arquiteturais.

### Pedidos do Juliano:
1. Corrigir versionamento: deveria ser 1.00.03, não 2.00.02
2. Unificar Technician e Partner em um único modelo
3. Preparar banco de dados para uso comercial com alta segurança
4. Implementar TODAS as melhorias arquiteturais identificadas em auditoria
5. Atualizar projeto log e chat log

### O que foi feito (Parte 1 — Merge Technician → Partner, v1.00.03 "Parceiros"):
- **Model Technician removido** — fundido no Partner
  - `partnerType String` → `partnerTypes String[]` (array: "CLIENTE", "FORNECEDOR", "TECNICO")
  - Campos absorvidos: passwordHash, rating
  - Relações migradas: ServiceOrder, Specializations, Evaluations
- **Renomeações no schema:**
  - `TechnicianSpecialization` → `PartnerSpecialization` (technicianId → partnerId)
  - `TechnicianEvaluation`: technicianId → partnerId
  - `ServiceOrder`: assignedTechnicianId → assignedPartnerId
  - `OtpCode`: technicianId → partnerId
  - `WorkflowStepLog`: technicianId → partnerId
- **Backend atualizado:** PartnerService absorveu TechnicianService, TechAuthService usa Partner
- **TechnicianModule removido** (service, controller, module deletados)
- **Frontend:** Página parceiros unificada com 2 abas (Parceiros + Especializações)
- **Sidebar:** Removido item "Técnicos"
- Versão corrigida para 1.00.03 (codename: "Parceiros")

### O que foi feito (Parte 2 — Melhorias Arquiteturais, v1.00.04 "Blindagem"):

**1. Indexes de banco de dados (15+ novos)**
- Partner: `@@index([email])`, `@@index([companyId, status])`, `@@index([document])`
- ServiceOrder: `@@index([companyId, status])`, `@@index([companyId, deletedAt])`, `@@index([assignedPartnerId])`, `@@index([deadlineAt])`, `@@index([createdAt])`
- ServiceOrderOffer: `@@index([serviceOrderId])`, `@@index([token])`
- ServiceOrderEvent: `@@index([serviceOrderId])`, `@@index([companyId])`
- OtpCode: `@@index([partnerId, serviceOrderId])`, `@@index([companyId])`
- ServiceOrderLedger: `@@index([confirmedAt])`
- PartnerSpecialization: `@@index([specializationId])`

**2. DTOs com class-validator para TODOS os endpoints**
- PaginationDto (page, limit, search) com @IsInt, @Min, @Max
- CreatePartnerDto, UpdatePartnerDto, UpdatePartnerStatusDto
- CreateServiceOrderDto, UpdateStatusDto, AssignPartnerDto
- UpdateCompanyDto (20+ campos opcionais validados)
- CreateGestorEvaluationDto, SubmitClientEvaluationDto
- StepProgressDto (note, photoUrl)
- Instalado @nestjs/mapped-types para PartialType

**3. Paginação server-side em TODOS os endpoints de lista**
- PaginatedResult<T> com { data, meta: { total, page, limit, totalPages } }
- Partner, ServiceOrder: $transaction([findMany, count]) para consistência
- Frontend: componente Pagination reutilizável, Orders e Dashboard adaptados

**4. Otimização de queries**
- CompanyService: removido $queryRawUnsafe, reescrito com Prisma ORM + ALLOWED_FIELDS whitelist
- EvaluationService: removido raw SQL, rating calculado com Prisma ORM
- ServiceOrder.stats(): substituído fetch-all por groupBy aggregation

**5. Transações atômicas no Workflow Engine**
- advanceStep envolto em $transaction: cria stepLog + atualiza status + cria event atomicamente
- Paginação com $transaction([findMany, count])

**6. Global Exception Filter**
- GlobalExceptionFilter: captura todas exceções, padroniza formato { statusCode, error, message, timestamp, path }
- Logs de erros não-HTTP com stack trace no console
- Registrado em main.ts antes do ValidationPipe

**7. Refatoração do frontend Partners**
- partners/page.tsx (~997 linhas) dividida em 4 componentes:
  - PartnerTable.tsx (~160 linhas): tabela com formatação, stars, badges
  - Pagination.tsx (~60 linhas): componente reutilizável
  - SpecializationsTab.tsx (~110 linhas): aba de especializações
  - PartnerForm.tsx (~250 linhas): formulário completo
  - page.tsx: ~180 linhas de orquestração

### Decisões técnicas:
- Removido TODO raw SQL ($queryRawUnsafe) — preparação para segurança comercial
- ValidationPipe global com whitelist + forbidNonWhitelisted + transform
- Indexes compostos para queries mais frequentes (companyId + status/deletedAt)
- Paginação obrigatória evita queries unbounded em produção
- $transaction garante atomicidade em operações multi-step

### Arquivos criados:
- `backend/src/common/dto/pagination.dto.ts`
- `backend/src/common/filters/http-exception.filter.ts`
- `backend/src/partner/dto/create-partner.dto.ts`
- `backend/src/partner/dto/update-partner.dto.ts`
- `backend/src/partner/dto/update-status.dto.ts`
- `backend/src/service-order/dto/create-service-order.dto.ts`
- `backend/src/service-order/dto/update-status.dto.ts`
- `backend/src/service-order/dto/assign-partner.dto.ts`
- `backend/src/evaluation/dto/create-evaluation.dto.ts`
- `frontend/src/app/(dashboard)/partners/components/PartnerTable.tsx`
- `frontend/src/app/(dashboard)/partners/components/Pagination.tsx`
- `frontend/src/app/(dashboard)/partners/components/SpecializationsTab.tsx`
- `frontend/src/app/(dashboard)/partners/components/PartnerForm.tsx`

### Arquivos significativamente modificados:
- `backend/prisma/schema.prisma` — 15+ indexes adicionados
- `backend/src/main.ts` — GlobalExceptionFilter + ValidationPipe
- `backend/src/partner/partner.service.ts` — DTOs + paginação
- `backend/src/partner/partner.controller.ts` — DTOs + query params
- `backend/src/service-order/service-order.service.ts` — paginação + groupBy stats
- `backend/src/service-order/service-order.controller.ts` — DTOs + paginação
- `backend/src/company/company.service.ts` — removido raw SQL
- `backend/src/evaluation/evaluation.service.ts` — removido raw SQL
- `backend/src/workflow/workflow-engine.service.ts` — $transaction
- `frontend/src/app/(dashboard)/partners/page.tsx` — refatorada com componentes
- `frontend/src/app/(dashboard)/orders/page.tsx` — paginação server-side
- `frontend/src/app/(dashboard)/dashboard/page.tsx` — resposta paginada

---

## Sessão 13 — 21/02/2026
**Contexto:** Continuação após compactação de contexto. Implementação de v1.00.05 "Filtros".

### Pedidos do Juliano:
- Sistema de filtros ERP-style com cabeçalhos clicáveis para ordenar (alfabética, valor, etc.)
- Barra de filtros com múltiplas condições (nome, CPF, data, valor, tipo, status)
- Padrão profissional tipo Bling ERP

### O que foi feito:

**Backend (8 arquivos):**
- `PaginationDto`: adicionados sortBy + sortOrder (validados com @IsIn)
- `build-order-by.ts`: utility para construir orderBy seguro contra injection (column allowlist)
- `PartnerService.findAll`: sort dinâmico (7 colunas) + filtros (status, personType)
- `PartnerController`: +status, +personType query params
- `ServiceOrderService.findAll`: sort dinâmico (5 colunas) + filtros (dateFrom, dateTo, valueMin, valueMax)
- `ServiceOrderController`: +dateFrom/dateTo/valueMin/valueMax query params
- `FinanceService.findLedgers`: novo endpoint paginado (4 colunas sort, filtros data, busca título OS)
- `FinanceController`: novo GET /finance/ledgers

**Frontend — Componentes reutilizáveis (6 novos arquivos):**
- `lib/types/table.ts`: SortOrder, SortState, FilterDefinition, FilterValues
- `hooks/useTableParams.ts`: hook centralizado (page, search, sort, filters) com auto page-reset
- `components/ui/SortableHeader.tsx`: `<th>` clicável com setas stacked, azul quando ativo
- `components/ui/FilterBar.tsx`: renderiza filtros baseado em FilterDefinition[], busca integrada
- `components/ui/Pagination.tsx`: componente compartilhado (numeros de pagina + anterior/proxima)

**Frontend — Integração em 3 páginas:**
- Partners: useTableParams + FilterBar (status, personType) + SortableHeader (5 colunas)
- Orders: useTableParams + FilterBar (status, datas, valores R$->centavos) + SortableHeader (4 colunas)
- Finance: summary cards (GET /summary) + ledger table (GET /ledgers paginado) + FilterBar + SortableHeader (4 colunas)

### Decisões técnicas:
- Sort server-side com column allowlist (buildOrderBy) para segurança
- Ciclo de sort: null->asc->desc->null (3 estados)
- Hook useTableParams centraliza todo estado de tabela
- FilterBar declarativo baseado em array de FilterDefinition
- Finance page split: summary (todos os dados) vs ledgers (paginado com filtros)
- Conversão R$->centavos feita no frontend antes de enviar query ao backend

### Build:
- Backend: `npx nest build` — 0 erros
- Frontend: `npm run build` — 21 rotas, 0 erros
- Versão: 1.00.05 (codename: "Filtros")

### Bug fix intermediário:
- Partners page retornava zero resultados mesmo sem filtro
- Root cause: `forbidNonWhitelisted: true` no ValidationPipe global rejeitava query params extras (type, status, personType)
- Fix: Removido `forbidNonWhitelisted: true` de `main.ts`, mantido apenas `whitelist: true` + `transform: true`

---

## Sessão 14 — 21/02/2026
**Contexto:** Continuação após compactação de contexto. Implementação de v1.00.06 "Colunas".

### Pedidos do Juliano:
1. Dashboard "Últimas Ordens" — clicar em OS retorna "OS não encontrada" (bug fix)
2. Tabela de OS precisa de colunas: nome do cliente, data/hora solicitação, aceite, início, conclusão
3. Scroll horizontal se colunas não couberem na largura
4. Arrastar cabeçalhos para reorganizar colunas (drag & reorder)
5. Persistir layout (salvar no localStorage, restaurar ao voltar) — global para todas as tabelas
6. NUNCA perder dados em atualizações (cadastro, layout, configurações)

### O que foi feito:

**Bug Fixes:**
- `findOne` em ServiceOrderService: adicionado `companyId` no where clause (segurança + fix)
- `orders/[id]/page.tsx`: trocado prop `params` por `useParams()` hook (Next.js 16 client component)

**Schema (3 novos campos nullable — zero perda de dados):**
- `startedAt DateTime?` — setado automaticamente quando status → EM_EXECUCAO
- `completedAt DateTime?` — setado automaticamente quando status → CONCLUIDA/APROVADA
- `clientPartnerId String?` — link para Partner tipo CLIENTE
- Relação `clientPartner Partner? @relation("ClientPartner")` + reversa no Partner
- `prisma db push` + `prisma generate` executados com sucesso

**Backend:**
- `updateStatus()`: auto-set timestamps com guards (`!so.startedAt` evita overwrite em ciclos de status)
- `findAll()`: includes `clientPartner`, busca por nome do cliente no OR do search
- `SORTABLE_COLUMNS` expandido: +acceptedAt, +startedAt, +completedAt
- `create()`: aceita `clientPartnerId`
- `CreateServiceOrderDto`: +clientPartnerId opcional
- Seed: clientPartnerId atribuído às 3 OS demo + startedAt na OS EM_EXECUCAO

**Frontend — Infraestrutura reutilizável (3 novos arquivos):**
- `lib/types/table.ts`: ColumnDefinition<T> (id, label, sortable, sortKey, align, className, render) + TableLayoutState
- `hooks/useTableLayout.ts`: persistência de layout no localStorage com version stamp, validação de IDs (remove deletados, append novos)
- `components/ui/DraggableHeader.tsx`: HTML5 Drag and Drop API (zero dependências), visual feedback (opacity, bg-blue-50 drop target)
- `components/ui/SortableHeader.tsx`: refatorado com `as` prop ("th" | "div") para uso dentro de DraggableHeader

**Frontend — Integração nas 3 tabelas:**
- Orders: 11 colunas (título, cliente, status, técnico, valor, criada, aceite, iniciada, concluída, prazo, endereço) + useTableLayout + DraggableHeader + overflow-x-auto
- Partners: PartnerTable reescrito com ColumnDefinition[] + useTableLayout + DraggableHeader
- Finance: LEDGER_COLUMNS + useTableLayout + DraggableHeader

**Frontend — Formulário Nova OS:**
- Dropdown "Cliente (opcional)" — fetch partners tipo CLIENTE
- Inclui clientPartnerId no POST

### Decisões técnicas:
- HTML5 Drag & Drop API em vez de lib externa (zero dependências, boa compatibilidade)
- SortableHeader com `as="div"` quando dentro de DraggableHeader (evita th>th nesting)
- useTableLayout com version stamp (LAYOUT_VERSION = 1) para migração futura
- Validação de columnOrder: remove colunas deletadas e append novas automaticamente
- Auto-timestamps com guards `!so.startedAt` para não sobrescrever em ciclos (AJUSTE → EM_EXECUCAO)
- Todos campos novos nullable → `prisma db push` seguro, zero perda de dados

### Build:
- Backend: `npx nest build` — 0 erros
- Frontend: `npm run build` — 21 rotas, 0 erros
- Versão: 1.00.06 (codename: "Colunas")

### Arquivos criados:
- `frontend/src/hooks/useTableLayout.ts`
- `frontend/src/components/ui/DraggableHeader.tsx`

### Arquivos modificados:
- `backend/prisma/schema.prisma` — 3 novos campos + relação
- `backend/prisma/seed.ts` — clientPartnerId + startedAt nos seeds
- `backend/src/service-order/service-order.service.ts` — findOne fix, timestamps, includes, sortable
- `backend/src/service-order/dto/create-service-order.dto.ts` — +clientPartnerId
- `frontend/src/lib/types/table.ts` — ColumnDefinition, TableLayoutState
- `frontend/src/components/ui/SortableHeader.tsx` — prop `as`
- `frontend/src/app/(dashboard)/orders/[id]/page.tsx` — fix useParams
- `frontend/src/app/(dashboard)/orders/page.tsx` — 11 colunas + drag + scroll
- `frontend/src/app/(dashboard)/orders/new/page.tsx` — seleção de cliente
- `frontend/src/app/(dashboard)/partners/components/PartnerTable.tsx` — drag + scroll
- `frontend/src/app/(dashboard)/finance/page.tsx` — drag + scroll

---

## Sessão 15 — 22/02/2026
**Contexto:** Continuação após compactação de contexto. Implementação de v1.00.07 "Ações".

### Pedidos do Juliano:
1. OS devem ser editáveis, seguindo padrão das outras tabelas com botão editar
2. Botões de ações nas OS — estudar quais seriam (editar, cancelar, duplicar, excluir)
3. Coluna de log de alterações em TODAS as tabelas (ex: "Alterou Nome, usuário tal")
4. Estudar ações antes de implementar

### O que foi feito:

**FASE 1 — Schema + AuditService:**
- Novo modelo `AuditLog` no Prisma (polimórfico: entityType + entityId)
  - Campos: action, actorType, actorId, actorName (desnormalizado), before/after (Json?)
  - 3 indexes: (entityType, entityId), (companyId), (companyId, createdAt)
  - Sem FK — audit logs imutáveis, sobrevivem exclusão da entidade
- `AuditService` reescrito: `log()` fire-and-forget (`.catch()`, nunca bloqueia), `getForEntity()`
- Novo `AuditController`: `GET /audit?entityType=X&entityId=Y&limit=N`
- `AuditModule` atualizado com controller + PrismaModule import
- `prisma db push` + `prisma generate` executados com sucesso

**FASE 2 — Backend OS edit/cancel/duplicate + audit:**
- Novo `UpdateServiceOrderDto` (8 campos opcionais validados)
- `ServiceOrderService` — 3 novos métodos:
  - `update(id, companyId, data, actor)`: valida TERMINAL_STATUSES, diff before/after, atualiza só campos mudados
  - `cancel(id, companyId, actor)`: guarda status terminal
  - `duplicate(id, companyId, actor)`: cria cópia com "(cópia)" no título
- Audit wiring em TODAS as 7 operações: create, assign, updateStatus, update, cancel, duplicate, remove
- `ServiceOrderController` — 3 novas rotas:
  - `PUT /:id` (edição), `PATCH /:id/cancel`, `POST /:id/duplicate`
  - Roles: ADMIN + DESPACHO
  - Rotas específicas ANTES das genéricas para NestJS resolver corretamente
- `ServiceOrderModule`: +AuditModule import

**FASE 3 — Backend audit em Partners e Users:**
- `PartnerService`: AuditService injetado, audit em create/update/updateStatus/remove
  - Update: diff before/after para campos alterados, senha = "***alterada***"
- `PartnerModule`: +AuditModule import
- `PartnerController`: `user` passado para todos métodos de mutação
- `UserService`: AuditService injetado, audit em create/update/remove
  - NUNCA inclui passwordHash no audit (mascarado como "***alterada***")
- `UserModule`: +AuditModule import
- `UserController`: `user` passado para todos métodos de mutação

**FASE 4 — Frontend página de edição de OS:**
- Nova página `/orders/[id]/edit/page.tsx`
  - Espelha formulário de criação (`/orders/new`)
  - Carrega dados via `GET /service-orders/:id` + clientes
  - Badge de status (read-only) no topo
  - `<fieldset disabled>` quando status terminal
  - Mensagem de aviso para OS em status terminal
  - Submit via `PUT /service-orders/:id`
  - Breadcrumb: Ordens → [título] → Editar

**FASE 5 — Frontend botões de ação na tabela de OS:**
- Componente `ActionsDropdown` com menu contextual "⋯"
  - Ver detalhes (sempre), Editar (editável + ADMIN/DESPACHO), Duplicar (ADMIN/DESPACHO)
  - Cancelar (editável + ADMIN/DESPACHO, variant warning), Excluir (ADMIN, variant danger)
- ConfirmModal para cancelar e excluir
- Duplicar → redirect para `/orders/[newId]/edit`
- Botão "+ Nova OS" só para ADMIN/DESPACHO
- Roles baseadas em `useAuth()` (user.role)

**FASE 6 — Frontend AuditLogDrawer:**
- Novo componente `AuditLogDrawer.tsx` reutilizável
  - Props: entityType, entityId, open, colSpan
  - Fetch lazy (só busca no primeiro expand)
  - Timeline compacta: bullet azul + descrição + ator + data relativa
  - Traduções PT-BR: ações (CREATED→Criado), campos (title→Título), status, roles
  - Renderiza como `<tr>` com `colSpan` após cada linha de dados
- `AuditToggle` — ícone relógio standalone ao lado do dropdown
  - State: `expandedAuditId` (só um aberto por vez)
  - Toggle: clique abre/fecha
  - Visual: border azul + bg-blue-50 quando ativo
- Integrado nas 3 tabelas:
  - Orders → entityType="SERVICE_ORDER"
  - Partners → entityType="PARTNER"
  - Users → entityType="USER"
- Todos os `<tbody>` usam `<React.Fragment>` com data row + AuditLogDrawer row

### Decisões técnicas:
- AuditLog polimórfico (entityType+entityId) em vez de FK — funciona para qualquer entidade
- Fire-and-forget audit (`.catch()`) — falha de audit nunca bloqueia operação principal
- `actorName` desnormalizado — exibe email mesmo se user for deletado
- `before`/`after` salvam APENAS campos que mudaram (payload leve)
- Rota ordering: específicas (`:id/cancel`, `:id/duplicate`) antes de genéricas (`:id`)
- AuditLogDrawer com fetch lazy — performance (não carrega até expandir)
- `expandedAuditId` state — só um drawer aberto por vez por tabela

### Build:
- Backend: `npx nest build` — 0 erros
- Frontend: `npm run build` — 22 rotas, 0 erros (inclui `/orders/[id]/edit`)
- Versão: 1.00.07 (codename: "Ações")

### Arquivos criados:
- `backend/src/service-order/dto/update-service-order.dto.ts`
- `backend/src/common/audit/audit.controller.ts`
- `frontend/src/app/(dashboard)/orders/[id]/edit/page.tsx`
- `frontend/src/components/ui/AuditLogDrawer.tsx`

### Arquivos modificados:
- `backend/prisma/schema.prisma` — modelo AuditLog
- `backend/src/common/audit/audit.service.ts` — reescrito para AuditLog
- `backend/src/common/audit/audit.module.ts` — controller + exports
- `backend/src/service-order/service-order.service.ts` — update, cancel, duplicate + audit em tudo
- `backend/src/service-order/service-order.controller.ts` — 3 novas rotas
- `backend/src/service-order/service-order.module.ts` — +AuditModule
- `backend/src/partner/partner.service.ts` — audit calls
- `backend/src/partner/partner.module.ts` — +AuditModule
- `backend/src/partner/partner.controller.ts` — user passado para mutações
- `backend/src/user/user.service.ts` — audit calls
- `backend/src/user/user.module.ts` — +AuditModule
- `backend/src/user/user.controller.ts` — user passado para mutações
- `frontend/src/app/(dashboard)/orders/page.tsx` — coluna ações + dropdown + drawer
- `frontend/src/app/(dashboard)/partners/components/PartnerTable.tsx` — audit drawer
- `frontend/src/app/(dashboard)/users/page.tsx` — audit drawer
- `version.json` — 1.00.07 "Ações"

---

## Sessão 16 — 22/02/2026
**Contexto:** Continuação após compactação de contexto. Implementação de v1.00.08 "Busca Global".

### Pedidos do Juliano:
1. Campo cliente na Nova OS precisa de filtro — pode haver milhares de clientes
2. Criar tela de pesquisa global reutilizável — mesmo padrão para todo tipo de busca
3. Lupa ao lado do campo abre popup de busca
4. Se for parceiro busca parceiro, se for OS busca OS, se for cidade busca API de cidades do Brasil
5. Corrigir dropdown "⋯" desalinhado na tabela de OS (position fixed)
6. Remover scrollbar vertical desnecessária na tabela de OS (overflow-y: hidden)

### O que foi feito:

**Bug Fixes (pré-v1.00.08):**
- `ActionsDropdown` reescrito com `position: fixed` + `getBoundingClientRect()`
  - Menu posicionado em relação à viewport (escapa do overflow-x-auto)
  - Calcula se cabe abaixo ou acima do botão
  - Fecha automaticamente ao fazer scroll
  - `text-left` forçado no container (corrige herança de text-right da coluna Ações)
- Scrollbar vertical removida em 3 tabelas (Orders, Partners, Finance)
  - Trocado `overflow-x-auto` por `overflow-x: auto; overflow-y: hidden`

**FASE 1 — Hook useDebounce:**
- Novo hook genérico `useDebounce<T>(value, delay)`
- Emite valor após 300ms de inatividade
- Reutilizável em qualquer lugar do sistema

**FASE 2 — SearchLookupModal:**
- Novo componente `SearchLookupModal.tsx` (~220 linhas)
- Props genéricos: `fetcher`, `keyExtractor`, `renderItem`, `onSelect`, `onClose`
- `LookupFetcher<T>` — função genérica com `AbortSignal` (cancela requests anteriores)
- Funciona com API interna (partners, orders) OU externa (IBGE cidades)
- Visual: z-[90], backdrop blur, `animate-scale-in` (padrão ConfirmModal)
- Input auto-focus com lupa SVG, debounce 300ms
- Resultados scrolláveis com hover + keyboard highlight (↑↓ Enter Escape)
- Loading skeleton, empty state, paginação simplificada
- `text-base` (16px) no input para evitar auto-zoom no iOS

**FASE 3 — LookupField:**
- Novo componente `LookupField.tsx` (~120 linhas)
- Wrapper de formulário: texto selecionado + botão 🔍 + botão X (limpar)
- Styled como input padrão do sistema
- `value: T | null` — armazena objeto completo (exibe nome sem fetch extra)
- Suporte a `disabled` para status terminal

**FASE 4 — Integração nas páginas:**
- `orders/new/page.tsx`:
  - Removido `<select>` com `limit=100` (não escalava)
  - Removido estado `clients` e `useEffect` de fetch
  - Adicionado `LookupField` com `clientFetcher` (busca server-side paginada)
  - `handleSubmit` usa `selectedClient?.id`
- `orders/[id]/edit/page.tsx`:
  - Mesma substituição
  - Pre-popula `selectedClient` com dados da OS carregada
  - Removido fetch paralelo de clientes no `Promise.all`

### Decisões técnicas:
- `fetcher` function em vez de `endpoint` string — permite APIs externas com formato diferente
- `AbortController` por request — cancela request anterior (evita race conditions)
- `keyExtractor` + `renderItem` — cada entidade renderiza como quiser
- Fetcher no nível do módulo (fora do componente) — ref estável, sem re-renders
- `value: T | null` em vez de `string` — exibe nome sem fetch adicional
- `onChange={(c) => setSelectedClient(c)}` em vez de `onChange={setSelectedClient}` — fix TypeScript (SetStateAction vs callback)

### Build:
- Frontend: `npm run build` — 22 rotas, 0 erros
- Versão: 1.00.08 (codename: "Busca Global")

### Arquivos criados:
- `frontend/src/hooks/useDebounce.ts`
- `frontend/src/components/ui/SearchLookupModal.tsx`
- `frontend/src/components/ui/LookupField.tsx`

### Arquivos modificados:
- `frontend/src/app/(dashboard)/orders/new/page.tsx` — `<select>` → `<LookupField>`
- `frontend/src/app/(dashboard)/orders/[id]/edit/page.tsx` — `<select>` → `<LookupField>` + pre-populate
- `frontend/src/app/(dashboard)/orders/page.tsx` — ActionsDropdown position fixed + text-left
- `frontend/src/app/(dashboard)/partners/components/PartnerTable.tsx` — overflow-y: hidden
- `frontend/src/app/(dashboard)/finance/page.tsx` — overflow-y: hidden
- `version.json` — 1.00.08 "Busca Global"

---

## Sessão 17 — 22/02/2026
**Contexto:** Continuação da sessão anterior. Implementação do v1.00.09 "Endereço Inteligente".

### Pedido do Juliano:
- Campo busca de cidade com filtro por estado (Estado primeiro, depois cidades filtradas)
- Latitude/longitude devem vir automaticamente via API de mapas
- Eliminar campos manuais de lat/lng que são impraticáveis para o gestor

### O que foi feito:

**FASE 1 — Schema Prisma:**
- 7 novos campos nullable em ServiceOrder: `addressStreet`, `addressNumber`, `addressComp`, `neighborhood`, `city`, `state`, `cep`
- `lat` e `lng` tornados nullable (`Float?`) — geocoding pode falhar
- `prisma db push` + `prisma generate`

**FASE 2 — Backend DTOs + Service:**
- `CreateServiceOrderDto`: novos campos opcionais + lat/lng opcionais + validação `@Matches` para state e cep
- `UpdateServiceOrderDto`: mesmos campos adicionados
- `service-order.service.ts`: métodos `create`, `update` e `duplicate` atualizados para novos campos

**FASE 3 — Frontend Utilitários (brazil-utils.ts):**
- `fetchCitiesByState(uf)` — IBGE API (`/estados/{UF}/municipios`), cache em `Map<string, IBGECity[]>`
- `geocodeAddress(fullAddress)` — Nominatim/OpenStreetMap, gratuito, sem API key, User-Agent customizado
- `composeAddressText(fields)` — composição: "Rua, 123 - Bairro, Cidade/UF"
- `STATE_NAMES` — Record com nomes completos dos 27 estados

**FASE 4 — Formulários reestruturados:**
- `orders/new/page.tsx`:
  - Seção "Endereço" com ícone de pin
  - Estado (select com 27 UFs + nomes) → Cidade (LookupField + IBGE client-side)
  - CEP com máscara + auto-fill via ViaCEP (rua, bairro, estado, cidade)
  - Rua (2/3 width) + Número (1/3) + Complemento
  - No submit: `composeAddressText()` + `geocodeAddress()` automáticos
  - Indicador visual "Obtendo coordenadas..." com spinner
- `orders/[id]/edit/page.tsx`:
  - Mesma reestruturação + pre-populate de todos os campos
  - Cidade pre-populada via IBGE (busca no load)
  - Fallback: OS antiga sem campos estruturados usa addressText como rua

### Decisões técnicas:
- IBGE API retorna todas as cidades (~200-800) → filtro client-side no modal (sem paginação server-side)
- Cache de cidades por UF evita re-fetch do mesmo estado
- Nominatim chamado apenas no submit (rate limit 1 req/sec ok)
- `cityFetcher` usa `useCallback` com dependência em `form.state` — ref estável, atualiza quando estado muda
- Quando estado muda → limpa cidade selecionada
- CEP auto-preenche estado + busca cidade na lista IBGE para selecionar automaticamente

### Build:
- Frontend: `npm run build` — 22 rotas, 0 erros
- Versão: 1.00.09 (codename: "Endereço Inteligente")

### Arquivos modificados:
- `backend/prisma/schema.prisma` — 7 novos campos + lat/lng nullable
- `backend/src/service-order/dto/create-service-order.dto.ts` — novos campos + lat/lng opcionais
- `backend/src/service-order/dto/update-service-order.dto.ts` — novos campos
- `backend/src/service-order/service-order.service.ts` — create, update, duplicate atualizados
- `frontend/src/lib/brazil-utils.ts` — 4 novas funções/constantes
- `frontend/src/app/(dashboard)/orders/new/page.tsx` — formulário reestruturado
- `frontend/src/app/(dashboard)/orders/[id]/edit/page.tsx` — formulário reestruturado + pre-populate
- `version.json` — 1.00.09 "Endereço Inteligente"

---

## Sessão 17 (continuação) — 22/02/2026
**Contexto:** Continuação da sessão 17. Implementação do v1.00.10 "Mapa Interativo" → pivô para v1.00.11 "Localização Google Maps".

### Pedidos do Juliano:
1. Botão "Definir localização" na OS → popup para definir ponto exato → salvar coordenadas
2. Popup em vez de mapa embutido (não pesar a página)
3. Após testar Leaflet: "O map não fica completo, parece problema de zoom" — tiles não renderizavam
4. Após fix CSS Tailwind: "Continua igual, não está renderizando, se clicar arrastar fica branco"
5. Após adicionar barra de pesquisa Nominatim: "Não ficou legal! Insisto em usar o Google Maps! Esse outro mapa é muito ruim, não acha o endereço"
6. Solução final: "Se abrirmos a página do Google Maps não tem como copiar e colar as coordenadas em algum local na página da OS?"

### Evolução técnica (3 iterações):

**Tentativa 1 — Leaflet/OpenStreetMap (v1.00.10):**
- Instalados: leaflet, react-leaflet, @types/leaflet
- LocationPickerModal com MapContainer, TileLayer, Marker, next/dynamic
- **Problema:** Tiles não renderizavam — Tailwind CSS 4 reseta `img { max-width: 100% }` que quebra posicionamento absoluto dos tiles
- **Fix CSS:** Adicionadas regras `.leaflet-container img { max-width: none !important }` em globals.css
- Tiles renderizaram mas mapa ficava branco ao arrastar/zoom

**Tentativa 2 — Leaflet + barra de pesquisa Nominatim:**
- Adicionada barra de pesquisa com Nominatim (geocoder do OpenStreetMap)
- Debounce 400ms, dropdown de resultados, auto-search do endereço da OS
- **Problema:** Nominatim não encontra endereços brasileiros de cidades pequenas (ex: Primavera do Leste - MT)
- Juliano rejeitou: busca do Nominatim muito imprecisa vs Google Maps

**Solução final — Google Maps + cola de coordenadas (v1.00.11):**
- **Leaflet removido** (`npm uninstall leaflet react-leaflet @types/leaflet`) — 3 pacotes a menos
- **CSS Leaflet removido** do globals.css (import + fix rules)
- **LocationPickerModal reescrito** — zero dependências externas, puro React
- Modal com 3 passos guiados:
  1. Botão "Buscar no Google Maps" → abre Google Maps com endereço da OS pré-pesquisado
  2. Instrução: "Clique com botão direito no local exato → coordenadas aparecem → clique para copiar"
  3. Campo para colar coordenadas com parse automático (aceita "lat, lng", "lat lng", com vírgula decimal)
- Validação em tempo real: ✓ verde + preview quando válido, erro vermelho quando inválido
- `parseCoordinates()`: regex robusta, limpa parênteses, valida ranges lat/lng
- `buildSearchUrl()`: constrói URL Google Maps a partir do addressText/city/state da OS
- Botão "Salvar localização" → `onConfirm(lat, lng)` → PUT /service-orders/:id

### Decisões técnicas:
- Zero dependências — modal é HTML/CSS puro com useState, sem library de mapas
- Google Maps como ferramenta de busca (não embed) — sem API key, sem custo
- Parse de coordenadas aceita formato Google Maps (ex: `-15.561049, -54.368185`)
- Mesmo handler handleConfirmLocation do v1.00.10 (PUT existente, zero mudança backend)

### Build:
- Frontend: `npm run build` — 22 rotas, 0 erros
- Versão: 1.00.11 (codename: "Localização Google Maps")

### Arquivos modificados:
- `frontend/src/components/ui/LocationPickerModal.tsx` — reescrito (Leaflet → Google Maps + paste)
- `frontend/src/app/globals.css` — removido import Leaflet CSS + fix rules
- `frontend/src/app/(dashboard)/orders/[id]/page.tsx` — adicionado prop addressText no modal
- `frontend/package.json` — removidas dependências leaflet, react-leaflet, @types/leaflet
- `version.json` — 1.00.11 "Localização Google Maps"

---

## Sessão 18 — 22/02/2026
**Contexto:** Continuação após rate-limit. A sessão anterior havia lançado pesquisa profunda sobre dashboards ERP/FSM e documentação de endpoints. Implementação do redesign do dashboard.

### O que foi feito:
- **v1.00.12 "Dashboard Pro"** — Redesign completo do dashboard

### Mudanças implementadas:

**Dashboard redesenhado do zero — de 5 cards simples para dashboard executivo completo:**

1. **Header melhorado:**
   - Saudação contextual (Bom dia/Boa tarde/Boa noite) + data por extenso
   - Botões de ação rápida: "Nova OS" e "Relatórios"

2. **4 KPI Cards (antes eram 5):**
   - Total OS (com sparkline de 14 dias no canto)
   - Em Execução (com badge "+X abertas")
   - Concluídas Hoje (com alerta de atrasadas ou "Sem atrasos")
   - Receita Bruta (com badge de pendências financeiras linkando para /finance)

3. **Mini-cards financeiros (NOVO):**
   - 3 cards brancos: Receita Bruta, Comissões, Repasse Líquido
   - Dados vindos de `/finance/summary` (endpoint já existia, não era usado no dashboard)

4. **Gráfico de atividade (NOVO):**
   - Sparkline SVG puro (zero dependências) mostrando OS criadas nos últimos 14 dias
   - Dados de `/reports/orders` (endpoint `byDay` já existia)
   - Labels de data no eixo X, responsivo

5. **Top Parceiros (NOVO):**
   - Ranking dos 5 melhores parceiros/técnicos por OS concluídas
   - Avatar com iniciais, rating em estrelas, taxa de conclusão %
   - Medalhas de posição (ouro, prata, bronze)
   - Dados de `/reports/technicians` (endpoint já existia)

6. **Alertas de pendência financeira (NOVO):**
   - Barra amber/warning mostrando OS aguardando confirmação financeira
   - Link direto para /finance
   - Mostra até 3 + "X mais pendentes"

7. **Arquitetura de dados:**
   - `Promise.allSettled` para 5 chamadas paralelas (stats, orders, finance, reports, technicians)
   - Dashboard funciona mesmo se algum endpoint falhar (graceful degradation)
   - Seções financeiras aparecem só quando há dados

### Decisões técnicas:
- Sparkline chart 100% SVG/CSS — zero dependências (sem chart.js, recharts, etc.)
- `Promise.allSettled` em vez de `Promise.all` para resiliência
- Componentes funcionais e `useMemo` para performance
- 5 OS recentes (antes eram 8) para equilibrar com os novos painéis
- Finance summary e reports só aparecem se têm dados (empty state implícito)

### Build:
- Frontend: `npm run build` — 22 rotas, 0 erros
- Versão: 1.00.12 (codename: "Dashboard Pro")

### Arquivos modificados:
- `frontend/src/app/(dashboard)/dashboard/page.tsx` — reescrito completamente (360 → ~480 linhas)
- `version.json` — 1.00.12 "Dashboard Pro"

---

## Sessão 18 (continuação) + Sessão 19 — 22-23/02/2026
**Contexto:** Continuação da sessão 18 + nova sessão após compactação. Implementação do v1.00.13 "Workflow Blocos".

### Pedidos do Juliano:
1. Redesenhar o fluxo de atendimento como montagem em blocos (tipo programação em blocos)
2. Blocos lógicos encaixáveis: SE, Então, Sim, Não, Delay, Número, Texto, GPS, etc.
3. Estudar viabilidade e aprimorar a ideia, pensando no fluxo do técnico e visão do gestor
4. Após estudo e mockup aprovados: "Vamos fazer?"

### O que foi feito:

**FASE 0 — Estudo e Prototipagem:**
- Pesquisa profunda de paradigmas visuais: Scratch, Blockly, Node-RED, n8n, ServiceNow
- Mockup v1 (`mockup-workflow.html`): 6 tipos de blocos básicos
- Mockup v2 (`mockup-workflow-v2.html`): estudo completo com 38 blocos, builder layout, views técnico/gestor, análise de viabilidade, plano faseado A/B/C
- Juliano aprovou e decidiu implementar Fase A

**FASE 1 — Tipos e Catálogo (`workflow-blocks.ts`):**
- 16 BlockTypes: START, END, CONDITION, STEP, PHOTO, NOTE, GPS, QUESTION, CHECKLIST, SIGNATURE, FORM, NOTIFY, APPROVAL, ALERT, DELAY, SLA
- Block interface com grafo: `id, type, name, icon, config, next, yesBranch, noBranch`
- WorkflowDefV2: `{ version: 2, blocks: Block[] }`
- Config types específicos por bloco (StepConfig, PhotoConfig, QuestionConfig, etc.)
- CatalogEntry com metadata visual (color, borderColor, iconBg, textColor)
- BLOCK_CATALOG (16 entries), CATALOG_BY_CATEGORY, CATEGORY_LABELS
- Helpers: genBlockId, createBlock, getDefaultConfig, createDefaultWorkflow
- Graph helpers: findBlock, findStartBlock, findEndBlock, findParent, insertBlockAfter, removeBlock, countUserBlocks, walkChain
- V1→V2 converter: convertV1toV2, isV2Format, parseWorkflowSteps
- 6 categorias: FLOW (amber), ACTIONS (blue), COMMUNICATION (emerald), SYSTEM (violet)

**FASE 2 — Workflow Builder Page (reescrita completa ~750 linhas):**
- **AddBlockPopup**: Modal categorizado com grid de blocos disponíveis
- **BlockCard**: Renderiza blocos individuais com cores/badges por tipo, seleção ao clicar
- **Connector**: Linhas verticais com botão "+" para inserir blocos entre outros
- **FlowRenderer**: Componente recursivo que percorre o grafo e renderiza flowchart vertical com branches CONDIÇÃO (split SIM/NÃO com merge)
- **PropertiesPanel**: Sidebar direita com configuração específica por tipo (16 tipos suportados)
  - STEP: requirePhoto, requireNote, requireGPS
  - PHOTO: minPhotos, label, photoType select
  - QUESTION: pergunta + lista dinâmica de opções (add/remove)
  - CHECKLIST: lista dinâmica de items (add/remove)
  - CONDITION: pergunta do bloco condicional
  - NOTIFY: canal (sms/email/push), destinatário, mensagem
  - APPROVAL: role do aprovador, mensagem
  - DELAY: minutos de espera
  - SLA: maxMinutes, alertOnExceed toggle
  - STATUS: targetStatus select
  - GPS: requireAccuracy toggle
  - SIGNATURE: quem assina
  - ALERT: mensagem, severity select
- **WorkflowCard**: Card no list view com nome, contagem de blocos, preview mini dos blocos
- **Main page**: Toggle list/builder, CRUD via API existente, save em formato V2

**FASE 3 — Build e correções:**
- Fix `JSX.Element` → `React.ReactNode` (React 19 não exporta namespace JSX)
- Fix `showToast` → `toast` (nome correto do hook useToast)
- Fix ConfirmModal: adicionada prop `open` obrigatória
- Build: 22 rotas, 0 erros TypeScript

### Decisões técnicas:
- Grafo em vez de array flat — suporta branches (CONDITION com yesBranch/noBranch)
- V2 format (`{ version: 2, blocks: Block[] }`) armazenado na mesma coluna `steps Json` existente
- V1→V2 converter automático para backward compatibility
- FlowRenderer recursivo com `depth` para branches aninhados
- AddBlockPopup inserção via `insertBlockAfter` (manipulação de ponteiros next)
- PropertiesPanel com clone imutável (`{ ...blocks }`) para React detectar mudanças
- 4 categorias visuais com cores consistentes (amber=flow, blue=actions, emerald=comm, violet=system)
- Zero mudança no backend — usa mesmos endpoints PUT /workflows/:id

### Build:
- Frontend: `npm run build` — 22 rotas, 0 erros
- Versão: 1.00.13 (codename: "Workflow Blocos")

### Arquivos criados:
- `frontend/src/types/workflow-blocks.ts` — tipos, catálogo, helpers, conversor V1→V2

### Arquivos modificados:
- `frontend/src/app/(dashboard)/workflow/page.tsx` — reescrito completamente (~750 linhas, builder visual de blocos)
- `version.json` — 1.00.13 "Workflow Blocos"

### Mockups criados (estudo):
- `frontend/public/mockup-workflow.html` — mockup v1 (6 blocos)
- `frontend/public/mockup-workflow-v2.html` — mockup v2 completo (38 blocos, 3 views, viabilidade)

### Pendências futuras (Fases B e C):
- Fase B: Motor de execução V2 (interpretar blocos no backend), tela mobile do técnico para novos tipos
- Fase C: Drag-and-drop (atualmente click-to-add), template library, blocos custom

---

## Sessão 19 (continuação) — 23/02/2026
**Contexto:** Após teste visual do workflow builder, Juliano pediu "Parte pra outra feature".

### O que foi feito:
- **v1.00.14 "Exportar Dados" — Exportação CSV + PDF em todas as tabelas ✅ COMPLETA**

**Utilitário `export-utils.ts` (zero dependências):**
- `exportToCSV<T>(data, columns, filename)` — gera CSV com BOM UTF-8 para Excel
- Separador `;` (padrão Excel PT-BR)
- Escape de campos com vírgulas, aspas, newlines
- Formatters reutilizáveis: `fmtDate`, `fmtDateTime`, `fmtMoney`, `fmtStatus`
- Type `ExportColumn<T>` com `header` + `value(row) → string`

**Botão CSV nas 3 tabelas principais:**
- **Ordens de Serviço**: 11 colunas (título, cliente, status, técnico, valor, datas, prazo, endereço)
- **Parceiros**: 13 colunas (nome, fantasia, tipo pessoa, tipos, documento, telefone, email, status, rating, cidade, UF, especializações, data cadastro)
- **Financeiro**: 6 colunas (OS, receita bruta, comissão %, comissão R$, repasse líquido, data confirmação)

**Relatórios — CSV + PDF:**
- Botão CSV: exporta dados da tab ativa (Financeiro por mês, OS por status, Técnicos)
- Botão PDF: `window.print()` com CSS print-optimized

**CSS @media print:**
- Esconde sidebar (`[data-sidebar]`), header (`[data-header]`), botões, navegação
- Main content full-width, sem margin/padding
- `print-color-adjust: exact` para preservar cores dos gráficos SVG
- `break-inside: avoid` nos cards

### Decisões técnicas:
- CSV client-side (zero backend changes, zero deps)
- BOM UTF-8 garante acentos no Excel
- Separador `;` para PT-BR (Excel reconhece automaticamente como delimitador)
- `window.print()` para PDF em vez de library pesada (jsPDF) — navegador faz melhor
- Data attributes no HTML (data-sidebar, data-header, data-main) para CSS print targeting
- Botão CSV consistente em todas as páginas (mesmo ícone SVG, mesmo estilo)

### Build:
- Frontend: `npm run build` — 22 rotas, 0 erros
- Versão: 1.00.14 (codename: "Exportar Dados")

### Arquivos criados:
- `frontend/src/lib/export-utils.ts` — utilitário CSV + formatters

### Arquivos modificados:
- `frontend/src/app/(dashboard)/orders/page.tsx` — botão CSV + ExportColumn[]
- `frontend/src/app/(dashboard)/partners/page.tsx` — botão CSV + ExportColumn[]
- `frontend/src/app/(dashboard)/finance/page.tsx` — botão CSV + ExportColumn[]
- `frontend/src/app/(dashboard)/reports/page.tsx` — botões CSV + PDF
- `frontend/src/app/globals.css` — @media print styles
- `frontend/src/components/layout/Sidebar.tsx` — data-sidebar attribute
- `frontend/src/components/layout/Header.tsx` — data-header attribute
- `frontend/src/components/layout/AuthLayout.tsx` — data-main attribute
- `version.json` — 1.00.14 "Exportar Dados"

---

## Sessão 20 — v1.00.15 "Motor V2" (23/02/2026)

### Contexto:
O builder visual de blocos (v1.00.13) criava templates V2 com grafo de blocos, mas o motor de execução backend e a tela mobile do técnico ainda funcionavam com o formato V1 linear. Esta sessão implementa o motor V2 completo.

### Decisões técnicas:
- **Backward-compatible:** Motor detecta automaticamente V1 vs V2 pela presença de `{ version: 2, blocks: [...] }`
- **Schema incremental:** Adicionados `blockId String?` e `responseData Json?` ao WorkflowStepLog (colunas opcionais, V1 não quebra)
- **stepOrder mantido:** Para V2, stepOrder = sequential completion order (1, 2, 3...) — mantém unique constraint e compatibilidade
- **normalizeBranches():** Corrige branches onde o builder deixa o último bloco com next=null, conectando ao merge-point do CONDITION
- **Auto-complete:** Blocos de sistema (NOTIFY, ALERT, STATUS, DELAY, SLA, RESCHEDULE) são automaticamente completados quando o engine os alcança
- **Validação por tipo:** Cada BlockType tem regras próprias (PHOTO requer foto, QUESTION requer answer, CHECKLIST requer checkedItems, GPS requer lat/lng, etc.)
- **CONDITION branching:** Resposta "SIM" → yesBranch, "NÃO" → noBranch, com fallback para block.next

### O que foi implementado:
1. **Schema Prisma:** `blockId`, `responseData`, `@@index([serviceOrderId, blockId])` no WorkflowStepLog
2. **StepProgressDto:** Campos `blockId` e `responseData` adicionados
3. **workflow-engine.service.ts:** Reescrito (~530 linhas) com:
   - `getProgressV1()` / `getProgressV2()` — detecção automática
   - `advanceStepV1()` / `advanceBlockV2()` — lógica separada por versão
   - `validateBlockRequirements()` — validação por tipo de bloco
   - `normalizeBranches()` — fix de branches no grafo
   - `resetStep()` — suporta V1 (por stepOrder) e V2 (por blockId)
   - Auto-complete de blocos sistema na transação
4. **workflow.service.ts:** `validateSteps()` detecta V2 e valida START/END/blocos
5. **workflow.controller.ts:** Aceita `steps: any` (V1 array ou V2 object)
6. **workflow-engine.controller.ts:** Reset aceita stepOrder (int) ou blockId (string)
7. **Tela mobile do técnico:** Reescrita (~800 linhas) com:
   - Detecção V1/V2 automática
   - UI específica por BlockType:
     - STEP: nota/foto opcional
     - PHOTO: upload obrigatório
     - NOTE: textarea
     - GPS: botão "Registrar localização" com geolocation API
     - QUESTION: radio buttons com opções configuráveis
     - CHECKLIST: checkboxes
     - CONDITION: botões Sim/Não
     - SIGNATURE: upload de imagem
     - FORM: campos dinâmicos (text/number/select)
   - V1 legacy rendering intacto

### Build:
- Frontend: `npm run build` — 22 rotas, 0 erros
- Backend: `npx nest build` — 0 erros (1 fix de tipo no Map<number, any>)
- Versão: 1.00.15 (codename: "Motor V2")

### Arquivos modificados:
- `backend/prisma/schema.prisma` — WorkflowStepLog + blockId, responseData, index
- `backend/src/workflow/dto/step-progress.dto.ts` — blockId, responseData
- `backend/src/workflow/workflow-engine.service.ts` — reescrito com V1+V2 dual engine
- `backend/src/workflow/workflow.service.ts` — validação V2
- `backend/src/workflow/workflow.controller.ts` — aceita steps V2
- `backend/src/workflow/workflow-engine.controller.ts` — reset V2 por blockId
- `frontend/src/app/tech/orders/[id]/page.tsx` — reescrito com UI V2 por tipo de bloco
- `version.json` — 1.00.15 "Motor V2"

---

## Sessão 21 — 23/02/2026
**Contexto:** Após v1.00.15, Juliano pediu para implementar o motor de automação como próxima feature.

### Pedidos do Juliano:
- Motor de automação como evolução do workflow — configurável pelo gestor
- Blocos visuais tipo quebra-cabeça para montar regras

### O que foi feito:
- **v1.00.16 "Motor de Automação"** — Sistema de automação event-driven completo
- Backend: AutomationRule + AutomationExecution models, AutomationService, AutomationEngineService
- Dispatch de eventos em ServiceOrderService
- Frontend: builder guiado QUANDO→SE→ENTÃO, automation-blocks.ts
- Ações: SEND_NOTIFICATION, CHANGE_STATUS, LAUNCH_FINANCIAL

---

## Sessões 22-25 — 23/02/2026
**Contexto:** Implementação das 6 fases do roadmap de evolução do motor de automação.

### O que foi feito (6 fases em sequência):
- **v1.00.17 "Financeiro Expandido"** — FinancialEntry model, status tracking, página /finance com 4 abas
- **v1.00.18 "Campos & Ações"** — 6 novos campos condicionáveis, tipo date, 3 novas ações
- **v1.00.19 "Parceiro Automatizado"** — PARTNER como entidade automatizável
- **v1.00.20 "Decisão Binária"** — ConditionNode com árvore SIM/NÃO, BranchDef
- **v1.00.21 "Canvas Visual"** — Canvas SVG drag-and-drop com blocos e conexões tipadas
- **v1.00.22 "Templates & Debug"** — Templates prontos, simulação dry-run, timeline de execuções

### Arquivos criados (principais):
- `backend/src/automation/` — controller, service, engine, template-service, template-controller, DTOs
- `frontend/src/app/(dashboard)/automation/` — page.tsx (1455 linhas, form+canvas), 8 componentes
- `frontend/src/types/automation-blocks.ts` — tipos, campos, operadores, ações
- `frontend/src/types/finance.ts` — tipos financeiros
- `backend/prisma/schema.prisma` — AutomationRule, AutomationExecution, AutomationTemplate, FinancialEntry

---

## Sessão 26 — 23/02/2026
**Contexto:** Continuação de sessão que ficou sem contexto. Teste completo do sistema.

### O que foi feito:
- Criado workflow complexo "Atendimento Técnico Completo" (21 blocos, 3 conditions, 4 caminhos)
- Testada resiliência da árvore (add/remove blocos no meio → reconecta perfeitamente)
- Criadas 3 automações: financeiro ao concluir, notificação ao atribuir, alerta por valor
- **4 cenários de workflow testados com sucesso:**
  - Cenário 1: Reparo SIM → Complexo SIM (15/15 etapas) ✅
  - Cenário 2: Reparo NÃO → Retorno SIM (13/13 etapas) ✅
  - Cenário 3: Reparo SIM → Complexo NÃO (14/14 etapas) ✅
  - Cenário 4: Reparo NÃO → Retorno NÃO (12/12 etapas) ✅
- 4 OS confirmadas financeiramente (R$ 1.080 bruto, R$ 108 comissão, R$ 972 líquido)
- Fix V2 workflow na página OS (normaliseWfSteps para V1/V2 compat)

### ⚠️ DESENTENDIMENTO IDENTIFICADO:
**Juliano apontou que houve uma confusão** causada pela pausa entre chats:
> "esse automação que vc criou era pra ser o fluxo de atendimento, o motor central de configuração de todo o sistema, os bloco eram para ser de encaixe tipo quebra cabeça"

**O que foi criado (ERRADO):** Dois sistemas separados:
1. `/workflow` — Fluxo de atendimento do técnico (builder vertical de blocos)
2. `/automation` — Motor de automação (QUANDO→SE→ENTÃO + canvas visual)

**O que deveria existir (CORRETO):** Um ÚNICO motor central com canvas visual de blocos de encaixe tipo quebra-cabeça. O fluxo de atendimento seria construído DENTRO do motor de automação — não como sistema separado.

### Decisão do Juliano:
> "o nome no bar vai ser fluxo de atendimento, o prompt onde vai ser montado o fluxo de atendimento vai seguir o modelo do Mit app inventor, blocos quebra cabeça, ali sera possível definir toda a rodagem do sistema, desde o inicio de uma os até a finalização e oque acontece no financeiro"

### Notas técnicas importantes:
- Logins: admin@demo.com / admin123, despacho@demo.com / despacho123 (tecnico@demo.com NÃO existe)
- UUIDs de seed NÃO são UUID v4 válidos — usar UUIDs reais
- Workflow V2 API: GET /service-orders/:id/workflow, POST .../advance com dto por tipo de bloco
- Logs consolidados de 5 arquivos → 2 (PROJETO_LOG.md + CHAT_LOG.md)

---

## Sessão 27 — 23/02/2026
**Contexto:** Implementação da unificação Workflow + Automação → "Fluxo de Atendimento" com blocos puzzle-piece.

### Pedido do Juliano:
- Unificar os dois sistemas em um só
- Nome no sidebar: "Fluxo de Atendimento"
- Builder estilo MIT App Inventor com blocos de encaixe
- Deve definir a rodagem completa: início da OS → finalização → financeiro

### O que foi implementado (v1.00.23 "Fluxo Unificado"):

**Arquivo de tipos unificado — `frontend/src/types/flow-blocks.ts`:**
- 22 tipos de bloco em 7 categorias
- 4 formas de puzzle: cap (trigger), stack (maioria), wrap (condição), end (fim)
- Catálogo completo com cores, ícones, config fields, descrições
- 8 eventos gatilho (6 para OS, 2 para Parceiro)
- Formato v3 FlowDefinition com children arrays + branching

**4 componentes novos no builder puzzle-piece:**
1. `PuzzleBlock.tsx` — Bloco visual com SVG puzzle connectors (tab/notch)
2. `PuzzlePalette.tsx` — Sidebar com categorias accordion, drag & drop
3. `BlockConfigPanel.tsx` — Painel lateral de configuração dinâmica
4. `FlowBuilder.tsx` — Builder principal com empilhamento vertical, branching SIM/NÃO, drag zones

**Página `/workflow` reconstruída:**
- Lista de fluxos com cards mostrando trigger, categorias, contagem
- Builder puzzle-piece integrado
- Suporte backward compat v1/v2/v3 (conversão automática)

**Sidebar:**
- Removido item "Automações" (`/automation`)
- Mantido "Fluxo de Atendimento" (`/workflow`)

**Backend — WorkflowEngineService estendido:**
- Detecção e conversão v3 → v2 automática no engine
- Novo método `executeSystemBlock()` para blocos auto-completados
- 10 tipos de bloco executáveis: STATUS_CHANGE, FINANCIAL_ENTRY, NOTIFY, ALERT, WEBHOOK, ASSIGN_TECH, DUPLICATE_OS, DELAY, SLA, RESCHEDULE
- FinanceService injetado para lançamento financeiro via bloco

### Decisões técnicas:
- Formato v3 usa children arrays (vs v2 linked-list com next pointers)
- Backend converte v3→v2 on-the-fly para processar no engine existente
- Página /automation mantida no código mas removida da sidebar (backward compat)
- Puzzle shapes renderizados com SVG paths (convex tab top, concave notch bottom)
- Condition blocks mostram branches SIM/NÃO lado a lado com drop zones independentes

### Resultado:
- frontend build ✅ (0 erros)
- backend build ✅ (0 erros)
- Sistema unificado acessível em /workflow

---

## Sessão 29 — 23/02/2026
**Contexto:** Verificação visual dos blocos NOTIFY e ASSIGN_TECH + fix de bug na API de partners.

### O que foi feito:
- **Verificação visual via Chrome MCP:**
  - NOTIFY block: confirmado que campo "Especialização" foi removido ✅
  - ASSIGN_TECH block: multi-select checklist de especializações funcionando ✅
  - Seleção múltipla (Elétrica + Hidráulica) com contador "(2 selecionadas)" ✅
  - Estratégia "Técnico Atribuído (da OS)" com campos condicionais cascata ✅
- **Bug encontrado: dropdown de técnicos vazio**
  - Causa: API `/partners?limit=500` retornava 400 Bad Request
  - PaginationDto tem `@Max(100)` no campo limit — 500 excedia o máximo
  - Fix: alterado de `limit=500` para `limit=100&type=TECNICO` em workflow/page.tsx
  - Após fix: 4 técnicos carregados corretamente (Ana Técnica, Carlos Técnico, Juliano José Triaca, Roberto Multifuncional)

### Decisões técnicas:
- DynamicOptions pattern: campo `optionsFrom` no catálogo de blocos carrega opções dinamicamente do banco
- `showWhen` conditional visibility: campos mostrados/ocultos baseado no valor de outros campos
- Filtro `type=TECNICO` movido para server-side (mais eficiente que filtrar client-side)

---

## Sessão 30 — 23/02/2026
**Contexto:** Juliano pediu campo "Atribuir Técnico" nos formulários de criação e edição de OS. Também apontou que PROJETO_LOG e CHAT_LOG não estavam sendo atualizados.

### Pedidos do Juliano:
- Adicionar campo "Atribuir Técnico" abaixo da Descrição nos formulários de OS (new + edit)
- 3 opções com radio buttons:
  1. "Todos com a seguinte especialização" (default) → campo multi-select especialização
  2. "Técnicos direcionados" → campo multi-select técnicos
  3. "Por fluxo de atendimento" → campo single-select workflow
- Cada campo com lupa (🔍) que abre SearchLookupModal
- Atualizar PROJETO_LOG.md e CHAT_LOG.md (estavam parados na sessão 28)

### O que foi implementado (v1.00.24 "Atribuir Técnico"):

**Schema Prisma — 3 novos campos em ServiceOrder:**
- `techAssignmentMode` String @default("BY_SPECIALIZATION")
- `requiredSpecializationIds` String[] @default([])
- `directedTechnicianIds` String[] @default([])

**Backend:**
- DTOs Create e Update atualizados com campos de atribuição
- ServiceOrderService: create/update/duplicate salvam os novos campos
- GET /specializations: agora paginado com search ({ data, meta })
- GET /workflows: agora paginado com search ({ data, meta })
- Consumidores antigos (workflow/page.tsx, partners/page.tsx) atualizados para novo formato

**Frontend — Novos componentes:**
1. `MultiLookupField.tsx` — Multi-select com chips/tags:
   - Chips azuis removíveis com X
   - Lupa abre SearchLookupModal
   - No modal: checkbox visual indica itens já selecionados
   - Toggle: clique adiciona/remove (não fecha modal)
2. `TechAssignmentSection.tsx` — Seção compartilhada:
   - 3 radio buttons estilizados
   - Campo de lookup condicional (só aparece quando opção selecionada)
   - Fetchers internos para especialização, técnicos, workflows
   - Prop `disabled` para status terminal

**Integração nos formulários:**
- `/orders/new/page.tsx`: estados + TechAssignmentSection entre Descrição e Endereço + payload no submit
- `/orders/[id]/edit/page.tsx`: mesma integração + pré-população dos dados salvos (resolve IDs → objetos)

### Decisões técnicas:
- MultiLookupField não fecha modal ao selecionar (permite múltiplas seleções rápidas)
- Checkbox visual no modal para indicar estado selecionado/deselecionado
- Pré-população na edição: busca todas especializations/technicians e filtra pelos IDs salvos
- Radio buttons controlam qual campo de lookup é exibido (apenas o modo ativo mostra o campo)
- workflowTemplateId reaproveitado do schema existente (sem campo novo)

### Resultado:
- backend build ✅ (0 erros)
- frontend build ✅ (0 erros, 22 rotas)
- PROJETO_LOG.md atualizado com sessões 29 e 30
- CHAT_LOG.md atualizado com sessões 29 e 30
- version.json: 1.00.24 "Atribuir Técnico"

---

## Sessão 31 — 23/02/2026
**Contexto:** Continuação da sessão 30 (após compactação de contexto). Juliano perguntou como montar conteúdo de mensagem no fluxo, depois pediu melhorias no bloco NOTIFY com multi-destinatário e campo "Contato no Local" na OS.

### Pedidos do Juliano:
1. "Ao criar um fluxo, qual próximo bloco devo colocar para criar o conteúdo da mensagem?" → Explicado que NOTIFY já tem campo mensagem embutido
2. Redesenhar bloco NOTIFY com:
   - Múltiplos destinatários (não apenas um)
   - Cada destinatário recebe informações diferentes
   - **Gestor:** cliente, endereço, serviço, valor total
   - **Técnico:** valor comissão, prazo, endereço, nome de quem vai estar no local
   - **Cliente:** Mensagem texto livre
   - Criar campo "Contato no Local" na OS (nome de quem estará no local)

### O que foi implementado (v1.00.25 "NOTIFY Multi-Destinatário"):

**Backend (completado na sessão anterior via Task agent):**
- Schema: `contactPersonName String?` em ServiceOrder
- DTOs: campo adicionado em Create e Update
- Service: create/update/duplicate salvam contactPersonName
- Engine: NOTIFY case reescrito com 20+ variáveis de template e multi-destinatário

**Frontend — Campo "Contato no Local":**
- Input field adicionado em ambos formulários (new/page.tsx + [id]/edit/page.tsx)
- Posicionado entre Descrição e seção Atribuir Técnico
- Pré-populado na edição a partir de `order.contactPersonName`
- Incluído no payload de submit

**Frontend — Redesign do bloco NOTIFY (flow-blocks.ts):**
- Novo tipo de campo `recipients` adicionado ao union type de FlowConfigField
- `NotifyRecipient` interface: type (GESTOR/TECNICO/CLIENTE/PARCEIRO), enabled, channel, message
- `NOTIFY_TEMPLATE_VARS`: 15 variáveis agrupadas em 3 grupos (OS, Financeiro, Pessoas)
- `DEFAULT_NOTIFY_RECIPIENTS`: templates padrão com mensagens relevantes por tipo
- Bloco NOTIFY usa `configFields: [{ id: 'recipients', type: 'recipients' }, { id: 'includeLink', type: 'toggle' }]`

**Frontend — UI de Destinatários (BlockConfigPanel.tsx):**
- Novo case `recipients` no switch do ConfigField
- Para cada destinatário (Gestor 👔, Técnico 👷, Cliente 👤):
  - Checkbox enable/disable com borda colorida (emerald quando ativo)
  - Select de canal (WhatsApp/SMS/Email) no header
  - Textarea de mensagem expandível quando habilitado
  - Chips de variáveis clicáveis ({titulo}, {valor}, {comissao}, etc.) para inserção rápida
- Placeholder contextual por tipo de destinatário

### Decisões técnicas:
- Variáveis usam formato `{nome}` (chaves simples) em vez de `{{nome}}` — mais limpo e fácil de digitar
- Inserção de variável adiciona ao final do texto (append) — simples e previsível
- Cada destinatário tem canal independente (pode ser WhatsApp pro gestor e SMS pro cliente)
- Engine faz backward compat: se `config.recipients` não existe, usa `config.recipient` antigo
- DEFAULT_NOTIFY_RECIPIENTS define templates sensatos: gestor recebe tudo, técnico recebe comissão/prazo/endereço/contato, cliente recebe mensagem livre

### Resultado:
- backend build ✅ (0 erros)
- frontend build ✅ (0 erros, 22 rotas)
- PROJETO_LOG.md atualizado com sessão 31
- CHAT_LOG.md atualizado com sessão 31
- version.json: 1.00.25 "NOTIFY Multi-Destinatário"

---

## Sessão 31 (continuação) — 23/02/2026
**Contexto:** Juliano pediu fix no toggle "Incluir link da OS" (estava global, deveria ser só do técnico). Depois perguntou sobre como montar fluxo com timeout + trigger antecipado.

### Pedidos do Juliano:
1. "Vi que no bloco de mensagem no final tem a opção de incluir link da OS, esse link vai pra todos ou só para os técnicos?" → Fix: moveido para per-recipient (só TECNICO)
2. "após o disparo da mensagem devo colocar um tempo correto? mas se algum dos tecnico aceitar a OS antes desse tempo já deve ter o disparo" → Explicado padrão event-driven
3. "Isso crie o bloco Aguardar verificando, e nas configurações dele, condições que ele espera pra disparar antes do tempo" → Implementação do bloco WAIT_FOR

### Fix includeLink:
- `NotifyRecipient` interface: adicionado `includeLink?: boolean`
- `DEFAULT_NOTIFY_RECIPIENTS`: `includeLink: true` apenas no TECNICO
- `NOTIFY` configFields: removido campo global `includeLink`
- `BlockConfigPanel.tsx`: toggle "Incluir link da OS" aparece SOMENTE na seção do TECNICO
- `workflow-engine.service.ts`: link da OS só é appendado quando `r.includeLink === true`

---

## Sessão 32 — 24/02/2026
**Contexto:** Continuação do pedido do bloco "Aguardar Verificando". Planejamento e implementação completa.

### Pedidos do Juliano:
1. Criar bloco "Aguardar Verificando" com:
   - Tempo configurável de timeout
   - Condições de trigger antecipado (técnico aceitar, status mudar, etc.)
   - Ação ao expirar (continuar ou encerrar)

### O que foi implementado (v1.00.26 "Aguardar Verificando"):

**Infraestrutura:**
- `@nestjs/schedule` instalado e `ScheduleModule.forRoot()` em app.module.ts
- Schema: enum `WaitStatus` + model `PendingWorkflowWait` com indexes otimizados
- Migration via `prisma db push`

**Frontend:**
- `WAIT_FOR` adicionado ao FlowBlockType e FLOW_CATALOG com 4 configFields
- `shouldShowField` corrigido para suportar arrays como currentVal (checklist showWhen)

**Backend — WaitForService (novo):**
- Cron `@Cron(EVERY_MINUTE)`: busca waits expirados, resolve com update atômico
- `checkEarlyTrigger()`: mapeia eventos → condições, resolve matching waits
- Cancelamento automático de waits quando OS é cancelada
- Resolve wait → atualiza WorkflowStepLog + cria ServiceOrderEvent → chama resumeFromBlock()

**Backend — WorkflowEngineService:**
- While-loop em advanceBlockV2: detecta WAIT_FOR → cria PendingWorkflowWait → BREAK
- Novo `resumeFromBlock()`: re-entra no loop de system blocks a partir de blockId
- `getProgressV2()`: WAIT_FOR com status WAITING = bloco não completado (pausa aqui)

**Integração:**
- WorkflowModule: WaitForService registrado e exportado
- ServiceOrderModule: importa WorkflowModule
- dispatchAutomation(): chama checkEarlyTrigger() fire-and-forget

### Decisões técnicas:
- @nestjs/schedule em vez de bull/bullmq — sem Redis no projeto, cron suficiente
- Polling 1 min com index `(status, expiresAt)` — performante para carga SaaS
- Update atômico `WHERE status=WAITING` previne processamento duplo (concurrency-safe)
- WAIT_FOR detectado ANTES de executeSystemBlock no while-loop (break, não auto-complete)
- resumeFromBlock busca max(stepOrder) para evitar conflito de unique constraint
- forwardRef() para resolver dependência circular WaitForService ↔ WorkflowEngineService

### Resultado:
- backend build ✅ (0 erros)
- frontend build ✅ (0 erros, 22 rotas)
- PROJETO_LOG.md atualizado com sessão 32
- CHAT_LOG.md atualizado com sessão 32
- version.json: 1.00.26 "Aguardar Verificando"

---

## Sessão 33 — 23/02/2026
**Contexto:** Juliano disse que o builder de blocos puzzle-piece é muito complexo para gestores não-técnicos. Pediu algo que "até um leigo conseguiria montar" mas "rico em opções, com infinitas possibilidades". Pesquisa com 2 agentes recomendou abordagem "Template + Pipeline + Recipes" inspirada em FieldPulse ClearPath + Monday.com Recipes.

### Pedidos do Juliano:
1. Redesenhar o builder de fluxo para ser intuitivo para leigos
2. Rico em opções, infinitas possibilidades, mas fácil de usar
3. Incluir A_CAMINHO nos status do pipeline

### O que foi implementado (v1.00.27 "Pipeline Builder"):

**Arquitetura — Pipeline como camada UI sobre FlowDefinition V3:**
- Pipeline Builder é uma camada de abstração frontend-only
- PipelineDefinition (version: 4) → compilePipeline() → FlowDefinition (version: 3)
- Zero mudanças no backend de execução
- Decompilação bidirecional: workflows existentes podem abrir no Pipeline Builder
- Fallback: workflows com CONDITION/branching abrem no FlowBuilder ("Modo Avançado")

**Arquivo de tipos — `pipeline-types.ts`:**
- PipelineDefinition, PipelineStage, TechAction, AutoAction, PipelineRecipe
- TECH_ACTION_CATALOG (8 tipos): STEP, PHOTO, NOTE, GPS, CHECKLIST, SIGNATURE, FORM, QUESTION
- AUTO_ACTION_CATALOG (8 tipos): NOTIFY, FINANCIAL_ENTRY, WEBHOOK, ALERT, ASSIGN_TECH, DUPLICATE_OS, DELAY, SLA
- OS_STAGES_DEFAULT: 7 estágios incluindo A_CAMINHO
- RECIPE_TEMPLATES: 7 receitas prontas (notificar técnico, lançar comissão, etc.)
- PIPELINE_TEMPLATES: 5 templates completos (Instalação, Manutenção, Vistoria, Urgente, Simples)
- Factory helpers: createDefaultPipeline(), createEmptyStage(), etc.

**Compilador — `pipeline-compiler.ts`:**
- compilePipeline(): converte stages → blocos V3 ordenados (TRIGGER_START → STATUS_CHANGE → FIELD blocks → END)
- decompilePipeline(): identifica STATUS_CHANGE como fronteiras de estágio, classifica blocos, retorna null se CONDITION presente

**10 componentes UI criados:**
1. `TemplateGallery.tsx` — Modal com 5 templates + "Começar do Zero", cards com gradient e preview
2. `PipelineStageBar.tsx` — Barra horizontal de chips coloridos com arrows, drag & drop, add/remove
3. `TechActionList.tsx` — Lista sortável de ações do técnico com config expandível
4. `AutoActionList.tsx` — Ações automáticas split em "Ao Entrar" / "Ao Sair"
5. `RecipeEditor.tsx` — UI frase "Quando [trigger] → Então [action]" com chips coloridos
6. `RecipeGallery.tsx` — Grid de 7 receitas prontas
7. `StageConfigPanel.tsx` — 4 tabs: Técnico | Automáticas | Receitas | Config
8. `PipelineBuilder.tsx` — Orquestrador principal com toolbar, stage bar, config panel

**Página workflow/page.tsx — refatorada:**
- View state machine: list → template_gallery → pipeline → advanced
- "Novo Fluxo" → abre Template Gallery (não mais builder direto)
- Editar existente → tenta decompile → pipeline ou fallback advanced
- Toggle bidirecional Pipeline ↔ Modo Avançado
- Save: compila pipeline → FlowDefinition V3 → API POST

**Prisma — A_CAMINHO adicionado:**
- Enum ServiceOrderStatus: A_CAMINHO entre ATRIBUIDA e EM_EXECUCAO
- `prisma db push` executado com sucesso

### Decisões técnicas:
- Pipeline é abstração frontend-only — backend não precisa saber que existe
- compilePipeline() gera FlowDefinition V3 identica ao que FlowBuilder geraria
- decompilePipeline() retorna null para workflows com CONDITION (branching = modo avançado)
- Templates usam deep clone (JSON.parse(JSON.stringify)) para evitar mutação
- Receitas são "frases" legíveis: "Quando OS entrar em Execução → Então Notificar técnico"
- FlowBuilder (puzzle-piece) mantido intacto como "Modo Avançado"
- A_CAMINHO já existia no frontend (OS_STATUS_VALUES) mas faltava no Prisma enum

### Resultado:
- frontend build ✅ (0 erros, 22 rotas)
- backend build ✅ (0 erros)
- prisma db push ✅ (A_CAMINHO adicionado)
- version.json: 1.00.27 "Pipeline Builder"

### Arquivos criados:
- `frontend/src/types/pipeline-types.ts` — tipos, catálogos, templates, helpers
- `frontend/src/types/pipeline-compiler.ts` — compilePipeline + decompilePipeline
- `frontend/src/app/(dashboard)/workflow/components/TemplateGallery.tsx`
- `frontend/src/app/(dashboard)/workflow/components/PipelineBuilder.tsx`
- `frontend/src/app/(dashboard)/workflow/components/PipelineStageBar.tsx`
- `frontend/src/app/(dashboard)/workflow/components/StageConfigPanel.tsx`
- `frontend/src/app/(dashboard)/workflow/components/TechActionList.tsx`
- `frontend/src/app/(dashboard)/workflow/components/AutoActionList.tsx`
- `frontend/src/app/(dashboard)/workflow/components/RecipeEditor.tsx`
- `frontend/src/app/(dashboard)/workflow/components/RecipeGallery.tsx`

### Arquivos modificados:
- `frontend/src/app/(dashboard)/workflow/page.tsx` — nova view machine (4 views)
- `backend/prisma/schema.prisma` — A_CAMINHO no enum ServiceOrderStatus
- `version.json` — 1.00.27 "Pipeline Builder"
- `PROJETO_LOG.md` — sessão 33
- `CHAT_LOG.md` — sessão 33

---

## Sessão 34 — 24/02/2026
**Contexto:** Pipeline Builder (v1.00.27) não funcionava. O compilador gerava formato V3 mas a validação do backend (`workflow.service.ts` linha 98) só aceita V2. Formato V3 caía no check V1 e falhava com "O fluxo deve ter pelo menos 1 etapa". Além disso, Juliano pediu redesign radical: "uma página grande de rolar, onde cada ação tem centenas de opções de marcar e desmarcar".

### Pedidos do Juliano:
1. "Não está funcionando, vamos refazer o fluxo de atendimento do zero"
2. "Apague toda a parte de montagem de blocos não vamos mais precisar dele"
3. "Uma página com cada etapa de um fluxo de atendimento, em cada etapa, diversas opções de ligar ou desligar ações"
4. "Página grande de rolar, centenas de opções de marcar e desmarcar ou campos selecionáveis"
5. "Não tem necessidade de experiência em programação, apenas selecionar o que cada etapa vai acontecer"

### O que foi feito (v1.00.28 "Formulário de Etapas"):

**13 arquivos deletados:**
- FlowBuilder.tsx, PipelineBuilder.tsx, PuzzleBlock.tsx, PuzzlePalette.tsx
- BlockConfigPanel.tsx, TemplateGallery.tsx, PipelineStageBar.tsx, StageConfigPanel.tsx
- TechActionList.tsx, AutoActionList.tsx, RecipeEditor.tsx
- pipeline-types.ts, pipeline-compiler.ts

**Novo modelo de dados — `stage-config.ts`:**
- `StageConfig`: cada status OS = seção com toggles
  - 8 ações do técnico: step, photo, note, gps, checklist, form, signature, question
  - 8 ações automáticas: notifyGestor, notifyTecnico, notifyCliente, financialEntry, alert, webhook, assignTech, duplicateOS
  - 3 controles de tempo: sla, waitFor, delay
- `WorkflowFormConfig`: nome + stages[] + triggerEvent + isDefault
- 5 presets prontos: Instalação, Manutenção, Vistoria, Urgente, Simples
- `compileToV2()`: StageConfig[] → WorkflowDefV2 (version: 2, blocos com linked-list next)
  - Para cada etapa: STATUS → auto_enter → WAIT_FOR → tech_actions → auto_exit → próxima etapa
- `decompileFromV2()`: V2/V1/V3 → StageConfig[] para edição (retorna null se CONDITION presente)
- Labels PT-BR, variáveis de template para notificações, constantes de UI

**StageSection.tsx — componente reutilizável:**
- Card colapsável por etapa (7 etapas: Aberta → Aprovada)
- Toggle ativo/desativado no header com badge de contagem de ações
- 3 seções internas: "Ações do Técnico", "Ações Automáticas", "Controle de Tempo"
- Cada toggle revela config inline com expand (description, selects, checkboxes, listas dinâmicas)
- Componentes internos: Toggle, SubToggle, ConfigRow, SelectField, NumberField, TextField, TextAreaField
- ItemList (checklist/opções): lista dinâmica com add/remove
- FormFieldList: campos de formulário com nome/tipo/obrigatório
- Variáveis de template clicáveis ({titulo}, {valor}, etc.) na mensagem de notificação

**page.tsx — reescrita completa:**
- 2 views simples: list (cards de workflows) + form (formulário scrollável)
- Lista: cards com gradient colorido, nome, data criação, badge "Padrão", botões Editar/Excluir
- Formulário: sticky toolbar, campo nome, presets (chips clicáveis), 7 StageSection, resumo com badges
- Presets no topo preenchem automaticamente os toggles ao clicar
- Decompilação ao editar: tenta converter V2/V1 existente para StageConfig, fallback = reset
- Compilação ao salvar: converte StageConfig → V2 (aceito pela validação)

### Bug encontrado e resolvido:
- **Pipeline Builder v1.00.27 gerava V3** mas backend valida apenas V2 → save falhava sempre
- **Solução:** novo compilador gera V2 diretamente (version: 2, blocos com next pointers, START/END)

### Decisões técnicas:
- V2 format obrigatório para salvar — validação do backend rejeita V3
- Blocos V2 com next pointer (linked-list) em vez de children[] (V3)
- Tipos V3 (FINANCIAL_ENTRY, WEBHOOK, ASSIGN_TECH, etc.) incluídos em blocos V2 — engine os reconhece via executeSystemBlock()
- Decompilador suporta V1, V2 e V3 (para editar workflows antigos)
- Zero mudanças no backend — validação, engine e tela mobile inalterados
- CSS nativo com Tailwind: toggles peer-checked, configs com expand/collapse, sticky toolbar

### Resultado:
- frontend build ✅ (0 erros, 22 rotas)
- version.json: 1.00.28 "Formulário de Etapas"

### Arquivos criados:
- `frontend/src/types/stage-config.ts` — tipos, defaults, presets, compileToV2, decompileFromV2
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — componente de etapa

### Arquivos deletados (13):
- `frontend/src/app/(dashboard)/workflow/components/FlowBuilder.tsx`
- `frontend/src/app/(dashboard)/workflow/components/PipelineBuilder.tsx`
- `frontend/src/app/(dashboard)/workflow/components/PuzzleBlock.tsx`
- `frontend/src/app/(dashboard)/workflow/components/PuzzlePalette.tsx`
- `frontend/src/app/(dashboard)/workflow/components/BlockConfigPanel.tsx`
- `frontend/src/app/(dashboard)/workflow/components/TemplateGallery.tsx`
- `frontend/src/app/(dashboard)/workflow/components/PipelineStageBar.tsx`
- `frontend/src/app/(dashboard)/workflow/components/StageConfigPanel.tsx`
- `frontend/src/app/(dashboard)/workflow/components/TechActionList.tsx`
- `frontend/src/app/(dashboard)/workflow/components/AutoActionList.tsx`
- `frontend/src/app/(dashboard)/workflow/components/RecipeEditor.tsx`
- `frontend/src/types/pipeline-types.ts`
- `frontend/src/types/pipeline-compiler.ts`

### Arquivos reescritos:
- `frontend/src/app/(dashboard)/workflow/page.tsx` — completa reescrita (2 views: list + form)
- `PROJETO_LOG.md` — sessão 33
- `CHAT_LOG.md` — sessão 33

---

## Sessão 35 — 24/02/2026
**Contexto:** Continuação da sessão 34 (contexto compactado). Polimento e enriquecimento do formulário de etapas (v1.00.28 → v1.00.29).

### Pedidos do Juliano (em ordem):
1. Backend não estava rodando (port 4000) → iniciado com `npm run start:dev`
2. "As opções de ações automáticas vem antes de ações dos técnicos" → reordenou seções
3. "Na seleção de técnicos colocar opção de descartar técnicos que estão em atendimento no prazo de aceite" → discardBusyTechnicians
4. "A opção de link para os técnicos fica dentro do disparo de mensagens para técnicos" → reestruturou techLink para dentro de messageDispatch.toTechnicians.link
5. "Layout da página do link = esquema de montagem com blocos info + texto" → LinkPageBlock com pageLayout reordenável
6. "Todas as opções no mesmo padrão, com setas ▲▼, tire botão +, coloque 3 texto livre" → lista unificada de 13 campos fixos
7. "Botão de navegação GPS → Botão de ativação GPS, com texto explicativo" → rename + hint
8. "O que seria alert e webhook?" → explicação + hint text adicionado
9. "Antes delas colocar opção do sistema enviar pergunta para o técnico" → estudo + implementação techQuestion
10. "Atualize version, PROJETO_LOG e CHAT_LOG a cada implementação como padrão" → regra estabelecida

### Decisões técnicas:
- **Ordem das seções:** ⚡ Ações Automáticas → 👷 Ações do Técnico → ⏱️ Controle de Tempo
- **Link embedded:** techLink não é mais campo separado, vive dentro de messageDispatch.toTechnicians.link
- **PageLayout fixo:** 13 campos sempre presentes (10 info + 3 texto livre), não dinâmico — mais simples para o usuário
- **techQuestion auto-sync:** Ao ativar/editar techQuestion, techActions.question é populado automaticamente (labels only)
- **Decompilador inteligente:** QUESTION block com optionActions = techQuestion (rich), sem optionActions = question simples
- **Regra de logs:** A cada implementação, atualizar version.json + PROJETO_LOG.md + CHAT_LOG.md

### O que foi feito (v1.00.29 "Etapas Enriquecidas"):

**stage-config.ts — Tipos e modelo de dados:**
- `discardBusyTechnicians: boolean` em techSelection
- `techLink` removido como campo separado → embedded em messageDispatch.toTechnicians.link
- `LinkPageBlock` interface + `LINK_PAGE_FIELDS` constant (10 campos de info)
- pageLayout default: 13 items (10 info + 3 texto livre), todos reordenáveis e toggleáveis
- `TechQuestionOption` interface (label + action)
- `QUESTION_ACTIONS` constant (5 ações: accept, reject, reschedule, notify_gestor, none)
- `techQuestion` em autoActions: enabled, question, options[], required, showOnLinkPage
- Compiler: gera QUESTION block com optionActions enriquecido + required + showOnLinkPage
- Decompiler: detecta optionActions → popula techQuestion (rich) + sync com techActions.question
- Hints atualizados para alert e webhook

**StageSection.tsx — UI enriquecida:**
- Seções reordenadas: Auto → Tech → Time
- ABERTA tem 3 cards ricos: Seleção de Técnicos, Disparo de Mensagens, Pergunta para o Técnico
- discardBusyTechnicians SubToggle na seleção de técnicos
- Link config embedded dentro da mensagem para técnicos
- "Botão de ativação GPS" com texto explicativo
- Layout de página: lista unificada de 13 campos com ▲▼ + checkbox + icon + label
- Texto livre: input editável quando ativado
- Pergunta para o técnico: toggle + campo pergunta + lista de opções com dropdown de ação + add/remove + required + showOnLinkPage
- Auto-sync: todos handlers sincronizam techQuestion ↔ techActions.question

### Resultado:
- frontend build ✅ (0 erros, 22 rotas)
- version.json: 1.00.29 "Etapas Enriquecidas"

### Arquivos modificados:
- `frontend/src/types/stage-config.ts` — tipos, defaults, presets, compiler, decompiler
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — UI component
- `version.json` — 1.00.28 → 1.00.29
- `PROJETO_LOG.md` — sessão 35
- `CHAT_LOG.md` — sessão 35

---

## Sessão 35 (continuação) — 24/02/2026
**Contexto:** Juliano reportou erro ao editar fluxo + pediu botão duplicar + suporte a múltiplos fluxos.

### Pedidos do Juliano:
1. "Quando tento editar não está abrindo e aparece erro ao carregar fluxo" → bug fix
2. "Pode colocar o botão duplicar entre editar e excluir" → botão Duplicar
3. "O sistema tem que ter capacidade de trabalhar com um ou mais fluxos cadastrados" → já suportado, validado

### Bug encontrado e resolvido:
- **Causa:** `handleEdit` fazia `const full = res.data` mas `api.get()` já retorna o corpo da resposta diretamente (não tem wrapper `.data`). Resultado: `full` era `undefined`, `full.steps` lançava exceção → toast "Erro ao carregar fluxo"
- **Fix:** Removido `.data`, agora `const full = await api.get<WorkflowTemplate>(\`/workflows/${wf.id}\`)` — retorna objeto direto
- **Também corrigido:** `loadWorkflows` tinha `res.data?.data ?? res.data` redundante → simplificado para `res.data`

### O que foi feito (v1.00.30 "Fluxos Operacionais"):
- Bug fix handleEdit: `res.data` → `res` (api.get já retorna dado direto)
- Bug fix loadWorkflows: simplificado acesso aos dados
- Novo `handleDuplicate`: carrega fluxo, cria cópia com nome "(cópia)", isDefault: false
- Botão 📋 Duplicar (violeta) entre ✏️ Editar e 🗑️ Excluir nos cards
- Sistema suporta múltiplos fluxos: criar, editar, duplicar, excluir

### Resultado:
- frontend build ✅ (0 erros, 22 rotas)
- version.json: 1.00.30 "Fluxos Operacionais"

### Arquivos modificados:
- `frontend/src/app/(dashboard)/workflow/page.tsx` — bug fix + duplicar
- `version.json` — 1.00.29 → 1.00.30
- `PROJETO_LOG.md` — sessão 35 continuação
- `CHAT_LOG.md` — sessão 35 continuação

---

## Sessão 35 (continuação 2) — 24/02/2026
**Contexto:** Juliano reportou que mudanças no fluxo não persistem após salvar e reabrir.

### Pedido do Juliano:
"Clico em editar, faço mudanças dentro fluxo, clico em salvar, volta pra pagina inicial, mas ao clicar em editar novamente vejo que as mudanças não foram salvas"

### 3 bugs encontrados e corrigidos (v1.00.31 "Persistência Sólida"):

**Bug 1 — CRÍTICO: `messageDispatch.enabled` não restaurado**
- **Causa:** Decompilador processava blocos NOTIFY e populava todos os sub-campos (toTechnicians, link, pageLayout, toGestor, toCliente) mas NUNCA setava `messageDispatch.enabled = true`. O default era `false`.
- **Impacto na UI:** Seção "Disparo de mensagens" ficava oculta (toggle desligado). Ao salvar novamente, compilador via `messageDispatch.enabled === false` e usava caminho simples (sem linkConfig/pageLayout). Resultado: dados ricos perdidos permanentemente no re-save.
- **Fix:** Adicionado `stage.autoActions.messageDispatch.enabled = true` no handler NOTIFY após processar recipients.

**Bug 2 — ALTO: `pageLayout` perdia blocos desabilitados**
- **Causa:** Compilador fazia `pageLayout.filter(b => b.enabled)`, salvando APENAS blocos habilitados. No round-trip, blocos desabilitados desapareciam.
- **Impacto:** Se 3 de 13 campos estavam habilitados, após salvar+reabrir só 3 campos apareciam (impossível reativar os outros 10).
- **Fix compilador:** Removido `.filter()` — salva TODOS os 13 blocos (flag `enabled` preservado).
- **Fix decompilador:** Merge com defaults — blocos salvos mantêm ordem, novos defaults são adicionados ao final.

**Bug 3 — MÉDIO: QUESTION blocos duplicados**
- **Causa:** Quando `autoActions.techQuestion.enabled` é `true`, auto-sync ativa `techActions.question.enabled`. Compilador gerava 2 blocos QUESTION: um rico (com optionActions) das autoActions e um simples das techActions. No decompile, o segundo sobrescrevia o primeiro.
- **Fix:** Compilador pula `techActions.question` se `autoActions.techQuestion.enabled` já emitiu o bloco.

### Resultado:
- frontend build ✅ (0 erros, 22 rotas)
- version.json: 1.00.31 "Persistência Sólida"

### Arquivos modificados:
- `frontend/src/types/stage-config.ts` — 3 bugs corrigidos no compilador + decompilador
- `version.json` — 1.00.30 → 1.00.31
- `PROJETO_LOG.md` — sessão 35 continuação 2
- `CHAT_LOG.md` — sessão 35 continuação 2

---

## Sessão 35 (continuação 3) — 24/02/2026
**Contexto:** Juliano pediu minimizar/expandir etapas independente do toggle ativo.

### Pedido do Juliano:
"Colocar a opção de minimizar e expandir as telas na configuração do fluxo, hoje ela só expande quando ativada, e só minimiza quando desativada"

### O que foi feito (v1.00.32 "Accordion Etapas"):
- Estado `expanded` local (useState) independente de `stage.enabled`
- **Header:** Lado esquerdo (ícone + nome + badges) → clique expande/minimiza. Lado direito → toggle ativo/desativado
- **Seta ▶/▼:** Indica se está expandido ou minimizado (rotação CSS)
- **Ao ativar:** Auto-expande (setExpanded(true))
- **Minimizado + ativo:** Exibe badges coloridos resumindo ações configuradas:
  - ⚡ Ações automáticas (amber)
  - 👷 Ações do técnico (blue)
  - ⏱️ Controle de tempo (slate)
- **Desativado:** Mostra hint "Etapa desativada — ative o toggle para configurar"
- **Texto auxiliar:** "clique para expandir" aparece quando minimizado com ações

### Resultado:
- frontend build ✅ (0 erros, 22 rotas)
- version.json: 1.00.32 "Accordion Etapas"

### Arquivos modificados:
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — accordion expand/collapse
- `version.json` — 1.00.31 → 1.00.32
- `PROJETO_LOG.md` — sessão 35 continuação 3
- `CHAT_LOG.md` — sessão 35 continuação 3

---

## Sessão 35 (continuação 4) — 24/02/2026
**Contexto:** Juliano perguntou a diferença entre "Todos com a especialização da OS" e "Filtrar apenas técnicos com a especialização da OS".

### Pedido do Juliano:
"Na seleção de técnicos qual a diferença entre o campo 'Todos com a especialização da OS' e o 'Filtrar apenas técnico com especialização da OS'?"

### Análise:
- **"Todos com a especialização da OS"** = radio button em TECH_SELECTION_METHODS (method: BY_SPECIALIZATION) — define o MÉTODO de seleção
- **"Filtrar apenas técnicos com a especialização da OS"** = checkbox filterBySpecialization — era pra ser um filtro adicional
- Na prática: **redundantes** — ambos fazem a mesma coisa (filtrar por especialização)

### O que foi feito (v1.00.33 "Seleção Limpa"):
- Removido checkbox `filterBySpecialization` da UI (era redundante com radio BY_SPECIALIZATION)
- Campo mantido no tipo/compiler/decompiler para backward compat
- Build: frontend 0 erros, 22 rotas

---

## Sessão 36 — 24/02/2026
**Contexto:** Sessão reconectada após desconexão. Juliano estabeleceu nova regra: SEMPRE atualizar CHAT_LOG e PROJETO_LOG antes E depois de cada modificação, junto com bump de versão.

### Nova regra permanente:
- ANTES de implementar: atualizar logs com o que será feito
- DEPOIS de implementar: atualizar logs com resultado + bump versão

### Pedidos do Juliano:
1. Verificar se o "Tempo para aceitar" no Fluxo está correto — ✅ verificado, está OK
2. Adicionar campo "Tempo para aceite" no cadastro/edição de OS (horas, minutos, ou definido no fluxo)
3. Cuidar com redundâncias, textos explicativos, mecanismos anti-redundância

### Diagnóstico (antes de implementar):
- **Workflow > Tempo para aceitar:** ✅ Implementado (3 opções: Minutos, Horas, Tempo definido na OS)
- **OS Criação (new/page.tsx):** ✅ Implementado (3 opções: Minutos, Horas, Definido no fluxo)
- **OS Edição (edit/page.tsx):** ❌ FALTANDO — não carrega nem salva acceptTimeoutMinutes
- **Textos explicativos:** ❌ Faltam dicas anti-redundância
- **Proteção circular:** ❌ Se workflow="da OS" e OS="do fluxo" → sem fallback

### O que foi feito (v1.00.34 "Aceite Completo"):

**1. Edição de OS — acceptTimeoutMinutes completo:**
- Estado: `acceptTimeoutMode` ('minutes' | 'hours' | 'from_flow') + `acceptTimeoutValue`
- Load: carrega do backend, converte minutos→horas quando valor é divisível por 60
- Save: envia `acceptTimeoutMinutes` (horas×60 ou minutos, null para from_flow)
- UI: seção com radio buttons + number input + hints

**2. Textos explicativos anti-redundância (3 locais):**

| Local | Texto principal | Hints por opção | Aviso |
|-------|----------------|-----------------|-------|
| OS Criação | "Quanto tempo o técnico tem para aceitar esta OS antes de expirar" | Minutos/Horas: "Define um tempo fixo...", Fluxo: "Usa o tempo configurado no fluxo (evita duplicidade)" | ⚠️ "Este valor sobrescreve a configuração do fluxo" |
| OS Edição | Idem | Idem | Idem |
| Workflow | "Quanto tempo o técnico tem para aceitar antes de expirar" | Minutos/Horas: "Tempo padrão fixo para todas as OS", OS: "Cada OS define seu próprio tempo" | ⚠️ "A OS pode sobrescrever este tempo com um valor próprio" |

**3. Diferenciação Prazo vs Aceite:**
- "Prazo" renomeado para "Prazo de execução" com hint "Data limite para concluir o serviço"
- Evita confusão entre prazo de execução (deadlineAt) e tempo de aceite (acceptTimeoutMinutes)

### Resultado:
- frontend build ✅ (0 erros, 22 rotas)
- version.json: 1.00.34 "Aceite Completo"

### Arquivos modificados:
- `frontend/src/app/(dashboard)/orders/[id]/edit/page.tsx` — acceptTimeout state/load/save/UI
- `frontend/src/app/(dashboard)/orders/new/page.tsx` — textos explicativos + anti-redundância
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — textos explicativos + anti-redundância
- `version.json` — 1.00.33 → 1.00.34
- `PROJETO_LOG.md` — sessão 36
- `CHAT_LOG.md` — sessão 36

---

## Sessão 36 (continuação) — 24/02/2026
**Contexto:** Juliano pediu: (1) renomear "aceite" → "aceitar", (2) novo campo "Tempo para clicar a caminho" com mesma lógica, (3) ambas variáveis disponíveis como {tempo_aceitar} e {tempo_a_caminho} no disparo de mensagens.

### Pedidos do Juliano:
1. Renomear "aceite" → "aceitar" em todos os locais
2. Novo campo "Tempo para clicar a caminho" (min/horas/do fluxo ou da OS)
3. Variáveis {tempo_aceitar} e {tempo_a_caminho} no disparo de mensagens
4. Campos anteriores também disponíveis no disparo

### O que foi feito (v1.00.35 "Tempos e Variáveis"):

**1. Renomeação "aceite" → "aceitar":**
- Workflow StageSection: labels, hints, SubToggle
- OS criação (new/page.tsx): label, hint, comentário submit
- OS edição (edit/page.tsx): label, hint, comentário submit
- DTOs backend: mensagens de validação

**2. Novo campo "Tempo para clicar a caminho" (enRouteTimeout):**

| Camada | Implementação |
|--------|--------------|
| **stage-config.ts** | Tipo `enRouteTimeout: { mode, value, unit }` em techSelection, default: 30 min fixo |
| **Compiler** | Salva `enRouteTimeoutMinutes`, `enRouteTimeoutUnit`, `enRouteTimeoutMode` no bloco ASSIGN_TECH |
| **Decompiler** | Reconstrói `enRouteTimeout` do config salvo (backward compat) |
| **Workflow UI** | Seção verde com radio Minutos/Horas/Definido na OS + number input |
| **OS Criação** | State + localStorage + UI verde + submit `enRouteTimeoutMinutes` |
| **OS Edição** | State + load backend + UI verde + submit |
| **Prisma** | `enRouteTimeoutMinutes Int?` no ServiceOrder |
| **DTOs** | `enRouteTimeoutMinutes?: number` com @Min(1) |
| **Service** | create, update (checkField), duplicate |

**3. Variáveis no disparo de mensagens:**
- Frontend NOTIFY_VARS (13 variáveis total):
  - `{tempo_aceitar}` — "Tempo para aceitar"
  - `{tempo_a_caminho}` — "Tempo para clicar a caminho"
- Backend substitution engine:
  - `{tempo_aceitar}` → "2h" ou "30 min" ou "Definido no fluxo"
  - `{tempo_a_caminho}` → "1h" ou "30 min" ou "Definido no fluxo"

### Resultado:
- frontend build ✅ (0 erros, 22 rotas)
- backend tsc ✅ (0 erros)
- version.json: 1.00.35 "Tempos e Variáveis"

### Arquivos modificados:
- `frontend/src/types/stage-config.ts` — tipo, default, NOTIFY_VARS, compiler, decompiler
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — UI tempos + renomear
- `frontend/src/app/(dashboard)/orders/new/page.tsx` — state, submit, localStorage, UI
- `frontend/src/app/(dashboard)/orders/[id]/edit/page.tsx` — state, load, submit, UI
- `backend/prisma/schema.prisma` — enRouteTimeoutMinutes
- `backend/src/service-order/dto/create-service-order.dto.ts` — enRouteTimeoutMinutes
- `backend/src/service-order/dto/update-service-order.dto.ts` — enRouteTimeoutMinutes
- `backend/src/service-order/service-order.service.ts` — create, update, duplicate
- `backend/src/workflow/workflow-engine.service.ts` — {tempo_aceitar}, {tempo_a_caminho}
- `version.json` — 1.00.34 → 1.00.35
- `PROJETO_LOG.md` — sessão 36 continuação
- `CHAT_LOG.md` — sessão 36 continuação

---

## Sessão 36 (continuação 2) — 24/02/2026
**Contexto:** Auditoria completa de campos por etapa. Juliano aprovou refatoração dos 9 pontos.

### Nova regra permanente:
> Ser crítico com pedidos — questionar equívocos, redundâncias ou problemas arquiteturais.

### O que foi feito (v1.00.36 "Etapas Inteligentes"):

**Refatoração completa — campos distribuídos por etapa lógica:**

| Etapa | Campos exclusivos | Justificativa |
|-------|-------------------|---------------|
| **ABERTA** | techSelection (método + máx. técnicos), messageDispatch, techQuestion | A OS é criada e oferecida aqui |
| **OFERTADA** | acceptTimeout, onTimeout, discardBusy | Técnicos estão avaliando a oferta |
| **ATRIBUÍDA** | enRouteTimeout | Técnico aceitou, aguardando ir a caminho |
| **A_CAMINHO / EM_EXECUÇÃO** | notificações genéricas + alert + webhook | Fase operacional do técnico |
| **CONCLUÍDA** | financialEntry + duplicateOS | OS terminada, lançamentos financeiros |
| **APROVADA** | financialEntry | Aprovação final |

**Filtros implementados:**
1. ✅ acceptTimeout/onTimeout/discardBusy movidos para OFERTADA (card amber com seção rica)
2. ✅ enRouteTimeout movido para ATRIBUÍDA (card green com seção rica)
3. ✅ assignTech (simples) removido de ABERTA/OFERTADA/ATRIBUÍDA/A_CAMINHO
4. ✅ financialEntry só em CONCLUÍDA e APROVADA
5. ✅ duplicateOS só em CONCLUÍDA
6. ✅ techActions (ações do técnico) removidos de ABERTA e OFERTADA — hint explicativo
7. ✅ Alert e webhook disponíveis em todas as etapas
8. ✅ Notificações simples disponíveis em todas exceto ABERTA (que usa messageDispatch rico)

**Compiler cross-stage:**
- ASSIGN_TECH coleta: método/maxTech da ABERTA + acceptTimeout/onTimeout/discardBusy da OFERTADA + enRouteTimeout da ATRIBUÍDA
- Dados salvos no mesmo bloco V2 (backward compatible)

**Decompiler cross-stage:**
- `mapBlockToStage` recebe `allStages` e distribui campos de ASSIGN_TECH para as 3 etapas corretas
- Backward compatible: dados antigos (tudo na ABERTA) são redistribuídos automaticamente

**Textos explicativos:**
- ABERTA: hint que tempos estão em Ofertada/Atribuída
- ABERTA/OFERTADA: hint que ações do técnico só estão a partir de Atribuída

### Resultado:
- frontend `tsc --noEmit` ✅ (0 erros)
- frontend `next build` ✅ (22 rotas, 0 erros)
- version.json: 1.00.36 "Etapas Inteligentes"

### Correção pós-auditoria (Juliano):
- **discardBusyTechnicians** movido de OFERTADA para ABERTA — é critério de SELEÇÃO (filtra quem recebe a oferta), não de aceite
- Compiler: lê discardBusy da ABERTA (não OFERTADA)
- Decompiler: distribui discardBusy para ABERTA (não OFERTADA)
- UI: SubToggle + hint explicativo no card de seleção de técnicos (ABERTA)

### Arquivos modificados:
- `frontend/src/types/stage-config.ts` — compiler (cross-stage), decompiler (allStages param), discardBusy fix
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — per-stage rendering, discardBusy na ABERTA
- `version.json` — 1.00.35 → 1.00.36

---

## Sessão 37 — 24/02/2026 — v1.00.37 "Etapas Inteligentes"

### Contexto:
Continuação da sessão anterior. Implementação da feature **arrivalQuestion** (Pergunta de tempo estimado de chegada) na etapa ATRIBUÍDA.

### Estudo de design (discutido antes da implementação):
1. **Pergunta pós-aceite:** Após aceitar a OS, técnico responde quanto tempo até estar a caminho
2. **Opções configuráveis:** Gestor define opções (label + minutos)
3. **Validação crítica:** Tempo informado NÃO pode exceder enRouteTimeout
4. **Fluxo de erro:** Se excede → mensagem de erro → opções: "informar novo tempo" ou "não vou poder atender"
5. **Recusa configurável:** onDecline com 4 opções (notificar gestor, redistribuir, voltar fila, cancelar)
6. **Anti-redundância:** useAsDynamicTimeout — tempo escolhido substitui o timeout, enRouteTimeout vira teto
7. **Notificações:** notifyCliente e notifyGestor com nova variável `{tempo_estimado_chegada}`

### Implementação — stage-config.ts:
- **Nova interface:** `ArrivalTimeOption { label, minutes }`
- **Novo campo em autoActions:** `arrivalQuestion { enabled, question, options[], useAsDynamicTimeout, notifyCliente, notifyGestor, onDecline }`
- **Nova constante:** `ON_DECLINE_OPTIONS` (4 opções)
- **NOTIFY_VARS:** adicionado `{tempo_estimado_chegada}` (14 variáveis total)
- **Factory:** defaults com 4 opções (15, 30, 60, 120 min)
- **Compiler:** emite bloco `ARRIVAL_QUESTION` quando ATRIBUÍDA tem arrivalQuestion.enabled
- **Decompiler:** case `ARRIVAL_QUESTION` popula arrivalQuestion na etapa

### Implementação — StageSection.tsx:
- Card azul na ATRIBUÍDA (abaixo do card verde de enRouteTimeout)
- Toggle de ativação com hint explicativo
- Campo de pergunta editável
- Lista de opções (label + minutos) com add/remove
- **Warning visual:** opções com tempo > enRouteTimeout ficam com borda vermelha e ícone ⚠️
- **Texto dinâmico:** mostra o limite baseado no enRouteTimeout configurado
- SubToggles: useAsDynamicTimeout, notifyCliente, notifyGestor
- Hint sobre variável `{tempo_estimado_chegada}`
- Select de onDecline com texto explicativo

### Resultado:
- frontend `tsc --noEmit` 0 erros
- frontend `next build` 22 rotas, 0 erros
- version.json: 1.00.37 "Etapas Inteligentes"

### Arquivos modificados:
- `frontend/src/types/stage-config.ts` — ArrivalTimeOption, arrivalQuestion, ON_DECLINE_OPTIONS, compiler, decompiler
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — card azul arrivalQuestion na ATRIBUÍDA
- `version.json` — 1.00.36 → 1.00.37

---

## Sessão 37 (cont.) — 24/02/2026 — v1.00.38 "Etapas Inteligentes" — Backend Fase 2

### Implementação Backend:

**Prisma schema:**
- `estimatedArrivalMinutes Int?` adicionado ao ServiceOrder

**Self-healing migration (PrismaService):**
- Novo método `ensureServiceOrderColumns()` cria coluna `estimatedArrivalMinutes` se não existir

**Workflow Engine — ARRIVAL_QUESTION:**
- Adicionado ao `ACTIONABLE_TYPES` — engine pausa neste bloco e espera resposta do técnico
- **Validação:** `selectedMinutes` no `responseData` deve ser >= 1 e <= `enRouteTimeoutMinutes` da OS
- **Erro tratado:** Mensagem clara informando o limite e opções (novo tempo ou "não vou poder atender")
- **Salvamento:** `estimatedArrivalMinutes` salvo na ServiceOrder dentro da transaction
- **Status:** ARRIVAL_QUESTION **NÃO** transiciona para EM_EXECUÇÃO (técnico só informou ETA)

**Substituição de variáveis:**
- `{tempo_estimado_chegada}` adicionado ao mapa de variáveis do NOTIFY
- Formato: "30 min" ou "2h" ou "Não informado"

### Ponto crítico identificado e resolvido:
O engine auto-transicionava ATRIBUÍDA → EM_EXECUÇÃO ao completar qualquer bloco actionable. Para ARRIVAL_QUESTION isso era errado (técnico só informou ETA, não começou execução). Adicionado `block.type !== 'ARRIVAL_QUESTION'` na condição.

### Resultado:
- backend `tsc --noEmit` 0 erros
- frontend `tsc --noEmit` 0 erros
- version.json: 1.00.38 "Etapas Inteligentes"

### Arquivos modificados:
- `backend/prisma/schema.prisma` — estimatedArrivalMinutes Int?
- `backend/src/prisma/prisma.service.ts` — ensureServiceOrderColumns()
- `backend/src/workflow/workflow-engine.service.ts` — ARRIVAL_QUESTION no ACTIONABLE_TYPES, validação, salvamento, status fix, {tempo_estimado_chegada}
- `version.json` — 1.00.37 → 1.00.38

---

## Sessão 37 (cont. 2) — 24/02/2026 — v1.00.39 "Etapas Inteligentes" — Fase 3: Mobile

### Backend — Novos endpoints públicos:

**`POST /p/:token/arrival-time`** — Técnico informa tempo estimado:
- Valida offer aceita recentemente (token com revokedAt)
- Verifica phone do técnico = assignedPartner
- Valida selectedMinutes <= enRouteTimeoutMinutes
- Salva estimatedArrivalMinutes na ServiceOrder

**`POST /p/:token/decline`** — Técnico recusa após aceitar:
- Mesma validação de offer/tech
- Lê onDecline do workflow (ARRIVAL_QUESTION block config)
- Executa ação: return_offered (volta OFERTADA), reassign (volta ABERTA), cancel (CANCELADA), notify_gestor

**`POST /p/:token/accept`** — Modificado para retornar arrivalQuestion:
- Retorno agora inclui `arrivalQuestion: { blockId, question, options[], onDecline, useAsDynamicTimeout, enRouteTimeoutMinutes }` se existir no workflow
- Frontend usa para mostrar o modal pós-aceite

### Frontend — /p/[token] reescrita completa:

**Fluxo de estados:**
1. `loading` → spinner de carregamento
2. `offer` → card com detalhes da OS + input de telefone + botão enviar código
3. `otp` → input de OTP (6 dígitos, tracking mono) + botão aceitar
4. `arrival` → modal com pergunta de tempo + opções + botão confirmar + "não vou poder atender"
5. `done` → tela verde de sucesso
6. `declined` → tela amber de recusa registrada
7. `error` → tela de erro

**UI Mobile-first:**
- Cards arredondados (rounded-2xl) com shadow
- Opções de tempo como botões full-width com seleção visual
- Opções que excedem enRouteTimeout ficam desabilitadas + riscadas
- Mensagem de erro em card vermelho
- Botão de recusa em vermelho com borda
- Spinner e estados de loading em cada ação

### Resultado:
- backend `tsc --noEmit` 0 erros
- frontend `tsc --noEmit` 0 erros
- frontend `next build` 22 rotas, 0 erros
- version.json: 1.00.39 "Etapas Inteligentes"

### Arquivos modificados:
- `backend/src/public-offer/public-offer.service.ts` — acceptWithOtp (arrivalQuestion), submitArrivalTime, declineAfterAccept
- `backend/src/public-offer/public-link.controller.ts` — 2 novos endpoints (arrival-time, decline)
- `frontend/src/app/p/[token]/page.tsx` — reescrita completa com fluxo OTP + arrivalQuestion modal
- `version.json` — 1.00.38 → 1.00.39

---

## Sessão 38 — 24/02/2026 — v1.00.40 "Etapas Inteligentes" — GPS Proximity Tracking

### Pedido do Juliano:
- Implementar rastreamento GPS de proximidade (estudo apresentado na sessão anterior)
- Verificar configurações GPS existentes para evitar redundância
- Adicionar opção do GPS ficar ativo até o final do atendimento (não só até entrar no raio)

### Auditoria GPS existente:
- `techActions.gps` — captura GPS de ponto único (propósito diferente, mantido como está)
- `gpsNavigation` — botão de navegação GPS no link config (diferente de monitoramento de proximidade)
- `haversineMeters()` — já existente em `backend/src/common/geo/haversine.ts`, reutilizado diretamente
- `navigator.geolocation.getCurrentPosition()` — captura única na página do técnico
- Estratégia NEAREST na seleção de técnico — usa GPS para ordenar por distância
- **Conclusão:** Nenhuma redundância, reutilizamos haversineMeters()

### Fase 1: stage-config.ts — Tipos, defaults, compiler, decompiler

**Novos tipos em `StageConfig.autoActions`:**
- `proximityTrigger.enabled` — ativa rastreamento GPS
- `proximityTrigger.radiusMeters` — raio para disparar eventos (50–5000m)
- `proximityTrigger.trackingIntervalSeconds` — frequência de envio (10–120s)
- `proximityTrigger.requireHighAccuracy` — alta precisão GPS
- `proximityTrigger.keepActiveUntil` — `'radius'` (desliga ao entrar no raio) ou `'execution_end'` (mantém até concluir serviço)
- `proximityTrigger.onEnterRadius` — eventos: notifyCliente, notifyGestor, autoStartExecution, alert

**Constantes e defaults:**
- `KEEP_ACTIVE_OPTIONS` — opções radio para keepActiveUntil
- `{distancia_tecnico}` adicionado ao NOTIFY_VARS (16 variáveis total)
- Factory defaults: 200m raio, 30s intervalo, alta precisão, keepActiveUntil: 'radius'
- Presets: Instalação (200m, radius), Vistoria (100m, execution_end, autoStartExecution: true)

**Compiler/Decompiler:**
- Novo bloco `PROXIMITY_TRIGGER` emitido quando A_CAMINHO tem proximityTrigger.enabled
- Decompiler reconstrói proximityTrigger a partir do bloco PROXIMITY_TRIGGER

### Fase 2: StageSection.tsx — Card roxo na A_CAMINHO

**UI do Proximity Trigger:**
- Card roxo (`border-purple-200 bg-purple-50/30`) na seção A_CAMINHO
- Toggle para ativar rastreamento de proximidade
- Range slider (50–5000m) + input numérico para raio
- Input numérico para intervalo de tracking (10–120s)
- SubToggle para alta precisão GPS
- Radio buttons para keepActiveUntil com KEEP_ACTIVE_OPTIONS
- Seção de eventos onEnterRadius:
  - SubToggle notifyCliente + canal + mensagem template
  - SubToggle notifyGestor + canal + mensagem template
  - SubToggle autoStartExecution (muda status para EM_EXECUÇÃO automaticamente)
  - SubToggle alert + mensagem
- Hint sobre variáveis template `{distancia_tecnico}` e `{tecnico}`

### Fase 3: Backend — Prisma, endpoints, proximity check

**Schema Prisma:**
- ServiceOrder: +trackingStartedAt (DateTime?), +proximityEnteredAt (DateTime?), +proximityRadiusMeters (Int?)
- Novo model `TechnicianLocationLog`: id, companyId, serviceOrderId, partnerId, lat, lng, accuracy, speed, heading, distanceToTarget, createdAt
- Indexes: [serviceOrderId, createdAt], [partnerId, createdAt]

**Self-healing migrations (prisma.service.ts):**
- `ensureServiceOrderColumns()` — 3 novas colunas
- `ensureLocationLogTable()` — CREATE TABLE IF NOT EXISTS + indexes

**Novos endpoints públicos:**
- `POST /p/:token/start-tracking` — { phone } → inicia tracking, salva config snapshot, retorna target coords
- `POST /p/:token/position` — { phone, lat, lng, accuracy?, speed?, heading? } → calcula distância via haversineMeters(), salva no TechnicianLocationLog (raw SQL), detecta entrada no raio
- `GET /p/:token/tracking-config` — retorna config de proximidade + coordenadas target + estado do tracking

**Workflow engine:**
- `{distancia_tecnico}` adicionado ao mapa de substituição de variáveis

### Fase 4: Mobile /p/[token] — Tracking page com watchPosition

**Novos estados e fluxo:**
- PageStep: adicionados "tracking" e "arrived"
- TrackingConfig type: radiusMeters, trackingIntervalSeconds, requireHighAccuracy, keepActiveUntil, targetLat/Lng
- States: trackingConfig, trackingActive, trackingDistance, trackingLastUpdate, trackingError
- useRef: watchId, lastSent timestamp, phoneDigitsRef

**sendPosition callback:**
- Throttled por trackingIntervalSeconds
- POST para /position com lat/lng/accuracy/speed/heading
- Atualiza display de distância
- Detecta proximityReached e transiciona para "arrived"

**startTracking:**
- POST para /start-tracking
- Inicia navigator.geolocation.watchPosition() com enableHighAccuracy configurável

**UI tracking (fundo roxo):**
- Display de distância em metros/km com formatação automática
- Barra de progresso visual (distância vs raio)
- Timestamp da última atualização
- Botão "Cheguei no local" (fallback manual)
- Botão "Parar rastreamento"
- Mensagem "Mantenha esta página aberta para o rastreamento funcionar"

**UI arrived (fundo verde):**
- Tela de confirmação de chegada

**UI done:**
- Card de oferta de GPS tracking quando geolocation disponível

**Error handling:**
- GPS permission denied (code 1), position unavailable (code 2), erros genéricos
- Cleanup no unmount (clearWatch)

### Resultado:
- backend `tsc --noEmit` 0 erros
- frontend `tsc --noEmit` 0 erros
- frontend `next build` 22 rotas, 0 erros
- version.json: 1.00.40 "Etapas Inteligentes"

### Erro encontrado e corrigido:
- **Prisma generate EPERM**: DLL do query engine travada por processos node em execução → fix: `taskkill //F //IM node.exe` + `npx prisma generate`

### Arquivos modificados:
- `frontend/src/types/stage-config.ts` — proximityTrigger types, KEEP_ACTIVE_OPTIONS, NOTIFY_VARS, factory defaults, presets, compiler PROXIMITY_TRIGGER, decompiler
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — card roxo com UI completa de proximity tracking
- `backend/prisma/schema.prisma` — 3 novos campos ServiceOrder, novo model TechnicianLocationLog
- `backend/src/prisma/prisma.service.ts` — ensureServiceOrderColumns() + ensureLocationLogTable()
- `backend/src/public-offer/public-offer.service.ts` — startTracking(), submitPosition(), getTrackingConfig()
- `backend/src/public-offer/public-link.controller.ts` — 3 novos endpoints (start-tracking, position, tracking-config)
- `backend/src/workflow/workflow-engine.service.ts` — {distancia_tecnico} no mapa de variáveis
- `frontend/src/app/p/[token]/page.tsx` — reescrita com tracking states, watchPosition, UI tracking/arrived
- `version.json` — 1.00.39 → 1.00.40

### TODOs técnicos pendentes (RESOLVIDOS na Sessão 39):
- ~~**onEnterRadius event dispatch**: submitPosition() apenas marca proximityEnteredAt~~ ✅ Resolvido
- ~~**{distancia_tecnico} dinâmico**: Atualmente retorna 'Não disponível'~~ ✅ Resolvido

---

## Sessão 39 — 24/02/2026

### v1.00.41 "Etapas Inteligentes" — onEnterRadius Event Dispatch + {distancia_tecnico} dinâmico

**Juliano:** "vamos continuar" + "veja se não ficou nada quebrado"

**Verificação inicial:** Builds backend tsc, frontend tsc, e next build todos passando com 0 erros.

### TODO 1: onEnterRadius Event Dispatch

**Problema:** `submitPosition()` no `PublicOfferService` apenas marcava `proximityEnteredAt` e logava no console, mas não executava os eventos configurados no workflow (notificações, auto-start, alerts).

**Solução:**

**public-offer.module.ts:**
- Importa `NotificationModule` para injetar `NotificationService`

**public-offer.service.ts:**
- Injetado `NotificationService` e `Logger`
- `submitPosition()` agora carrega OS com relações completas (workflowTemplate, assignedPartner, clientPartner, company)
- Novo método privado `executeOnEnterRadius(so, companyId, distanceMeters)` — fire-and-forget:
  1. Lê `onEnterRadius` config do bloco PROXIMITY_TRIGGER no workflow
  2. Constrói mapa de variáveis para substituição em mensagens
  3. Notifica cliente (se `notifyCliente.enabled`) via canal configurado
  4. Notifica gestor (se `notifyGestor.enabled`) via canal configurado
  5. Auto-inicia execução (se `autoStartExecution` e status ATRIBUIDA/A_CAMINHO) → muda para EM_EXECUÇÃO + ServiceOrderEvent PROXIMITY_AUTO_START
  6. Cria alerta dashboard (se `alert.enabled`) → Notification PROXIMITY_ALERT

### TODO 2: {distancia_tecnico} Dinâmico

**Problema:** No `WorkflowEngineService`, a variável `{distancia_tecnico}` sempre retornava "Não disponível".

**Solução (workflow-engine.service.ts):**
- Case NOTIFY consulta última entrada do `TechnicianLocationLog` via `$queryRawUnsafe`:
  ```sql
  SELECT "distanceToTarget" FROM "TechnicianLocationLog"
  WHERE "serviceOrderId" = $1 AND "distanceToTarget" IS NOT NULL
  ORDER BY "createdAt" DESC LIMIT 1
  ```
- Formata: >= 1000m → "X.X km", < 1000m → "X m"
- Try/catch fallback seguro (tabela pode não existir)

### Resultado:
- backend `tsc --noEmit` 0 erros
- frontend `tsc --noEmit` 0 erros
- frontend `next build` 22 rotas, 0 erros
- version.json: 1.00.41 "Etapas Inteligentes"

### Arquivos modificados:
- `backend/src/public-offer/public-offer.module.ts` — importa NotificationModule
- `backend/src/public-offer/public-offer.service.ts` — NotificationService injetado, executeOnEnterRadius(), submitPosition() com relações completas
- `backend/src/workflow/workflow-engine.service.ts` — {distancia_tecnico} consulta TechnicianLocationLog
- `version.json` — 1.00.40 → 1.00.41

---

## Sessão 40 — 24/02/2026

### Pedido do Juliano:
> "A melhoria era a seguinte: note que para iniciar a execução configurei em A Caminho fotos do antes, porém temos que projetar em todas as etapas necessárias, precisa estudar. A implementação do durante, digo isso pelo fato de ter configuração para atendimentos demorados — vai parar pra hora do almoço, pra noite, final de semana etc — e talvez o gestor queira configurar fotos do durante em cada pausa."

### Contexto:
- Juliano havia pedido isso antes da sessão travar, e o trabalho não foi salvo
- Regra reforçada: SEMPRE registrar no CHAT_LOG + PROJETO_LOG antes e depois de cada modificação
- O sistema já tem preparação parcial para pausas:
  - `PhotoRequirementGroup` tem `moment: 'on_pause' | 'on_resume'`
  - `PHOTO_MOMENT_OPTIONS` inclui "Ao pausar" e "Ao retomar"
  - `executionTimer.pauseDiscountsFromSla` existe como toggle futuro
  - StageSection mostra warning amber "requerem sistema de pausas (futuro)" para fotos on_pause/on_resume
- O que NÃO existe ainda: sistema de pausas em si (backend + mobile)

### Estudo realizado:
- `stage-config.ts`: PhotoRequirementGroup com moment 'on_pause'/'on_resume' já definido, mas sem backend/mobile
- `StageSection.tsx`: EM_EXECUCAO tem photoRequirements com grupos por momento, executionTimer com pauseDiscountsFromSla
- Etapas afetadas: EM_EXECUCAO (principal), potencialmente A_CAMINHO e CONCLUIDA
- Necessidade: sistema completo de pausas (técnico pausa/retoma + fotos obrigatórias + timer + SLA)

### Decisão do Juliano:
> "Podemos também de forma configurável pedir qual o motivo da pausa, esses já seriam pré-configurados. Ex: almoço, final do dia (ou achar um nome mais específico), buscar peças, chuva, etc."

### Motivos de pausa pré-configurados (definidos):

**Categorias padrão (gestor pode ativar/desativar cada uma):**
1. 🍽️ **Intervalo para refeição** — almoço, lanche, janta
2. 🌙 **Encerramento do expediente** — final do dia, volta amanhã
3. 🔧 **Buscar material/peças** — precisa sair para buscar suprimentos
4. 🌧️ **Condições climáticas** — chuva, tempestade, calor extremo
5. ⏳ **Aguardando cliente** — cliente ausente, retorna em horário marcado
6. 🔌 **Aguardando energia/utilidades** — sem luz, sem água, sem internet
7. 🚧 **Aguardando liberação de acesso** — área restrita, segurança, permissão
8. 🛠️ **Aguardando outro serviço** — outra equipe precisa terminar primeiro
9. 🏥 **Motivo pessoal** — necessidade pessoal do técnico
10. 📝 **Outro** — campo de texto livre obrigatório

### Implementação: v1.00.42 "Sistema de Pausas"

#### Fase A — Schema Prisma
- `ServiceOrder`: novos campos `isPaused`, `pausedAt`, `pauseCount`, `totalPausedMs`
- Novo model `ExecutionPause`: id, companyId, serviceOrderId, partnerId, reasonCategory, reason, pausedAt, resumedAt, durationMs, pausePhotos, resumePhotos
- Self-healing: `ensureExecutionPauseTable()` + colunas de pausa no `ensureServiceOrderColumns()`

#### Fase B — Config (stage-config.ts)
- `pauseSystem` adicionado ao `timeControl` em `StageConfig`
- `PAUSE_REASON_CATEGORIES` (10 motivos pré-configurados com icon/label/hint)
- Variáveis `{pausas}` e `{tempo_pausado}` em NOTIFY_VARS
- Compilador: emite bloco `PAUSE_SYSTEM`
- Decompilador: reconstrói `pauseSystem` config
- Presets Instalação e Manutenção: pauseSystem ativado por padrão

#### Fase C — UI gestor (StageSection.tsx)
- Nova seção laranja "⏸️ Sistema de pausas" apenas em EM_EXECUÇÃO
- Configuração: máx pausas, duração máxima, motivo obrigatório
- Checkboxes para ativar/desativar cada motivo de pausa
- Fotos obrigatórias ao pausar/retomar (com min fotos)
- Notificações: gestor ao pausar/retomar
- Aviso amber das fotos on_pause atualizado de "futuro" → info blue

#### Fase D — Backend endpoints
- `POST /p/:token/pause` — pauseExecution (valida limites, reason, fotos, cria ExecutionPause + atualiza SO)
- `POST /p/:token/resume` — resumeExecution (calcula durationMs, atualiza totalPausedMs)
- `GET /p/:token/pause-status` — retorna isPaused, pauseCount, totalPausedMs, pauseConfig, histórico
- Variáveis de template: `{pausas}` e `{tempo_pausado}` no workflow-engine

#### Fase E — Mobile (p/[token]/page.tsx)
- Novos estados: "executing", "pausing", "paused", "resuming"
- Tela executing: botão "Pausar" (com contagem de pausas)
- Tela pausing: seleção de motivo com ícones + texto livre para "Outro"
- Tela paused: info da pausa + botão "Retomar"
- Auto-detecção de OS em execução ao carregar página

#### Fase F — Dashboard
- Badge "⏸️ Pausada" na lista de OS (laranja)
- Badge "⏸️ Pausada" na página de detalhe da OS
- Tipo ServiceOrder atualizado com isPaused/pausedAt/pauseCount/totalPausedMs

#### Build final
- Backend tsc: 0 erros
- Frontend tsc: 0 erros
- next build: 22 rotas, 0 erros
- version.json: 1.00.42 "Sistema de Pausas"

### Arquivos modificados:
- `backend/prisma/schema.prisma` — campos isPaused/pauseCount/totalPausedMs + model ExecutionPause
- `backend/src/prisma/prisma.service.ts` — self-healing ExecutionPause + colunas pausa
- `backend/src/public-offer/public-link.controller.ts` — endpoints pause/resume/pause-status
- `backend/src/public-offer/public-offer.service.ts` — métodos pauseExecution/resumeExecution/getPauseStatus
- `backend/src/workflow/workflow-engine.service.ts` — variáveis {pausas} e {tempo_pausado}
- `frontend/src/types/stage-config.ts` — pauseSystem config, PAUSE_REASON_CATEGORIES, compilador/decompilador
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — seção de pausas + aviso atualizado
- `frontend/src/app/p/[token]/page.tsx` — estados executing/pausing/paused/resuming
- `frontend/src/app/(dashboard)/orders/page.tsx` — badge "⏸️ Pausada"
- `frontend/src/app/(dashboard)/orders/[id]/page.tsx` — badge + tipo atualizado
- `version.json` — 1.00.42 "Sistema de Pausas"

---

## Sessão 41 — 25/02/2026

### Pedido do Juliano:
> "Colocar opções de notificar e como notificar de acordo com padrões em outras etapas, porem no sistema de pausa, gestor, cliente, técnico. ver redundâncias de pedidos de fotos pra finalizar na etapa fotos por momento e 6. concluída, na 6. concluída colocar opções de lançamento de financeiro Ex: contas a receber, contas a pagar, custos etc (estudar sobre). verificar geral redundâncias de configuração em todas as etapas, vereficar opções que não fazem sentido em etapas."

### Itens solicitados:
1. **Notificações no sistema de pausas** — Expandir de boolean simples para sistema completo com canal/mensagem para gestor, cliente e técnico (seguindo padrão de outras etapas)
2. **Redundância de fotos** — Verificar sobreposição entre `photoRequirements` (on_pause/on_resume) e `pauseSystem` (requirePhotosOnPause/Resume)
3. **Lançamento financeiro expandido** — Na CONCLUÍDA, expandir `financialEntry: { enabled: boolean }` para incluir tipos: contas a receber, contas a pagar, custos, etc.
4. **Auditoria geral de redundâncias** — Verificar todas as 7 etapas
5. **Opções sem sentido por etapa** — Remover/ocultar opções ilógicas

### Estudo/Auditoria realizado:

**REDUNDÂNCIAS ENCONTRADAS:**

**A) Fotos de pausa — DUPLA CONFIGURAÇÃO:**
- `pauseSystem` tem `requirePhotosOnPause/Resume` + `minPhotosOnPause/Resume` (4 campos)
- `photoRequirements` tem groups com `moment: 'on_pause'` e `moment: 'on_resume'` (sistema completo com label, instructions, min/max)
- **Problema:** O gestor pode configurar fotos de pausa em DOIS lugares diferentes com configurações conflitantes
- **Solução:** REMOVER fotos do pauseSystem. Manter apenas no photoRequirements que é mais rico (label, instruções, min/max). Quando pauseSystem está ativo, auto-criar grupos on_pause/on_resume se não existem.

**B) Notificações de pausa — LIMITADAS:**
- `pauseSystem` tem apenas `notifyGestorOnPause` e `notifyGestorOnResume` (booleans simples)
- Outras etapas usam sistema completo: canal (whatsapp/sms/email/push), mensagem com variáveis, destinatários separados
- **Solução:** Expandir para sistema completo com gestor/cliente/técnico, cada um com canal e mensagem customizável

**C) Lançamento financeiro — MUITO SIMPLES:**
- `financialEntry: { enabled: boolean }` — apenas liga/desliga
- Falta: tipo de lançamento (contas a receber, pagar, custos), valor automático, descrição, categorias
- **Solução:** Expandir para tipos múltiplos com opções

**OPÇÕES QUE NÃO FAZEM SENTIDO:**
- ABERTA/OFERTADA: corretamente não mostram ações do técnico ✅
- Todas as etapas têm SLA, waitFor, alert, webhook — correto, são universais ✅
- CONCLUIDA/APROVADA: assignTech, financialEntry, duplicateOS — correto (redistribuição, encerramento) ✅
- DELAY escondido em EM_EXECUCAO — correto ✅
- APROVADA com `duplicateOS` — OK (pode querer duplicar para nova visita) ✅
- **Nenhuma opção sem sentido grave encontrada** — A filtragem por etapa já está bem feita

### Implementação: v1.00.43 "Ajustes de Pausas + Financeiro"

#### 1. Notificações ricas no sistema de pausas
- **Antes:** apenas `notifyGestorOnPause: boolean` e `notifyGestorOnResume: boolean`
- **Depois:** sistema completo com 3 destinatários (gestor, cliente, técnico) × 2 eventos (pausar, retomar) = 6 slots
- Cada slot tem: enabled, channel (whatsapp/sms/email/push), message (com variáveis de template)
- Padrão idêntico ao usado em messageDispatch e proximityTrigger
- Backend: novo método `sendPauseNotifications()` com substituição de variáveis `{titulo}`, `{tecnico}`, `{pausas}`, `{tempo_pausado}`, `{empresa}`
- Backward compat mantida: se workflow antigo tiver `notifyGestorOnPause: true`, ainda funciona

#### 2. Redundância de fotos resolvida
- **Antes:** fotos configuradas em 2 lugares — `pauseSystem.requirePhotosOnPause/Resume` E `photoRequirements` com moment `on_pause/on_resume`
- **Depois:** fotos removidas do pauseSystem, ficam SOMENTE no `photoRequirements` (mais rico: label, instruções, min/max)
- Aviso na UI: "📸 As fotos de pausa/retomada são configuradas em Fotos por momento (acima)"
- Backend atualizado: `getPhotoRequirement()` lê do bloco PHOTO_REQUIREMENTS
- Backward compat mantida: se workflow antigo tiver `requirePhotosOnPause`, ainda valida
- Presets atualizados: Instalação e Manutenção agora adicionam grupos on_pause/on_resume ao photoRequirements

#### 3. Lançamento financeiro expandido
- **Antes:** `financialEntry: { enabled: boolean }` — apenas liga/desliga
- **Depois:** `financialEntry: { enabled: boolean, entries: FinancialEntryConfig[] }`
- Novo tipo `FinancialEntryConfig`: id, type, label, valueSource, fixedValue, percentOfOS, description, autoCreate
- 7 tipos de lançamento: contas_receber, contas_pagar, comissao, custo, taxa, desconto, custom
- 6 fontes de valor: os_value, os_commission, materials_total, percent_os, fixed, manual
- Constantes `FINANCIAL_ENTRY_TYPES` e `FINANCIAL_VALUE_SOURCES`
- UI: card emerald com lista de lançamentos editáveis (tipo, valor, label, descrição, autoCreate)
- Presets atualizados: Instalação (receber + comissão), Manutenção (receber + custo materiais + comissão), Urgente (receber), Simples (receber)

#### 4. Auditoria geral
- Todas as 7 etapas verificadas — filtragem por status está correta
- Nenhuma opção sem sentido grave encontrada
- Delay corretamente oculto em EM_EXECUCAO
- Ações do técnico corretamente ocultas em ABERTA/OFERTADA

### Build final
- Backend tsc: 0 erros
- Frontend tsc: 0 erros
- next build: 22 rotas, 0 erros
- version.json: 1.00.43 "Ajustes de Pausas + Financeiro"

### Arquivos modificados:
- `frontend/src/types/stage-config.ts` — FinancialEntryConfig type, FINANCIAL_ENTRY_TYPES, FINANCIAL_VALUE_SOURCES, pauseSystem com notifications ricas, compilador/decompilador atualizado, presets atualizados
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — UI notificações ricas pausas (6 slots), UI financialEntry expandida (cards editáveis), remoção fotos do pauseSystem
- `backend/src/public-offer/public-offer.service.ts` — sendPauseNotifications(), getPhotoRequirement(), backward compat, getPauseStatus com photoRequirements
- `frontend/src/app/p/[token]/page.tsx` — PauseConfig e PauseStatus types atualizados
- `version.json` — 1.00.43 "Ajustes de Pausas + Financeiro"

### Pedido adicional do Juliano:
> "Coloque todas as configurações lançar financeiro na etapa 7 aprovada tambem, e crie uma proteção que ao acionar na etapa 7 um aviso notifica que na etapa 6 o lançar financeiro já está ativado se quiser continuar vai ser desativado o da etapa 6 e assim vise verso, pra não ter lançamentos duplicados"

### Implementação adicional:
1. **financialEntry na APROVADA** — a UI completa com cards editáveis já aparecia em ambas etapas (CONCLUIDA e APROVADA)
2. **Proteção contra duplicidade:**
   - Ao ativar financeiro em uma etapa, se a outra já tiver ativado: `confirm()` avisa o gestor com mensagem clara
   - Se confirmar: desativa automaticamente o financeiro da outra etapa via flag `_disableOtherFinancial`
   - `handleStageChange` no page.tsx trata o flag e desativa a outra etapa atomicamente
   - Aviso permanente amber aparece se ambas estiverem ativas simultaneamente (edge case)
   - Funciona nos dois sentidos: CONCLUIDA -> APROVADA e APROVADA -> CONCLUIDA
3. **`allStages` prop** — StageSection agora recebe todas as stages para verificar conflitos cross-stage
4. **Variável `{motivo_pausa}`** — adicionada em NOTIFY_VARS, backend e presets

### Arquivos modificados adicionalmente:
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — allStages prop, proteção financeiro, aviso amber
- `frontend/src/app/(dashboard)/workflow/page.tsx` — allStages passada, handleStageChange trata _disableOtherFinancial
- `frontend/src/types/stage-config.ts` — {motivo_pausa} em NOTIFY_VARS
- `backend/src/public-offer/public-offer.service.ts` — PAUSE_REASON_LABELS, {motivo_pausa}
- `backend/src/workflow/workflow-engine.service.ts` — {motivo_pausa} nas variáveis de template

---

## Sessão 42 — 25/02/2026 (continuação)

### Pedido do Juliano (literal):
> "Faça uma com que o mobile rode em uma nova tela emulada como se fosse no celular para testarmos um fluxo completo, faça tela do tecnico do cliente e do gestor como se tivessem recebendo pelo watzapp, vamos testar um fluxo completo"

### O que foi feito:
1. **Página de demo criada** em `/demo` (`frontend/src/app/demo/page.tsx`)
2. **3 colunas interativas:**
   - 📱 Celular do Técnico: frame de celular emulado com todas as telas do fluxo
   - 👔 WhatsApp do Gestor: tela estilo WhatsApp com notificações em tempo real
   - 👤 WhatsApp do Cliente: tela estilo WhatsApp com notificações do fluxo
3. **Fluxo completo simulado:**
   - Ofertada → Aceita → A Caminho (GPS + distância) → Chegou (fotos obrigatórias) → Executando (timer + checklist) → Pausada (seleção de motivo) → Retomada → Concluída (lançamentos financeiros)
4. **Barra de progresso** mostrando etapa atual com ícones
5. **Notificações contextuais** — gestor e cliente recebem mensagens diferentes conforme a etapa
6. **Lançamentos financeiros** exibidos na conclusão (Contas a Receber + Comissão Técnico)
7. **Botão Reiniciar Demo** para resetar o fluxo

### Teste visual realizado:
- Todas as 8 etapas do fluxo testadas com sucesso
- 7 notificações apareceram no WhatsApp do Gestor
- 5 notificações apareceram no WhatsApp do Cliente
- Timer, pausas, fotos e financeiro funcionando corretamente

### Arquivo criado:
- `frontend/src/app/demo/page.tsx` — página completa de demonstração do fluxo

---

## Sessão 43 — 25/02/2026

### Pedido do Juliano (literal):
> "Campos não necessaros na etapa 6. veja e caso não concorde seja critico, Atribuir técnico automaticamente, Duplicar OS, Registrar atividade, Tirar fotos obrigatórias"

### Análise crítica:
- **Atribuir técnico na CONCLUÍDA** — SEM SENTIDO. Técnico já está atribuído e acabou de concluir. Redistribuição seria feita em etapas anteriores.
- **Duplicar OS na CONCLUÍDA** — SEM SENTIDO como auto-ação. Criaria cópia automática toda vez. Follow-up é decisão manual do gestor.
- **Registrar atividade na CONCLUÍDA** — REDUNDANTE. EM_EXECUÇÃO já captura tudo (checklist, notas, fotos, GPS, materiais).
- **Tirar fotos na CONCLUÍDA** — REDUNDANTE. photoRequirements em EM_EXECUÇÃO já tem momento `on_conclude` para fotos de conclusão.

### Implementação:
1. `assignTech` — removido de CONCLUÍDA, mantido apenas em APROVADA
2. `duplicateOS` — removido de CONCLUÍDA, mantido apenas em APROVADA
3. `step` (registrar atividade) — oculto em CONCLUÍDA
4. `photo` (fotos legacy) — oculto em CONCLUÍDA (usa photoRequirements.on_conclude da EM_EXECUÇÃO)

### Arquivo modificado:
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — condições de visibilidade atualizadas
- Build: frontend tsc 0 erros, next build 22 rotas 0 erros

---

## Sessão 44 — 25/02/2026

### Pedido do Juliano (literal):
> "Agora usando a mesma lógica anterior verifique todas as etapas da 1 até a 7 se tem campos que não tem sentido estar naquela etapa"

### Auditoria completa — 7 etapas:

**Etapa 1 ABERTA** — ✅ OK (messageDispatch, techQuestion, alert, webhook, SLA — tudo coerente)
**Etapa 2 OFERTADA** — ✅ OK (techSelection.acceptTimeout, notificações, SLA — tudo coerente)
**Etapa 3 ATRIBUÍDA** — ❌ `signature` removida (cliente NÃO presente na atribuição)
**Etapa 4 A_CAMINHO** — ❌ `signature` removida (técnico em trânsito, cliente NÃO presente)
**Etapa 5 EM_EXECUÇÃO** — ✅ OK (etapa principal do técnico — todos os campos coerentes)
**Etapa 6 CONCLUÍDA** — ✅ OK (já limpa na sessão 43)
**Etapa 7 APROVADA** — ❌ Grandes alterações:
  - `assignTech` removido — serviço aprovado, sem sentido atribuir
  - `duplicateOS` removido — auto-duplicar toda OS aprovada é errado
  - **TODAS ações do técnico removidas** — etapa gerencial, técnico já terminou campo
  - Hint adicionado: "Aprovada é etapa gerencial. Trabalho de campo termina na Concluída."

### Resumo de remoções:
| Etapa | Campo | Motivo |
|-------|-------|--------|
| ATRIBUÍDA | signature | Cliente não presente |
| A_CAMINHO | signature | Técnico em trânsito |
| APROVADA | assignTech | Serviço finalizado |
| APROVADA | duplicateOS | Auto-duplicar é decisão manual |
| APROVADA | step, photo, note, gps, checklist, form, signature, question | Etapa gerencial, não de campo |

### Arquivo modificado:
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — condições de visibilidade para 3 etapas
- Build: frontend tsc 0 erros, next build 22 rotas 0 erros

---

## Sessão 45 — 25/02/2026

### Pedido do Juliano (literal):
> "Na etapa concluída, tem que tem uma opção de aprovação de conclusão do gestor, ou seja o gestor analisa fotos, checklist, documentos e então aprova ou desaprova, se aprovar pula para aprovada, se não aprovar opções para configurar"

### O que foi feito:
1. **Novo campo `gestorApproval`** no tipo StageConfig (autoActions)
2. **Configuração completa:**
   - Toggle para ativar aprovação do gestor
   - Checklist de revisão editável (itens que o gestor confere)
   - **Ao Aprovar:** OS avança para APROVADA + notificações configuráveis (técnico/cliente)
   - **Ao Reprovar:** 3 ações configuráveis:
     - "Retornar para Execução" (técnico refaz)
     - "Retornar para Atribuída" (recomeça deslocamento)
     - "Apenas notificar" (mantém na CONCLUÍDA)
   - Exigir motivo da reprovação (toggle)
   - Notificações de reprovação (técnico/cliente com canal + mensagem)
3. **Nova variável de template:** `{motivo_rejeicao}` — motivo da rejeição do gestor
4. **Constante `GESTOR_REJECT_ACTIONS`** com 3 ações de rejeição
5. **Compilador:** Novo bloco `GESTOR_APPROVAL` com config de checklist, onApprove, onReject
6. **Decompilador:** Case `GESTOR_APPROVAL` reconstrói o gestorApproval
7. **Presets atualizados:**
   - Instalação Padrão: gestorApproval ativado com 4 itens de revisão
   - Manutenção Corretiva: gestorApproval ativado com 4 itens de revisão
8. **UI:** Card azul na CONCLUÍDA com seções Aprovar/Reprovar, notificações por evento

### Arquivos modificados:
- `frontend/src/types/stage-config.ts` — tipo, constantes, defaults, compiler, decompiler, presets
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — import + bloco UI gestorApproval
- Build: frontend tsc 0 erros, next build 22 rotas 0 erros

## Sessão 46 — 25/02/2026

### Pedido do Juliano (literal):
> "Aprovar com ressalvas tambem poderia estar nas configurações(estudar qual seria a ações que faz sentido ter)"

### Análise feita:
Ações que fazem sentido para "Aprovar com Ressalvas":
- ✅ Exigir nota/descrição das ressalvas (obrigatório para documentar)
- ✅ Ajuste de comissão (reduzir % ou valor fixo — penalidade proporcional)
- ✅ Flag de qualidade na OS (rastreamento de recorrência)
- ✅ Notificar técnico (precisa saber das ressalvas)
- ✅ Notificar cliente (opcional)
- ❌ Agendar follow-up (overkill — outra OS resolve)
- ❌ Bloquear técnico (muito agressivo para ressalvas)

### O que foi feito:
1. **Novo campo `onApproveWithReservations`** no gestorApproval:
   - Toggle para habilitar a opção
   - `requireNote` — exige descrição das ressalvas
   - `commissionAdjustment` — ajustar comissão (% ou fixo)
   - `flagOS` — marcar OS com flag de qualidade
   - Notificações configuráveis (técnico/cliente)
2. **Nova variável de template:** `{ressalvas}` — descrição das ressalvas
3. **Constante `COMMISSION_ADJUSTMENT_TYPES`** (reduce_percent, reduce_fixed)
4. **Compilador/Decompilador:** `onApproveWithReservations` incluído no bloco GESTOR_APPROVAL
5. **createEmptyStage:** defaults para onApproveWithReservations
6. **Presets atualizados:**
   - Instalação: comissão reduz 10% com ressalvas
   - Manutenção: comissão reduz 15% com ressalvas
7. **UI StageSection:** Seção amber "⚠️ Ao APROVAR COM RESSALVAS" entre Aprovar e Reprovar:
   - Toggle habilitar, requireNote, flagOS
   - Card de ajuste de comissão (tipo + valor)
   - Notificações técnico/cliente
8. **Dica atualizada:** Agora menciona 3 botões (Aprovar, Ressalvas, Reprovar)

### Arquivos modificados:
- `frontend/src/types/stage-config.ts` — tipo, constantes, defaults, compiler, decompiler, presets
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — import COMMISSION_ADJUSTMENT_TYPES + bloco UI onApproveWithReservations
- Build: backend tsc 0 erros, frontend tsc 0 erros, next build 22 rotas 0 erros

## Sessão 47 — 25/02/2026

### Pedido do Juliano (literal):
> "Ok, agora faça um estudo amplo e geral do sistema, para organização, melhores praticas, segurança, integração a outros erp, melhorias necessárias, pois já penso em subir o sistema pra on line, seja totalmente critico"

### O que foi feito:
Auditoria completa e crítica do sistema inteiro com 5 agentes em paralelo:
1. **Backend** — Arquitetura NestJS, APIs, validação, error handling, performance
2. **Frontend** — Next.js 14, state management, auth, forms, a11y, performance
3. **Segurança & Deploy** — JWT, rate limiting, CORS, Docker, HTTPS, endpoints públicos
4. **Banco de Dados** — Schema Prisma, indexes, N+1, multi-tenancy, escalabilidade
5. **Qualidade de Código** — console.logs, any types, TODOs, config, testes

Resultado: Relatório completo com 6 issues CRÍTICAS, 8 HIGH, 12 MEDIUM.
Nota geral: 6.5/10 (pré-produção). NÃO está pronto para deploy sem correções.
Nenhum arquivo foi modificado — apenas leitura e análise.
