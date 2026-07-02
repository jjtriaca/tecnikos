---
name: sessao_228_summary
description: Sessao 228 (01-02/07, v1.15.24→41) — EngineReporter GRUPO EMPILHADO (pilha/stack) do zero + paginacao A4 + pagina comprida por-pagina + mecanismos de grupo (cascata/trava/alinhar ao pai) + duplicar/editar campo/mini-modal + campo CONSUMO no cadastro + receitas de consumo/cantoneira + campo INDICADOR (tempo de filtragem) no relatorio + NFS-e Nacional (Primavera saiu do ABRASF). LER pra retomar EngineReporter.
metadata:
  type: project
---

# Sessao 228 (01-02/07/2026) — v1.15.24 → v1.15.41

Frente principal: **EngineReporter** (editor de layout de impressao do orcamento de Piscina, canvas de caixas x,y). Ver [[engine_reporter_card_dinamico]] (detalhe tecnico completo dos dinamicos/pilha).

## EngineReporter — GRUPO EMPILHADO (pilha/stack) — a grande frente
- **Contexto:** grupo dinamico escondido pela condicao deixava BURACO branco no print (canvas e absoluto). Juliano rejeitou o "repetidor/multiplicador" (blocos dinamicos ficam como estao); pediu duplicar-grupo-inteiro em vez disso.
- **v1.15.24** — Duplicar grupo leva os FILHOS junto (`duplicateSelBox` remapeia parentId dos clones; antes ficavam no grupo original).
- **v1.15.25** — Editar campo de etapa/linha: caixa TEXT/IMAGE com token `{linha:..}`/`{etapa:..}` ganha selo 🔗 + botao "Editar campo" que reabre o MESMO modal de insercao (`editFieldBoxId`); "Aplicar" vira "Trocar" e substitui o box. Helper unico `fieldBoxFor(attr,ref)`.
- **v1.15.27** — MODO PILHA: `Box.stack` marca CARD como container de FLUXO VERTICAL. `applyStackFlow` (BudgetReport) no PRINT empilha filhos visiveis do topo, colapsa escondidos, auto-fit da altura. `boxShowsCascade` virou TRANSITIVO (sobe cadeia inteira; netos vazavam). Editor: objeto "📚 Grupo empilhado" + toggle Empilhar + aninhar CARD-em-stack + delete/move cascata.
- **v1.15.29** — Grupo empilhado nasce TRANSPARENTE (nao cobre os grupos). Montar: Inserir → posicionar cobrindo → selecionar cada grupo pela ARVORE OBJETOS → "📥 Colocar no grupo".
- **v1.15.31** — PAGINACAO da pilha: `paginateStackFlow` fatia em A4 quando estoura; cada grupo = unidade atomica (nao parte). GOTCHA: browser NAO fatia canvas absoluto sozinho; aumentar altura da pagina = 1 folha comprida.
- **v1.15.33** — PAGINA COMPRIDA por-pagina: `pageConfig.heightMm` (altura de trabalho, canvas rola) + `pageConfig.breakA4` (fatia A4 no print). Helper `pgH()` region-aware nos clamps. UI aba Inicio "Alt. pag" + "Quebrar A4". Print: `cH = breakA4 ? A4 : (heightMm||global)`. Global fica A4 (Capa nao infla).
- **v1.15.35** — Espaco configuravel entre grupos: `Box.stackGap` (mm, default 2); campo "Espaco" na ribbon do grupo pilha.
- **v1.15.38** — Duplicar DENTRO de grupo nasce alinhado ABAIXO (mesmo X + stackGap) e o pai CRESCE pra conter (nao vaza).
- **v1.15.39** — FIX heightMm nao persistia (voltava a 297): `scheduleSave` atualizava so `layout.pages`, nunca `editingPage` → init lia pageConfig stale e zerava. Fix: `setEditingPage({...prev, pageConfig})` no save. (Diagnostico via SQL no banco: page tinha breakA4=true mas heightMm=null.)
- **v1.15.40** — Guia de QUEBRA A4 no editor (so visual): linha magenta "✂ A4 · pag N" + faixas de cabecalho/rodape por folha (prop `pageBreaks` no CanvasEditor).

## EngineReporter — mecanismos de grupo (v1.15.34, 37)
- **v1.15.34** — BUG neto que escapava: `onCanvasChange` (arraste) so movia filhos DIRETOS; agora move a SUBARVORE (`subtreeIds` BFS). `clampInParent` trava filho na borda do pai. `alignToParent` + botoes "no grupo: Esq/Centro/Dir/Topo/Meio/Base pai". NumInput ganhou ↑/↓ (teclado).
- **v1.15.37** — X/Y do filho ficam RELATIVOS ao pai (0=canto do grupo; selo ▣). Trava tambem no RESIZE (w/h nao passam da borda).
- **v1.15.36** — Setinhas ▲▼ VISIVEIS no NumInput (prop `spin` opt-in; type="text" nao tem spinner nativo). Ligado nos campos de medida (X/Y/L/A/Borda/Cantos/Padding/Opac/Espaco/Alt.pag).

## EngineReporter — outros
- **v1.15.30** — "Outras linhas" do FormulaModal virou mini-modal AGRUPADO por etapa (ordem salva, colapsado) — Juliano: "mini modal em tudo". PENDENTE: varrer outras listas planas do sistema.
- **v1.15.41** — Campo INDICADOR da auto-selecao no relatorio: `{linha:Lx.indicador|indicadorrotulo|indicadortexto|indicadorstatus}` (ex: "Tempo de filtragem: 3h 42min"). ReportItem + buildReportData + fmtIndicator + optgroup no picker. Generico (folga, vazao, etc).

## Modulo Piscina — CONSUMO (fora do EngineReporter)
- **v1.15.26** — Campo CONSUMO (coeficiente de aplicacao) no cadastro Piscina: grupo "📦 Consumos" minimizado (consumoArgamassaM2/RejunteM2/CantoneiraMl/CimentoM3/AreiaM3). **Insight Juliano:** o coeficiente NAO mora no material consumido (rejunte), e sim no produto DRIVER (revestimento) — pq consumo de rejunte depende do revestimento. 5 receitas `prod(LREF,"consumoXxx")*qty(LREF)` (needsLineRef). Backend ZERO mudanca (technicalSpecs Json).
- **v1.15.28** — Removidas receitas LEGADAS (consumoKgM2/pesoKg) + fix clique do picker (aparecia fora da tela).
- **v1.15.32** — Receita CANTONEIRA self-dependente: `ceil(cantos * consumoCantoneiraMl)` (le o proprio produto, nao outra linha).
- **ACHADO:** `consumoKgM2`/`pesoKg`/`rendimento` (+ comprimentoCm/larguraCm/etc) sao LEGADO importado da planilha Excel (seed-from-excel.ts), INVISIVEIS no cadastro. 8 produtos com consumoKgM2, 10 linhas com formula legada. **MIGRACAO PARQUEADA** (Juliano: so entender por ora). Ver CURRENT_TASK "MIGRACAO LEGADO".

## NFS-e (fora do EngineReporter) — RESOLVIDO
- Primavera do Leste/MT (5107040) DESCONTINUOU o ABRASF (saiu do Cenario A). Erro "ABRASF descontinuado, use DPS Nacional". **Fix (config, nao deploy):** trocar Layout MUNICIPAL→NACIONAL (SPED /v2/nfsen) + Salvar → NFS-e nº 88 AUTORIZADA. NAO precisou mexer no painel Focus. Ciclo previsto no Gotcha 8. Ver [[nfse-lessons-learned]]. **CONTRADICAO pendente:** obra flat vs aninhada (resolver lendo codigo antes de emitir OBRA).

## PENDENCIAS pra proxima sessao
- Testar na tela: pilha com muitos grupos + Quebrar A4 (paginacao), heightMm persistindo, guias A4, duplicar-no-grupo alinhado.
- EngineReporter: `onCanvasGroupMove` (multi-select) ainda nao cascateia subarvores; clamp de resize parcial (canto top-left).
- Mini-modal agrupado em outras listas planas do sistema (varredura).
- Indicador como COLUNA da Lista dinamica (se Juliano pedir).
- Migracao legado consumoKgM2/pesoKg (parqueada — discutir manter pesoKg vs lancar em sacos/m²).
- Repetidor/multiplicador do grupo: PARADO por decisao (duplicar-grupo cobre).
