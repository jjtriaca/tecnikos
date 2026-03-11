# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 97 — SMTP + Chat IA (v1.02.19 + Chat IA pronto para deploy)

## Ultima sessao: 97 (11/03/2026)
- Sessao 96: SEO + Landing Page + Pioneiro + SLS Obras (v1.02.16-17)
- Sessao 97: SMTP Producao + PPID (pendente) + Chat IA implementacao completa

## O que foi feito na sessao 97:

### SMTP Producao — CONCLUIDO
- [x] docker-compose.production.yml atualizado com todas env vars
- [x] SMTP: contato@tecnikos.com.br via smtp.zoho.com:587
- [x] Test email enviado e recebido

### PPID Producao — PENDENTE (API fora do ar)
- [x] Credenciais configuradas
- [ ] API retorna 404 — aguardando resposta suporte PPID

### Dashboard fix (v1.02.18) + Pioneer badge (v1.02.19) — CONCLUIDO

### Chat IA — Assistente Inteligente + Onboarding — PRONTO PARA DEPLOY
- [x] Backend completo (modulo, service, controller, guard, tools, onboarding, dto)
- [x] Prisma models + migration criada e aplicada localmente
- [x] @anthropic-ai/sdk instalado
- [x] Frontend completo (Context, Button, Message, Input, Panel)
- [x] Integrado no AuthLayout
- [x] Backend compila (tsc --noEmit OK)
- [x] Frontend compila (next build OK)
- [ ] ANTHROPIC_API_KEY: precisa ser adicionada no .env.production do servidor
- [ ] Deploy para producao

### Arquivos criados/modificados:
**Backend (novo):**
- backend/src/chat-ia/chat-ia.module.ts
- backend/src/chat-ia/chat-ia.service.ts
- backend/src/chat-ia/chat-ia.controller.ts
- backend/src/chat-ia/chat-ia.guard.ts
- backend/src/chat-ia/chat-ia.tools.ts
- backend/src/chat-ia/chat-ia.onboarding.ts
- backend/src/chat-ia/dto/send-message.dto.ts
- backend/prisma/migrations/20260311180000_chat_ia_models/migration.sql

**Backend (modificado):**
- backend/prisma/schema.prisma (+ ChatIAConversation, ChatIAMessage, campos Company)
- backend/src/app.module.ts (+ ChatIAModule)
- docker-compose.production.yml (+ ANTHROPIC_API_KEY, CHAT_IA_MODEL, CHAT_IA_MAX_TOKENS)

**Frontend (novo):**
- frontend/src/contexts/ChatIAContext.tsx
- frontend/src/components/chat-ia/ChatIAButton.tsx
- frontend/src/components/chat-ia/ChatIAMessage.tsx
- frontend/src/components/chat-ia/ChatIAInput.tsx
- frontend/src/components/chat-ia/ChatIAPanel.tsx

**Frontend (modificado):**
- frontend/src/components/layout/AuthLayout.tsx (+ ChatIAProvider, ChatIAPanel)

## Proximos passos:
1. ~~SMTP producao~~ CONCLUIDO
2. PPID producao — AGUARDANDO suporte
3. ~~Chat IA backend~~ CONCLUIDO
4. ~~Chat IA frontend~~ CONCLUIDO
5. Adicionar ANTHROPIC_API_KEY no servidor
6. Deploy Chat IA
7. Testar end-to-end

## Versao atual: v1.02.19

## IDs importantes WhatsApp Meta:
- WABA ID: 1421505052856896 (SLS Sol e Lazer Solucoes) — REATIVADA
- Business ID: 2115296342089072
- Phone Number ID: 996592133539837
- App ID: 950743907617295
- System User ID: 122102184027217286

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
