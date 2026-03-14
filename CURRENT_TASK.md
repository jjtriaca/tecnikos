# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 123 — Hints Inteligentes + Deteccao de Conflitos (CONCLUIDO)

## Ultima sessao: 123 (14/03/2026)
- Sessao 121+: isUrgent, Reorganizacao Form, Fix Trigger, Auditoria (v1.02.83-85)
- Sessao 122+: Correcoes Arquiteturais Workflow (v1.02.86-89)
- Sessao 123: Hints Inteligentes + Deteccao de Conflitos (v1.02.90)

## O que foi feito nesta sessao:

### Hints Descritivos + Deteccao de Conflitos (v1.02.90)
- [x] Reescrita de todos os hints em TECH_ACTION_LABELS, AUTO_ACTION_LABELS, TIME_CONTROL_LABELS
- [x] Hints agora explicam QUANDO dispara, O QUE acontece, QUEM e afetado
- [x] Componente ConflictWarning reutilizavel (amber warning box)
- [x] Conflito: Agenda + notifyTecnico na ATRIBUIDA (mensagem duplicada)
- [x] Conflito: Agenda + messageDispatch na ABERTA (mensagens nao serao disparadas)
- [x] Conflito: Agenda + techSelection (selecao automatica nao sera usada)
- [x] Conflito: Agenda + techReviewScreen (tela de revisao nao sera exibida)
- [x] Conflito: photoRequirements on_pause/on_resume sem pauseSystem ativo
- [x] Hints inline melhorados: aprovacao gestor, sistema de pausas, proximidade, financeiro
- [x] Build backend + frontend OK
- [x] Deploy v1.02.90

## Arquivos modificados:
- `frontend/src/types/stage-config.ts` — hints descritivos reescritos
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — ConflictWarning + deteccao cross-stage + hints inline

## Versao atual: v1.02.90 (em producao)

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- NUNCA usar Preview Screenshot — trava o chat. Usar preview_snapshot/preview_inspect.
