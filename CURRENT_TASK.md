# TAREFA ATUAL

## Versao atual em prod: v1.11.99 — proxima release: v1.12.00 (Solar v3 — fix valores zerados + upload imagem header + A4 print)

## Em andamento (sessao 208 — 20/05/2026)

### Solar v3 — fixes e melhorias do PDF
- ✅ **Bug area=0**: `solar-budget.service.ts:149-150` lia `dims.areaM2`/`dims.volumeM3` mas o sistema grava `dims.area`/`dims.volume` (igual heating). Por isso TODO o dimensionamento (area, qtd, baterias, vazao, %) vinha zerado mesmo com piscina cadastrada.
- ✅ **Upload de imagem no header**: nova coluna `PoolBudget.solarHeaderImage` + migration `20260520140000_add_pool_budget_solar_header_image`. Endpoints `POST/DELETE /pool-budgets/:id/solar-header-image` (multer, JPEG/PNG/WebP, max 5MB, salvo em `/uploads/<companyId>/pool-budgets/<id>/`). Componente `HeaderImageBlock` no SolarTab substitui o icone ☀️ placeholder — clicavel pra upload, mostra preview, botoes Trocar/Remover. Logo padrao aparece no print quando nao tem imagem.
- ✅ **Layout A4 portrait no print**: CSS @media print reescrito — @page A4 com margin 7mm, font-sizes reduzidos (9px base, 8px secundario), paddings/gaps compactados em mm, SVG do grafico limitado a 50mm, classe `avoid-break` em blocos criticos (header, dados, dimensionamento, grafico+tabela) pra nao quebrar entre paginas. Tela continua responsiva — A4 so no print.

### Pos-deploy
- Backfill: nenhum (ADD COLUMN nullable, TenantMigrator sincroniza via ADD COLUMN IF NOT EXISTS automaticamente)
- Teste manual: abrir orcamento ANDERSON DA SILVA PRADO → aba Solar → conferir valores nao-zerados, fazer upload de imagem, clicar Imprimir/PDF e validar A4 portrait.
