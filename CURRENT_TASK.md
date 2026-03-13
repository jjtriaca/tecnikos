# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 116 — Limpeza SLS + Teste Compra do Zero

## Ultima sessao: 116 (13/03/2026)
- Sessao 109: Upload Cartao CNPJ no step 3 do signup
- Sessao 110: Fix Galeria Selfie + Asaas API Key + Fix FK + Fix Signup Flow + Fix Camera
- Sessao 111: Cobranca Recorrente + Bloqueio por Inadimplencia
- Sessao 112: Fix fluxo pagamento (PIX QR code, boleto, step 5 success messages)
- Sessao 113: Asaas Checkout + Add-on + Upgrade + Disable Notifications
- Sessao 114: Fix billingTypes API error + Remove PIX/Boleto/Cartao cards from Step 4
- Sessao 115: Restricoes por verificacao + Nginx wildcard + Welcome email + DNS/SSL
- Sessao 116: Limpeza SLS para teste fresh da compra completa

## O que foi feito na sessao 116:
- [x] Cancelar subscription no Asaas (sub_f330i47frr8tubpx) — DELETE 200
- [x] Deletar customer no Asaas (cus_000165863289) — DELETE 200
- [x] Limpar banco: VerificationSession, Subscription, Tenant, schema tenant_sls
- [x] Resetar promo PIONEIRO-PISCINAS (currentUses → 0)
- [x] Verificacao: tudo limpo, pronto para teste fresh

## Proximos passos:
1. Testar signup completo: tecnikos.com.br/signup com SLS Obras
2. Testar pagamento via Asaas Checkout
3. Testar login no host sls.tecnikos.com.br
4. Verificar restricoes (OS, orcamentos, financeiro bloqueados)
5. Admin aprovar docs → verificar full access
6. Testar add-on e upgrade via /settings/billing
7. Configurar info fiscal no Asaas

## Versao atual: v1.02.56

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
