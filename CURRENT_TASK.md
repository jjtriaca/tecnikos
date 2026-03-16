# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 121 — Respeitar técnico direcionado + Commission cleanup

## Ultima sessao: 120 (16/03/2026)
- Sessao 119: Security audit fixes + Schema audit (enums, SaasInvoiceConfig, Marilise cleanup)
- Sessao 120: Session cleanup automatico + Logradouro fix + Commission removal
- Sessao 121: Respeitar técnico direcionado (v1.03.76)

## O que foi feito na sessao 121:

### Respeitar técnico direcionado (v1.03.76)
- [x] Config `respectDirectedTechnician` no tipo `techSelection` (stage-config.ts)
- [x] Compilador V2 inclui config no bloco ASSIGN_TECH
- [x] Toggle na UI do workflow editor (StageSection.tsx, etapa ABERTA)
- [x] Backend: service-order.service.ts lê workflow template e auto-atribui 1º técnico direcionado
- [x] Backend: workflow-engine.service.ts pula criação de oferta quando OS já está ATRIBUÍDA
- [x] Default: true (ativado por padrão)
- [x] Build OK (backend + frontend limpos)

## Pendente:
- **BLOQUEADO: Resolver desativação da conta WhatsApp no Meta Business Support**
  - Conta DESATIVADA (não apenas restrita) — recurso enviado ao Meta
  - Após reativação: editar template aviso_os com botão CTA
- FUTURO: Verificação visual completa do workflow editor
- FUTURO: Mecanismo para clientes solicitarem melhorias
- FUTURO: Contrato do cliente com a Tecnikos

## Versao atual: v1.03.76

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- NUNCA usar Preview Screenshot — trava o chat. Usar preview_snapshot/preview_inspect.
- TODOS os campos de texto (textarea/input de mensagem) DEVEM ter texto exemplo preenchido
- APIs externas com risco de ban (WhatsApp, Meta, Google): SEMPRE consultar memory/ antes de alterar
- IA embarcada tools: somente configs de ADMIN, nunca janela de entrada no sistema
- Sincronismo: atualizar memory, tools, wizard, prompt ao melhorar APIs
