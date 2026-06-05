---
name: gotcha-tsc-incremental-false-pass
description: Type-check local do FRONTEND e' NAO-CONFIAVEL (false-pass) — nem `tsc --noEmit` (qualquer flag) nem `next build` com `.next` stale pegam erros reais. Causa: `.next/dev/types` velho (de um `next dev` anterior) com sintaxe invalida polui o type-check. UNICO gate confiavel: `rm -rf .next && npm run build`. Incidentes v1.13.10 e v1.13.14.
metadata:
  type: feedback
  date: 2026-06-05
---

# Gotcha: type-check local do frontend dá FALSE-PASS antes do deploy

**O `tsc --noEmit` local (com OU sem `--incremental false`) NÃO é confiável pra este frontend.**
O `next build` do servidor (passo 6 do deploy, Docker LIMPO) é o gate real — ele pega erros que o check local não pega.

## Causa raiz (descoberta na v1.13.14)
Um diretório **`.next/dev/types/`** deixado por um `next dev` anterior contém `.ts`/`.d.ts` gerados com
sintaxe que o `tsc` local não parseia (`routes.d.ts` cheio de `TS1005: ';' expected`). Esses arquivos
entram no programa do `tsc` (via tsconfig) e **poluem o type-check**:
- `npx tsc --noEmit --incremental false` → cospe dezenas de erros em `.next/dev/types/*`. Se você
  FILTRA esses (`grep -v '^\.next/'`) e confia em "0 erros no src", é **FALSE-PASS** — o erro real no
  `src/` não foi reportado (o programa quebrado suprime o check completo).
- `npm run build` LOCAL com `.next` stale → "✓ Compiled successfully" e DEPOIS `Type error` no
  `.next/dev/types/routes.d.ts`. Ou seja, nem o build local é confiável com `.next` sujo.

O Docker do deploy é confiável porque **exclui `.next`** (.dockerignore + tar `--exclude=.next`) →
build fresco regenera types válidos → pega o erro real.

## Regra (ÚNICO gate local confiável)
```
cd frontend && rm -rf .next && npm run build
```
Exit 0 + "✓ Compiled successfully" + "Generating static pages" = limpo de verdade.
Backend: `cd backend && npx tsc --noEmit` É confiável (nest, sem `.next`).

## Incidentes
- **v1.13.10**: prop `onEdit` no TIPO mas não na DESESTRUTURAÇÃO do componente. `tsc` passou, `next build` (servidor) falhou `Cannot find name 'onEdit'`. Deploy abortou no build (prod intacta).
- **v1.13.14**: `operatingHoursDebug` adicionado na interface do BACKEND mas esquecido na do FRONTEND. `tsc --incremental false` filtrado deu 0 erros no src (false-pass). `next build` do servidor pegou `Property 'operatingHoursDebug' does not exist on type 'HeatingReport'`. Deploy abortou no build (prod intacta). Local só validou depois de `rm -rf .next && npm run build`.

## Também
- Ao adicionar campo a um TIPO compartilhado (ex: `HeatingReport`) que existe no backend E no frontend:
  adicionar nos DOIS. Idem prop de componente: TIPO (`}: { ... }`) E DESESTRUTURAÇÃO (`function X({ ... })`).
- Deploy abortado no build bumpa `version.json` local mas NÃO commita. Pra re-deploy limpo na MESMA
  versão: `git checkout HEAD -- version.json backend/version.json` antes de re-rodar (senão o step 0
  entra em "recovery" e pula a versão). [[feedback_deploy_build_silent]]
