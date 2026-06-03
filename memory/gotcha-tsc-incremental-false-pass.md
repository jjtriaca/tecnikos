---
name: gotcha-tsc-incremental-false-pass
description: tsc --noEmit com cache incremental (.tsbuildinfo) pode dar FALSE-PASS (0 erros) mesmo com erro de tipo real, que so aparece no build do servidor (next build). Verificar pre-deploy com --incremental false. Incidente v1.13.10.
metadata:
  type: feedback
  date: 2026-06-03
---

# Gotcha: `tsc --noEmit` com cache incremental dá FALSE-PASS antes do deploy

## Incidente (v1.13.10, 1o deploy abortado)
Adicionei um prop `onEdit` ao TIPO dos props do `ItemRow` mas esqueci de incluir na
DESESTRUTURACAO da funcao (`function ItemRow({ ...onRemove, onMove })`). Usei `onEdit` no corpo.
- `cd frontend && npx tsc --noEmit` -> **0 erros** (cache `.tsbuildinfo` stale, nao re-checou direito).
- `next build` no servidor (passo 6 do deploy) -> **`Type error: Cannot find name 'onEdit'`** -> BUILD FALHOU.
- O detector de build do `deploy-remote.sh` pegou (PIPESTATUS + exit 1) e ABORTOU antes de tocar prod. ✓

## Regra
**Antes de deploy, verificar com cache LIMPO:**
```
npx tsc --noEmit --incremental false
# ou: apagar *.tsbuildinfo e rodar npx tsc --noEmit
```
O `next build` faz type-check fresco (sem o cache do tsc local), entao um `tsc --noEmit`
incremental que passa NAO garante que o build passa.

## Tambem
- Ao adicionar prop a um componente: adicionar nos DOIS lugares — o TIPO (`}: { ... }`) E a
  DESESTRUTURACAO (`function X({ ... })`. Esquecer a desestruturacao = "Cannot find name".
- O deploy bumpou version.json local pra a versao nova mas NAO commitou (abortou no build).
  Pra re-deploy limpo na MESMA versao: `git checkout -- version.json backend/version.json`
  (volta pra ultima commitada) antes de re-rodar. Senao o step 0 entra em "recovery" e pula a versao.
