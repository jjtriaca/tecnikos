# TAREFA ATUAL

## Prod: v1.12.96 | Local: A+B+C prontos (C compila + `next build` OK). C NAO deployada.

## SESSAO 215: Aba Bomba de Calor = clone visual da Solar + auto-selecao configuravel
- ✅ **A — Cadastro** vazao min/max no produto Bomba de Calor (deployado v1.12.96).
- ✅ **B — Backend auto-selecao** heatingRule + GET/POST /pool-budgets/heating/rule;
     fetchBombaCalorCandidates aplica filterPoolType/filterDescription (sem regra = fallback). (deployado v1.12.96)
- ✅ **C — Aba visual (CODIGO PRONTO — tsc + next build OK — aguardando deploy)**:
     `BombaCalorTab` reescrita como datasheet de BOMBA (HeatingSimulatorModal.tsx ~3259, ~554 linhas):
     toolbar (zoom + Recalcular + Imprimir) + folha A4 "Dimensionamento para Bomba de Calor" + Cliente/Obra +
     Dimensoes (read-only) + Configuracao (capa/vento/cidade/uf/temp inicial/final/tipo piscina/construcao) +
     HeaderImageBlock + Dimensionamento (KPIs calor kcal/h · kW · BTU + card Equipamento: select de candidates +
     COP 3 condicoes + ✨ AutoSelectModal da heatingRule + tabela perda termica mensal) + Simulacao (consumo
     anual/medio/inicial + tabela mensal) + footer NBR + print `bomba-pdf-*` (reusado verbatim, 1 pagina).
     Wire: parent passa report(HeatingReport)/candidates/changeEquipment/changingEquipment/config setters/
     headerImage solar/heatingRule/saveHeatingRule; inline antiga (577 linhas) REMOVIDA; zoom key "bomba:manualZoom".
     `saveHeatingRule`: POST /heating/rule + reload candidatos + recompute report (reflete a regra na selecao).

## PROXIMO: **PERGUNTAR deploy** -> v1.12.97. Pool SEM preview: validar visual EM PROD pos-deploy.
### Validar em prod (aba Bomba de Calor do Simulador):
- Datasheet A4 aparece (titulo "Dimensionamento para Bomba de Calor"); Recalcular; trocar equipamento (dropdown);
  ✨ abre regra de auto-selecao da bomba; Imprimir gera 1 pagina; numeros (calor kcal/h, COP, consumo) batem.

## Notas
- Tholz X23 validado: kcalHNominal = cap Ar26/Turbo (BTU÷3,9683); copMax/copAt50Air26/copAt50Air15 batem com datasheet.
  WINTER_CAPACITY_FACTOR=0.85 (datasheet sugere ~0.71 Ar15/Ar26; calibrado p/ TAB006 — NAO mexer sem analise).
- Plano: [memory/plano_aba_bomba_calor.md](memory/plano_aba_bomba_calor.md). Sessao 214: [memory/sessao_214_summary.md](memory/sessao_214_summary.md)

## Outros pendentes
- Remover painel debug violeta apos validacao final. Aguardando Solis (7+ baterias).
- Roadmap: usar vazao min/max p/ selecionar bomba de circulacao por curva; defaults tubulacao configuraveis.
