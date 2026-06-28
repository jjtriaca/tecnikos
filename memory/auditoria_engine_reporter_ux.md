# Auditoria UX — EngineReporter (editor de Layouts de Impressão) — v1.14.37

## 🟦 BACKLOG ABERTO — Editor PowerPoint (canvas) — fazer 1 a 1, 1 deploy só (pedido Juliano 28/06)
> Canvas de caixas livres x,y JÁ no código (não deployado — v1.14.61 só tem a base). Itens pendentes:
- [ ] **A. Digitar texto não funciona** (CRÍTICO): `preventDefault` do arrasto bloqueia o duplo-clique. Fix: arrasto só com threshold (~4px), sem preventDefault, clique-de-novo/duplo-clique entra em edição, InlineEditable com autofocus. (BudgetReport: BoxFrame + InlineEditable)
- [ ] **B. Página quadrada / tamanho**: a folha na tela deve ficar no TAMANHO configurado (A4 retrato = alta, não quadrada), cabendo no painel (fit-to-height). Add opção **Tamanho da página (default A4)** na aba Página (210×297). (BudgetReport CanvasEditor + page.tsx)
- [ ] **C. Bíblia em ABA própria**: tab "Campos"; clicar abre a cascata (acordeão); cada bloco/campo com **"+"** pra inserir na página. Tirar o toggle de Inserir/drawer atual. (page.tsx + ReportFieldLibrary)
- [ ] **D. Juntar ferramentas de Página + Estilo na aba Início** (há redundância de ferramentas — fonte/cor duplicada). Remover abas Página/Estilo, folddar na Início. (page.tsx)
- [ ] **E. Cabeçalho/Rodapé = modo de edição na folha**: clicar "Cabeçalho" mostra a faixa do cabeçalho na página e DESFOCA o resto; edita inserindo (Inserir → imagem/texto/bloco) — SEM checkbox "incluir logo". Idem rodapé. (header/footer viram canvas próprio: branding.headerBoxes/footerBoxes; rendem em todas as páginas de conteúdo)
- [x] (feito no código) canvas de caixas, biblioteca de campos (catálogo hierárquico extensível p/ qualquer relatório), remover dropdown "Bloco".

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
