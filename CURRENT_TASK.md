# TAREFA ATUAL

## Versao atual em prod: v1.12.01 — proxima release: Solar v4 (redesign datasheet profissional)

## Em andamento (sessao 208 — 20/05/2026)

### Solar v3 (v1.12.01 — JA EM PROD)
- ✅ **Bug area=0**: `solar-budget.service.ts:149-150` lia `dims.areaM2`/`dims.volumeM3` mas o sistema grava `dims.area`/`dims.volume` (igual heating). Por isso TODO o dimensionamento (area, qtd, baterias, vazao, %) vinha zerado mesmo com piscina cadastrada.
- ✅ **Upload de imagem no header**: nova coluna `PoolBudget.solarHeaderImage` + migration `20260520140000_add_pool_budget_solar_header_image`. Endpoints `POST/DELETE /pool-budgets/:id/solar-header-image` (multer, JPEG/PNG/WebP, max 5MB, salvo em `/uploads/<companyId>/pool-budgets/<id>/`).
- ✅ **Layout A4 portrait no print**: CSS @media print reescrito.

### Solar v4 — redesign profissional (PENDING DEPLOY)
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
