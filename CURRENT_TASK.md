# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 120 — Session cleanup + Schema audit fixes

## Ultima sessao: 119 (16/03/2026)
- Sessao 118: IA tools WhatsApp + Focus NFe + knowledge base + deploy v1.03.71 + audit
- Sessao 119: Security audit fixes + Schema audit (enums, SaasInvoiceConfig, Marilise cleanup)
- Sessao 120: Session cleanup automatico

## O que foi feito na sessao 119-120:

### Auditoria de Seguranca (v1.03.72)
- [x] CRITICO: Role check — config tools requerem ADMIN
- [x] CRITICO: IV size fix — crypto.randomBytes(12) compatibilidade
- [x] CRITICO: Removido chat-ia.guard.ts (dead code)

### Auditoria de Schema público vs tenant_sls (v1.03.73)
- [x] Enum sync automatico: TenantMigratorService sincroniza enums no boot (ChecklistClass, ChecklistMode criados)
- [x] SaasInvoiceConfig removida de tenant schemas (adicionada a PUBLIC_ONLY_TABLES)
- [x] Marilise removida do public schema (só existe em tenant_sls)
- [x] Orphaned enum columns remapeados automaticamente (udt_schema public → tenant)

### Session cleanup automatico (v1.03.74)
- [x] Boot cleanup: deleta sessões revogadas, expiradas ou inativas > 3 dias (todos os schemas)
- [x] Limite por usuario: max 5 sessões ativas (revoga as mais antigas ao criar 6ª)
- [x] Aplica para gestores (AuthService) e técnicos (TechAuthService)

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

## Versao atual: v1.03.74

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
