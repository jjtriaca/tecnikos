# Auditoria UX — EngineReporter (editor de Layouts de Impressão) — v1.14.37

## 🔧 REGRA DESTA SESSÃO (definida pelo Juliano)
**Montar o layout SEMPRE pela tela do Chrome (dogfooding), não hardcodar blocos.** Ao montar, sentir como é o uso real; a CADA dificuldade ou ponto não-intuitivo (fator humano) → ANOTAR aqui pra virar melhoria. Tarefa em curso: apagar as 2 páginas do layout "Piscina Pré Moldada" e remontar do ZERO espelhando o PDF da Andréia Santana (8 págs), considerando ORCP-00001. Abordagem escolhida: ALTA FIDELIDADE, página por página.

### Atrito observado ao montar (vai virar melhoria)
- [✅ FRICTION 1 — CORRIGIDO v1.14.41] "Remover" página usava `window.confirm()` nativo (UX pobre + travava automação). Trocado por modal de confirmação próprio ("Remover pagina N?" + Cancelar/Remover).
- [🔴 FRICTION 2] Não dá pra dar fundo SÓ na Capa (cinza, como o PDF) pela tela — o único controle de fundo é GLOBAL (aba Página, afeta TODAS as páginas). Capa precisa de fundo próprio. → Melhoria: bloco Capa com `coverBg` (default cinza SLS), idealmente com color-picker no editor da página dinâmica. (Fix em andamento.)
- [🔴 FRICTION 3] Capa sem logo fica com canto vazio e não avisa que falta subir o logo (Estilo → 📁 Logo). Sugerir placeholder/aviso "envie o logo".



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
