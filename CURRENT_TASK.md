# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 111 — Cobranca Recorrente + Bloqueio por Inadimplencia

## Ultima sessao: 111 (13/03/2026)
- Sessao 97: SMTP + Chat IA backend + frontend
- Sessao 98: Chat IA Deploy + Streaming + Asaas + Wizards (v1.02.18-24)
- Sessao 99-100: Modulo de Orcamentos COMPLETO
- Sessao 101: Senha Forte no Signup + Convites + Reset Password
- Sessao 102-103: Verificacao Manual de Documentos COMPLETO
- Sessao 104: Fixes Signup + Rastreamento + UTM + Asaas (v1.02.25-30)
- Sessao 105: Emissao NFS-e + Analytics Tooltips (build OK)
- Sessao 106: Deploy v1.02.31-32 — NFS-e + Gatilho no Fluxo
- Sessao 107: Melhorias Gatilho — Collapsible + Renumeracao + Setas
- Sessao 108: Promo/Slug so trava apos pagamento + Email lowercase + Fix enums tenant schema
- Sessao 109: Upload Cartao CNPJ no step 3 do signup
- Sessao 110: Fix Galeria Selfie + Asaas API Key + Fix FK + Fix Signup Flow + Fix Camera
- Sessao 111: Cobranca Recorrente + Bloqueio por Inadimplencia

## O que foi feito na sessao 111:
- [x] Schema: overdueAt + originalValueCents na Subscription + migration
- [x] Pioneer promo fix: subscription criada no valor promo (R$15), nao usa discount do Asaas
- [x] Decremento automatico de promotionMonthsLeft a cada PAYMENT_CONFIRMED
- [x] Ao acabar promo: asaas.updateSubscription() atualiza para preco cheio
- [x] PAYMENT_OVERDUE: seta overdueAt (nao sobrescreve se ja setado)
- [x] PAYMENT_CONFIRMED: limpa overdueAt, reativa tenant se bloqueado
- [x] Cron @Cron('0 7 * * *'): bloqueia tenants PAST_DUE ha 7+ dias
- [x] GET /auth/billing-status: retorna status completo de cobranca
- [x] BillingBanner.tsx: banner global no AuthLayout com 4 estados (blocked, overdue, due_today, ok)
- [x] Build OK (backend tsc + frontend next build)

## O que foi feito na sessao 112 (continuacao):
- [x] Fix completo do fluxo de pagamento no signup
- [x] Backend: PIX QR code + boleto identification field via Asaas API
- [x] Backend: getFirstPaymentInfo() com retry, getPaymentStatus() para polling
- [x] Backend: Welcome email movido para PAYMENT_CONFIRMED, URL usa subdominio tenant
- [x] Backend: subscribe retorna paymentInfo, novo endpoint payment-status/:tenantId
- [x] Frontend Step 4: QR code PIX inline (base64 image), copia e cola, linha digitavel boleto
- [x] Frontend Step 4: polling a cada 5s para confirmacao de pagamento
- [x] Frontend Step 5: icone verde + "Pagamento confirmado!" (pago) ou azul + "Cadastro realizado!" (voucher)
- [x] Build OK (backend tsc + frontend next build)

## Proximos passos:
1. Deploy v1.02.51 (fix fluxo de pagamento)
2. Testar end-to-end: signup → pagamento PIX → verificar QR code + polling
3. Configurar info fiscal no Asaas (inscricao municipal, CNAE, etc)
4. Audit log review (pendente desde sessao 101)
5. Testar emissao NF via admin (com Asaas sandbox)

## Versao atual: v1.02.51

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
