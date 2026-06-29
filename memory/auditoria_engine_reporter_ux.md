# Auditoria UX — EngineReporter (editor de Layouts de Impressão) — v1.14.37

## 🟦 BACKLOG ABERTO — Editor PowerPoint (canvas) — fazer 1 a 1, 1 deploy só (pedido Juliano 28/06)
> Canvas de caixas livres x,y. DEPLOYED v1.14.64. Status:
- [x] **A. Digitar texto** ✅ v1.14.63/64 (testado): arrasto com threshold (~4px) sem preventDefault; clicar-de-novo/duplo-clique entra em edição; InlineEditable autofocus. (BudgetReport: BoxFrame + InlineEditable)
- [x] **B. Tamanho/escala da folha** ✅ v1.14.64: folha usa TODO o espaço (largura cheia, maxWidth 980) + ROLA pra baixo (não encolhe pra caber). Tamanho da página editável **L×A mm na aba Início** (default A4 210×297; orientação define default; diminuir altura deixa mais "quadrada"). `pageDims()` no BudgetReport; render/print usam W×H mm. (BudgetReport CanvasEditor + page.tsx)
- [x] **C. Bíblia na aba "Campos"** ✅ v1.14.63: tab própria; painel cascata (acordeão 1-aberto, busca, fontes pequenas, minimiza ao perder foco); cada item com **"+"** (hover) pra inserir. (ReportFieldLibrary + reportFieldCatalog — catálogo hierárquico extensível: Genéricos/Empresa/Cliente/Orçamento Piscina[dados reais]/Ordem de Serviço/Financeiro/Produto)
- [x] **D. Página + Estilo juntos na aba Início** ✅ v1.14.63 (testado): grupos separados por linhas finas (estilo PowerPoint): [Texto] | [Página: orient/L/A mm/Fundo] | [Marca: Logo/Prim/Dest/Salvar] | [Flags: Ativa/Quebra/Converter]. Abas Página e Estilo REMOVIDAS (sem redundância). (page.tsx)
- [x] **E. Cabeçalho/Rodapé = modo de edição** ✅ v1.14.65: aba Cab/Rodapé tem "Editar cabeçalho/rodapé" → entra em região (CanvasEditor da faixa, banner âmbar "voltar à página"); insere via Inserir/Campos; altura mm configurável; SEM checkbox logo (logo = inserir imagem). Renderiza `branding.headerBoxes/footerBoxes` em toda página canvas (faixa topo/base). `region` state + `enterRegion` + scheduleSave roteia pagina↔branding.
- [x] **Ajustes Início v1.14.65:** selecionar TEXTO vai pra aba Início (onEditStart/onSelect por tipo); **tamanho com −/+ (muda na hora SEM perder seleção)** + digitar; **mais fontes** (14); **quebra de linha** (toggle, TEXT); **botão Logo REMOVIDO** (logo = Inserir→Imagem); grupos com divisores.
- [x] **Bugs texto v1.14.65:** (1) texto **autossalva** (onCanvasChange→scheduleSave; blur→commit); (2) **desfazer desfaz o texto** (commit no blur empurra histórico). 
- [x] **Novo card v1.14.65:** botão "Novo card" no Inserir = caixa CARD (retângulo bg/borda). 🔜 PENDENTE: **hierarquia/cascata do card** (card contendo outras caixas + árvore inline ao clicar) — nesting ainda não implementado (modelo de boxes é plano; sobrepõe por z-order). Próximo item. clicar "Cabeçalho" mostra a faixa do cabeçalho na página e DESFOCA o resto; edita inserindo (Inserir → imagem/texto/bloco) — SEM checkbox "incluir logo". Idem rodapé. (header/footer viram canvas próprio: branding.headerBoxes/footerBoxes; rendem em todas as páginas de conteúdo)

## ✅ PACOTE v1.14.69 (28/06) — implementado
- [x] F2/card: **clique simples seleciona, duplo-clique edita** (não entra em edição no 1º clique; dá pra mover/apagar). 
- [x] F10: **fonte/tamanho/cor agem na CAIXA selecionada** (não só editando texto) — resolve "aumentar fonte não funciona".
- [x] Campo de tamanho: **setas nativas, removido +/−**, aplica na hora.
- [x] F9: **Capa e Termos saíram** dos blocos; ficaram só as tabelas dinâmicas.
- [x] F3: **painel "Campos" não colapsa** mais ao perder foco.
- [x] F8: **nomear páginas** (✏️ inline no card; pageConfig.name; preservado no autosave).
- [x] F1 (EDITOR): campos de Cliente/Empresa **resolvem no preview** com dados de exemplo ({clientPhone}/{clientEmail}/{clientAddress}/{clientState}/{clientZip}/{clientTradeName}/{company*}). 🔜 FALTA ligar no relatório REAL (BudgetReportModal.buildReportData mapear partner+company do orçamento).

## ✅ PACOTE G1–G10 (28/06, v1.14.71) — implementado
- [x] G1 clique simples → Layout; duplo-clique → Início (edição).
- [x] G2 entrelinha (style.lineHeight) na Início.
- [x] G3 {solicitante} (environmentParams.solicitante) + G4 {climateCity}/{climateState} (environmentParams.cidade/regiaoSolar) no catálogo + resolver + SAMPLE.
- [x] G5 fundo da página vai pra impressão (render oculto da página aberta mescla bg/nome/noHF).
- [x] G6 toggle "Mostrar cab/rodapé nesta página" (pageConfig.noHF) na aba Cab/Rodapé.
- [x] G7 guia tracejada das margens no editor + controle "Margem (mm)" na Início.
- [x] G8 campo de tamanho reflete a fonte da caixa selecionada (efeito por selBox) + reflectSel na edição.
- [x] G9 alinhamento vertical (cima/meio/baixo) na Início (style.valign).
- [x] G10 link saiu da Início → "Link" no Inserir (caixa TEXT com href) + campo "🔗 link" no Layout (TEXT/IMAGE, box.href → vira <a> clicável no PDF). selLink/linkInput removidos.

## ✅ PACOTE mm + G11–G14 (28/06, v1.14.72) — implementado
- [x] **Geometria em MILÍMETROS** (era %): Box.x/y/w/h = mm, canto sup-esq = 0,0, NÃO rescala ao mudar tamanho da página. `boxRectStyle(b, unit)` unit-aware; `CanvasPage`/`CanvasEditor`/`BoxFrame` recebem unit; pageConfig.unit:"mm" + branding.hfUnit:"mm". **Migração lazy %→mm** ao abrir página (effect) e ao entrar em cab/rodapé (enterRegion), persistida. Drag/alças/Centro H/V/campos X/Y/L/A em mm + clamp 0..pageW/H.
- [x] **G11** Ribbon menor: RibbonBtn compacto (ícone text-sm + label text-[9px], min-w-44), faixa minHeight 44/py-1.
- [x] **G12** Cab/rodapé INDEPENDENTES por página: `pageConfig.noHeader`/`noFooter` (noHF vira legado que esconde os 2); 2 checkboxes (Cabeçalho/Rodapé) na aba Cab/Rodapé; render separado.
- [x] **G13** Caixa de Link: no editor `<a>` = pointer-events:none (BoxContent recebe `editor`; só CanvasEditor passa) → seleciona/arrasta/duplo-clica; clicável só no read-only (impressão). Default href VAZIO. normalizeHref no render.
- [x] **G14** ESC cancela arraste/resize: BoxFrame escuta keydown Escape → reverte pro `start.b`, remove listeners, sem onCommit.

## 🐛 FIX G15 (28/06, v1.14.73) — cards da página tortos/sumindo ao editar cab/rodapé
- **Sintoma:** editar Cabeçalho/Rodapé → ao voltar, cards da Capa ficavam tortos e depois sumiam.
- **Causa:** `enterRegion("page")` relia `editingPage.pageConfig.boxes` que ficava em **%** (o state editingPage NÃO era atualizado após a migração lazy %→mm, só `layout.pages` via setLayout). Esses % eram interpretados como mm → cards minúsculos/tortos; o autosave seguinte gravava o lixo → sumiam ("depois sumiu" = corrupção persistida).
- **Fix:** `pageBoxesRef` guarda o snapshot VIVO da página (mm, já migrado); `enterRegion("page")` restaura dele, nunca do pageConfig stale. `scheduleSave(bs, regionOverride)` evita gravar na faixa errada por `region` stale na migração (load effect e enterRegion passam a região explícita).
- ⚠️ **Dados já corrompidos:** páginas que sofreram o bug ANTES do fix podem ter boxes gravados com valores errados (unit:"mm" + números de %). A migração não recupera (já está "mm"). Reposicionar manualmente OU restaurar.

## 🧪 DOGFOODING rodada 3 (28/06, v1.14.69) — implementado em v1.14.71
- [ ] **G1** Clicar (1 clique) numa caixa já vai pra aba **Início** — deveria ir pra **Layout** no clique simples e só ir pra **Início** no **duplo-clique** (edição). Fix: `onSelect` → setTab("Layout") sempre; só `onEditStart` (duplo-clique) → setTab("Inicio"). (page.tsx CanvasEditor onSelect)
- [ ] **G8** Ao selecionar texto/caixa, o **campo de tamanho deve mostrar o tamanho atual** da fonte (detectar). Hoje fica valor padrão/desatualizado. Vale p/ trecho (reflectSel px→pt) e p/ caixa só selecionada (style.fontSize).
- [ ] **G7** Mostrar **limite das margens** na página (guia tracejada do recuo, como as linhas de cab/rodapé) no editor; usa `pageMarginMm`. Só guia visual (não imprime).
- [ ] **G6** Opção de **cabeçalho/rodapé em página única OU em todas** — toggle por página ("mostrar cab/rodapé aqui") e/ou escopo na aba Cab/Rodapé. Hoje renderiza em todas (exceto `noHF`).
- [ ] **G5 (BUG)** Cor de fundo da página **não vai pra impressão**. Causa: o render OCULTO (#budget-pdf-area) reconstrói o pageConfig da página EDITADA só com `{canvas, boxes}` — perde `bg/bgType/bgColor2/name`. Fix: no map do hidden BudgetReport (page.tsx), mesclar `{ ...p.pageConfig, canvas, boxes, ...pageBgCfg, name: pageNameRef }`. (Confirmado: editor cinza, impressão branca; e "só pegou a cor ao trocar de página" = quando deixou de ser a página aberta + autosave gravou. Logo: render oculto da página ABERTA perde o bg + garantir gravar o bg na hora.)
- [ ] **G4** Falta **"cidade clima"** (cidade usada no cálculo do aquecedor — `environmentParams`/região solar do PoolBudget). Adicionar token (ex.: `{climateCity}`) na origem Orçamento de Obras e ligar ao dado.
- [ ] **G3** Falta o campo **"Solicitante"** (existe no cadastro do Orçamento de Obras / PoolBudget) na bíblia → adicionar token (ex.: `{requesterName}`/`{solicitante}`) no catálogo (origem Orçamento de Obras) e ligar ao dado real. Conferir o campo exato no cadastro/modelo.
- [ ] **G2** Opção de **espaçamento entre linhas (entrelinha / line-height)** no texto — na aba Início (e/ou estilo da caixa). Aplicar na seleção (lineHeight) e/ou na caixa (style.lineHeight no boxRectStyle/BoxContent).

## 🧪 DOGFOODING rodada 2 (28/06, v1.14.68) — ACUMULANDO (resto pendente)
- [ ] **F1 (ALTO) Campos do Cliente/Empresa NÃO resolvem** — só `{clientName}/{clientDocument}/{clientCity}` + `{budget*}/{pool*}` resolvem. `{clientPhone}/{clientEmail}/{clientAddress}/{clientNeighborhood}/{clientState}/{clientZip}/{clientTradeName}` e TODOS os `{company*}` ficam LITERAIS, mesmo no Pool (origem "dados reais"). A bíblia oferece campos que não funcionam. → Ligar TODOS os campos de Partner + Company ao contexto de dados (backend buildReportData/BudgetReportModal + BudgetReportData + resolvePlaceholders). Testado: inseri {clientName}=Anderson ✓ mas {clientPhone}={clientPhone} ✗.
- [ ] **F2 Editar texto x arrastar** — clicar DE NOVO numa caixa de texto selecionada entra em EDIÇÃO; ao tentar mover dá pra editar sem querer. → Editar TEXTO só por **duplo-clique** (clique simples = selecionar/mover). (arrasto real só testável manualmente — automação não dispara pointer-drag)
- [ ] **F3 Painel "Campos" fecha/colapsa fácil** ao perder foco (auto-minimizar agressivo) e os itens viram stale; inserir vários campos seguidos é chato. → não colapsar ao clicar num campo; manter aberto/fixável.
- [ ] **F4 Aninhamento do card** (card contendo caixas + cascata/hierarquia ao clicar) — pendente (grande; modelo plano).
- [ ] **F5 Bloco grande (w90 h80) cobre o conteúdo** ao inserir (offset só ajuda nas caixas pequenas). → inserir bloco em área vazia / abaixo do conteúdo, ou avisar.
- [ ] **F6 Nice-to-have:** guias de alinhamento/snapping, copiar-colar (Ctrl+C/V), multi-seleção, "limpar página", grade.
- [ ] **F7** Inserir campo de TEXTO joga pra aba Layout; pra inserir vários, melhor manter foco na bíblia.
- ✅ Confirmado funcionando: {clientName} resolve, bloco Produtos renderiza c/ dados+imagem, offset de inserção, fundo por página, badge CANVAS, overlay cabeçalho, autosave, duplicar.
- [ ] **F8 NOMEAR PÁGINAS** (Juliano): tirar o resumo automático "sem conteúdo"/"Canvas · N caixas" do card da página e deixar o operador **dar NOME** a cada página (Capa, Sobre, Produtos…). Campo `pageConfig.name` (ou Page.name) editável inline no card; default "Página N".
- [ ] **F10 (ALTO/BUG) "Aumentar a fonte não funciona"** — fonte/tamanho/cor SÓ aplicam quando a caixa está em EDIÇÃO de texto com um trecho selecionado. Selecionar a caixa (alças) e mudar a fonte = NADA (testado: cliquei + 2x, ficou 12). → Os controles da aba Início devem agir: (a) na SELEÇÃO quando editando texto (como hoje); (b) na CAIXA inteira (`style.fontSize/fontFamily/textColor`) quando a caixa TEXT está só selecionada. Aplicar imediatamente. (boxRectStyle já usa style.fontSize.)
- [ ] **F11 Campos GRANULARES do Orçamento de Obras** (Juliano): além do bloco "Produtos por etapa", inserir peças individuais — **{etapa}** (nome da seção), **linha da etapa** (um item específico: descrição/qtd/valor), **imagem do produto da linha**. Precisa design de como referenciar uma etapa/linha específica (índice? seletor?). Acumular.
- [ ] **F9 BLOCOS PRONTOS — decisão (Juliano achou hardcode):** PARECER do Claude: blocos que mostram **dados de tamanho variável** (lista de N itens) NÃO são hardcode dispensável — são a ÚNICA forma de exibir conteúdo dinâmico (caixa livre só guarda conteúdo fixo). MANTER: **Produtos por etapa, Resumo do orçamento, Plano de pagamento, Galeria de fotos, Datasheets (solar/bomba), Tabela personalizada**. REMOVER (redundante c/ campos/canvas livre): **Capa pronta** (capa já se monta com caixas) e **Termos e condições** (usar campos {termsConditions}/{equipmentWarranty}/{workWarranty}). Evolução: tornar a APARÊNCIA dos blocos mantidos configurável (colunas/fonte/cor) p/ deixar de ser "fixo". AGUARDA decisão do Juliano.

## 🧪 DOGFOODING editor canvas (28/06, v1.14.68) — achados + correções
- [x] **Fundo da página era GLOBAL** (mudava todas) → agora **por página** (`pageConfig.bg/bgType/bgColor2`; aba Início "Fundo" mexe só na página atual; render usa o fundo da própria página). ✅ v1.14.68
- [x] **Caixas novas sobrepunham** (mesma x,y) → **offset em cascata** ao inserir. ✅
- [x] **Badge "HTML FIXO"** em página canvas → **"CANVAS"** + descrição "Canvas · N caixas". ✅
- [x] **Duplicar caixa** (faltava) → botão Duplicar na aba Layout (Ctrl não). ✅
- [ ] **Aninhamento do card** (card contendo caixas + cascata/hierarquia ao clicar) — PENDENTE (grande; modelo de boxes é plano). Próximo.
- [ ] **Tokens de origens não-Pool não resolvem** (quote*/os*/fin*/client extra/company*) — precisam de PROVIDER de dados por origem no backend (futuro). Estrutura do catálogo já é final ([[engine_reporter_field_catalog]]).
- [ ] Nice-to-have observados: guias de alinhamento/snapping, copiar/colar, multi-seleção.

## 🔧 REGRA DESTA SESSÃO (definida pelo Juliano)
**PRINCÍPIO-MESTRE: NADA fixo no código — em QUALQUER página, TUDO é editável pelo operador** (tamanho/posição/cor/texto/imagem). Quando algo está hardcoded (ex.: tamanho/posição da logo), virar controle editável. **Quando travar numa dificuldade (ex.: upload de arquivo via automação), CHAMAR o Juliano** em vez de inventar contorno.
**Montar o layout SEMPRE pela tela do Chrome (dogfooding), não hardcodar blocos.** Ao montar, sentir como é o uso real; a CADA dificuldade ou ponto não-intuitivo (fator humano) → ANOTAR aqui pra virar melhoria. Tarefa em curso: apagar as 2 páginas do layout "Piscina Pré Moldada" e remontar do ZERO espelhando o PDF da Andréia Santana (8 págs), considerando ORCP-00001. Abordagem escolhida: ALTA FIDELIDADE, página por página.

## 📋 ESTADO DO LAYOUT "Piscina Pré Moldada" (28/06, v1.14.59) — 7 páginas (print = 7 folhas; P2 cabe em 1)
1. Capa **(agora COMPOSIÇÃO editável, sangria cinza)** ✅ título "Proposta Comercial" no meio + bloco cliente + rodapé; logo da capa PENDENTE upload (Juliano).
2. Sobre (Composição) ✅ intro + Sobre Mim/foto Juliano + Nossa História/foto loja + 2 contatos.
3. Produtos por seção (dinâmica PRODUCTS_BY_SECTION) — renderiza todas as etapas (rascunho).
4. Resumo do orçamento (dinâmica BUDGET_SUMMARY) — resumo por etapa (NÃO é o detalhado).
5. Termos e condições (dinâmica TERMS_CONDITIONS).
6. Plano de pagamento (dinâmica INSTALLMENTS).
7. Datasheet Coletor Solar (Composição c/ bloco HEATING_SOLAR — pois o enum do backend não tem HEATING_*).

## 🔶 PENDÊNCIAS (anotadas; algumas precisam do Juliano)
**Precisam de você:** (a) **Verificar a IMPRESSÃO** — não controlo o diálogo nativo de impressão pela automação; confira se sai idêntico (quebras, capa full-bleed, cab/rodapé por página). (b) Decisões de estilo fino (tamanhos de fonte exatos, cor laranja das Condições). (c) Reordenar Datasheet Solar pra antes do Resumo (ou eu reordeno).
**Posso fazer (grandes):** (1) faixa de CARACTERÍSTICAS da piscina (dimensões) no topo da P3; (2) dividir Produtos em 2 págs + formato 3 colunas (etapa|itens|imagem)+notas NBR como o PDF; (3) **Resumo Financeiro DETALHADO** (item a item por etapa + total produtos/serviços) = BLOCO NOVO — checar se BudgetReportData tem dados item-level; (4) Condições+Parcelas numa página só com estilo laranja; (5) **ícones + links clicáveis** nas redes sociais (precisa botão de link no editor de texto); (6) polir tamanhos/negrito da P2; (7) avaliar enum backend HEATING_* (migration multi-tenant) se quiser datasheet como página dinâmica.

### Atrito observado ao montar (vai virar melhoria)
- [✅ FRICTION 2/3/14 — RESOLVIDO v1.14.58/59] "A capa tem texto/blocos mas não vejo como editar posição/etc." Causa: a P1 era **Página dinâmica COVER** = bloco PRONTO no código (auto-preenche mas NÃO editável peça a peça). Solução (alinhada a "tudo editável"): **capa vira COMPOSIÇÃO**. (a) Card ganhou **Sangria** (`style.bleed`): cancela o padding de 12mm da página → fundo cinza vai até as bordas; vira flex-column + minHeight 297mm (folha cheia). (b) Template **"Capa comercial (cheia)"** refeito: card sangria cinza + logo topo-direita + espaçadores (TEXT flex) que jogam o título "Proposta Comercial" pro meio + bloco do cliente (placeholders) + rodapé de validade — tudo nós editáveis. (c) Página com card de sangria **não recebe cabeçalho/rodapé global** (`hasBleed` detecta nó de topo com bleed; senão a capa-composição herdava o "Orçamento nº"+logo). P1 do layout SLS convertida via tela. 🔜 PENDENTE Juliano: **subir o logo da capa** (bloco Imagem → Enviar, Imagem1.png) — automação não sobe arquivo. Reversível (voltar P1 pra "Página dinâmica"). Resolve também FRICTION 2 (fundo só na capa) e FRICTION 3 (logo na capa).
- [✅ FRICTION 11 — RESOLVIDO v1.14.53] Mudar o tamanho de um BLOCO inteiro por seleção era sofrível: o `ctrl+a` (selecionar tudo) do navegador dentro do contentEditable **não pega todos os parágrafos** — sobrava sempre o último parágrafo num tamanho diferente, exigindo triple-click extra. Fix: campo **"Tamanho do texto do bloco inteiro (pt)"** no inspector do bloco TEXT (`style.fontSize`, render no `rp-node-block`/card). 1 clique muda o bloco todo. A formatação por palavra/trecho (aba Início) continua e SOBRESCREVE o tamanho do bloco (span vence). (Juliano: "e se eu quiser uma palavra com tamanho/cor diferente?" → os dois coexistem.)
- [✅ FRICTION 12 — RESOLVIDO v1.14.55/56] Imagem distorcia e card não tinha como dar altura/largura nem fazer a imagem PREENCHER 100% (Juliano zerou padding/borda e mesmo assim sobrava espaço). Causa: imagem usava `object-fit:cover` com `maxHeight` (cortava/distorcia) e o card não tinha altura nem `position`. Fix — 2 controles novos: **(a) Altura do card (px)** no inspector do card (`style.height`); card agora `position:relative` SEMPRE (ancora imagem absoluta). **(b) Ajuste da imagem** (`config.fit`): *Proporcional* (largura manda, altura auto → NUNCA distorce), *Preencher card 100%* (img `position:absolute; inset:0; width/height:100%; object-fit:cover` → preenche sem distorcer, corta a sobra; funciona com altura FIXA do card OU herdada do "esticar" da linha — ex.: foto ao lado do texto preenche a coluna), *Esticar* (object-fit:fill, pode distorcer). Aplicado na P2 (Juliano via tela): foto Juliano + foto loja em "Preencher card". ⚠️ Limitação: imagem "Preencher" SOZINHA num card sem altura fixa nem irmão mais alto colapsa pra 0 (aviso âmbar pede definir Altura do card).
- [✅ FRICTION 13 — RESOLVIDO v1.14.57] Juliano: o dropdown "Ajuste" (Proporcional/Preencher/Esticar) ficou "hardcode", quer CAMPOS ricos e altamente configuráveis (N cards). Refeito: **IMAGEM** = checkbox "Preencher card 100%" OU **Largura(px) · 🔒cadeado · Altura(px)** (cadeado LIGADO por padrão: mexeu num, o outro acompanha pela proporção REAL da imagem — lê `naturalWidth/Height` via `new Image()`; desligado = livre/independente) + **Alinhar horizontal × vertical** (vertical pede Altura no card; alinhamento via flex no `rp-node-block`; render usa `object-fit:fill` que com o cadeado não distorce). **CARD** = **Largura exata (px)** (vence a %) + **Altura (px)** + **Peso na linha (flex)** (divide o espaço entre cards lado a lado, ex. 2 e 1 = 66/33). **LINHA (N cards)** = gap + alinhamento vertical + distribuir horizontal (incl. "espaçar ao redor") + **quebrar no mobile (flex-wrap)** + dica de que a largura de cada coluna é no Card. Campos novos no style: `widthPx`, `wrap`; config da imagem: `fill`, `w`, `h`, `lockAspect`, `alignH`, `alignV`. Compat: `fit:"fill"` antigo ainda preenche.
- [✅ FEATURE v1.14.52] Faltava LINK clicável no editor de texto. Add: campo "link/número/@" + botão 🔗 na aba Início → `createLink` na seleção (normaliza: @→instagram.com, número→wa.me/55…, senão https://; vazio=unlink; target=_blank). **Links FUNCIONAM no PDF** (gerado via window.print→"Salvar como PDF" do Chrome, que preserva `<a href>` clicável). 🔜 PENDENTE: ícones de MARCA (WhatsApp/Instagram) inline no texto — editor só digita texto plano; precisa inserir imagem/ícone inline (ou layout row [ícone][handle-link]). P2 fit ainda pendente (reduzir fonte dos bios + imagem preencher card via padding 0).
- [✅ FRICTION 10 — RESOLVIDO v1.14.51] P2 estava ESTOURANDO (virava 8 págs na impressão) porque as fotos tinham altura natural (gigantes) e não havia controle de tamanho de imagem. Add: controle no inspector do bloco IMAGE — Largura (100/75/50/auto), Altura máx (px), Alinhar (esq/centro/dir); render usa width/maxHeight/objectFit/margin-auto. Fotos da P2 setadas em 200px → P2 cabe em 1 folha. (Juliano: tudo pelo engine, nada hardcode.) ✅ Verificação de impressão: Juliano consegue printar a tela de impressão (Imprimir→Salvar como PDF) e me mostrar.
- [✅ FRICTION 8 — CORRIGIDO v1.14.47] Botão "+ no topo" era contraditório (sempre adiciona embaixo, no nível raiz). Renomeado para "+ Novo" (Juliano apontou).
- [🐞 FRICTION 9 — CORRIGIDO v1.14.48] Mudar tamanho da fonte deixava o texto GIGANTE e o seletor mostrava só "Tam". Causa: `selExec` (B/I/cor) liga `styleWithCSS=true` no documento; aí o `fontSize=7` virava `<span font-size:xx-large>` e o conversor (que busca `font[size=7]`) não achava → ficava enorme. Fix: forçar `styleWithCSS=false` antes do fontSize no `selFontSize` + converter `.rp-inline-edit font[size=7]` em todo o documento. TAMBÉM: tamanho virou **campo digitável** (input number, aplica no Enter/blur) em vez de dropdown fixo (Juliano: "poder digitar, ex 6"). ⚠️ Textos já salvos com o tamanho-gigante: re-selecionar e setar o tamanho de novo (agora funciona).
- [✅ FRICTION 1 — CORRIGIDO v1.14.41] "Remover" página usava `window.confirm()` nativo (UX pobre + travava automação). Trocado por modal de confirmação próprio ("Remover pagina N?" + Cancelar/Remover).
- [🔴 FRICTION 2] Não dá pra dar fundo SÓ na Capa (cinza, como o PDF) pela tela — o único controle de fundo é GLOBAL (aba Página, afeta TODAS as páginas). Capa precisa de fundo próprio. → Melhoria: bloco Capa com `coverBg` (default cinza SLS), idealmente com color-picker no editor da página dinâmica. (Fix em andamento.)
- [🔴 FRICTION 3] Capa sem logo fica com canto vazio e não avisa que falta subir o logo (Estilo → 📁 Logo). Sugerir placeholder/aviso "envie o logo".
- [✅ FRICTION 4 — RESOLVIDO v1.14.43] Tamanho/posição da logo eram FIXOS no código. Agora editáveis na aba Estilo: altura na Capa, altura no Cabeçalho, Posição (esq/centro/dir), Logo no Rodapé (on/off + px). Cabeçalho global (Orçamento nº + logo) automático nas páginas de conteúdo, NÃO na capa.
- [✅ FRICTION 5 — RESOLVIDO v1.14.44] Posição de card/texto era fixa. Card agora tem: Largura (100/75/66/50/33/25%), Alinhar na página (esq/centro/dir via margin auto), Espaço acima/abaixo (px), Alinhar texto (esq/centro/dir/justif). Linha tem: Distribuir colunas (esq/centro/dir/espaçar). Texto: alinhamento pela aba Início.
- [PRINCÍPIO] Toda vez que achar algo fixo no código durante a montagem → virar controle editável (Juliano: "nada fixo, tudo editável em qualquer página").
- [✅ FRICTION 6 — RESOLVIDO v1.14.45] "Logo do rodapé não funciona": era porque só existia a CAPA (rodapé só renderiza em páginas de conteúdo). Além disso, cabeçalho e rodapé eram acoplados. Refeito: **aba dedicada "Cab/Rodape"** com SELETOR (Cabeçalho | Rodapé); cada um INDEPENDENTE — texto próprio, logo on/off, tamanho (px), lado (esq/dir) e **"Mostrar na capa"** (a capa pode ter rodapé/cabeçalho). Capa = logo (tam/pos) na aba Estilo. Render: cabeçalho/rodapé só em conteúdo, mas com "Mostrar na capa" aparecem também na capa (CoverBlock usa footerHtml+logo).
- [TESTE PENDENTE] Verificar ao vivo, com uma página de CONTEÚDO criada: render de cabeçalho+rodapé (logo lado certo/tam) e posicionamento de card (largura/alinhar/margens). Será feito ao montar a página 2.
- [🐞 BUG CRÍTICO — CORRIGIDO v1.14.46] Salvar página de COMPOSIÇÃO falhava com 400 "Página FIXED precisa ter htmlContent preenchido". Composição salva como type=FIXED + pageConfig.nodes (htmlContent=null) e o backend (`pool-print-layout.service` create) exigia htmlContent. Fix: aceitar FIXED quando há `pageConfig.nodes`. (Só o create tinha a trava; update ok.) ⚠️ Era um bug que impedia QUALQUER página de composição de ser salva — antes ninguém tinha salvado uma (sempre cancelei nos testes).

## UPLOAD de imagens (limitação de automação, NÃO do produto)
A automação (Claude) não consegue usar o seletor nativo de arquivos nem ler arquivos fora de anexos do chat. Então, ao montar via Chrome, **PEDIR ao Juliano** pra subir cada imagem (logo/fotos) pelo 📁 do editor. Imagens da proposta SLS estão em Downloads: Imagem1.png=logo SLS, Imagem2.jpg=foto Juliano, Imagem3.jpg=loja SLS.



Auditoria hands-on (Juliano pediu: montar um layout do zero e anotar TUDO de errado, criterioso em pequenos detalhes, fator humano de visualização/entendimento). Sessão via Chrome no app real (sls.tecnikos.com.br).

## Tela: Lista de Layouts (/pool/print-layouts)
- [ORTO] Título "Layouts de **Impressao**" — falta til → "Impressão".
- [JARGÃO] Subtítulo exibe termos técnicos crus pro operador: "**Page builder**", "páginas **FIXED** (HTML com placeholders)", "**DYNAMIC**", "**items**", "condicoes". Mistura inglês + sem acento. Operador não sabe o que é FIXED/DYNAMIC/placeholder. Reescrever em PT humano.
- [ORTO] "orcamento", "paginas", "condicoes", "items" (→ itens) sem acento/errado.
- [POLISH] Card: "2 **pagina(s) configurada(s)**" — padrão "(s)" preguiçoso; pluralizar de verdade ("2 páginas configuradas").
- [UX] Botão "Remover" (vermelho) colado no "Editar paginas" — risco de clique errado; verificar se remoção do LAYOUT inteiro tem confirmação.

## Tela: Editor (ribbon) — layout "Piscina Pré Moldada"
- [ORTO] Abas da ribbon sem acento: "**Inicio**" (→ Início), "**Pagina**" (→ Página). "**Nova pagina**" (→ página).
- [ORTO] "**PRE-VISUALIZACAO**" (→ PRÉ-VISUALIZAÇÃO). Páginas: "Capa do **orcamento**", "Resumo do **orcamento**" (→ orçamento).
- [JARGÃO] Badge "**DINAMICA**" nas páginas — termo técnico cru pro operador.
- [REDUNDÂNCIA] DOIS botões pra mesma ação de adicionar página: "+ Pagina" (painel esquerdo) e "+ Nova pagina" (faixa Inserir). Confunde.
- [UX] Aba que abre por padrão = "Inserir", mas ela só tem 1 botão + um texto-dica solto ("Capa, Produtos, Datasheets…"). Faixa pobre/vazia — má primeira impressão.
- [VISUAL/CAPA] Preview da Capa: "Proposta Comercial" gigante (42px) e começa MUITO abaixo (a 1ª linha logo/imagem está vazia) → topo da folha fica com grande vão em branco, desequilibrado. Capa parece "quase vazia".
- [UX] "Editar" e "Remover" (vermelho) colados no canto de cada card de página — risco de clique errado.

## Página 2 (Resumo do Orçamento) — preview
- [ORTO] "RESUMO DO **ORCAMENTO**", "**Construcao**", "Acionamentos **eletricos**".
- [DADOS/SAMPLE 🔴] Dados de exemplo INCOERENTES: etapas somam 130.000+18.500+12.800+5.057,60 = **166.357,60**, mas o "Subtotal" mostra **R$185.615,20**. Não bate. (Total = subtotal+impostos: 185.615,20+1.444,12=187.059,32 ✓.) Exemplo incoerente atrapalha quem está montando.
- [CONCEITO] "Subtotal + Impostos = Total" — impostos SOMAM ao total; confirmar se é o desejado (em obra o imposto costuma já estar embutido no preço).

## Ribbon — conteúdo das abas
- **Início:** Fonte/Tamanho/Cor — aplicam ao relatório INTEIRO (branding global), não à seleção. Texto "negrito/alinhar: selecione um texto na folha **(em breve)**" = promessa morta. [MENTAL MODEL 🔴] No Office a aba Início age na SELEÇÃO; aqui age no global → engana (gap da Etapa C). "A"+swatch sem rótulo (cor do texto, ambíguo). "Fonte padrao".
- **Página:** Orientação/Margem/Fundo/Cabeçalho/Rodapé. [ORTO] Orientacao/Solido/Cabecalho/Rodape. [UX] Cabeçalho/Rodapé sem seletor de variáveis (chips) — mas o HTML fixo TEM; inconsistente. Input do cabeçalho cortado ("{budgetCoc"). [TRAP 🔴] Aba SEM botão Salvar — mexe na margem/fundo e o Salvar está em OUTRA aba; sair sem salvar PERDE.
- **Estilo:** Primária/Destaque (cores)+Logo+Salvar. [UX] Não fica claro ONDE primária/destaque se aplicam. [ORTO] Primaria.
- **Arquivo:** Renomear/Salvar estilo/Imprimir/**Duplicar (stub "em breve")**.
- [SALVAR FRAGMENTADO 🔴] "Salvar estilo"(Arquivo) + "Salvar"(Estilo) salvam só o BRANDING; páginas salvam no próprio editor; reordenar salva sozinho. NÃO há um "Salvar" único → operador não sabe o que está salvo.

## Criar página / Composição (testado montando ao vivo)
- [ORTO] "Nova **pagina**", "**Pagina** dinamica", "**Composicao** (cards)", "**Pagina** condicional", "Quebra de **pagina apos**". Mas "Configuração" aparece CERTO → acentuação inconsistente na MESMA tela.
- [JARGÃO] Botão "HTML fixo (placeholders)" expõe "HTML"/"placeholders" pro operador.
- [CRAMPED 🔴] No modo Composição, o montador (Estrutura) + a Pré-visualização ficam ESPREMIDOS no painel inline do centro: o preview vira uma caixinha (~300px) — montar uma página A4 nessa caixinha é ruim. Editor de texto fica embaixo, longe do preview (rola muito). Falta espaço/usar a folha grande do centro.
- [✅ ETAPA B OK] Cliquei no texto na folha → selecionou o bloco interno (árvore destacada + contorno ciano) e abriu "Editar Bloco" com o RichTextEditor. Funciona.
- [SELEÇÃO DE CONTAINER 🔴] Não dá pra selecionar o CARD clicando na folha — o bloco filho preenche o card todo, então o clique sempre pega o filho. Pra editar estilo do card (fundo/borda/padding) só pela árvore. Gap real do "clica e edita".
- [✅ EDIÇÃO AO VIVO OK] Digitei no RichText → preview atualizou na hora; barra refletiu a seleção (Arial/11pt). Mas NÃO se digita direto na folha (é numa caixa abaixo) = ainda não é WYSIWYG in-place (Etapa C).
- [RICHTEXT] Botões de alinhamento são setas "◄ ≡ ►" pouco óbvias; sem rótulo/realce do estado. "negrito" referido na ribbon Início mas a formatação real só existe AQUI no bloco.
- [CONDIÇÃO 🔴] "Página condicional → Requer características" é um INPUT LIVRE ("Ex: AQUECIMENTO_SOLAR, separado por vírgula"). Operador não tem como saber as chaves válidas (sem dropdown das características do orçamento). Fácil errar e a página nunca aparecer (ou aparecer sempre).
- [CONDIÇÃO/UI] Na lista de páginas, condição é mostrada como `{"requires":[...]}` cru (JSON) — ilegível.

## Visualização / fator humano (geral)
- [CAPA] Topo da capa fica em branco (linha logo/imagem vazia no exemplo) → folha parece vazia/desequilibrada. Sem logo carregado, o espaço reservado não some.
- [DEFAULT] Layout começa com 2 páginas dinâmicas (Capa + Resumo). Faltam, por padrão, as páginas que vendem (Produtos por etapa com imagem, Datasheets, Termos, Pagamento) — operador tem que descobrir e montar tudo.
- [SEM SALVAR DIRTY] O editor de Composição/HTML/Dinâmica NÃO tem trava de "Salvar desabilitado sem alteração" (padrão system-wide do CLAUDE.md) — botão "Adicionar/Salvar" sempre ativo.
- [PRINT] "Imprimir exemplo" usa printViaClone (não testei pra não abrir diálogo de impressão). Verificar quebras de página entre cards grandes.

## O que FUNCIONA bem
- Etapa B (clicar elemento na folha → selecionar bloco) — OK pra blocos.
- DIGITAR texto no RichText (substituir conteúdo) atualiza o preview ao vivo — OK.
- Modelos de card (titulo+texto, 2 colunas, destaque, capa comercial) — bom atalho.
- Preview ao vivo com dados de exemplo — bom.

## 🔴🔴 VISÃO DO JULIANO (corrigiu o rumo) + BUGS GRAVES do editor de texto
**Target:** editor de texto NÃO pode "abrir" painel separado. Igual **Word/Excel/PowerPoint**: SELECIONA o texto na FOLHA e formata pela ABA (Ações/Início). Hoje é o oposto (abre "Editar Bloco" com RichTextEditor embaixo).
- [🔴 SELEÇÃO PERDIDA — formatação NÃO aplica] B/I/S, selects de Fonte/Tamanho e input de Cor SEM `onMouseDown preventDefault`: ao clicar, o foco sai do contentEditable, a seleção colapsa, e `execCommand` roda sem seleção → **negrito/itálico/fonte/tamanho/cor frequentemente não aplicam**. `focus()` é chamado DEPOIS do execCommand (tarde). Causa exata do "cliquei negrito e nada". (RichTextEditor.tsx L79-85, 111-127.)
- [🔴 navegação] Clicar numa PÁGINA ABRE o editor em vez de NAVEGAR pra ela na folha. Volta só por "✕ Fechar (ver folha)". `editable/selectedPageId/onSelectPage` do BudgetReport DORMEM.
- [BUG ícone] Sublinhado usa glifo "S" (parece tachado); não há tachado real. Deveria ser "U".
- [BUG reflexo] Dropdown Tamanho só mostra se valor EXATO da lista; headings caem em "Tam." vazio. `applyFontSize` mexe em TODOS os `font[size=7]` do editor.

### Plano Etapa C (proposto — edição in-place estilo Office)
1. FOLHA editável: blocos TEXT com `contentEditable` direto na página (BudgetReport em modo editor).
2. Ribbon Início/Ações age na SELEÇÃO viva (B/I/U/cor/fonte/tamanho/alinhamento) com `onMouseDown preventDefault` (corrige o bug raiz).
3. Salvar o HTML de volta no `pageConfig.nodes` (bloco TEXT) no blur.
4. Aposentar o painel "Editar Bloco" pra TEXT (inspector fica só p/ card/linha + troca de tipo).
5. Clicar página = NAVEGAR (ligar selectedPageId/onSelectPage + scrollIntoView); "Editar" só p/ estrutura.

## PRIORIZAÇÃO sugerida (proposta, não executada)
1. [ALTO/rápido] Sweep de ACENTOS + tirar JARGÃO (FIXED/DYNAMIC/placeholders/page builder) em toda a tela.
2. [ALTO] Resolver "Salvar" fragmentado: um Salvar claro do layout (ou autosave) + trava dirty.
3. [ALTO] Dados de exemplo COERENTES (etapas somam o subtotal).
4. [MÉDIO] Composição em tela cheia (usar a folha grande do centro, não a caixinha).
5. [MÉDIO] Selecionar container (card) na folha (ex.: 2º clique sobe pro pai, ou borda clicável).
6. [MÉDIO] Condição com dropdown das características reais (não texto livre).
7. [MÉDIO] Etapa C: ribbon Início agir na seleção (tirar "em breve") / digitar na folha.
8. [BAIXO] Remover/implementar "Duplicar" (stub). Capa: esconder espaço do logo quando vazio.
