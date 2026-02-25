# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: ✅ CONCLUÍDO — Checklist vermelho de segurança (v1.00.45)

## Última sessão completada: 47 (25/02/2026)
- Auditoria completa do sistema (5 agentes em paralelo)
- Relatório com 6 issues críticas, 8 high, 12 medium
- Nota geral: 6.5/10 (pré-produção)

## Próxima tarefa planejada:
**Checklist vermelho de segurança (~3-4h)**
O Juliano quer subir o sistema para produção. Precisa primeiro:

1. [ ] JWT Secret forte (não hardcoded)
2. [ ] Helmet (headers de segurança)
3. [ ] Rate limit diferenciado (login/OTP mais restrito)
4. [ ] Remover OTP do console.log
5. [ ] Senha mínima 8+ chars
6. [ ] CORS com domínio real (configurável via env)
7. [ ] Middleware de rota no frontend (middleware.ts)
8. [ ] Error boundary (error.tsx + not-found.tsx)

## Se reconectar no MEIO de uma tarefa:
- Verifique o TODO list no Claude (se existir)
- Leia o último bloco do CHAT_LOG.md para contexto
- Continue exatamente do ponto onde parou
- NÃO pergunte ao Juliano — ele autorizou execução irrestrita

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte técnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessão
- Versão em version.json sempre atualizada
