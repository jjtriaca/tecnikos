# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 105 — Emissao NFS-e via Asaas COMPLETO (build OK, pre-deploy)

## Ultima sessao: 105 (12/03/2026)
- Sessao 96: SEO + Landing Page + Pioneiro + SLS Obras (v1.02.16-17)
- Sessao 97: SMTP + Chat IA backend + frontend
- Sessao 98: Chat IA Deploy + Streaming + Asaas + Wizards (v1.02.18-24)
- Sessao 99-100: Modulo de Orcamentos COMPLETO
- Sessao 101: Senha Forte no Signup + Convites + Reset Password
- Sessao 102-103: Verificacao Manual de Documentos COMPLETO
- Sessao 104: Fixes Signup + Rastreamento + UTM + Asaas (v1.02.25-30)
- Sessao 105: Emissao NFS-e via Asaas COMPLETO

## O que foi feito na sessao 105:
- [x] Pesquisa API Asaas NFS-e (endpoints, webhook events, fiscal config)
- [x] Schema: SaasInvoice + SaasInvoiceConfig + migration
- [x] AsaasProvider: 11 novos metodos (invoices, fiscal info, municipal services)
- [x] AsaasService: issueInvoice, listInvoices, cancelInvoice, handleInvoiceWebhook, auto-emit
- [x] Webhook controller: dispatch INVOICE_* events
- [x] TenantController: 7 novos endpoints admin (issue, list, cancel, config, fiscal info)
- [x] Frontend: pagina /ctrl-zr8k2x/invoices (lista + config + modal emissao + modal detalhes)
- [x] Frontend: botao "Emitir NF" nos tenants ACTIVE
- [x] Frontend: sidebar com link "Notas Fiscais"
- [x] Backend tsc OK + Frontend next build OK
- [ ] Deploy pendente

## Proximos passos:
1. Deploy v1.02.31
2. SLS Obras: fazer cadastro novamente pelo rito certo
3. Testar end-to-end: signup → upload docs → admin review → approve/reject
4. Testar emissao NF via admin (com Asaas sandbox)
5. Configurar info fiscal no Asaas (inscricao municipal, CNAE, etc)
6. Audit log review (pendente desde sessao 101)

## Versao atual: v1.02.30 (pre-deploy 1.02.31)

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
