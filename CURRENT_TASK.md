# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 104 — Rastreamento Tentativas de Cadastro COMPLETO (deployed)

## Ultima sessao: 104 (12/03/2026)
- Sessao 96: SEO + Landing Page + Pioneiro + SLS Obras (v1.02.16-17)
- Sessao 97: SMTP + Chat IA backend + frontend
- Sessao 98: Chat IA Deploy + Streaming + Asaas + Wizards (v1.02.18-24)
- Sessao 99-100: Modulo de Orcamentos COMPLETO
- Sessao 101: Senha Forte no Signup + Convites + Reset Password
- Sessao 102-103: Verificacao Manual de Documentos COMPLETO
- Sessao 104: Fixes + Rastreamento Tentativas de Cadastro (v1.02.25-29)

## O que foi feito na sessao 104:

### Verify page — Rejeicao + Resubmit (v1.02.27)
- [x] verification.service.ts: rejectionReason + resubmitFromRejected
- [x] verification.controller.ts: POST /verification/:token/resubmit
- [x] /verify/[token]/page.tsx: tela REJECTED + resubmit + APPROVED

### SLS Obras Cadastro Fix (v1.02.28)
- [x] Removido tenant SLS Obras SUSPENDED do banco
- [x] Fix CNPJ lookup 403: User-Agent + Accept headers no fetch BrasilAPI
- [x] Mascara CNPJ e telefone no signup

### Rastreamento Completo de Tentativas de Cadastro (v1.02.29)
- [x] Schema: lastStep, lastError, completedAt no SignupAttempt + migration
- [x] Backend: upsert no signup-attempt + email ao admin no criticism
- [x] Frontend: saveAttempt a cada step + botao Relatar Problema
- [x] Admin: barra progresso visual + lastStep/lastError no modal
- [x] Backend tsc --noEmit OK
- [x] Frontend next build OK
- [x] Deploy v1.02.29 OK

### Arquivos modificados:
**Backend:**
- backend/prisma/schema.prisma (lastStep, lastError, completedAt)
- backend/prisma/migrations/20260312140000_signup_attempt_step_tracking/migration.sql
- backend/src/tenant/tenant-public.controller.ts (upsert + email + CNPJ fix)
- backend/src/verification/verification.service.ts (rejection + resubmit)
- backend/src/verification/verification.controller.ts (resubmit endpoint)

**Frontend:**
- frontend/src/app/signup/page.tsx (tracking + mascaras + relatar problema)
- frontend/src/app/verify/[token]/page.tsx (rejected + resubmit)
- frontend/src/app/(dashboard)/ctrl-zr8k2x/signup-attempts/page.tsx (progresso visual)

## Proximos passos:
1. Testar end-to-end: signup → tracking aparece no admin → relatar problema → email
2. Testar resubmit: reject docs → reenviar → nova sessao
3. Audit log review (pendente desde sessao 101)
4. Testes de carga / otimizacao (se necessario)

## Versao atual: v1.02.29

## IDs importantes WhatsApp Meta:
- WABA ID: 1421505052856896
- Phone Number ID: 996592133539837
- App ID: 950743907617295

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
