# TAREFA ATUAL

## Versao em prod: v1.12.95 (alinhada local == prod)

## EM ANDAMENTO (sessao 215): Aba Bomba de Calor = clone visual da aba Solar
Diretriz: Trocador = Bomba -> UMA aba, CLONE VISUAL FIEL da Solar (datasheet A4, zoom, print). SO os calculos mudam.

### O que a sessao anterior (crash) deixou — confirmado em prod v1.12.95:
- OK  Aba **Trocador REMOVIDA** (TabKey/botao/invocacao) — merge Trocador->Bomba.
- ATENCAO  `function BombaCalorTab` (~3259) = **clone do SolarTab**; so renomeou print ids (solar-pdf->bomba-pdf).
  Ainda mostra conteudo SOLAR (titulo "Dimensionamento para Coletor Solar", coletores/baterias),
  zoom key ainda "solar:manualZoom". E **codigo morto** (ninguem invoca `<BombaCalorTab/>`).
- FALTA  Wire NAO feito: aba "bomba" viva = JSX **inline antiga** (~805), intacta e funcional.
- FALTA  Conteudo/calculos de bomba: **0% adaptado**.

### PROXIMO PASSO (o grosso que falta):
1. Encher `BombaCalorTab` com conteudo de BOMBA (COP/BTU/kcal/equipamento) — fonte = aba inline atual.
2. Trocar titulo p/ "Dimensionamento para Bomba de Calor" + zoom key "bomba:manualZoom".
3. Wire: trocar inline (~805) por `<BombaCalorTab/>` e ajustar props.
4. `npx tsc --noEmit` + `next build` + **PERGUNTAR antes de deploy**.

Plano: [memory/plano_aba_bomba_calor.md](memory/plano_aba_bomba_calor.md)
(ATENCAO: o plano dizia "nada escrito ainda" e "trocador ja removido" — AMBOS desatualizados; ver acima.)

## Outros pendentes
- Remover painel debug violeta apos validacao final dos numeros.
- Aguardando Solis: comportamento com 7+ baterias (3 ramos paralelos).
- Roadmap: defaults de tubulacao configuraveis em Config > Piscina; autoSelectRule.followProductLine.

## Sessao 214 (fechada): 19 releases v1.12.75 -> v1.12.94. Ver memory/sessao_214_summary.md.
