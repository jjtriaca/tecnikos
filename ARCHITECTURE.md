# Tecnikos — Mapa Tecnico da Arquitetura

> **Leia este arquivo ao iniciar qualquer sessao.** Ele contem o mapa completo do sistema para evitar perda de contexto entre sessoes. Mantenha-o atualizado ao fazer mudancas estruturais.

## Visao Geral

Tecnikos e uma plataforma SaaS B2B de Gestao de Servicos Tecnicos (Field Service Management). O sistema gerencia ordens de servico, tecnicos em campo, financeiro, fiscal, automacoes e comunicacao com clientes.

**Stack**: NestJS (backend:4000) + Next.js 15 App Router (frontend:3000) + PostgreSQL 16 + Prisma + Tailwind CSS
**Multi-tenant**: Schema PostgreSQL por tenant (`tenant_{slug}`), schema public para SaaS (Tenant, Plan, Subscription)

---

## 1. Modulos do Backend (39 NestJS Modules)

### Core
| Modulo | Responsabilidade | Service principal |
|--------|-----------------|-------------------|
| AppModule | Root, orquestra tudo | - |
| PrismaModule | Conexao DB (global) | PrismaService |
| AuthModule | JWT + refresh + session + RBAC | AuthService, JwtStrategy |
| HealthModule | `/health` (versao + status) | HealthController |

### Ordens de Servico
| Modulo | Responsabilidade | Service principal |
|--------|-----------------|-------------------|
| ServiceOrderModule | CRUD OS + lifecycle + dispatch | ServiceOrderService |
| WorkflowModule | Engine V1/V2/V3 + execucao | WorkflowEngineService |
| AutomationModule | Regras event-driven | AutomationEngineService |
| PublicOfferModule | Links publicos + OTP | PublicOfferService |
| ChecklistResponseModule | Checklists por etapa | ChecklistResponseService |

### Cadastros
| Modulo | Responsabilidade | Service principal |
|--------|-----------------|-------------------|
| PartnerModule | Clientes/Fornecedores/Tecnicos (unified) | PartnerService |
| UserModule | Usuarios gestores multi-role | UserService |
| SpecializationModule | Especializacoes de tecnicos | SpecializationService |
| ProductModule | Catalogo de produtos (estoque, fiscal) | ProductService |
| ServiceModule | Catalogo de servicos (preco, comissao) | ServiceService |
| ObraModule | Canteiros de obra (CNO) | ObraService |
| ServiceAddressModule | Enderecos de atendimento | ServiceAddressService |

### Financeiro
| Modulo | Responsabilidade | Service principal |
|--------|-----------------|-------------------|
| FinanceModule | A receber, a pagar, parcelas, contas | FinanceService |
| QuoteModule | Orcamentos + PDF + aprovacao | QuoteService |
| BoletoModule | Emissao de boletos bancarios (multi-banco) | BoletoService, BoletoConfigService |

### Fiscal
| Modulo | Responsabilidade | Service principal |
|--------|-----------------|-------------------|
| NfseEmissionModule | Emissao NFS-e (Focus NFe) | NfseEmissionService |
| NfseEntradaModule | Importacao NFS-e recebidas | NfseEntradaService |
| NfeModule | Importacao NFe + SEFAZ DFe | NfeService, SefazDfeService |
| FiscalPeriodModule | Periodos fiscais (apuracao) | FiscalPeriodService |
| SpedModule | Geracao SPED (ICMS-IPI, Contribuicoes) | SpedService |

### Comunicacao
| Modulo | Responsabilidade | Service principal |
|--------|-----------------|-------------------|
| NotificationModule | Multi-canal (WhatsApp, SMS, Email, Push) | NotificationService, PushNotificationService |
| WhatsAppModule | Meta Cloud API v21.0 | WhatsAppService |
| EmailModule | SMTP (Zoho) | EmailService |
| ChatIAModule | Assistente IA embarcado (Claude) | ChatIAService |

### SaaS / Multi-tenant
| Modulo | Responsabilidade | Service principal |
|--------|-----------------|-------------------|
| TenantModule | Billing Asaas + planos + subscriptions | TenantService, AsaasService |
| SaasConfigModule | Configuracoes globais (key-value, AES-256-GCM) | SaasConfigService |
| VerificationModule | CAPTCHA Turnstile | VerificationService |
| UploadModule | Storage S3-compatible | UploadService |
| ReportsModule | Dashboard + exports | ReportsService |
| ContractModule | Contratos tecnicos + portal publico | ContractService |
| EvaluationModule | Avaliacoes gestor+cliente (1-5) | EvaluationService |

### Modulo Piscina (vertical, opt-in via Company.poolModuleActive)
| Modulo | Responsabilidade | Service principal |
|--------|-----------------|-------------------|
| PoolCatalogConfigModule | Vincula Product/Service a secoes Piscina + formula | PoolCatalogConfigService |
| PoolBudgetTemplateModule | Templates pre-prontos de etapas | PoolBudgetTemplateService |
| PoolBudgetModule | Orcamentos de piscina + items + status | PoolBudgetService, PoolFormulaService |
| PoolProjectModule | Obras (etapas + livro caixa + fotos) | PoolProjectService |
| PoolPrintLayoutModule | Page builder de layouts PDF | PoolPrintLayoutService |

### Dependencias Circulares (forwardRef)
- FinanceModule <-> NfseEmissionModule
- AuthModule -> TenantModule

---

## 2. Maquina de Estados — Ordem de Servico

```
ABERTA --> OFERTADA --> ATRIBUIDA --> A_CAMINHO --> EM_EXECUCAO --> CONCLUIDA --> APROVADA (terminal)
  |            |            |              |              |              |
  +->CANCELADA +->ABERTA    +->ABERTA      +->ATRIBUIDA   +->AJUSTE      +->AJUSTE
               +->CANCELADA +->CANCELADA   +->CANCELADA   +->CANCELADA
                             +->EM_EXECUCAO
```

**ALLOWED_TRANSITIONS** validado no `updateStatus()`. Status terminais (APROVADA, CANCELADA) bloqueiam qualquer transicao.

### Modos de Atribuicao
- **BY_SPECIALIZATION**: Filtra por especializacao + rating
- **DIRECTED**: Auto-assign ao tecnico direcionado (se nao tem review screen no workflow)
- **BY_AGENDA** (CLT): Pre-atribui + aceita automaticamente
- **BY_WORKFLOW**: Disparado pelo template de workflow

### Timestamps do Ciclo
`acceptedAt` -> `enRouteAt` -> `arrivedAt` -> `startedAt` -> `completedAt`
Pause: `isPaused`, `pauseCount`, `totalPausedMs`
Cancel: `cancelledReason`, `declinedReason`, `declinedAt`

### Regras Criticas
- OS deletadas **contam** no limite mensal (evita burla por create+delete)
- `acceptedAt` so seta se workflow tem `acceptOS=true` no NOTIFY block
- DIRECTED + TechReview: checa workflow ANTES de auto-assign

---

## 3. Workflow Engine (V1/V2/V3)

Armazenado em `WorkflowTemplate.steps` (Json):
- **V1**: Array linear `[{order, name, icon, requirePhoto, requireNote}]`
- **V2**: Grafo `{version:2, blocks:[{id, type, config, next, yesBranch, noBranch}]}`
- **V3**: FlowDef `{version:3, blocks:[{id, type, children[], yesBranch, noBranch}]}`

### REGRA V3 (ABSOLUTA): Blocos controlam tudo
- Status inicial da OS apos gatilho: **NULL** (sem status pre-fixado)
- Engine executa blocos sequencialmente do START ao FIM
- NENHUMA logica pre-fixada (sem auto-assign, sem fallback)
- Bloco Status: modo `automatico` ou `manual` (aguardar tecnico clicar com botao customizado)
- Bloco GPS: obrigatorio, alta precisao, modo (pontual/continuo), intervalo, captura automatica
- Bloco SE/Condicao: branches SIM/NAO com blocos independentes em cada caminho
- Se problema transicional: criar novo BLOCO, NUNCA hard-code no engine
- Ver `memory/project_workflow_engine_v3.md` para detalhes

### Tipos de Blocos
STEP, PHOTO, GPS, QUESTION, CHECKLIST, SIGNATURE, FORM, CONDITION, NOTIFY, WAIT_FOR, STATUS, ARRIVAL_QUESTION, TECH_REVIEW_SCREEN

### Canais de Notificacao (NOTIFY)
WhatsApp, Email, Push

### Status de OS
ABERTA, OFERTADA, ATRIBUIDA, A_CAMINHO, EM_EXECUCAO, CONCLUIDA, APROVADA, CANCELADA, RECUSADA

### Triggers de Workflow
Prioridade: `urgente` -> `retorno` -> `avaliacao_orcamento` -> `modo atendimento` (specialization/directed/agenda) -> `os_created` (generico)
- `os_evaluation_created`: OS de Avaliacao/Orcamento (isEvaluation=true)

---

## 4. Automacao (Event-Driven)

Disparada apos cada mutacao de ServiceOrder/Partner (fire-and-forget).

**Eventos**: os_created, os_urgent_created, os_return_created, os_specialization_created, os_directed_created, os_agenda_created, os_assigned, os_accepted, os_started, os_completed, partner_created, partner_rating_changed

**Acoes**: LAUNCH_FINANCIAL, SEND_NOTIFICATION, CHANGE_STATUS, ALERT_MANAGER, ASSIGN_TECHNICIAN, DUPLICATE_OS, WEBHOOK

**Modos**: Simple (AND) ou Advanced (arvore SIM/NAO com acoes por branch)

---

## 5. Modelo de Dados (Prisma) — Modelos Principais

### Multi-tenant (schema public)
- **Tenant**: slug, schemaName, cnpj, status (PENDING_VERIFICATION->PENDING_PAYMENT->ACTIVE->BLOCKED/SUSPENDED/CANCELLED)
- **Plan**: maxUsers, maxOsPerMonth, maxTechnicians, maxAiMessages, priceCents, priceYearlyCents
- **Subscription**: tenantId, planId, status, billingCycle, pendingPlanId, creditBalanceCents, promotionMonthsLeft
- **AddOn/AddOnPurchase**: 5 tipos (OS, users, technicians, AI messages, NFS-e imports), expiresAt por ciclo
- **SaasConfig**: key-value global (FOCUS_NFE_RESELLER_TOKEN, VAPID keys), valores sensiveis AES-256-GCM
- **Promotion**: code, discountPercent/Cents, durationMonths, skipPayment (voucher)

### Usuarios e Auth
- **User**: roles UserRole[] (ADMIN, DESPACHO, FINANCEIRO, FISCAL, LEITURA), chatIAEnabled, preferences (JSONB)
- **Session**: refreshTokenHash, revokedAt (invalidacao imediata), deviceName, lastActivityAt
- **Partner**: partnerTypes[] (CLIENTE, FORNECEDOR, TECNICO), passwordHash (login tecnico), rating, regime (CLT/PJ)

### Ordens de Servico
- **ServiceOrder**: status, techAssignmentMode, valueCents, commissionBps, GPS fields, pause tracking, scheduling
- **ServiceOrderOffer**: token, channel, expiresAt (link publico)
- **ServiceOrderEvent**: audit trail imutavel
- **ServiceOrderLedger**: grossCents, commissionCents, netCents (1:1 com OS)
- **ServiceOrderItem**: line items (serviceId, quantity, unitPriceCents)
- **WorkflowStepLog**: blocos completados por OS
- **PendingWorkflowWait**: blocos WAIT_FOR aguardando evento

### Financeiro
- **FinancialEntry**: RECEIVABLE/PAYABLE, parcelas, renegociacao chain (parentEntryId), nfseStatus
- **FinancialInstallment**: parcela individual com juros/multa/desconto
- **CashAccount**: CAIXA/BANCO, saldo, PIX
- **PaymentMethod/PaymentInstrument**: metodos + instrumentos especificos
- **CardSettlement/CardFeeRate**: liquidacao de cartao com taxas
- **BankStatementImport/Line**: conciliacao OFX/CSV
- **FinancialAccount**: plano de contas hierarquico (2 niveis)
- **CollectionRule/Execution**: regua de cobranca automatica

### Fiscal
- **NfseConfig**: Focus NFe token (encrypted), auto-emit, RPS series
- **NfseEmission**: status PROCESSING->AUTHORIZED->ERROR->CANCELLED, XML/PDF URLs
- **NfseEntrada**: NFS-e recebidas (prestador, tomador, valores, tributos)
- **SefazConfig**: certificado PFX (encrypted), auto-fetch
- **SefazDocument**: NFe baixadas da SEFAZ (nsu, schema, status)
- **NfeImport/NfeImportItem**: NFe importadas com items e tributos detalhados
- **FiscalPeriod**: apuracao mensal (ICMS, IPI, PIS, COFINS, ISS)

### Comunicacao
- **Notification**: multi-canal, whatsappMessageId, errorDetail, status tracking
- **PushSubscription**: endpoint, p256dh, auth (Web Push API), userId, deviceName, expiresAt
- **WhatsAppConfig**: metaAccessToken (encrypted), phoneNumberId, wabaId
- **WhatsAppMessage**: INBOUND/OUTBOUND, status (SENT->DELIVERED->READ->FAILED)
- **EmailConfig**: SMTP (encrypted)
- **ChatIAConversation/Message**: historico IA, tool calls, action buttons

### Outros
- **Evaluation**: gestor (40%) + cliente (60%), token publico
- **TechnicianLocationLog**: GPS trail (lat, lng, distanceToTarget)
- **ExecutionPause**: pause tracking com fotos e categorias
- **TechnicianContract**: contrato PJ/CLT com assinatura
- **Quote/QuoteItem**: orcamentos com versionamento
- **Product**: estoque, fiscal (NCM, CEST, ICMS, IPI)
- **Obra**: canteiros com CNO
- **AuditLog**: before/after JSON de todas mudancas
- **CodeCounter**: gerador sequencial (OS-00001, PAR-00001, etc.)

---

## 6. Frontend — Estrutura de Rotas

### Publicas
| Rota | Funcao |
|------|--------|
| `/` | Landing page (marketing + pricing) |
| `/login`, `/signup` | Auth |
| `/p/[token]` | Link publico OS (tecnico aceita/recusa) |
| `/q/[token]` | Link publico orcamento |
| `/rate/[token]` | Avaliacao publica |
| `/contract/[token]` | Assinatura contrato |

### App Tecnico
| Rota | Funcao |
|------|--------|
| `/tech/login` | Login tecnico |
| `/tech/orders` | OS atribuidas |
| `/tech/orders/[id]` | Detalhe OS (checklists, fotos, GPS) |

### Dashboard (protegido)
| Grupo | Rotas |
|-------|-------|
| OS | `/orders`, `/orders/new`, `/orders/[id]`, `/orders/[id]/edit`, `/agenda` |
| Orcamentos | `/quotes`, `/quotes/new`, `/quotes/[id]`, `/quotes/[id]/edit` |
| Cadastros | `/partners`, `/products`, `/services` |
| Financeiro | `/finance`, `/results`, `/reports` |
| Fiscal | `/nfe`, `/nfe/entrada`, `/nfe/saida`, `/fiscal`, `/fiscal/livro-entradas`, `/fiscal/servicos-tomados`, `/fiscal/sped` |
| Config | `/settings`, `/settings/billing`, `/settings/devices`, `/settings/email`, `/settings/fiscal`, `/settings/whatsapp` |
| Piscina (opt-in) | `/quotes?tab=obras` (lista PoolBudgets+PoolProjects), `/quotes/pool/new`, `/quotes/pool/[id]`, `/quotes/pool/projects/[id]`, `/pool/catalog`, `/pool/templates`, `/pool/print-layouts`, `/pool/print-layouts/[id]` |
| Admin | `/users`, `/notifications`, `/whatsapp`, `/workflow`, `/automation`, `/dashboard` |
| SaaS Admin | `/ctrl-zr8k2x/*` (tenants, plans, addons, promotions, invoices, signup-attempts, settings) |

---

## 7. Frontend — Contexts e Hooks

### Contexts
| Context | Estado | Funcao |
|---------|--------|--------|
| **AuthContext** | user, roles, token | Auth JWT in-memory, silent refresh, hasRole() helper |
| **DispatchContext** | dispatches[] | Painel flutuante OS ativas, polling 5s, GPS, resend |
| **ChatIAContext** | messages, onboarding | Chat IA streaming (SSE), usage tracking, multi-conversation |
| **FiscalModuleContext** | fiscalEnabled | Toggle visibilidade modulo fiscal no sidebar |
| **TechAuthContext** | techUser, token | Login tecnico separado (Partner com passwordHash) |

### Hooks
| Hook | Funcao |
|------|--------|
| `useTableParams({ persistKey })` | Estado de filtros/sort/page, persiste em localStorage |
| `useTableLayout(tableId, columns)` | Ordem e largura de colunas, persiste em localStorage |
| `useDebounce(value, delay)` | Debounce para search inputs |
| `usePushNotifications()` | Web Push: subscribe/unsubscribe, permission, supported |

### API Wrapper (`lib/api.ts`)
- Fetch puro (sem Axios), JWT Bearer auto-inject
- Token JWT armazenado em memoria (nao localStorage — protecao XSS)
- Silent refresh em 401 via httpOnly cookie (retry unico)
- Retry em 502/503/504 (3 tentativas, 3s delay — resiliencia de deploy)
- `api.get/post/put/patch/del<T>(path, body?, opts?)`

---

## 8. Frontend — Sistema de Tabelas

**Obrigatorio em TODAS as tabelas:**
1. `DraggableHeader` -> colunas redimensionaveis e reordenaveis
2. `SortableHeader` -> ordenacao por coluna
3. `FilterBar` + `FilterDefinition[]` -> filtros persistidos
4. `Pagination` -> paginacao padrao
5. `useTableParams({ persistKey })` -> estado filtros/sort/page
6. `useTableLayout(tableId, columns)` -> ordem/largura colunas
7. Tipos: `ColumnDefinition<T>`, `FilterDefinition` de `@/lib/types/table`

---

## 9. Integracoes Externas

| Integracao | Provider | Modulo | Tokens |
|------------|----------|--------|--------|
| Pagamento | Asaas | TenantModule | ASAAS_API_KEY (env) |
| WhatsApp | Meta Cloud API v21.0 | WhatsAppModule | Encrypted AES-256-GCM |
| NFS-e (revenda) | Focus NFe | NfseEmissionModule | FOCUS_NFE_RESELLER_TOKEN (SaasConfig DB, fallback env) + tokens por tenant (encrypted) |
| Push Notifications | Web Push API | NotificationModule | VAPID keys (SaasConfig DB, encrypted) |
| NFe/SEFAZ | SEFAZ DFe | NfeModule | Certificado PFX encrypted |
| Email | SMTP Zoho | EmailModule | SMTP credentials (env) |
| IA | Claude API | ChatIAModule | ANTHROPIC_API_KEY (env) |
| CAPTCHA | Turnstile | VerificationModule | TURNSTILE keys (env) |
| CEP | ViaCEP | Frontend | Free (sem auth) |

---

## 10. Fluxos de Negocio Criticos

### Subscription/Billing (Asaas)
1. **Signup** -> Tenant(PENDING_VERIFICATION) + Subscription(PENDING) -> webhook PAYMENT_CONFIRMED -> ACTIVE
2. **Upgrade** -> pendingPlanId salvo -> webhook -> plano/limites atualizados
3. **Downgrade** -> pendingPlanId para proximo ciclo (sem pagamento)
4. **Add-on** -> AddOnPurchase(PENDING) -> webhook -> limites creditados
5. **Overdue** -> Grace 7 dias -> Tenant BLOCKED
6. **Crons**: sync 7AM, cobranca 00:30, webhook sync 00:15

### Evaluation (Avaliacao)
1. Gestor avalia tecnico (score 1-5, peso 40%)
2. Gera token publico -> envia link ao cliente
3. Cliente avalia (score 1-5, peso 60%)
4. Rating = media ponderada -> atualiza Partner.rating

### NFS-e Emission (Focus NFe — Revenda Centralizada)
1. **Modelo**: Tecnikos tem conta Start na Focus NFe, cadastra CNPJs dos clientes via API de Empresas
2. **Token de revenda**: FOCUS_NFE_RESELLER_TOKEN (env) — usado para /v2/empresas (CRUD de clientes)
3. **Tokens de emissao**: Cada tenant recebe token_producao e token_homologacao da Focus (encrypted no NfseConfig)
4. **Registro**: registerOrUpdateEmpresa() cadastra CNPJ na Focus → salva focusNfeCompanyId + tokens
5. **Certificado**: uploadCertificate() envia e-CNPJ A1 via API de Empresas
6. **Emissao**: FinancialEntry RECEIVABLE -> preview -> Emit -> PROCESSING -> AUTHORIZED/ERROR
7. **Cancelamento 2 etapas**: Alguns municipios exigem 2 DELETE (pedido + confirmacao) — status CANCELLING com retry automatico
8. **Wizard IA**: ChatIA guia config fiscal em 7 steps (registro auto, certificado, IBGE, servicos, ISS, validacao, teste)

### Wizards ChatIA (Sistema de Guias Inteligentes)
- **Setup Wizard (master)**: Triggers "como comecar", "setup inicial" → guia sequencial por todos os 10 items do onboarding
- **NFS-e Config Wizard**: Triggers "configurar NFS-e", "nota fiscal" → 7 steps (registro Focus, certificado, IBGE, servicos, ISS, validacao, teste)
- **Push Notifications Wizard**: Triggers "push", "notificacoes push" → ativar push no navegador
- **NFS-e Import Wizard**: Triggers "importar nfse", "pacotes nfse" → saldo, pacotes, compra
- **Billing/Plans Wizard**: Triggers "meu plano", "upgrade", "billing" → plano atual, limites, upgrade
- **Tools**: verificar_configuracao, verificar_push_notifications, verificar_nfse_imports, verificar_plano_billing, verificar_fiscal_completo, buscar_municipio_ibge, salvar_codigo_ibge, listar_servicos_nfse, registrar_empresa_focus

### WhatsApp (Meta Cloud API)
- Template fallback: tenta template primeiro, fallback texto em janela 24h
- Tokens encrypted AES-256-GCM no banco
- Webhook: verificacao signature + status updates
- **RISCO DE BAN**: ver memory/whatsapp-audit-2026-03.md

---

## 11. Auth e Seguranca

### Fluxo Auth
1. Login -> JWT access token (in-memory) + refresh token (httpOnly cookie)
2. Guard chain: Throttler -> JWT -> Roles -> Verification -> Fiscal
3. Session com `revokedAt` permite logout imediato cross-device
4. CAPTCHA Turnstile a cada 7 dias

### Roles (UserRole enum)
ADMIN, DESPACHO, FINANCEIRO, FISCAL, LEITURA (exclusivo — nao combina com outros)
Tecnico: nao e UserRole, e Partner com login proprio (phone/CPF + password)

### Tenant Isolation
- Schema PostgreSQL por tenant (`tenant_{slug}`)
- Todas queries filtram por `companyId`
- JWT contem `tenantSlug` para contexto
- PrismaService + TenantConnectionService resolvem schema correto

### Encriptacao
- AES-256-GCM: WhatsApp tokens, Focus NFe tokens, SEFAZ certs, SMTP creds, VAPID private key, SaasConfig values
- `EncryptionService` com chave do env (ENCRYPTION_KEY ou fallback JWT_SECRET)
- `SaasConfigService` armazena configs globais criptografadas (DB first, env fallback)

---

## 12. Infraestrutura

### Producao
- **Servidor**: Hetzner CPX21 (Ashburn VA), IP: 178.156.240.163
- **Containers**: postgres (2GB), backend (1GB), frontend (1GB), nginx, certbot
- **SSL**: Let's Encrypt auto-renew
- **Backup**: Diario 3AM, retencao 30 dias
- **Firewall**: UFW + Fail2Ban (SSH max 3, ban 2h)

### Nginx Rate Limiting
- `/api/*`: 30 req/s (burst 50)
- `/api/auth/*`: 1 req/s (burst 5)
- `/api/p/*`: 10 req/s (publico)
- Bloqueia scanners (Nmap, Nikto, SQLMap, etc.)

### Deploy
```bash
bash scripts/deploy-remote.sh          # patch
bash scripts/deploy-remote.sh minor    # minor
```
Fluxo: bump version -> tar -> SCP -> backup DB -> Docker build -> prisma migrate -> restart -> health check -> git commit+push+tag

### Versionamento
Arquivo `version.json` na raiz. Formato: `MAJOR.MINOR.PATCH` (ex: 1.04.33). Patch 1-99, ao chegar em 99 incrementa minor.

---

## 13. Cron Jobs

| Service | Schedule | Funcao |
|---------|----------|--------|
| CollectionService | 6 AM diario | Executar regras de cobranca |
| SefazDfeService | A cada 10 min | Buscar NFe novas da SEFAZ |
| QuoteService | Meia-noite | Expirar orcamentos vencidos |
| AsaasService | 7 AM diario | Sync status subscriptions |
| AsaasService | 00:30 diario | Cobrar tenants inadimplentes (grace 7 dias) |
| AsaasService | 00:15 diario | Expirar add-ons vencidos (revert limites) |
| PushNotificationService | 3 AM diario | Cleanup push subscriptions expiradas |
| WaitForService | A cada minuto | Checar blocos WAIT_FOR pendentes |

---

## 14. Gotchas e Armadilhas Conhecidas

1. **OS deletadas contam no limite mensal** — evita burla por create+delete
2. **acceptedAt condicional**: so seta se workflow tem `acceptOS=true` no NOTIFY block
3. **DIRECTED + TechReview**: checa workflow ANTES de auto-assign
4. **Webhook race condition**: `updateMany(status != ACTIVE)` impede ativacao duplicada
5. **forwardRef obrigatorio**: Finance <-> NfseEmission (circular dependency)
6. **Preview Screenshot**: NUNCA usar, trava o chat. Usar preview_snapshot/preview_inspect
7. **LEITURA role**: exclusivo, nao combina com outros roles
8. **JWT backward compat**: fallback `payload.roles || [payload.role]` no jwt.strategy
9. **WhatsApp template fallback**: `sendTextWithTemplateFallback(forceTemplate:true)` para evitar ban
10. **Add-on NAO faz rollover**: vale pro ciclo vigente, expira no fim do periodo
16. **OS/AI contagem por ciclo billing**: Usa `currentPeriodStart/End` da Subscription (NAO calendario dia 1). Fallback calendario se sem subscription.
17. **Promo upfront**: `promotionMonthsLeft` zerado no primeiro pagamento. Deteccao via `promotionId + originalValueCents` no getBillingStatus/MRR.
18. **Add-on revert protege baseline**: Ao expirar add-on, limites nunca caem abaixo do plano base (busca Plan do Tenant).
19. **SaasConfig fallback env**: `SaasConfigService.get(key)` busca DB primeiro, fallback `process.env[key]`.
20. **NFS-e imports = add-on puro**: `maxNfseImports=0` em todos os planos. Compra via add-on (nfseImportQuantity).
11. **Fire-and-forget automation**: `automationEngine?.dispatch().catch(() => {})` — falha silenciosa
12. **Token JWT in-memory**: NAO esta em localStorage (seguranca XSS), perde no F5 -> silent refresh via cookie
13. **NFS-e cancelamento 2 etapas**: Alguns municipios (ex: Primavera do Leste/MT) exigem 2 DELETE — status CANCELLING com retry automatico 3s
14. **Focus NFe .env.production**: Arquivo correto em `/opt/tecnikos/app/.env.production` (NAO `/opt/tecnikos/`)
15. **Focus NFe API de Empresas**: Token de revenda (producao) funciona em /v2/empresas. Token de homologacao NAO tem permissao

---

## 15. Arquivos-Chave (Referencia Rapida)

### Backend
| Arquivo | Funcao |
|---------|--------|
| `backend/src/app.module.ts` | Composicao de todos os modulos |
| `backend/src/service-order/service-order.service.ts` | Logica da maquina de estados OS |
| `backend/src/workflow/workflow-engine.service.ts` | Execucao V1/V2/V3 |
| `backend/src/automation/automation-engine.service.ts` | Regras event-driven |
| `backend/src/tenant/tenant.service.ts` | Provisioning multi-tenant |
| `backend/src/tenant/asaas.service.ts` | Lifecycle de pagamentos |
| `backend/src/common/saas-config.service.ts` | Config global (DB + env fallback) |
| `backend/src/notification/push-notification.service.ts` | Web Push API |
| `backend/src/finance/finance.service.ts` | Lancamentos, parcelas, renegociacao |
| `backend/prisma/schema.prisma` | Modelo de dados completo (60+ models) |

### Frontend
| Arquivo | Funcao |
|---------|--------|
| `frontend/src/contexts/AuthContext.tsx` | Auth state + silent refresh |
| `frontend/src/contexts/ChatIAContext.tsx` | IA streaming + tools |
| `frontend/src/contexts/DispatchContext.tsx` | OS polling + GPS |
| `frontend/src/lib/api.ts` | API wrapper com retry/refresh |
| `frontend/src/hooks/useTableParams.ts` | Filtros/sort persistidos |
| `frontend/src/hooks/useTableLayout.ts` | Colunas persistidas |
| `frontend/src/hooks/usePushNotifications.ts` | Web Push subscribe/unsubscribe |
| `frontend/public/sw.js` | Service Worker (cache + push listener) |

### Infra
| Arquivo | Funcao |
|---------|--------|
| `docker-compose.yml` | Setup containers |
| `nginx/nginx.conf` | Reverse proxy + rate limits |
| `scripts/deploy-remote.sh` | Deploy automatizado |
