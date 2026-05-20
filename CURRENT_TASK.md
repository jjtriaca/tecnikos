# TAREFA ATUAL

## Versao atual em prod: v1.12.03 — proxima release: Solar v5 (datasheet redesign + bug fixes)

## Em andamento (sessao 208 — 20/05/2026)

### Solar v3 (v1.12.01 — JA EM PROD)
- ✅ **Bug area=0**: `solar-budget.service.ts:149-150` lia `dims.areaM2`/`dims.volumeM3` mas o sistema grava `dims.area`/`dims.volume` (igual heating). Por isso TODO o dimensionamento (area, qtd, baterias, vazao, %) vinha zerado mesmo com piscina cadastrada.
- ✅ **Upload de imagem no header**: nova coluna `PoolBudget.solarHeaderImage` + migration `20260520140000_add_pool_budget_solar_header_image`. Endpoints `POST/DELETE /pool-budgets/:id/solar-header-image` (multer, JPEG/PNG/WebP, max 5MB, salvo em `/uploads/<companyId>/pool-budgets/<id>/`).
- ✅ **Layout A4 portrait no print**: CSS @media print reescrito.

### Solar v5 — redesign datasheet + bug fixes (PENDING DEPLOY)
**Iteracao via preview local com usuario (sessao 209).** Mudancas:
- ✅ **Header**: "Dimensionamento para Coletor Solar" + "ORÇAMENTO" (com cedilha). Removido linha NBR redundante.
- ✅ **Cliente/Obra**: nome em destaque, sem label "CLIENTE/OBRA" acima. `LOCAL:` e `PROJETO:` com `:` separando label.
- ✅ **Dimensoes piscina**: StatCompact (label inline + valor) em grid 2×3, com TIPO no header.
- ✅ **Configuracao do aquecimento**: 4 linhas:
  - L1: Capa termica (2/5) + Vento (3/5)
  - L2: Orientacao do telhado + Inclinacao
  - L3: Cidade / Estado (full)
  - L4: **NOVA** — Temp. inicial + Temp. final
- ✅ **NBR**: card unico compacto abaixo das Dimensoes (mesma coluna) com header gradient vermelho/dourado. 5 faixas em grid 2×3 + aviso ⚠ medico.
- ✅ **Imagem do produto**: col-span-4 aspect-square (quadrada), placeholder elegante "Adicionar imagem" com SVG icon.
- ✅ **Banners**: trocado preto solido por azul marinho (bg-blue-900) mais leve. Tirado "Coletor Solar Solis Piscinas" do banner DIMENSIONAMENTO. Dropdown do mes movido pra logo apos "SIMULACAO TERMICA MENSAL" com cor amber (legivel).
- ✅ **DIMENSIONAMENTO**: 2 colunas — esquerda (5/12) com 6 KPIs em coluna unica padrao StatCompact + accent amber em Qtd. coletores; direita (7/12) com Coletor + Slider + Bomba empilhados. Icones ✨ (auto-selecao) antes do dropdown de Coletor e antes da Bomba (mesmo padrao da linha das etapas).
- ✅ **Grafico SVG refeito** (estilo planilha Excel original + Claude design):
  - Tamanho aumentado: viewBox 600x340 (era 600x230, ~48% maior)
  - Fundo gradient azul claro (água)
  - Linhas brancas finas horizontais (ondulações)
  - Linha principal com gradient vertical (azul-frio → amarelo → laranja-quente)
  - Stems verticais finos azuis pontilhados (estilo Excel)
  - Pontos com glow + cor variando do azul ao laranja por altura
  - Badges azul-marinho com valor branco em cada ponto
  - Subtitulo "VARIAÇÃO TÉRMICA EM 4 DIAS" + mês selecionado em destaque
  - Eixo X bottom-bar azul marinho + "DIA 1/2/3/4" + "início/fim"
  - Labels maiores (11.5-12px) — mais legivel
- ✅ **Acentos PT-BR** aplicados em labels visiveis: DIMENSÕES, CONFIGURAÇÃO, CAPA TÉRMICA, ORIENTAÇÃO, INCLINAÇÃO, PROF. MÍN/MÁX, ÁREA, Competição, Recreação, Bebês, Crianças, médico, VAZÃO, M² NECESSÁRIO, SIMULAÇÃO TÉRMICA, GRÁFICO DO MÊS, MÊS, MARÇO, OBSERVAÇÕES.
- ✅ **CSS print** atualizado: `@page A4 margin 6mm`, SVG max-height 80mm (acomoda gráfico maior), padding/font compactos, banners escuros preservados via `print-color-adjust: exact` + overrides explicitos pra bg-blue-900/slate-900/gradient.

**Bug fixes:**
- ✅ **Slider "Aumento da Eficiência"** agora dispara recompute no `onPointerUp`/`onKeyUp` (antes só atualizava state local).
- ✅ **Select de coletor** agora dispara recompute no `onChange` direto.

**Migracao tipoEquipamento:**
- ✅ `products/page.tsx`: substituido `SOLAR` por `COLETOR_SOLAR_PISCINA` e `COLETOR_SOLAR_BOILER`. Opcao `SOLAR` mantida como legado (rotulada).
- ✅ `solar-budget.service.ts`: filtro aceita `COLETOR_SOLAR_PISCINA` OU `SOLAR` (compat).
- ✅ Script `backend/scripts/migrate-solar-to-coletor-solar-piscina.sql` — roda em todos tenants apos deploy.

**Persistir novos campos em environmentParams:**
- ✅ `SolarRecomputeDto` ganhou `orientacaoTelhado`, `inclinacaoTelhadoGraus`, `temperaturaAguaInicial`.
- ✅ `computeAndSaveReport` persiste esses 3 em `environmentParams` quando enviados.
- ✅ Frontend `recomputeSolar` aceita extras como 3o parametro.
- ⏳ **Motor de calculo** ainda nao usa orientacao/inclinacao (so persiste). Fase futura: aplicar fator azimutal + inclinacao otima ≈ latitude + delta T da temp inicial.

**Pendente futura (task #10/PENDENTES Solar v5):**
- ⏳ Ligar icone ✨ Coletor/Bomba ao AutoSelectModal real (modal compartilhado com quotes/pool/[id]/page.tsx) — requer refatoracao do modal pra ser standalone.

### Solar v4 — refino pos-preview local (PENDING DEPLOY — agora obsoleto, integrado em v5)
- ✅ Preview local validado em /demo/solar-preview (temporario, removido)
- ✅ TIPO: PRIVATIVA movido pra dentro do bloco DIMENSOES (header da secao)
- ✅ Aviso NBR mudou de italic amarelo pra vermelho regular com simbolo ⚠
- ✅ HeaderImageBlock min-height aumentado pra 110px (melhor proporcao com cliente)
- ✅ CLIENTE / OBRA: 6/6 cols (em vez de 7/5) — imagem com mais espaco
- ✅ SolarChart refeito: curva bezier suave (em vez de polilinha angular), sem flechinhas Excel-style, label META verde no canto esquerdo (evita sobreposicao com pontos), labels DIA 1-4 centralizados, eixo X "inicio/fim" em segunda linha, grid Y discreto 5 em 5 graus
- tsc clean

### Solar v3.5 — redesign profissional (DEPLOYED ANTERIORMENTE em v1.12.02)
- ✅ **SolarTab refatorado** em datasheet profissional A4 (max-w-[820px], borda + sombra na tela; A4 cheio no print):
  - **Header banner** gradient slate-900→blue-900, codigo do orcamento em destaque, badge "Aquecimento solar para piscinas"
  - **Cliente + Imagem produto** em 7/5 cols (imagem maior, dados focados)
  - **Specs em 3 colunas**: Dimensoes da piscina (6 stat cards), Configuracao (inputs amarelos discretos), Referencia NBR (lista compacta)
  - **Banner DIMENSIONAMENTO** dark slate-900
  - **6 KPI cards horizontais** (area piscina, m² necessario, coletores [accent amber], baterias, vazao, cobertura)
  - **Coletor selecionado** com slider de coletores extras (accent amber-500) + **Bomba recomendada** em card slate-50
  - **Banner SIMULACAO TERMICA** dark + dropdown mes integrado ao banner
  - **Grafico SVG** maior + **tabela mensal** com zebra (4 dias compactos em 9.5px)
  - **Footer** com observacoes em ordered list
- ✅ **HeaderImageBlock** elegante: SVG icon discreto (em vez de emoji), dashed border no empty state, botoes Trocar/Remover uppercase 9px
- ✅ **Novos componentes**: `SectionLabel`, `DataRow`, `Stat`, `ConfigRow`, `NbrRow`, `Kpi` — todos com hierarquia tipografica consistente (labels 8.5-9px uppercase tracking-wide, valores 11-12px tabular-nums semibold/bold)
- ✅ **CSS print** otimizado: `print-color-adjust: exact` preserva fundos escuros, @page A4 margin 6mm, SVG cap 52mm, secoes com padding compacto, `avoid-break` em blocos criticos
- tsc clean

### Pos-deploy
- Backfill: nenhum (ADD COLUMN nullable, TenantMigrator sincroniza via ADD COLUMN IF NOT EXISTS automaticamente)
- Teste manual: abrir orcamento ANDERSON DA SILVA PRADO → aba Solar → conferir valores nao-zerados, fazer upload de imagem, clicar Imprimir/PDF e validar A4 portrait.
