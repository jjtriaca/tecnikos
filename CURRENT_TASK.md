# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 107 — Deploy v1.02.35 OK

## Ultima sessao: 107 (12/03/2026)
- Sessao 97: SMTP + Chat IA backend + frontend
- Sessao 98: Chat IA Deploy + Streaming + Asaas + Wizards (v1.02.18-24)
- Sessao 99-100: Modulo de Orcamentos COMPLETO
- Sessao 101: Senha Forte no Signup + Convites + Reset Password
- Sessao 102-103: Verificacao Manual de Documentos COMPLETO
- Sessao 104: Fixes Signup + Rastreamento + UTM + Asaas (v1.02.25-30)
- Sessao 105: Emissao NFS-e + Analytics Tooltips (build OK)
- Sessao 106: Deploy v1.02.31-32 — NFS-e + Gatilho no Fluxo
- Sessao 107: Melhorias Gatilho — Collapsible + Renumeracao + Setas

## O que foi feito na sessao 107:
- [x] Trigger collapsible com auto-collapse via IntersectionObserver
- [x] Cards de trigger 75% menores (grid-cols-4, text-[11px])
- [x] Removido TechnicianOnboardingSection (substituido pelo trigger)
- [x] Deploy v1.02.33 — Trigger collapsible + cards compactos
- [x] Trigger numerado como Etapa 1 ("1. ⚡ Quando:")
- [x] Etapas OS renumeradas a partir de 2 (StageSection: index + 2)
- [x] Seta de conexao entre trigger e primeira etapa OS
- [x] Labels corretos para badges scheduleConfig e gestorApproval
- [x] Deploy v1.02.35
- [x] Tela de revisao de tecnicos (techReviewScreen) — tipo + UI + compile/decompile + label
- [x] Deploy v1.02.36
- [x] Slug so trava apos pagamento (ACTIVE/BLOCKED/SUSPENDED)
- [x] Signup limpa tenants PENDING abandonados (mesmo slug/CNPJ/email)
- [x] Deploy v1.02.37

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

## Versao atual: v1.02.37

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
