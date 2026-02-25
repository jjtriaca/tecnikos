# DECISÕES TÉCNICAS (ADR)

Este documento registra **decisões estruturais** do projeto e seus motivos.
Evita retrabalho e perda de contexto em projetos de longo prazo.

---

## ADR-001 — Next.js com App Router
**Decisão:** Usar Next.js com App Router.  
**Motivo:** Padrão atual do framework, melhor organização por rotas/layouts e suporte a SSR/SSG.  
**Status:** Aprovado.

---

## ADR-002 — TypeScript como padrão
**Decisão:** Todo o frontend em TypeScript.  
**Motivo:** Segurança de tipos, melhor refatoração e testes mais confiáveis.  
**Status:** Aprovado.

---

## ADR-003 — Tailwind CSS
**Decisão:** Usar Tailwind CSS com PostCSS (`@tailwindcss/postcss`).  
**Motivo:** Velocidade de desenvolvimento, consistência visual e baixo acoplamento.  
**Status:** Aprovado.

---

## ADR-004 — Axios para HTTP
**Decisão:** Axios como cliente HTTP centralizado em `src/lib/api.ts`.  
**Motivo:** Interceptors, padronização de headers e fácil integração com backend.  
**Status:** Aprovado.

---

## ADR-005 — Playwright para testes E2E
**Decisão:** Playwright como framework de testes end-to-end.  
**Motivo:** Execução real em navegador, bom suporte a CI e traces detalhados.  
**Status:** Aprovado.

---

## ADR-006 — data-testid para testes
**Decisão:** Testes devem preferir `data-testid` a textos/roles.  
**Motivo:** Evita testes frágeis quando textos ou layout mudam.  
**Status:** Aprovado (em implementação).

---

## ADR-007 — Git como fonte da verdade
**Decisão:** Estado do projeto documentado em `/docs` e versionado no Git.  
**Motivo:** Evitar dependência de histórico de chat e perda de contexto.  
**Status:** Aprovado.

---

## Revisões
- Alterações futuras devem adicionar um novo ADR numerado.
