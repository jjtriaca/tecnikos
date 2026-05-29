# TAREFA ATUAL

## Prod: v1.12.95 | Local: v1.12.95 + mudancas NAO deployadas (sessao 215)

## EM ANDAMENTO (sessao 215): Aba Bomba de Calor = clone visual da Solar + auto-selecao configuravel
Diretriz: Trocador = Bomba (UMA aba), clone visual FIEL da Solar (datasheet A4, zoom, print). So calculos mudam.
Escolha da bomba de calor: auto-selecao CONFIGURAVEL (tela ✨), espelhando o coletor solar. Sem hardcode.
Bomba de agua/circulacao, tubulacao, MCA: CONGELADO (ficam como estao).

### Progresso (3 partes):
- ✅ **A — Cadastro** (tsc OK): vazao minima + maxima no produto Bomba de Calor (technicalSpecs
     vazaoMinM3h/vazaoMaxM3h). So dados; selecao da bomba de circulacao por curva usando isso = FUTURO.
     `frontend/src/app/(dashboard)/products/page.tsx` (card 🔥 Aquecimento, gated /bomba de calor/i).
- ✅ **B — Backend auto-selecao** (backend tsc OK): `getHeatingRule`/`setHeatingRule`
     (Company.systemConfig.pool.heatingRule) + `fetchBombaCalorCandidates` aplica filterPoolType/
     filterDescription (SEM regra = fallback hardcode atual, nao quebra). Capacidade kcal/h segue no
     selectEquipment. Endpoints `GET/POST /pool-budgets/heating/rule`.
     `backend/src/pool-budget/heating-budget.service.ts` + `pool-budget.controller.ts`.
- ⏳ **C — Aba visual (FALTA, o grosso)**: `BombaCalorTab` (HeatingSimulatorModal.tsx ~3259) hoje e CLONE
     SOLAR (titulo "Coletor Solar", coletores/baterias, zoom key "solar:manualZoom", props solares,
     report: SolarReport). Adaptar pra bomba: Dimensionamento kW/kcal/BTU; Equipamento + COP + ✨ apontando
     pra regra de B (carregar/salvar GET/POST /heating/rule + popular vars no AutoSelectModal); Simulacao
     consumo. Titulo -> "Dimensionamento para Bomba de Calor"; zoom key -> "bomba:manualZoom".
     Wire no parent: remover inline (~805) e inserir <BombaCalorTab/> com props de bomba. Print herda solar.
     Fonte da logica de bomba pronta = a aba INLINE antiga (805) tem COP/kcal/BTU/equipamento/consumo.

### Fechar: `tsc` + `next build` + **PERGUNTAR antes de deploy** (deploy bumpa pra v1.12.96).

## Notas
- Aba Trocador REMOVIDA na v1.12.95 (deploy feito). HEAD v1.12.94 tinha 4 abas (solar|bomba|trocador|comparativo).
- Plano (parcialmente desatualizado): [memory/plano_aba_bomba_calor.md](memory/plano_aba_bomba_calor.md)
- Sessao 214 (fechada): 19 releases. [memory/sessao_214_summary.md](memory/sessao_214_summary.md)

## Outros pendentes
- Remover painel debug violeta apos validacao final.
- Aguardando Solis: comportamento com 7+ baterias.
- Roadmap: usar vazao min/max pra selecionar bomba de circulacao por curva; defaults tubulacao configuraveis.
