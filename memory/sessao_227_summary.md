---
name: sessao-227-summary
description: Sessão 227 (28/06, v1.14.72→77) — EngineReporter dogfooding — mm, hierarquia objetos, validade+default, link máscara, fixes cab/rodapé. Incidente Capa SLS.
metadata:
  type: project
---

# Sessão 227 (28/06/2026, v1.14.72 → v1.14.77) — EngineReporter (editor de layout de impressão), dogfooding

Juliano testando o editor canvas na tela (layout "Piscina Pré Moldada", id `692900a6-1788-44be-90c7-3abe9c59f066`, tenant SLS). Lote de melhorias acumuladas e deployadas. Detalhe técnico completo em [[auditoria-engine-reporter-ux]].

## O que foi entregue
- **v1.14.72** — Geometria em **milímetros** (era % da folha): `Box.x/y/w/h` = mm, canto sup-esq = 0,0, NÃO rescala ao mudar tamanho da página. Migração lazy %→mm ao abrir página/faixa. + **G11** ribbon menor; **G12** cabeçalho/rodapé independentes por página (`pageConfig.noHeader`/`noFooter`); **G13** link não-clicável no editor; **G14** ESC cancela arraste.
- **v1.14.73** — **FIX G15** (bug grave): editar cabeçalho/rodapé e voltar deixava os cards da página tortos e depois sumindo. Causa: `enterRegion("page")` relia boxes do `editingPage.pageConfig` ainda em % (stale) → interpretados como mm → autosave gravava lixo. Fix: `pageBoxesRef` (snapshot vivo em mm) + `scheduleSave(bs, regionOverride)`.
- **v1.14.74** — Seletor de **fonte** corrigido (lista única `FONTS`, detecta qualquer fonte, "Fonte" removida, **Arial Black** adicionada) + **hierarquia de objetos** (painel de camadas: lista texto/imagem/campo/card, nome editável, reordena z, exclui).
- **v1.14.75** — **Validade da proposta** em Condições gerais do orçamento de piscina + botão **⭐ Salvar padrão** (tenant). Backend: `Company.systemConfig.pool.defaultValidityDays`; endpoints `GET /pool-budgets/settings/proposal-defaults` e `PUT /pool-budgets/settings/validity`; create usa `dto ?? template ?? tenantDefault ?? 30`; tela de novo orçamento pré-preenche. + **link máscara** (🔗 URL atrás / 🏷️ Rótulo frente) + **🚫 Limpar realce** (remove background-color do texto).
- **v1.14.76** — **Inserir → Link via pop-up** (pergunta URL + texto visível; cria a caixa com a máscara).
- **v1.14.77** — Fix: caixa inserida no cabeçalho/rodapé nascia FORA da faixa (não clicável) → `addBox` agora é region-aware (usa a altura da faixa).

## Incidente — Capa SLS perdeu os cards
O bug G15 zerou os boxes da página **Capa** (id `44583d48-cd99-4b71-9e94-02e675401604`) — gravou `[]`. Investigado: o **AuditLog** (`tenant_sls."AuditLog"`, colunas before/after/createdAt) e os backups pré-deploy (`/opt/tecnikos/backups/pre-deploy-*.sql.gz`) tinham o último snapshot bom (16 boxes, 28/06 ~20:30 BRT). **Juliano optou por REFAZER a Capa** (não restaurar). A **Página 2** (id `e5767c40-...`, "Sobre Mim/Nossa História", 11 boxes) ficou intacta.
**Aprendizado:** dá pra recuperar layout de qualquer PoolPrintPage pelo AuditLog (after->pageConfig->boxes do último registro com boxes não-vazios) — mas writes diretos na prod são bloqueados pelo classifier (pedir autorização explícita).

## Pendências do Juliano (próxima sessão)
- Refazer a página **Capa**.
- Usar **🚫 Limpar realce** na caixa do rodapé pra tirar o fundo cinza atrás do "30" (`{validityDays}` veio com `<span background-color>` — realce manual/colado, não sistemático).
- Subir/posicionar o campo `{budgetCode}` que ficou fora da faixa do cabeçalho (selecionar pela lista 🗂️ Objetos → Layout → ajustar Y/A).

## Regra de sessão ativa
Nesta sessão o Juliano pediu **sempre perguntar antes de deploy** ([[feedback-perguntar-antes-deploy]]).
