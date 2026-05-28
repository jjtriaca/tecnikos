---
name: sistema_impressao_pdf_simulador
description: Documentacao completa do sistema de impressao do Simulador de Aquecimento Solar — arquitetura, decisoes, historico de problemas (18 itens v1.12.67 → v1.12.77), e ferramenta /dev/print-test.
metadata:
  type: project
---

# Sistema de impressao PDF — Simulador Solar

**Componente:** [HeatingSimulatorModal.tsx](../../../sistema-terceirizacao/frontend/src/components/pool/HeatingSimulatorModal.tsx)
**Versao final:** v1.12.77 (28/05/2026)
**Pagina de teste:** [frontend/src/app/dev/print-test/page.tsx](../../../sistema-terceirizacao/frontend/src/app/dev/print-test/page.tsx) — acessivel em `/dev/print-test` (publico, mock data)

## Objetivo

Gerar PDF profissional do dimensionamento solar — **1 pagina A4 portrait** com header colorido, dimensoes da piscina, configuracao do aquecimento, dimensionamento (KPIs+bomba+tubulacao), simulacao termica mensal (grafico + tabela 12 meses) e observacoes + NBR. Visualmente identico ao datasheet da tela, sem botoes ou inputs interativos.

## Arquitetura final

```
HeatingSimulatorModal (modal fixed inset-0 z-50)
└── #solar-pdf-area (DOM original, dentro do modal)
    └── header, sections, footer (Tailwind + classes print:*)

Botao "🖨️ Imprimir" → printViaClone()
    ├── createPdfClone("printing-clone")
    │   ├── document.getElementById('solar-pdf-area').cloneNode(true)
    │   ├── Prefixa IDs descendentes com "clone-" (evita conflito SVG gradient)
    │   ├── Atualiza url(#X) de fill/stroke pra url(#clone-X)
    │   ├── clone.id = 'solar-pdf-clone'
    │   ├── clone.style.minHeight = '0' (zera min-h-[1120px] da tela)
    │   ├── clone.style.height = 'auto'
    │   └── Append em document.body (FORA dos containers Next.js)
    ├── document.documentElement.classList.add('printing-mode')
    ├── window.print()
    └── afterprint event → remove .printing-mode + remove clone
```

### Por que clonar?

O `#solar-pdf-area` original esta dentro de `<div class="fixed inset-0 z-50 overflow-hidden">` (modal full-screen). O motor de print do Chrome se confunde com `fixed + overflow-hidden`, gerando paginas duplicadas. **Solucao:** clonar o conteudo pra fora de qualquer container fixed, direto no body, e printar so o clone.

### CSS de @media print (resumo)

```css
@media print {
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }

  /* Esconde TUDO no body exceto o container do clone (display:none, NAO visibility:hidden) */
  html.printing-mode body > *:not(.solar-pdf-clone-container) { display: none; }

  /* Container do clone em flow normal (position: static, nao absolute) */
  html.printing-mode .solar-pdf-clone-container.printing-clone {
    position: static; width: 100%; padding: 0; margin: 0; background: #fff;
    display: block;
  }

  /* Clone */
  html.printing-mode #solar-pdf-clone {
    width: 100%; padding: 3mm; min-height: 0; height: auto;
    font-size: 10px; line-height: 1.2; box-shadow: none; border: 0;
    display: block;
  }

  /* Compactacao: sections com padding 2px (era py-3 = 12px) */
  html.printing-mode #solar-pdf-clone section { padding-top: 2px; padding-bottom: 2px; }
  html.printing-mode #solar-pdf-clone footer { padding-top: 2px; padding-bottom: 2px; }
  html.printing-mode #solar-pdf-clone .px-5 { padding-left: 10px; padding-right: 10px; }

  /* Esconde espacador flex-1 vazio (puxa conteudo pra baixo na tela, no print nao precisa) */
  html.printing-mode #solar-pdf-clone > div.flex-1,
  html.printing-mode #solar-pdf-clone .flex-1:not(section):not([class*="col-span"]):empty {
    display: none;
  }

  /* Forca cor do header (gradient azul-preto) — color-adjust: exact */
  html.printing-mode #solar-pdf-clone header {
    background: linear-gradient(to right, #0f172a, #1e3a8a) !important;
    color: #ffffff !important;
    padding: 4px 16px !important;
    -webkit-print-color-adjust: exact;
  }

  /* Banners DIMENSIONAMENTO + SIMULACAO TERMICA */
  html.printing-mode #solar-pdf-clone .bg-blue-900 { background-color: #1e3a8a; color: #fff; }

  /* Esconde controles interativos */
  html.printing-mode #solar-pdf-clone select { display: none; }
  html.printing-mode #solar-pdf-clone input[type=range] { display: none; }

  /* Tailwind print:* aplicadas no clone (Tailwind JIT pode nao incluir senao tem uso direto) */
  html.printing-mode #solar-pdf-clone .print\:hidden { display: none; }
  html.printing-mode #solar-pdf-clone .print\:inline-block { display: inline-block; }
  html.printing-mode #solar-pdf-clone .print\:bg-white { background: #fff; }
  /* ... + cores, bordas, alturas (h-[52mm], max-h-[58mm], max-h-[62mm], etc) */

  /* Avoid page-break em sections principais */
  .avoid-break { page-break-inside: avoid; break-inside: avoid; }
  tr { page-break-inside: avoid; }
}
```

## Historico de problemas (v1.12.67 → v1.12.77)

| # | Problema | Causa-raiz | Fix | Versao | Status |
|---|---|---|---|---|---|
| 1 | Cabecalho sem cor | Gradient azul-preto nao imprimia | `color-adjust: exact` + `linear-gradient` inline | v1.12.67 | ✅ |
| 2 | Logo do tenant ausente | Nao tinha endpoint publico | `<img src="/api/public/tenant/:slug/logo/icon-192">` | v1.12.68 | ✅ |
| 3 | Cards desalinhados | Sem altura uniforme | `height: 32px` + `flex flex-col justify-center` | v1.12.69 | ✅ |
| 4 | "Modo de dimensao/configuracao" no PDF | Sem `print:hidden` | Adicionado `print:hidden` | v1.12.70 | ✅ |
| 5 | Grafico sem linha | SVG `id="tempLine"` duplicado entre original e clone | Prefixar IDs do clone com `clone-` | v1.12.69 | ✅ |
| 6 | Banners sem cor | Tailwind JIT nao incluia classes | CSS inline no clone (`html.printing-mode #solar-pdf-clone .bg-blue-900`) | v1.12.68 | ✅ |
| 7 | 2 paginas identicas (duplicacao) | Modal `fixed inset-0 overflow-hidden` confundia motor de print | `printViaClone()` clona pra fora do modal direto no body | v1.12.72 | ✅ |
| 8 | Branco acima do header | Parent `fixed` + `@page margin: 0` | Clone `position: absolute` (na epoca; depois mudado pra `static` em v1.12.76) | v1.12.72 | ✅ |
| 9 | Preview ≠ Impresso | Botao "Imprimir agora" removia clone antes do print | Ambos botoes usam `printViaClone()` | v1.12.72 | ✅ |
| 10 | Imagem coletor enorme | `aspect-square` sem `max-height` no print | `print:max-h-[58mm]` — ainda maior que cards | v1.12.73 | ⚠ parcial |
| 11 | Grafico ocupando 80mm | `svg max-height: 80mm` | Reduzido pra `60mm` | v1.12.73 | ✅ |
| 12 | Tabela mensal esticava | `items-stretch + h-full` | `print:items-start + print:h-auto` | v1.12.73 | ✅ |
| 13 | Imagem ainda > cards | `58mm > altura dos cards (~52mm)` | `print:max-h-[52mm]` | v1.12.74 | ✅ |
| 14 | Banners colados nos cards | Sem margin-bottom no print | `print:mb-1` em DIMENSIONAMENTO + SIMULACAO | v1.12.74 | ✅ |
| 15 | 2a pagina em branco (parcial) | `min-h-[1120px]` da tela persistia no clone + `<div flex-1/>` espacador esticando | `clone.style.minHeight = 0` no JS + CSS pra zerar `.flex-1:empty` no clone | v1.12.74 | ⚠ persistiu |
| **16** | **2a pagina em branco (definitivo)** | **`visibility: hidden` em `body *` mantem `#solar-pdf-area` original no layout flow (1163px) → body scrollHeight > A4** | **Trocar `visibility: hidden` por `display: none` em `body > *:not(.solar-pdf-clone-container)` + `position: static` no container** | **v1.12.76** | **✅** |
| **17** | **Imagem coletor pequena no print real (~38mm em vez de 52mm)** | **`print:h-full` depende da altura da grid row (`items-stretch`). Quando col-span-8 ficava compactado, row encolhia abaixo de 52mm e imagem com `h-full` encolhia junto** | **Trocar `print:h-full + print:max-h-[52mm]` por `print:h-[52mm]` (altura FIXA, independente da row)** | **v1.12.76** | **✅** |
| **18** | **Botao 👁️ PDF redundante** | **Preview interno (simulating-print) era a mesma visualizacao que o Chrome Print Preview gera automaticamente ao clicar Imprimir** | **Removido botao + useState + useEffect + portal toolbar + ~100 linhas de CSS `simulating-print` + import createPortal** | **v1.12.77** | **✅** |

## Decisoes arquiteturais

### 1. Por que `display: none` e nao `visibility: hidden`?

**`visibility: hidden`** esconde visualmente mas **mantem o elemento no layout flow** — Chrome paginacao considera `scrollHeight` do body inteiro pra decidir page breaks. Elementos invisiveis ainda ocupam altura.

**Padrao correto pra @media print:**
```css
html.printing-mode body > *:not(.print-target) { display: none !important; }
html.printing-mode .print-target { position: static; display: block; }
```

Detalhes do incidente: [bug-print-visibility-hidden-2nd-page.md](bug-print-visibility-hidden-2nd-page.md).

### 2. Por que altura FIXA (`h-[52mm]`) e nao MAX (`max-h-[52mm]`)?

`max-h-[52mm]` + `h-full` so funciona se o pai (grid row) tem altura >= 52mm. Quando o pai eh menor (col-span-8 compactado no print), `h-full` encolhe e a imagem fica menor que esperado. **Solucao:** altura FIXA `h-[52mm]` — independente do contexto.

### 3. Por que clonar via JS em vez de print direto do original?

Original esta enterrado em `<div class="fixed inset-0 overflow-hidden">` (modal). `fixed + overflow-hidden + @page margin: 0` no Chrome gera comportamentos estranhos (branco no topo, paginas duplicadas). **Clonar pra `body > .solar-pdf-clone-container`** isola o conteudo de print.

### 4. Por que prefixar IDs do clone com `clone-`?

SVG `<defs><linearGradient id="tempLine">` apareceria 2x no DOM (original + clone). Browser usa o **primeiro** que encontra ao resolver `url(#tempLine)`. O clone com mesma referencia pegava o gradient do original (que pode estar escondido), gerando renderizacao quebrada. Prefixar com `clone-` da ID unicos pra cada copia.

### 5. Por que `position: static` no container do clone (v1.12.76)?

Antes era `position: absolute`. Como o resto do body fica `display: none` (v1.12.76), nao precisa mais posicionar o clone absolutamente — o flow esta limpo. `position: static` deixa o clone ocupar o body natural, evita layout issues com paginacao.

## Ferramenta de debug: /dev/print-test

[frontend/src/app/dev/print-test/page.tsx](../../../sistema-terceirizacao/frontend/src/app/dev/print-test/page.tsx) — pagina ISOLADA com mock data que reproduz a estrutura DOM do `#solar-pdf-area` + CSS embutido de `printing-mode` e `simulating-print`. Tem 4 modos:

1. **Normal** — tela padrao, com layout `min-h-[1120px]`
2. **👁️ Preview (simulating-print)** — replica o que o Chrome Print Preview vai mostrar (CSS fora de @media print, fundo cinza pra contraste)
3. **🖨️ Print Clone (printing-mode)** — adiciona `html.printing-mode`, mas o CSS so aplica em @media print real (preview MCP nao consegue testar isso direto)
4. **🐛 Debug print (sem @media)** — replica TODO o CSS de `printing-mode` FORA do @media print wrap — usado pra inspecionar layout via DOM no preview browser

URL: `http://localhost:3000/dev/print-test` (dev) ou `https://sls.tecnikos.com.br/dev/print-test` (prod — publico, so mock data).

**Use sempre que precisar debugar print sem login/backend.** Adicione novos casos de teste editando a pagina.

## Como debugar print quando aparece bug novo

1. Reproduzir no `/dev/print-test` modo `Debug print (sem @media)` — vai mostrar o layout exato que sai no print
2. Inspecionar via `preview_inspect` ou DevTools — medir `bodyScrollHeight` vs `A4=1123px`
3. Se body > 1123 → algum elemento esta puxando altura. Verificar:
   - `min-h-*` nao zerado
   - `position: absolute` jogando elemento fora do flow (mas filho ainda no flow)
   - `visibility: hidden` em vez de `display: none`
   - Elementos `flex-1` vazios ainda esticando
4. Se body < 1123 mas ainda gera 2a pagina:
   - Verificar `page-break-after/before: always` em algum elemento
   - Verificar `@page` margins
   - Verificar avoid-break empurrando blocos grandes pra proxima pagina

## Lista de classes Tailwind `print:*` usadas no Simulador

Todas precisam ser **explicitamente** declaradas no CSS de `printing-mode` (Tailwind JIT nao garante presenca em CSS clonado via JS):

- `print:hidden` `print:inline-block` `print:block` `print:inline` `print:flex`
- `print:bg-white` `print:text-blue-900` `print:text-amber-700` `print:text-slate-600`
- `print:border-b-4` `print:border-y` `print:border-blue-900` `print:border-slate-300`
- `print:aspect-auto` `print:h-full` `print:h-auto` `print:h-[52mm]`
- `print:max-h-[52mm]` `print:max-h-[58mm]` `print:max-h-[62mm]`
- `print:items-start` `print:py-1` `print:p-1` `print:mb-1`
- `print:max-w-none` `print:border-0` `print:shadow-none`

**Regra:** ao adicionar nova classe `print:*` no JSX, **adicionar tambem a regra correspondente** em `html.printing-mode #solar-pdf-clone .print\\:xxx { ... }` dentro do bloco `@media print`.

## Estrutura atual do JSX (top-down)

```
<div className="mx-auto max-w-[820px] print:max-w-none solar-screen-wrapper">
  <div id="solar-pdf-area" className="bg-white text-slate-900 font-sans border print:border-0 print:shadow-none flex flex-col min-h-[1120px]">
    <header>...gradient + logo + titulo + orcamento</header>
    <section>...cliente + dimensoes/config (col-span-8) + imagem coletor (col-span-4 print:h-[52mm])</section>
    <div className="bg-blue-900 ... print:mb-1">DIMENSIONAMENTO</div>
    <section>...KPIs + coletor selecionado + tubulacao + bomba</section>
    <div className="bg-blue-900 ... print:mb-1">SIMULACAO TERMICA MENSAL</div>
    <div className="flex-1" />  {/* espacador, escondido no print */}
    <section>...grafico (col-span-7) + tabela mensal (col-span-5)</section>
    <footer>...observacoes (col-span-7) + NBR card (col-span-5)</footer>
  </div>
</div>
```

## Toolbar atual (acima do datasheet)

- Zoom −/+/% (visualizacao na tela, escondido em print:hidden)
- **Recalcular** (amber)
- **💾 Salvar / ✕ Limpar** (so quando manual override)
- **🖨️ Imprimir** (chama `printViaClone()`, sem botao de preview separado)
