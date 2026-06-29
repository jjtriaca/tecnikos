---
name: dogfooding-caracteristicas-estilo3
description: EngineReporter — dogfooding (29/06) tentando montar bloco "Características" Estilo 3 (faixa de ícones) na unha; lista de atritos + melhorias priorizadas.
metadata:
  type: project
---

# Dogfooding — montar "Características" (Estilo 3, faixa de ícones) no editor

**Contexto (29/06/2026, v1.14.77):** Juliano pediu pra eu MONTAR o bloco de características no editor de
Layouts de Impressão (página "Itens" do layout "Piscina Pré Moldada") pelo NAVEGADOR — propósito explícito:
sentir as dificuldades e levantar o que precisa melhorar. Estilo aprovado = **Estilo 3** (faixa horizontal de
6 medidas, cada uma com ícone em círculo + valor grande + rótulo, com filete em cima/embaixo).

## Como o editor funciona (confirmado ao vivo)
- Página é **sempre editável** (estilo PowerPoint), **salvamento automático** ("salvo ✓"). Lápis ao lado do nome
  da página = **renomear** (pedido do Juliano), não "editar". NÃO tratar isso como atrito.
- Abas do ribbon: Arquivo · Início · Inserir · Campos · Layout · Cab/Rodape.
- **Inserir** oferece: Nova página · Novo card · Texto · Imagem · Link · Campos & blocos. (SEM ícone.)
- **Campos** abre painel "CAMPOS & BLOCOS" (busca + acordeão por origem). Orçamentos de Obras (Piscina) tem badge
  "dados reais". Clicar no campo insere na folha.
- **Layout** (selecionando uma caixa): X/Y/L/A em **mm**, Centro H/V, Frente/Trás, Fundo, Borda, Cantos (radius),
  Padding, Sombra, Opacidade, V-align, URL. Ou seja: dá pra estilizar a caixa (bg/borda/raio/padding) — bom.

## Campos de dimensão expostos (busca "pool")
`{poolLength}` Comprimento · `{poolWidth}` Largura · `{poolDepth}` Profundidade · `{poolArea}` Área ·
`{poolVolume}` Volume · `{poolPerimeter}` Perímetro. **Só UMA profundidade.**

## Atritos reais encontrados (o que precisa melhorar)
1. **Sem biblioteca de ícones.** Estilo 3 é movido a ícone (régua, área, profundidade, gota). Hoje o único
   caminho é subir PNG por PNG via "Imagem". → Adicionar **picker de ícones** (Tabler/Lucide) como elemento
   inserível, com cor/tamanho.
2. **Sem bloco pronto "Características" e sem componente "métrica".** Busca "caracter" = nada. Cada medida vira
   caixa-de-valor + caixa-de-rótulo (+ ícone) posicionadas à mão → ~18 caixas pra 6 métricas. → Criar **bloco
   data-driven "Características da piscina"** que auto-preenche as dimensões, com o Estilo 3 (faixa de ícones)
   como preset; OU um componente "métrica" (ícone+valor+rótulo) pra soltar 6×.
3. **Campo entra só com o VALOR.** `{poolArea}` → "28,5" (sem "Área", sem "m²"). → Insert de campo deveria ter
   opção "rótulo: valor" + unidade, ou variante de campo rotulado.
4. **Insert cai fixo em X21/Y21, SOBRE o conteúdo** (sobrepôs a frase de apresentação). → Cair em área livre /
   perto do último clique / em fluxo; evitar sobreposição.
5. **Sem alinhar/distribuir/grade, sem snap/guias.** Faixa de 6 colunas iguais = calcular mm de cada caixa na
   mão. → Adicionar alinhar (esq/centro/dir/topo/meio/base), **distribuir horizontal/vertical**, snap-to-grid/
   guias, e talvez um helper de colunas.
6. **Falta Maior/Menor profundidade.** Catálogo expõe só `{poolDepth}`; orçamento real (e o PDF antigo) tem
   maior (1,4 m) e menor (0,4 m) — desnível de fundo. → Expor `{poolDepthMax}`/`{poolDepthMin}`.

## Conclusão / recomendação
Não dá pra reproduzir o Estilo 3 com fidelidade no editor atual sem (a) subir imagens de ícone e (b) posicionar
~18 caixas na mão — e ainda faltaria min/max profundidade. Maior alavanca = **bloco data-driven "Características"
com o Estilo 3 como preset** (vira 1 clique e é reutilizável) + **picker de ícones**. Ver [[engine_reporter]] e
[[engine-reporter-field-catalog]].
