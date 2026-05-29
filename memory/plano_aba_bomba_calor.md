---
name: plano_aba_bomba_calor
description: Plano CORRETO (sessao 215) pra reconstruir a aba Bomba de Calor como CLONE VISUAL identico da aba Solar no HeatingSimulatorModal. So os calculos mudam. Substitui plano_aba_trocador_calor (rejeitado).
metadata:
  type: project
---

# Plano: Aba Bomba de Calor = clone visual da aba Solar

## DIRETRIZ DO USUARIO (verbatim, manda em tudo)

> "trocador de calor e bomba de calor e a mesma coisa, apague trocador ou bomba de calor.
> eu quero que o visual botoes tudo seja IDENTICO a solar. a diferenca vai ser que pra
> bomba de calor trocador de calor tem uns calculos diferentes que o solar, mas de resto
> e pegar a aba solar e adaptar ela pra bomba de calor"

**Decodificado:**
1. Trocador e Bomba de Calor sao A MESMA COISA → existe UMA SO aba de aquecimento alternativo ("bomba"). A aba Trocador separada foi REJEITADA e o codigo morto dela ja foi removido.
2. A aba "bomba" tem que ser CLONE VISUAL FIEL da aba Solar (mesmo layout, botoes, datasheet A4, zoom, print).
3. SO os CALCULOS mudam. De resto: "pegar a aba solar e adaptar".

> ⚠️ O arquivo irmao [plano_aba_trocador_calor.md](plano_aba_trocador_calor.md) esta SUPERSEDED — descrevia
> uma aba Trocador separada com layout proprio. NAO seguir aquele. Seguir ESTE.

## Estado atual (inicio sessao 215)

- **Versao alinhada: v1.12.94** (local == prod, confirmado via `/api/health`).
- **Nada foi escrito em codigo ainda** — so reconhecimento + design completo (este doc).
- A aba bomba que esta **VIVA em prod** e a JSX inline antiga (estilo NAO-datasheet) dentro do
  `HeatingSimulatorModal.tsx`. Ela e a referencia AUTORITATIVA dos DADOS de bomba de calor,
  mas NAO do visual desejado.
- Existe uma `BombaCalorTab` MORTA (byte-copy do SolarTab com assinatura/props SOLAR) que precisa
  ser SUBSTITUIDA pela versao nova.

## Arquivo central

`frontend/src/components/pool/HeatingSimulatorModal.tsx` (~6100 linhas, **CRLF**, single-file).
`type TabKey = "solar" | "bomba" | "comparativo"`. SolarTab (function ~linha 1462) e o padrao-ouro
do datasheet A4. Modulo Piscina **NAO** tem preview local — verificacao so em prod apos deploy.

### Mapa de linhas (do estado v1.12.94, reconferir antes de cortar)

| Trecho | Linhas | Acao |
|---|---|---|
| JSX inline bomba antiga (`{activeTab === "bomba" && (`) | 805–1381 | REMOVER no wire (#17), trocar por `<BombaCalorTab .../>` |
| Invocacao do `<SolarTab/>` no parent | 1383–1418 | Referencia de como o parent passa props |
| Comentario `// ===== Aba Bomba de Calor ... =====` | 3258 | MANTER |
| `function BombaCalorTab({` (morta) … fecha `}` | 3259–5053 | SUBSTITUIR pelo corpo novo |
| `function KV` | 5056 | nao tocar |

**Splice CRLF-safe (Node):** `lines.slice(0,3258).concat(newFuncLines).concat(lines.slice(5053))`
unido com o EOL detectado (CRLF). Escrever a funcao nova num temp (`__bomba_new.txt`), splicar, conferir.

## Escopo MVP (decidido)

### MANTER (clonar do Solar, ja portado no temp file `__bomba_wip.txt`)
- Toolbar: **zoom + Recalcular + Imprimir** (DROP os botoes de salvar/limpar override do solar)
- Datasheet A4: header titulo → **"Dimensionamento para Bomba de Calor"** / subtitulo "Aquecimento para piscinas"
- Cliente/Obra
- Dimensoes (read-only: `const dimManual = false`)
- Configuracao (editavel: `const cfgManual = true`) — capa, vento, cidade, uf, temp inicial,
  temp final, tipo piscina, tipo construcao, **amarrados aos setters do parent**
- HeaderImageBlock (reusa `solarHeaderImage`)
- Footer: Observacoes + card NBR
- Bloco `<style>` de print (verbatim `bomba-*` do temp file)

### DROP (especifico de fisica solar, nao se aplica)
- Linhas de config Orientacao/Inclinacao
- Os 2 dropdowns de Modo (AUTO/MANUAL)
- Tubulacao, bomba de circulacao (trocador-bomba-candidates / trocador-pipe)
- AutoSelectModal, SolarRulesModal, thermalReport, popover de tarifa, painel debug, SolarChart
- Salvar/limpar override solar, logica de imagem-do-produto-vinda-do-coletor
- `selectedMonthIdx`/`setSelectedMonthIdx` (NAO passar pra bomba → evita erro TS de prop nao usada)

> Nota: nada disso e regressao — a aba bomba inline antiga so tinha
> Dimensionamento / Equipamento / Consumo. Tubulacao/bomba/chart nunca existiram nela.

## Assinatura nova da funcao (finalizada)

Props (com tipos-chave):
```
budget, report (HeatingReport | null), loading, recomputing,
candidates, changeEquipment, changingEquipment,
uf, cidade, setUf, setCidade, availableUfs, availableCities,
capaTermica, setCapaTermica, vento, setVento,
tempAguaDesejada, setTempAguaDesejada,
tempAguaInicial (number | ""), setTempAguaInicial,
tipoPiscina, setTipoPiscina, tipoConstrucao, setTipoConstrucao,
onRecompute (() => void | Promise<void>),
headerImage, headerImageUploading, onUploadHeaderImage, onRemoveHeaderImage
```
Corpo: `const cfgManual = true; const dimManual = false;`
`const tempIniDisplay = typeof tempAguaInicial === "number" ? tempAguaInicial : 22;`
`manualZoom` localStorage key = `"bomba:manualZoom"`. `createPdfClone`/`printViaClone` com ids
`bomba-pdf-area` / `bomba-pdf-clone`.

### Secoes que o corpo renderiza
1. Toolbar (Recalcular `onClick={()=>onRecompute()}`)
2. Datasheet A4 (titulo "Dimensionamento para Bomba de Calor")
3. Cliente/Obra
4. Dimensoes (StatEditable read-only + SelectCard tipo piscina/construcao + BigHighlightInput Area/Volume read-only)
5. Configuracao (ConfigFieldBig capa/vento/cidade/estado + BigHighlightInput temp inicial/final, cfgManual=true)
6. HeaderImageBlock
7. **Dimensionamento** (banner): grid-12 → esq col-5 Kpi (qtotalMaxKw kW / calorNecessarioKcalH / calorNecessarioBtuH / MESES[qtotalMonthCritical]); dir col-7 card Equipamento (`<select>` ordenado de candidates + EquipmentQuantityInput em print:hidden + badges fromOverride/fromItemCellRef/quantity + StatCompact specs + 3 mini-cards COP copMax/copAt50Air26/copAt50Air15 + loadRatio/isAdequate + timeToHeat). Abaixo: tabela "Perda termica mensal" (Temp ar / Umidade / Qtotal kW, highlight em qtotalMonthCritical)
8. **Simulacao** (banner "Simulacao de consumo mensal"): grid-12 → esq col-7 4× BigStatLegacy (annualKwh cyan / custo medio mensal=annualCostBRLCents÷12 orange / custo anual orange / aquec. inicial=initialHeatingCostBRLCents emerald); dir col-5 tabela mensal (Mes / kWh / R$ de monthlyConsumption + linha total). Guard em `report.monthlyConsumption?.length`
9. Footer (Observacoes + card NBR)
10. `<style>` print bomba-*
- Tudo dentro de `report ? (<>…</>) : (placeholder)`. Equipamento `<select>` deve incluir o
  `eq.productId` atual como option mesmo se nao estiver em `candidates`.

## Wire do parent (#17) — trocar JSX inline 805–1381 por:

```
<BombaCalorTab report={report} loading={loading} recomputing={saving}
  candidates={candidates} changeEquipment={changeEquipment} changingEquipment={changingEquipment}
  uf={uf} cidade={cidade} setUf={setUf} setCidade={setCidade}
  availableUfs={cities} availableCities={availableCities}
  capaTermica={capaTermica} setCapaTermica={setCapaTermica}
  vento={vento} setVento={setVento}
  tempAguaDesejada={tempAguaDesejada} setTempAguaDesejada={setTempAguaDesejada}
  tempAguaInicial={tempAguaInicial} setTempAguaInicial={setTempAguaInicial}
  tipoPiscina={tipoPiscina} setTipoPiscina={setTipoPiscina}
  tipoConstrucao={tipoConstrucao} setTipoConstrucao={setTipoConstrucao}
  onRecompute={handleSaveAndRecompute}
  headerImage={solarHeaderImage} headerImageUploading={headerImageUploading}
  onUploadHeaderImage={uploadSolarHeaderImage} onRemoveHeaderImage={removeSolarHeaderImage}
  budget={budget} />
```
`handleSaveAndRecompute()` (linha ~657) e no-arg: monta `newEnv` do state do parent, faz PUT
`/pool-budgets/:id` + POST `/pool-budgets/:id/heating-report/recompute`, setReport.
`changeEquipment(productId, qty=1)` (~543): PUT `/pool-budgets/:id/heating-report/equipment`.

## Helpers module-level (props travadas — reusar, NAO recriar)
`SectionLabel`, `DataRow`, `Stat`, `StatEditable({label,value,onChange,unit,manual?})`,
`StatCompact`, `ConfigRow`, `Kpi({label,value,unit,accent?})`, `HeaderImageBlock`,
`Section`, `BigStatLegacy({label,value,unit,emphasis:"cyan"|"orange"|"emerald"})`, `SmallStat`,
`fmtBRL`, `EquipmentQuantityInput({productId,currentQty,onChangeQty,disabled})` (debounce 600ms),
`EquipmentCandidateRow`, `ExtraImpactCard`, `Pill`, `KV`,
`SelectCard({label,value,options,onChange,readOnly?,fullWidth?})` (⚠ prop e `readOnly`, NAO `manual`),
`ConfigFieldBig({label,children,manual?})`, `BigHighlight`,
`BigHighlightInput({label,value,onChange,unit,min,max,manual?})` (disabled={!manual}, tem print span).

## Temp file de referencia
`C:\Users\Juliano\sistema-terceirizacao\__bomba_wip.txt` (1789 linhas, byte-copy do solar com
renames `bomba-*`). Usar como SHELL visual verbatim. Trechos: toolbar 476–537; A4 wrapper+header
542–574; Cliente/Obra 582–588; Dimensoes 595–636; Configuracao 640–726 (contem Orientacao/Inclinacao
a DROPAR); image block 730–760; footer 1505–1554; placeholder 1556–1559; print `<style>` 1635–1786;
`createPdfClone`/`printViaClone` 397–458. **DELETAR este temp file ao terminar.**

## HeatingReport (camada de dados — campos usados)
`cityResolved; inputs; monthlyHeatLoss[]{monthIndex,tempAr,humidity,qsKw,qsExtraKw,qsExtrasKw,qtotalKw};
qtotalMaxKw; qtotalAvgKw; qtotalMonthCritical; calorNecessarioKcalH; calorNecessarioBtuH;
selectedEquipment{productId,modelName,kcalHNominal?,btuH?,kwNominal?,consumoMaxW?,consumoMedioW?,
ratedInputPowerKW?,copMax?,copAt50Air26?,copAt50Air15?,copNominal?,copAt50Capacity?,loadRatio,
isAdequate,quantity,fromItemCellRef?,fromOverride?}; timeToHeatHours?; degreesPerHour?;
timeToHeatInfeasible?; copEstimated?; monthlyConsumption[]{monthIndex,monthName,kwhConsumido,
custoBRLCents}; annualKwh?; annualCostBRLCents?; initialHeatingCostBRLCents?; extrasDetected?`.

## Passos de execucao (ordem)
1. REGRA #0: reconferir `version.json` == `/api/health` (esperado v1.12.94).
2. Reconferir linhas 3258–5053 (podem ter mudado).
3. Escrever a funcao nova em `__bomba_new.txt`.
4. Splicar via Node CRLF-safe nas linhas 3259–5053.
5. Wire do parent (#17): remover inline 805–1381, inserir `<BombaCalorTab/>`.
6. Deletar `__bomba_wip.txt` (e `__bomba_new.txt`).
7. `cd frontend && npx tsc --noEmit` (zerar erros).
8. Atualizar CURRENT_TASK.md (REGRA #8).
9. **PERGUNTAR antes de deploy** (regra desta sessao). Deploy = `bash scripts/deploy-remote.sh`,
   validar `/api/health`.

## Regras de processo (NAO violar)
- REGRA #0: nunca editar com local ≠ prod (hook bloqueia).
- Modulo Pool: sem preview; so valida em prod pos-deploy.
- Sempre PERGUNTAR antes de deploy nesta sessao.
- REGRA #9: seguir padroes do codebase, sem hardcode/bandagem paralela.
- Salvar progresso incremental — nao confiar que a sessao dura.

## Referencias
- [sistema_impressao_pdf_simulador.md](sistema_impressao_pdf_simulador.md) — sistema de print (printViaClone)
- [thermal_demand_service.md](thermal_demand_service.md) — motor de demanda termica
- [modelo_consumo_bomba_solar.md](modelo_consumo_bomba_solar.md) — modelo de consumo eletrico
- [frontend/src/components/pool/HeatingSimulatorModal.tsx](../frontend/src/components/pool/HeatingSimulatorModal.tsx)
