# TAREFA ATUAL

## Versao: v1.05.11
## Ultima sessao: 140 (18/03/2026)

## Pendencias

### A FAZER
- **Token revenda no admin**: Mover FOCUS_NFE_RESELLER_TOKEN de .env para painel admin SaaS (usado em 3 arquivos: nfse-emission.service.ts x2, chat-ia.tools.ts x1)
- **Fase 3 — Offline-first**: IndexedDB para OS locais + fila de sync (futuro)
- **Push Notifications**: Integrar Web Push API com backend (ServiceWorkerRegistration.tsx ja existe)
- **TenantMigratorService**: Corrigir copia de FKs ao criar tabelas novas em tenant schemas

### JA IMPLEMENTADO (removido da lista)
- ~~Promo upfront checkout~~: JA FEITO — `createSubscriptionCheckout()` calcula `monthlyDiscountedCents * promoDuration` e cobra tudo na primeira fatura. Webhook zera `promotionMonthsLeft=0` e ajusta `currentPeriodEnd` + Asaas para preco cheio apos periodo.

### CONCLUIDO (sessao 140)

#### Auditoria Completa Billing (15/15 PASS)
- **Fix #1 — OS enforcement por ciclo billing**: `create()` usa `getBillingPeriod()` com subscription dates (nao mais calendario dia 1)
- **Fix #2 — AI msgs por ciclo billing**: `needsBillingReset()` verifica `currentPeriodStart` da subscription
- **Fix #4 — Promo badge upfront**: Detecta promo por `promotionId + originalValueCents` mesmo com `monthsLeft=0`
- **Fix #5 — Add-on revert baseline**: `revertAddOnFromTenantCompany()` protege limites do plano (nao apenas > 0)
- **Fix #6 — MRR otimizado**: Batch fetch de promotions (elimina N+1) + detecta promo upfront
- **Testes CI corrigidos**: 70/70 passando — mocks atualizados, regex error msg, teste promo upfront

#### NFS-e Import Add-on System
- **Add-on nfseImportQuantity**: Campo no modelo AddOn + AddOnPurchase + Company.maxNfseImports
- **creditAddOnToTenantCompany**: Incrementa maxNfseImports quando add-on confirmado
- **revertAddOnFromTenantCompany**: Decrementa maxNfseImports na expiracao com protecao baseline
- **Frontend admin**: Campo "Import. NFS-e extras" no formulario de pacotes add-on
- **Frontend tenant**: Botao "Importar NFS-e" desabilitado quando saldo=0, link para compra add-on
- **HeaderBilling**: Barra Import NFS-e no topo (vermelho quando 0, cores progressivas)
- **Billing page**: Filter=nfse mostra somente add-ons de importacao
- **Texto explicativo**: Informa sobre importacao manual gratuita vs automatica paga
- **Planos**: maxNfseImports removido da UI de planos (add-on puro)
- **Admin escondido**: HeaderBilling nao aparece em rotas /ctrl-*

#### Outros Fixes
- **Bug TenantMigratorService**: Erro `Tenant limits sync failed` corrigido
- **sortOrder add-on**: Backend create/update aceita nfseImportQuantity + sortOrder
- **Helper sortOrder**: Mostra "Ultima posicao: X" no formulario admin

### CONCLUIDO (sessao 139)
- **Import NFS-e Focus NFe**: Importacao automatica de NFS-e recebidas via GET /v2/nfsens_recebidas
- **FocusNfeProvider**: listNfsesRecebidas, getNfseRecebidaJson, getNfseRecebidaPdf
- **syncFromFocus**: Paginacao incremental por versao, deduplicacao chaveNfse, auto-link prestador
- **Frontend botao**: "Importar Focus NFe" + badge emerald "Focus NFe" na coluna Origem
- **Schema**: chaveNfse, focusSource, situacaoFocus, versaoFocus + autoSyncNfseRecebida no NfseConfig
- **Promo upfront**: Promocoes com duracao (PIONEIRO) agora cobram todos os meses de uma vez (6×R$15=R$90)
- **Webhook upfront**: Primeiro pagamento marca promo como paga, atualiza Asaas para preco cheio, nextDueDate apos periodo promo
- **Protecao SLS**: SLS mantem fluxo mensal existente (promotionMonthsLeft ja decrementado a 0 no DB)
- **Fix billing "Pagamento atrasado"**: Endpoint admin PATCH /tenants/:id/fix-subscription para corrigir status
- **Fix MRR real**: getMetrics() calcula MRR com valor efetivo (promocoes + ciclo anual)
- **Fix ciclo billing**: monthlyUsage() usa currentPeriodStart/End da Subscription (nao mes calendario)
- **Fix textos billing**: "Uso neste ciclo" + "transacoes" em vez de "Uso de OS" + "OS"

### CONCLUIDO (sessao 138)
- **Cancelamento 2 etapas**: Status CANCELLING + retry (GET query + DELETE) para municipios com duplo cancelamento
- **Frontend CANCELLING**: Badge laranja "Cancelando" + botao refresh para confirmar cancelamento
- **FOCUS_NFE_RESELLER_TOKEN**: Configurado no .env.production (plano Start ativo, token producao)
- **API de Empresas testada**: GET /v2/empresas retorna SLS Obras (ID: 192027) com sucesso
- **Tokens atualizados**: Prod e homolog novos salvos no NfseConfig + focusNfeCompanyId=192027
- **Enforcement NFS-e 1:1 com OS**: NFS-e avulsa conta como transacao no limite maxOsPerMonth
- **Enforcement em todos os pontos**: create OS, duplicate OS, emit NFS-e, createOsFromQuote
- **monthlyUsage breakdown**: Retorna osCount + avulsaNfseCount separados
- **Billing page breakdown**: Mostra "9 OS + 4 NFS-e avulsas" abaixo da barra de progresso
- **Bug cancelamento Focus NFe**: Ticket #216000 aberto — Focus nao sincroniza cancelamento da prefeitura (Primavera do Leste/MT)
- **Plano Focus Start contratado**: R$113,90/mes, 3 CNPJs, 100 notas/CNPJ, primeiro boleto maio/2026

### BLOQUEADO
- (nenhum)
