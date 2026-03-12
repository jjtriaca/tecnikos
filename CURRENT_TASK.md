# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 108 — Deploy v1.02.39 OK

## Ultima sessao: 108 (12/03/2026)
- Sessao 97: SMTP + Chat IA backend + frontend
- Sessao 98: Chat IA Deploy + Streaming + Asaas + Wizards (v1.02.18-24)
- Sessao 99-100: Modulo de Orcamentos COMPLETO
- Sessao 101: Senha Forte no Signup + Convites + Reset Password
- Sessao 102-103: Verificacao Manual de Documentos COMPLETO
- Sessao 104: Fixes Signup + Rastreamento + UTM + Asaas (v1.02.25-30)
- Sessao 105: Emissao NFS-e + Analytics Tooltips (build OK)
- Sessao 106: Deploy v1.02.31-32 — NFS-e + Gatilho no Fluxo
- Sessao 107: Melhorias Gatilho — Collapsible + Renumeracao + Setas
- Sessao 108: Promo/Slug so trava apos pagamento + Email lowercase

## O que foi feito na sessao 108:
- [x] Email signup forcado lowercase (com CSS lowercase + .toLowerCase())
- [x] Prisma fix: ?schema=tenant_xxx sem ,public (v1.02.38)
- [x] REGRA: Promo/Slug/CNPJ/Email so travam apos PAGAMENTO confirmado
- [x] Novo campo Tenant.promoCode (migration)
- [x] pioneer-slots: conta tenants ATIVOS em vez de currentUses
- [x] validate-code: conta tenants ATIVOS em vez de currentUses
- [x] Signup NAO incrementa currentUses (movido para activate())
- [x] provisionTenant: duplicate check respeita LOCKED_STATUSES
- [x] Reset currentUses PIONEIRO-PISCINAS (era 1, agora 0)
- [x] createSchema: excluir tabelas SaaS (SignupAttempt, SaasEvent, etc)
- [x] Deploy v1.02.39
- [x] Fix: copiar enum types (UserRole, etc) para tenant schema durante createSchema
- [x] Fix: ALTER COLUMN para remap enums de public.X para tenant.X
- [x] Limpeza tenant_sls abandonado (PENDING_VERIFICATION)
- [x] Deploy v1.02.40

## Decisao: SLS Obras operando pelo schema public
- SLS Obras continua no schema public (tecnikos.com.br, admin@tecnikos.com.br)
- NAO migrar para tenant/host ate concluir todos os testes e certificacao
- Registro antigo de Tenant SLS foi limpo (schema tenant_sls dropado + registro deletado)
- Quando pronto: refazer signup pelo host para teste completo do fluxo tenant

## Proximos passos:
1. SLS Obras: testar signup pelo host quando pronto para certificar
2. Testar end-to-end: signup → upload docs → admin review → approve/reject
3. Testar emissao NF via admin (com Asaas sandbox)
4. Configurar info fiscal no Asaas (inscricao municipal, CNAE, etc)
5. Audit log review (pendente desde sessao 101)

## Versao atual: v1.02.40

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
