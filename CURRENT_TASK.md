# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 113 — Asaas Checkout + Add-on + Upgrade

## Ultima sessao: 113 (13/03/2026)
- Sessao 108: Promo/Slug so trava apos pagamento + Email lowercase + Fix enums tenant schema
- Sessao 109: Upload Cartao CNPJ no step 3 do signup
- Sessao 110: Fix Galeria Selfie + Asaas API Key + Fix FK + Fix Signup Flow + Fix Camera
- Sessao 111: Cobranca Recorrente + Bloqueio por Inadimplencia
- Sessao 112: Fix fluxo pagamento (PIX QR code, boleto, step 5 success messages)
- Sessao 113: Asaas Checkout + Add-on + Upgrade + Disable Notifications

## O que foi feito na sessao 113:
- [x] Backend: AsaasProvider — `customer` field in createCheckout, User-Agent header
- [x] Backend: AsaasProvider — notificationDisabled: true on createCustomer
- [x] Backend: AsaasProvider — createCheckout() + listPayments() methods
- [x] Backend: AsaasService — createSignupCheckout() (Asaas Checkout for signup)
- [x] Backend: AsaasService — createAddOnCheckout() (Asaas Checkout for add-on purchase)
- [x] Backend: AsaasService — createUpgradeCheckout() (Asaas Checkout for plan upgrade)
- [x] Backend: AsaasService — getBillingStatus() now includes overduePaymentUrl
- [x] Backend: AsaasService — handleSubscriptionWebhook() handles SUBSCRIPTION_CREATED to link asaasSubscriptionId
- [x] Backend: AsaasService — confirmAddOnByCustomer() fallback for checkout add-on payments
- [x] Backend: Controller — POST /subscribe simplified (no billingType/creditCard, returns checkoutUrl)
- [x] Backend: Controller — POST /purchase-addon updated for checkout flow
- [x] Backend: Controller — POST /auth/upgrade-plan new endpoint
- [x] Frontend: Signup Step 4 — replaced PIX/boleto/card forms with Asaas Checkout popup
- [x] Frontend: Signup Step 4 — "Reabrir pagina de pagamento" button when pending
- [x] Frontend: BillingBanner — overduePaymentUrl: "Pagar agora"/"Regularizar" opens Asaas invoice
- [x] Frontend: Settings Billing — "Seu Plano" section with current plan info
- [x] Frontend: Settings Billing — Upgrade section with available plans
- [x] Frontend: Settings Billing — Add-on purchase via Asaas Checkout
- [x] Build OK (backend tsc + frontend next build)

## Proximos passos:
1. Deploy
2. Testar end-to-end: signup → checkout Asaas → webhook → ativacao
3. Testar add-on via /settings/billing → checkout → OS creditadas
4. Testar upgrade via /settings/billing → checkout → nova subscription
5. Verificar que Asaas NAO envia email/SMS ao cliente
6. Configurar info fiscal no Asaas (inscricao municipal, CNAE, etc)

## Versao atual: v1.02.52 (pre-deploy)

## IDs importantes WhatsApp Meta:
- WABA ID: 1421505052856896
- Phone Number ID: 996592133539837
- App ID: 950743607617295

## Se reconectar no MEIO de uma tarefa:
- Verifique o TODO list no Claude (se existir)
- Leia o CHAT_LOG.md para contexto
- Continue exatamente do ponto onde parou
- NAO pergunte ao Juliano — ele autorizou execucao irrestrita

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- Pode sempre continuar depois do deploy sem perguntar
