# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 120 — Workflow Triggers + Client Onboarding (CONCLUIDO)

## Ultima sessao: 120 (14/03/2026)
- Sessao 117: Isolamento de dados multi-tenant via AsyncLocalStorage + Proxy (v1.02.58)
- Sessao 118: Admin Host isolado + Migracao de dados completa (v1.02.59)
- Sessao 119: Remocao login do dominio raiz + domain-aware routing (v1.02.63)
- Sessao 120: Triggers, Conflito, Especializacao, Templates, Client Onboarding (v1.02.64-71)

## O que foi feito nesta sessao:

### Fixes (v1.02.64-67)
- [x] CAPTCHA: removido cache 7 dias do frontend (widget sempre visivel)
- [x] Analytics: deduplicacao por sessionId + metricas reais (SignupAttempt, Tenant ACTIVE)
- [x] Workflow: trigger partner_tech_created mostra TechnicianOnboardingSection
- [x] Workflow: header "Etapas do Fluxo" consistente para todos triggers

### Novo Trigger "Nova Especializacao" + Conflito (v1.02.68)
- [x] Trigger `partner_spec_added` em TRIGGER_OPTIONS
- [x] conflictResolution em TechnicianOnboardingConfig (send_both | tech_only | spec_only)
- [x] TechnicianOnboardingSection: triggerId prop, filtro, banners conflito/info
- [x] workflow/page.tsx: isOnboardingTrigger, presets, subtitles, validacao

### Variavel {especializacao} (v1.02.69)
- [x] Adicionada em WELCOME_VARIABLES e todas as variable buttons

### Templates Default (v1.02.70)
- [x] Todos os campos de texto pre-preenchidos com templates profissionais
- [x] Variable buttons na mensagem de notificacao (faltava)

### Client Onboarding (v1.02.71)
- [x] ClientOnboardingConfig type + createDefaultClientOnboarding()
- [x] Contrato padrao "Termos de Prestacao de Servicos Tecnicos" (8 clausulas)
- [x] ClientOnboardingSection.tsx: UI completa (termos + mensagem + reply)
- [x] workflow/page.tsx: partner_client_created no isOnboardingTrigger
- [x] compileToV2/decompileFromV2 persistem clientOnboarding
- [x] Deploy v1.02.71

## Arquivos modificados:
- `frontend/src/types/stage-config.ts` — ClientOnboardingConfig, createDefaultClientOnboarding, compile/decompile
- `frontend/src/app/(dashboard)/workflow/components/ClientOnboardingSection.tsx` — NOVO componente
- `frontend/src/app/(dashboard)/workflow/page.tsx` — import, isOnboardingTrigger, render, resumo

## Versao atual: v1.02.71 (em producao)

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- NUNCA usar Preview Screenshot — trava o chat. Usar preview_snapshot/preview_inspect.
