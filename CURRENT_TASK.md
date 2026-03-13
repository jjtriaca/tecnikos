# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 120 — Workflow Triggers + Conflito (EM ANDAMENTO)

## Ultima sessao: 120 (13/03/2026)
- Sessao 117: Isolamento de dados multi-tenant via AsyncLocalStorage + Proxy (v1.02.58)
- Sessao 118: Admin Host isolado + Migracao de dados completa (v1.02.59)
- Sessao 119: Remocao login do dominio raiz + domain-aware routing (v1.02.63)
- Sessao 120a: Fixes CAPTCHA + Analytics dedup + Trigger-based stages (v1.02.64-67)
- Sessao 120b: Novo trigger "Nova Especializacao" + Resolucao de conflito (EM ANDAMENTO)

## O que foi feito nesta sessao:

### Fixes (v1.02.64-67)
- [x] CAPTCHA: removido cache 7 dias do frontend (widget sempre visivel)
- [x] Analytics: deduplicacao por sessionId + metricas reais (SignupAttempt, Tenant ACTIVE)
- [x] Workflow: trigger partner_tech_created mostra TechnicianOnboardingSection
- [x] Workflow: header "Etapas do Fluxo" consistente para todos triggers

### Novo Trigger + Conflito (EM ANDAMENTO)
- [x] Adicionado trigger `partner_spec_added` em TRIGGER_OPTIONS
- [x] Adicionado tipo `conflictResolution` em TechnicianOnboardingConfig
- [x] Atualizado createDefaultOnboarding() com conflictResolution default
- [x] TechnicianOnboardingSection: nova prop `triggerId` para filtrar sub-sections
- [x] Banner de conflito (amarelo) no trigger partner_tech_created com radio buttons
- [x] Banner info (azul) no trigger partner_spec_added
- [x] Titulos/subtitulos dinamicos por trigger no componente
- [x] workflow/page.tsx: isOnboardingTrigger para ambos triggers
- [x] workflow/page.tsx: presets escondidos para ambos onboarding triggers
- [x] workflow/page.tsx: validacao, resumo, subtitle atualizados
- [x] workflow/page.tsx: passa triggerId para TechnicianOnboardingSection
- [ ] Testar no preview (build + visual)
- [ ] Deploy

## Arquivos modificados nesta sub-sessao:
- `frontend/src/types/stage-config.ts` — +1 trigger, +conflictResolution type/default
- `frontend/src/app/(dashboard)/workflow/components/TechnicianOnboardingSection.tsx` — triggerId prop, filtro, banners
- `frontend/src/app/(dashboard)/workflow/page.tsx` — isOnboardingTrigger, triggerId, subtitles

## Versao atual: v1.02.67 (em producao, sem o novo trigger)

## Se reconectar no MEIO desta tarefa:
- Todas as edicoes frontend ja foram feitas
- Falta: testar build, preview visual, deploy
- NAO fazer novas edicoes — testar o que ja foi feito

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- NUNCA usar Preview Screenshot — trava o chat. Usar preview_snapshot/preview_inspect.
