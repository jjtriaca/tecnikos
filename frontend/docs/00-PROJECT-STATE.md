# PROJECT STATE — Frontend

## Visão Geral
Frontend do sistema de terceirização de serviços (estilo Auvo),
construído em Next.js com App Router.

Este documento descreve **o estado atual real** do projeto.
Ele deve ser atualizado sempre que algo estrutural mudar.

---

## Stack
- Next.js 16.1.6 (Turbopack)
- React + TypeScript
- Tailwind CSS + PostCSS
- Axios
- Playwright (E2E)
- Docker (build de produção)
- Git (controle de versão)

---

## Estrutura Principal
- `app/` — rotas e layouts (App Router)
- `src/components/` — componentes reutilizáveis
- `src/lib/` — clientes HTTP e utilitários
- `tests/` — testes E2E (Playwright)
- `docs/` — documentação viva do projeto

---

## Rotas Implementadas
### Públicas
- `/`
- `/auth/login`
- `/p/[token]`

### Área Logada
- `/dashboard`
- `/dashboard/service-orders`
- `/dashboard/service-orders/[id]`
- `/dashboard/finance`
- `/dashboard/settings`

---

## Build e Execução
- `npm run dev` ✅
- `npm run build` ✅
- `docker build` ✅

---

## Testes
- Playwright configurado
- Testes existentes:
  - Login
  - Dashboard

⚠️ Alguns testes ainda falham por seletor/texto (ajuste planejado).

---

## Estado Atual
- Frontend funcional
- Build de produção OK
- Repositório Git inicializado e limpo
- Documentação iniciada

---

## Próximo Foco
- Ajustar testes E2E com `data-testid`
- Documentar decisões técnicas
- Padronizar mensagens de erro (login / aceite)
