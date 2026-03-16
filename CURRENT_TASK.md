# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 121 — Respeitar técnico direcionado (v1.03.78)

## Ultima sessao: 121 (16/03/2026)
- Sessao 120: Session cleanup automatico + Logradouro fix + Commission removal
- Sessao 121: Respeitar técnico direcionado (v1.03.76-78)

## O que foi feito na sessao 121:

### Respeitar técnico direcionado (v1.03.76-78)
- [x] Config `respectDirectedTechnician` no tipo `techSelection` (stage-config.ts)
- [x] Compilador V2 inclui config no bloco ASSIGN_TECH
- [x] Toggle na UI do workflow editor (StageSection.tsx, etapa ABERTA)
- [x] Backend: service-order.service.ts auto-atribui 1º técnico direcionado (DIRECTED → ATRIBUÍDA)
- [x] Backend: workflow-engine.service.ts pula criação de oferta quando OS já está ATRIBUÍDA
- [x] Simplificado: DIRECTED + técnicos escolhidos = SEMPRE auto-atribui (sem depender de config do workflow)
- [x] Deploy v1.03.78 OK

## Pendente:
- **BLOQUEADO: Resolver desativação da conta WhatsApp no Meta Business Support**
  - Conta DESATIVADA (não apenas restrita) — recurso enviado ao Meta
  - Após reativação: editar template aviso_os com botão CTA
- FUTURO: Avaliação/Feedback do serviço — fluxo ponta a ponta (gerar token, enviar link, UI gestor) — estudo salvo em memory/avaliacao-feedback-estudo.md
- FUTURO: Sistema de sugestões — Botão "Solicitar melhoria" no chat IA → sugestões para Juliano
- FUTURO: Configurações empresa — campos readonly (dados vêm do onboarding/licença), só "Buscar na Receita" atualiza. Responsável Legal só troca via solicitação (botão "Solicitar troca")
- FUTURO: Barra de uso de OS — entre nome da empresa e sininho, mostrar OS restantes no mês, muda cor a partir de 80% do limite
- FUTURO: Compra de add-ons — onde o cliente compra pacotes extras de OS
- FUTURO: Status da mensalidade — exibir situação do pagamento/assinatura no painel
- FUTURO: Verificação visual completa do workflow editor
- FUTURO: Contrato do cliente com a Tecnikos

## Versao atual: v1.03.78

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
