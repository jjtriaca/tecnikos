# TAREFA ATUAL

## Prod: v1.12.97 (alinhado local == prod). Aba Bomba de Calor (A+B+C) DEPLOYADA — validar visual em prod.

## SESSAO 215: Aba Bomba de Calor = clone visual da Solar + auto-selecao configuravel — CONCLUIDA (deploy feito)
- ✅ **A** vazao min/max no cadastro Bomba de Calor (technicalSpecs vazaoMinM3h/vazaoMaxM3h).
- ✅ **B** auto-selecao configuravel: heatingRule + GET/POST /pool-budgets/heating/rule;
     fetchBombaCalorCandidates aplica filterPoolType/filterDescription (sem regra = fallback hardcode).
- ✅ **C** `BombaCalorTab` reescrita como datasheet A4 de bomba (HeatingSimulatorModal.tsx ~3259, ~554 linhas):
     toolbar (zoom+Recalcular+Imprimir) + A4 "Dimensionamento para Bomba de Calor" + Cliente/Obra +
     Dimensoes (read-only) + Configuracao (capa/vento/cidade/uf/temp inicial-final/tipo piscina-construcao) +
     HeaderImageBlock + Dimensionamento (calor kcal/h·kW·BTU + Equipamento select+COP 3 cond.+ ✨ regra +
     tabela perda termica) + Simulacao consumo (anual/medio/inicial + tabela mensal) + footer NBR +
     print bomba-pdf-* (1 pagina). zoom key "bomba:manualZoom". saveHeatingRule recarrega candidatos + recomputa.

## VALIDAR EM PROD (Pool sem preview) — aba Bomba de Calor do Simulador de Aquecimento:
1. Datasheet A4 aparece (titulo "Dimensionamento para Bomba de Calor").
2. Editar UF/capa/vento/temp -> Recalcular atualiza.
3. Trocar equipamento pelo dropdown (▼) + qtd.
4. ✨ abre AutoSelectModal -> configurar regra da bomba de calor (filtro tipo/descricao) -> salva e re-seleciona.
5. Imprimir -> 1 pagina A4 (header azul, sem 2a pagina branca).
6. Numeros batem (calor kcal/h, COP, consumo mensal/anual).
> Se algo visual/numero estiver errado, ajustar e redeployar (fluxo normal do Pool).

## Notas
- Tholz X23 validado: kcalHNominal = cap Ar26/Turbo (BTU÷3,9683); copMax/copAt50Air26/copAt50Air15 batem.
  WINTER_CAPACITY_FACTOR=0.85 (datasheet sugere ~0.71 Ar15/Ar26; calibrado p/ TAB006 — NAO mexer sem analise).
- Plano (concluido): [memory/plano_aba_bomba_calor.md](memory/plano_aba_bomba_calor.md)

## Outros pendentes
- Conferir valores Tholz JA cadastrados no SLS vs datasheet (kcalHNominal/COP/vazao).
- Remover painel debug violeta apos validacao final. Aguardando Solis (7+ baterias).
- Roadmap: usar vazao min/max p/ selecionar bomba de circulacao por curva; defaults tubulacao configuraveis.
