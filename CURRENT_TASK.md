# TAREFA ATUAL

## Versao: v1.04.35
## Ultima sessao: 132 (17/03/2026)

## Pendencias

### A FAZER
1. **Avaliacao/Feedback do servico** — Fluxo ponta a ponta (gerar token, enviar link ao cliente, UI gestor avaliar)
2. **Sistema de sugestoes** — Botao "Solicitar melhoria" no chat IA -> sugestoes para Juliano
3. **Configuracoes empresa readonly** — Campos vem do onboarding/licenca, so "Buscar na Receita" atualiza
4. **Deploy v1.04.36** — Deploy com editor visual + correcoes acumuladas

### CONCLUIDO (sessao 132)
- Editor visual de workflow integrado na pagina principal (substituiu formulario antigo)
- 6 componentes: Palette, Canvas, BlockNode, Properties, Templates, VisualEditor
- Templates: Instalacao, Manutencao Preventiva, Vistoria, Corretiva, Em Branco
- Suporte a todos os tipos de bloco (18 tipos) com painel de propriedades
- CONDITION com branches SIM/NAO renderizados visualmente
- Validacao, keyboard shortcuts (Delete/Escape), insert mode

### CONCLUIDO (sessao 131)
- Reestruturacao documentacao (ARCHITECTURE.md + CLAUDE.md enxuto + limpeza .md redundantes)
- Testes automatizados (70 testes: OS lifecycle + Asaas billing)
- Sentry integrado (backend @sentry/nestjs + frontend @sentry/nextjs)
- CI/CD atualizado (GitHub Actions com step de testes)
- Importacao CSV de parceiros (modelo + botao download + mapeamento)
- CNPJ readonly + Checkbox contrato SaaS + Auto-token avaliacao

### BLOQUEADO
- **WhatsApp Business** — Conta desativada pelo Meta, recurso enviado
