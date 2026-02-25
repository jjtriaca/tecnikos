# TODO / BACKLOG — Frontend

Este backlog lista **tarefas objetivas**, priorizadas, para evolução do frontend.
Use checkboxes para acompanhar o progresso.

---

## PRIORIDADE ALTA (Estabilidade)
- [ ] Ajustar testes E2E para usar `data-testid`
- [ ] Adicionar `data-testid` nos pontos âncora das telas:
  - [ ] Login (mensagem de erro)
  - [ ] Service Orders (título/lista)
  - [ ] Dashboard (layout principal)
- [ ] Padronizar mensagens de erro (login / aceite público)
- [ ] Garantir redirects corretos (auth vs dashboard)

---

## PRIORIDADE MÉDIA (Qualidade)
- [ ] Configurar scripts: `lint`, `typecheck`, `test`
- [ ] Adicionar Prettier
- [ ] Configurar Husky + lint-staged (pre-commit)
- [ ] Definir padrão de logs no frontend

---

## PRIORIDADE MÉDIA (UX)
- [ ] Loading states consistentes
- [ ] Estados vazios (empty states)
- [ ] Feedback visual de erro/sucesso
- [ ] Acessibilidade básica (labels, foco)

---

## PRIORIDADE BAIXA (Infra)
- [ ] CI básico (build + tests)
- [ ] Variáveis de ambiente documentadas (`.env.example`)
- [ ] Revisar Dockerfile para produção

---

## CONCLUÍDO
- [x] Build de produção funcionando
- [x] Git inicializado e repositório limpo
- [x] Estrutura de documentação criada
