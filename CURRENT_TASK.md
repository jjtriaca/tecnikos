# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 107 — Fix GPS + Hints + Workflow Cleanup (CONCLUIDO)

## Ultima sessao: 107 (14/03/2026)
- Sessao 105: Correcoes Workflow UI + linkConfig (v1.03.10)
- Sessao 106: Link Publico Multi-Pagina + enRoute (v1.03.11 a v1.03.12)
- Sessao 107: Fix GPS startTracking + Hints + Workflow Cleanup (v1.03.13 a v1.03.16)

## O que foi feito nesta sessao:

### Fix GPS startTracking (v1.03.13-15) — JA FEITO
- [x] Backend: startTracking() defaults + link invalidacao
- [x] Deployado como v1.03.14 e v1.03.15

### Hints + Conflitos + WhatsApp Warning — JA FEITO
- [x] Hints descritivos reescritos em TECH/AUTO/TIME_LABELS (stage-config.ts)
- [x] Numeracao das etapas removida do StageSection
- [x] WhatsAppCostWarning em todos os pontos de notificacao
- [x] Conflito cross-stage: notifyCliente ATRIBUIDA vs onAccept do link

### Workflow Cleanup (v1.03.16) — JA FEITO
- [x] Removido Webhook/Alerta/AguardarEvento de todas as etapas
- [x] Notificacoes filtradas por etapa (notifyTecnico so ATRIBUIDA, sem A_CAMINHO/APROVADA)
- [x] Acoes do tecnico filtradas por etapa (GPS/Form/Signature/Question so EM_EXECUCAO, Checklist ATRIBUIDA+EM_EXECUCAO, PHOTO ATRIBUIDA+CONCLUIDA)
- [x] Lancamento financeiro ja restrito a CONCLUIDA+APROVADA
- [x] OFERTADA+ATRIBUIDA ocultas quando scheduleConfig ativo (workflow/page.tsx)
- [x] Build frontend OK

## Arquivos modificados:
- `frontend/src/types/stage-config.ts` — Hints reescritos
- `frontend/src/app/(dashboard)/workflow/components/StageSection.tsx` — Cleanup completo
- `frontend/src/app/(dashboard)/workflow/page.tsx` — Hide stages when scheduleConfig active

## Pendente:
- Deploy v1.03.16

## Versao atual: v1.03.16 (local, pronto para deploy)

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- NUNCA usar Preview Screenshot — trava o chat. Usar preview_snapshot/preview_inspect.
