# TAREFA ATUAL

## Versao: v1.05.16
## Ultima sessao: 142 (19/03/2026)

## Pendencias

### A FAZER
- **Workflow Engine V3**: Blocos como controladores absolutos — sem logica pre-fixada. Ver memory/project_workflow_engine_v3.md
- **Portal do tecnico**: Respeitar configs dos blocos (botao manual, GPS avancado, aceite)
- **Fase 3 — Offline-first**: IndexedDB para OS locais + fila de sync (futuro)

### PENDENTE VALIDACAO
- **Tech refresh TTL**: Atualmente 1 dia para teste. Apos validar, mudar para 90 dias em `auth.constants.ts`

### CONCLUIDO (sessao 142)

#### TenantMigratorService — Fix FK cross-schema
- **remapForeignKeys()**: Novo metodo detecta FKs que referenciam public schema e remapeia para tenant schema
- **syncAllTenantSchemas**: Step 3 adicionado — remap FKs apos sync de enums e tabelas
- **syncSchema (new table)**: Chama remapForeignKeys(schema, table) apos criar tabela + remap enums
- **tenant.service.ts createSchema()**: Mesmo fix aplicado na criacao inicial de schemas
- **Logica**: Drop FK old → se tabela ref existe no tenant, recria apontando pro schema correto; se public-only, apenas remove

### CONCLUIDO (sessao 141)

#### Wizards ChatIA — Setup Geral + Features Recentes
- **Setup Wizard (master)**: Guia sequencial por todos os 10 items do onboarding via ChatIA
- **Wizard Push Notifications**: Triggers + tool verificar_push_notifications + instrucoes
- **Wizard NFS-e Import**: Triggers + tool verificar_nfse_imports + pacotes e saldo
- **Wizard Billing/Planos**: Triggers + tool verificar_plano_billing + limites e upgrade
- **Onboarding**: Item pushNotifications adicionado ao checklist (opcional)
- **verificar_configuracao**: Novo case 'push' para checar dispositivos inscritos
- **System prompt**: 5 wizards com triggers, setup master, instrucoes detalhadas
- **Context injection**: Wizards push/nfse-import/billing injetados apos onboarding completo
- **CLAUDE.md**: Regra de avaliar wizard para cada feature nova

### CONCLUIDO (sessao 140)

#### Auditoria Billing Completa (15/15 PASS)
- **Fix #1 — OS enforcement por ciclo billing**: `create()` usa `getBillingPeriod()` com subscription dates
- **Fix #2 — AI msgs por ciclo billing**: `needsBillingReset()` verifica `currentPeriodStart` da subscription
- **Fix #4 — Promo badge upfront**: Detecta promo por `promotionId + originalValueCents` mesmo com `monthsLeft=0`
- **Fix #5 — Add-on revert baseline**: `revertAddOnFromTenantCompany()` protege limites do plano base
- **Fix #6 — MRR otimizado**: Batch fetch promotions (elimina N+1) + detecta promo upfront
- **Testes CI**: 70/70 passando — mocks atualizados, regex error msg, teste promo upfront

#### NFS-e Import Add-on System
- **Add-on nfseImportQuantity**: Campo no AddOn + AddOnPurchase + Company.maxNfseImports
- **creditAddOnToTenantCompany**: Incrementa maxNfseImports quando add-on confirmado
- **revertAddOnFromTenantCompany**: Decrementa na expiracao com protecao baseline
- **Frontend admin**: Campo "Import. NFS-e extras" no formulario de pacotes + botao "Duplicar"
- **Frontend tenant**: Botao "Importar NFS-e" desabilitado sem saldo, link para compra add-on
- **HeaderBilling**: Barra Import NFS-e no topo (cores progressivas)
- **Billing page**: Filter=nfse mostra pacotes de importacao
- **Texto explicativo**: Importacao manual gratuita vs automatica paga
- **Planos**: maxNfseImports removido da UI (add-on puro)
- **3 pacotes criados**: +72 (R$23,80), +150 (R$40,50), +300 (R$66,00)
- **Fix public/saas/addons**: Endpoint agora retorna nfseImportQuantity
- **Fix add-on checkout**: Trocado createCheckout (billingTypes invalido) por createPayment (UNDEFINED)

#### Admin Global Config (SaasConfig)
- **SaasConfig model**: Key-value criptografado AES-256-GCM no schema public
- **SaasConfigService**: get() com fallback env, set() com encrypt, getAll() mascarado
- **SaasConfigController**: GET/PUT/DELETE /admin/config + POST generate-vapid
- **SaasConfigModule**: @Global, exporta SaasConfigService
- **FOCUS_NFE_RESELLER_TOKEN**: Migrado de .env para DB (3 locais substituidos)
- **Frontend admin**: Pagina /ctrl-zr8k2x/settings com secoes Integracoes, Push, Geral
- **Sidebar admin**: Link "Configuracoes" adicionado

#### Push Notifications (Web Push API)
- **PushSubscription model**: Tenant schema, userId, endpoint, p256dh, auth, deviceName
- **web-push**: npm package instalado
- **PushNotificationService**: subscribe/unsubscribe/sendToUser/sendToCompany + cron cleanup 3AM
- **PushSubscriptionController**: GET /push/vapid-key, POST subscribe/unsubscribe/test
- **NotificationService**: Push fire-and-forget apos cada notificacao (recipientUserId)
- **VAPID keys**: Geradas e armazenadas no SaasConfig (encrypted)
- **Frontend hook**: usePushNotifications (permission, subscribed, requestAndSubscribe, unsubscribe)
- **Frontend notifications**: Toggle Ativar/Desativar/Bloqueado
- **ServiceWorkerRegistration**: Re-sync subscription no registro do SW
- **sw.js**: Push listener + notification click handler (ja existia)

### CONCLUIDO (sessao 139)
- **Import NFS-e Focus NFe**: Importacao automatica via GET /v2/nfsens_recebidas
- **Promo upfront**: Cobrar todos os meses de uma vez
- **Fix billing**: MRR real, ciclo billing, textos

### BLOQUEADO
- (nenhum)
