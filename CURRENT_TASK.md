# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 114 — Fix billingTypes + Cleanup UI

## Ultima sessao: 114 (13/03/2026)
- Sessao 108: Promo/Slug so trava apos pagamento + Email lowercase + Fix enums tenant schema
- Sessao 109: Upload Cartao CNPJ no step 3 do signup
- Sessao 110: Fix Galeria Selfie + Asaas API Key + Fix FK + Fix Signup Flow + Fix Camera
- Sessao 111: Cobranca Recorrente + Bloqueio por Inadimplencia
- Sessao 112: Fix fluxo pagamento (PIX QR code, boleto, step 5 success messages)
- Sessao 113: Asaas Checkout + Add-on + Upgrade + Disable Notifications
- Sessao 114: Fix billingTypes API error + Remove PIX/Boleto/Cartao cards from Step 4

## O que foi feito na sessao 114:
- [x] Fix createSignupCheckout() — Subscription API (billingType UNDEFINED) + invoiceUrl em vez de Checkout API
- [x] Fix createUpgradeCheckout() — mesma mudanca (era Checkout API com RECURRENT, dava erro billingTypes)
- [x] Removidos cards PIX/Boleto/Cartao do Step 4 (tanto no formulario quanto no estado pendente)
- [x] Build OK (backend tsc + frontend next build)
- [x] Deploy v1.02.54

## Proximos passos:
1. Testar end-to-end: signup → invoiceUrl Asaas → pagar → webhook → ativacao
2. Testar add-on via /settings/billing → checkout → OS creditadas
3. Testar upgrade via /settings/billing → checkout → nova subscription
4. Verificar que Asaas NAO envia email/SMS ao cliente
5. Configurar info fiscal no Asaas (inscricao municipal, CNAE, etc)

## Versao atual: v1.02.54

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
