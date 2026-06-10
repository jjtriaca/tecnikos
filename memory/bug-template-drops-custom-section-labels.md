# Bug: "Salvar modelo" de orçamento dropava NOMES das etapas custom (v1.13.46)

**Sintoma (relato Juliano, 10/06/2026):** salvou o layout "Juliano" a partir do ORCP-00001 e aplicou num orçamento NOVO → as etapas custom apareceram com a CHAVE interna crua (`CUSTOM_BORDA_INFINITA_2G4W`, `CUSTOM_AQUECEDOR_SOLAR_PISCINA_XYGN`) no lugar do nome amigável ("Borda Infinita", "Aquecedor Solar Piscina").

**O que NÃO quebrou (verificado no código):** linhas e fórmulas. `applyItemsSnapshot` recria cada item com `poolSection` (a chave CUSTOM_*), `cellRef`, `formulaExpr`, `autoSelectRule`, `kind`, `qty`, descrição, unidade, preço verbatim. Confirmado no print do usuário: L90 `fx 8 = solarQty auto` preservado.

**Causa raiz:** o nome amigável de uma etapa custom vive em `PoolBudget.environmentParams.customSections.labels[KEY]` — SEPARADO das linhas. O `saveAsTemplate` salvava `itemsSnapshot` (as linhas, com a chave) + `defaults`, mas NÃO esse mapa. O `create` montava `environmentParams` só de DTO > tenant-defaults > vazio. Logo o mapa de nomes nunca era restaurado, e o front `secLabel(key) = customLabelsMap[key] ?? SECTION_LABEL[key] ?? key` caía na chave crua.

**Fix (v1.13.46, BACKEND-only, aditivo, SEM migration):**
- `saveAsTemplate` (`pool-budget.service.ts` ~L2491-2540): captura `customSections.{labels,hidden}` — só das etapas que TÊM item no snapshot — e grava em `defaults.customSections`.
- `create` (~L153-175): faz MERGE de `defaults.customSections` no `environmentParams` do novo orçamento, ANTES do `prisma.poolBudget.create` gravar.
- Template salvo ANTES do fix não tem `defaults.customSections` → merge vira no-op (zero regressão).

**⚠️ Ação do usuário:** modelos antigos precisam ser RE-SALVOS uma vez pra capturar os nomes (mesmo padrão das fórmulas na v1.13.10 — snapshot antigo não tem o dado novo).

**PADRÃO DE RISCO (recorrente):** qualquer código que serializa um SUBCONJUNTO do estado (snapshot / template) ou faz REPLACE de um blob JSON tende a DROPAR chaves "sidecar" não-gerenciadas — aqui `customSections.labels`. Irmão do incidente v1.13.08 (editor `PUT :id` sobrescrevia `environmentParams` e dropava `customSections` — ver [bug-editor-env-replace-drops-keys.md]). **Checklist ao mexer em template / snapshot / editor de orçamento:** o `environmentParams.customSections` (labels+hidden), `solarReport`, `bordaInfinita`, `bordaVolumeExtraM3` estão sendo preservados/restaurados?

**Arquivos:** backend `pool-budget.service.ts` (`saveAsTemplate`, `create`, `applyItemsSnapshot` ~L540). Front `quotes/pool/[id]/page.tsx` (`secLabel` L388, `customLabelsMap` L378, header da etapa L1087).
