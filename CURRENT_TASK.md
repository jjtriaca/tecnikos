# TAREFA ATUAL

## Versao: v1.04.35
## Ultima sessao: 131 (17/03/2026)

## Pendencias

### A FAZER
1. **Avaliacao/Feedback do servico** — Fluxo ponta a ponta (gerar token, enviar link ao cliente, UI gestor avaliar)
2. **Sistema de sugestoes** — Botao "Solicitar melhoria" no chat IA -> sugestoes para Juliano
3. **Configuracoes empresa readonly** — Campos vem do onboarding/licenca, so "Buscar na Receita" atualiza
4. **Verificacao visual do workflow editor** — Revisao completa da UI
5. **Contrato do cliente com a Tecnikos** — Estudo em memory/contrato-saas-estrutura.md
6. **Criar conta Sentry** — Criar projeto em sentry.io, obter DSN, adicionar SENTRY_DSN nas envs do servidor

### CONCLUIDO (sessao 131)
- Reestruturacao documentacao (ARCHITECTURE.md + CLAUDE.md enxuto + limpeza .md redundantes)
- Testes automatizados (70 testes: OS lifecycle + Asaas billing)
- Sentry integrado (backend @sentry/nestjs + frontend @sentry/nextjs)
- CI/CD atualizado (GitHub Actions com step de testes)
- Importacao CSV de parceiros (modelo + botao download + mapeamento)

### BLOQUEADO
- **WhatsApp Business** — Conta desativada pelo Meta, recurso enviado

## Planos em producao
- Essencial R$197/mes (2 users, 72 OS, 6 techs, 50 AI msgs)
- Profissional R$397/mes (4 users, 198 OS, 10 techs, 200 AI msgs)
- Enterprise R$697/mes (8 users, 594 OS, ilimitado techs, 800 AI msgs)
