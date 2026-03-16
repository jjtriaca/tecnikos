# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 119 — Security audit fixes

## Ultima sessao: 118 (16/03/2026)
- Sessao 117: WhatsApp notification fix + API research (v1.03.68-70)
- Sessao 118: IA tools WhatsApp + Focus NFe + knowledge base + deploy v1.03.71 + audit
- Sessao 119: Security audit fixes

## O que foi feito na sessao 118-119:

### IA Tools para WhatsApp + Focus NFe (v1.03.71)
- [x] 4 novas tools: configurar_whatsapp, testar_conexao_whatsapp, configurar_focus_nfe, testar_focus_nfe
- [x] Wizard do chat IA atualizado com guia completo de 6 passos WhatsApp
- [x] System prompt da IA com conhecimento WhatsApp Business API
- [x] Knowledge base: memory/whatsapp-lessons-learned.md
- [x] Deploy v1.03.71

### Auditoria de Seguranca (v1.03.72)
- [x] CRITICO: Role check — config tools (configurar_whatsapp, testar_conexao_whatsapp, configurar_focus_nfe, testar_focus_nfe) agora requerem ADMIN
  - userRoles propagados: controller → service → streamClaude/callClaude → executeTool
  - ADMIN_ONLY_TOOLS set no chat-ia.tools.ts bloqueia não-admins
- [x] CRITICO: IV size fix — crypto.randomBytes(16) → randomBytes(12) para compatibilidade com EncryptionService
  - Refatorado: funções encryptToken() e decryptToken() centralizadas (DRY)
  - 4 duplicações de código crypto eliminadas
- [x] CRITICO: Removido chat-ia.guard.ts (dead code, sempre retornava true)

## Pendente:
- **BLOQUEADO: Resolver desativação da conta WhatsApp no Meta Business Support**
  - Conta DESATIVADA (não apenas restrita) — recurso enviado ao Meta
  - Após reativação: editar template aviso_os com botão CTA
- FUTURO: Verificação visual completa do workflow editor
- FUTURO: Mecanismo para clientes solicitarem melhorias
- FUTURO: Contrato do cliente com a Tecnikos
- FUTURO: Fix logradouro em dados importados do Sankhya
- FUTURO: Discutir/remover commissionBps global da empresa
- FUTURO: Workflow config "Respeitar tecnico direcionado"

## Versao atual: v1.03.72 (deploying)

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
