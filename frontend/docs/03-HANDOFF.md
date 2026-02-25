# HANDOFF — Frontend (colar no próximo chat)

## Contexto
Projeto grande de frontend para sistema de terceirização de serviços.
Este arquivo é a **fonte rápida de contexto** para continuar o trabalho em outro chat
sem perder informações.

---

## Stack
- Next.js 16.1.6 (Turbopack)
- TypeScript
- Tailwind CSS + PostCSS (@tailwindcss/postcss + autoprefixer)
- Axios
- Playwright (E2E)
- Docker
- Git

---

## Status Atual
- `npm run dev` → OK
- `npm run build` → OK
- Dockerfile criado
- Git inicializado (commit baseline feito)
- Documentação viva criada em `/docs`

---

## Rotas Principais
- Público: `/`, `/auth/login`, `/p/[token]`
- Logado:
  - `/dashboard`
  - `/dashboard/service-orders`
  - `/dashboard/service-orders/[id]`
  - `/dashboard/finance`
  - `/dashboard/settings`

---

## Testes (Playwright)
- Configurado e rodando
- Falhas atuais:
  - Testes dependem de texto/heading (`Ordens de serviço`, erro de login)
- Decisão tomada:
  - Migrar asserts para `data-testid`

Arquivos envolvidos:
- `tests/dashboard.spec.ts`
- `tests/login.spec.ts`

---

## Decisões Importantes
- Testes devem usar `data-testid` (não texto)
- Estado do projeto é documentado no Git (`/docs`)
- Chat NÃO é a fonte da verdade

---

## Próximos Passos (imediatos)
1. Adicionar `data-testid` nos pontos âncora das telas
2. Ajustar testes Playwright para esses IDs
3. Garantir 100% dos testes passando
4. Commitar ajustes como `test: stabilize e2e selectors`

---

## Comandos Úteis
```bash
npm run dev
npm run build
npx playwright test
