# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 107 — Fix GPS + Hints Workflow (EM ANDAMENTO)

## Ultima sessao: 107 (14/03/2026)
- Sessao 105: Correcoes Workflow UI + linkConfig (v1.03.10)
- Sessao 106: Link Publico Multi-Pagina + enRoute (v1.03.11 a v1.03.12)
- Sessao 107: Fix GPS startTracking + Hints Workflow (v1.03.13)

## O que foi feito nesta sessao:

### Fix GPS startTracking (v1.03.13)
- [x] Backend: startTracking() agora usa defaults quando nao tem PROXIMITY_TRIGGER (antes lancava BadRequestException)
- [x] Isso permite que gpsNavigation funcione pelo linkConfig mesmo sem bloco PROXIMITY_TRIGGER no workflow
- [x] Link publico invalidado quando OS excluida ou cancelada — todos os endpoints verificam deletedAt + status CANCELADA
- [x] Pontos protegidos: getOfferByToken, resolveAssignedTech, markEnRoute, submitPosition, getTrackingConfig, findOsByToken
- [x] Mensagem ao tecnico: "Esta ordem de serviço não está mais disponível."
- [x] Build backend OK

## Arquivos modificados:
- `backend/src/public-offer/public-offer.service.ts` — startTracking defaults + invalidacao de link em OS deletada/cancelada

## Pendente para deploy:
- Rodar migration no servidor (enRouteAt): `docker exec tecnikos_backend npx prisma migrate deploy`
- Deploy via script (v1.03.13)

## Versao atual: v1.03.12 (em producao) — proximo deploy sera v1.03.13

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- NUNCA usar Preview Screenshot — trava o chat. Usar preview_snapshot/preview_inspect.
