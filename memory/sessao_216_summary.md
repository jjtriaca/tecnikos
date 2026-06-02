---
name: sessao_216_summary
description: Sessao 216 (01-02/06/2026) — Sistema de Borda Infinita FASE 1 (do ZERO) + Central de Avisos. v1.12.99 -> v1.13.07. Ler pra retomar a frente.
metadata:
  type: project
  date: 2026-06-02
---

# Sessao 216 (01-02/06/2026) — Sistema de Borda Infinita FASE 1 + Central de Avisos

Frente inteira construida do zero: do estudo de engenharia ate a tela em prod. **v1.12.99 -> v1.13.07** (varios deploys patch).
Modulo Piscina = deploy direto (sem preview — ver feedback_preview_pool_budget.md). Tudo type-clean + verificado numericamente.

## O QUE FOI ENTREGUE (FASE 1 — dimensionar a borda no orcamento)
Sistema multi-linha no orcamento de piscina (tela de EDICAO `quotes/pool/new?edit=`), estilo "Dimensoes" — INLINE,
nao popup. Linhas MASTER (cisterna) + SLAVE (borda). Calcula ao vivo via `POST /pool-budgets/borda-infinita/simulate`.

### Estudos de engenharia (memory/)
- `study_borda_infinita_reservatorio.md` — volume do master por vasos comunicantes (`V ≈ area×0,10m + banhistas×0,075`, ~5-10% do volume da piscina).
- `study_borda_infinita_tubulacao_gravidade.md` — tubo de gravidade = **Manning** (tubo parcialmente cheio), NAO Darcy do solar.
  + secao 8 (RALOS: grelha escoa MENOS que tubo aberto — vertedor/orificio) + secao 9 (SURGE: drenagem = recirculacao × fator).

### Backend (`backend/src/pool-budget/`)
- `gravity-flow.service.ts` — Manning tubo parcial + `sizeGravityPipe` (escolhe DN comercial). VERIFICADO (meio-cheio=0,5×cheio; 8m->DN150).
- `reservoir-volume.service.ts` — `computeMasterVolume`: recomendado/min/% + status OK/BAIXO/ALTO (a bomba puxa direto do master).
- `borda-infinita.service.ts` — ORQUESTRADOR: compoe os dois + ralos + surge + multitubo + totais. Constantes RALO + SURGE_FACTOR_DEFAULT=2.
- `dto/borda-infinita-simulate.dto.ts` + endpoint registrado no module. e2e via curl (Host: sls.localhost) confirmado.

### Frontend
- `components/pool/BordaInfinitaSection.tsx` — SECAO INLINE COLAPSAVEL, **linha estilo Excel** (celulas+gridlines, `flex-nowrap`+`overflow-x-auto` -> rola, nao quebra), "?" HelpHint por campo, dropdowns (Tipo master / Captacao / Superficie). CONTROLADO (lines+onChange -> form). Salvo em `poolDimensions.bordaInfinita[]` (JSON livre, sem model Prisma).
- `components/pool/CentralAvisos.tsx` — painel system-wide no TOPO e RODAPE da pagina; agrega erros/avisos de Geral/Dimensoes/Aquecimento/Borda; 🔴 erro / 🟡 aviso; clica->pula pra secao; CONFIRMA no salvar se ha erro. `validatePage()` em new/page.tsx (faixas dos campos). REUSAVEL.

## DECISOES DE ENGENHARIA TRAVADAS
- Captacao do slave (3 modos): reservatorio c/ volume · canaleta c/ ralos · **direto no master** (sem tubo).
- Caimento do tubo = **desnivel / comprimento**; **curvas roubam caimento** (L_eff = L + curvas×30×D).
- **Ralo (grelha) escoa MENOS que a boca de um tubo aberto** do mesmo diametro: Q_ralo = min(vertedor, orificio)×0,8. Ø100mm ≈ 7,5 m³/h. nº ralos = teto(drenagem ÷ Q_ralo).
- **SURGE (ondas/criancas):** a DRENAGEM (ralos+tubo) eh dimensionada pro PICO = transbordo × fator (default 2×; norma min 1,25×). O filme estavel (6mm=2,593 m³/h/m) NAO dimensiona a drenagem. O VOLUME do surge eh absorvido pelo MASTER.
- **Multiplos tubos:** N tubos em paralelo, cada um leva drenagem ÷ N -> DN menor (ex.: 1×DN200 vira 2×DN150).
- **Master cisterna pronta:** informa o VOLUME -> valida vs recomendado (✓ OK verde / ⚠ insuficiente vermelho). Ou complementa com cisterna se o reservatorio nao atinge.
- **Altura de queda em CM** (digitar 10 = 10cm; guardado em metros). >140cm avisa (evita 10m por engano).
- Resultado do tubo mostra **✓ suficiente / (folgado, da pra reduzir) / ⚠ insuficiente** (intuicao pro operador).

## PENDENCIAS (proxima sessao)
- 🔴 **FASE 2 (RECOMENDADO ASAP):** religar a borda no **Simulador de Aquecimento**. HOJE o aquecimento esta SEM efeito de borda
  (UI escalar antiga removida; a nova ainda nao alimenta o heating). Numeros prontos no report: `volumeTermicoExtraM3`, `areaEvaporacaoExtraM2`.
  Entry points: `heating-budget.service.ts` (aggregateExtrasFromItems / extractInputs), `heating.service.ts` (computeMonthlyHeatLoss), `heating-constants.ts` (BORDA_INFINITA). Campos legados `environmentParams.bordaInfinita*` ainda no submit (aposentar).
- 🟡 **Auditoria de responsividade MOBILE de TODO o sistema** (regra ja no CLAUDE.md "Responsividade / Mobile"; spawn task criado).
- 🟡 Central de Avisos eh reusavel — levar pra outros cadastros + expandir regras de faixa.

## Sessoes anteriores
- Sessao 215 (v1.12.94-98): Aba Bomba de Calor (datasheet clone da Solar). Sessao 214: consumo bomba solar calibrado + PDF.
