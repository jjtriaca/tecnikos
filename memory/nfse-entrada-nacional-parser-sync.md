# NFS-e ENTRADA (recebidas / serviços tomados) — formato Nacional + robustez do sync

**v1.13.27 (08/06/2026).** Dois bugs corrigidos no módulo `nfse-entrada`. Ler ANTES de mexer em
importação/sincronização de NFS-e recebidas.

## 1) Leitor de XML manual não lia o formato NACIONAL (importava R$ 0)
- **Sintoma:** "Importar XML" de uma NFS-e no padrão Nacional (DPS) criava o registro mas com
  **valor = R$ 0** (e sem chave, descrição, impostos). Caso real: NF 740 CIBE CONCRETOS (tomador SLS),
  R$ 4.970 → entrou R$ 0 → lançamento financeiro nasceu zerado.
- **Causa:** `nfse-entrada-parser.service.ts > parseNacional` lia tudo de `serv.*` (estrutura errada).
  No layout nacional real (`<NFSe xmlns=sped.fazenda>` + `<DPS><infDPS>`), os campos ficam em:
  - **valor do serviço:** `infDPS.valores.vServPrest.vServ` (NÃO em `serv`)
  - **totais da nota:** `infNFSe.valores` (vBC, pAliqAplic, vISSQN, vLiq)
  - **códigos do serviço:** `serv.cServ.{cTribNac,xDescServ,cNBS}` (dentro de `cServ`)
  - **tributos:** `infDPS.valores.trib.{tribMun, tribFed.piscofins}`
  - **obra:** `serv.obra.cObra` ; **município:** `serv.locPrest.cLocPrestacao`
- **Fix:** parseNacional remapeado pros caminhos certos (nfseValores + dpsValores + cServ + trib).
  Testado no XML da CIBE: extrai R$ 4.970, base, ISS 198.80, PIS/COFINS, descrição, cTribNac, obra.
- **GOTCHA pré-existente (não corrigido):** `parseTagValue:true` no XMLParser transforma string que
  "parece número" em número → `cTribNac` "070202" vira 70202 (perde zero à esquerda). Cosmético; se
  for problema fiscal, tratar campos de código como string.

## 2) Sync "Baixar NFS-e" era frágil (cursor de versão prendia notas)
- **Sintoma:** apagar uma nota e re-sincronizar NÃO a trazia de volta. Notas puladas/erradas ficavam presas.
- **Causa:** `syncFromFocus` começava de `config.lastNfseSyncVersion` (cursor) e só pegava versão MAIOR.
  Focus pagina por VERSÃO, não por data. Nota abaixo do cursor = invisível pro sync. (Ex.: NF 740 era
  versão 109, cursor estava em 112 → nunca baixava.)
- **Fix:** `currentVersion = 0` SEMPRE (reconciliação completa). Varre a lista inteira, dedup por
  `chaveNfse` (pula existentes), importa o que falta. `lastNfseSyncVersion` segue gravado (telemetria),
  mas não trava o início. Pós-deploy recuperou **5 notas presas** (60→65, paridade com Focus).
- **Filtro por data (`dateFrom`) preservado:** o skip por data acontece ANTES do dedup/import (barato),
  então escopo por mês continua leve — só importa o período pedido, mesmo varrendo a lista.
- **Escala:** lista completa + dedup por nota a cada sync. OK pra volume atual (65). Se crescer muito,
  otimizar dedup pra 1 query (carregar Set de chaves) em vez de N findFirst.

## 3) Pendências / gotchas conhecidos
- **Focus sync NÃO cria lançamento financeiro** (A Pagar) — só cria o registro fiscal da entrada.
  O **upload manual** cria os dois (entrada + financeiro). Decidir UX: sync deveria oferecer "lançar financeiro"?
- **Upload manual NÃO deduplica por chaveNfse** → re-subir o mesmo XML cria DUPLICATA (a 740 já veio pela
  Focus; re-upload manual faria 2). Adicionar dedup por chave no `uploadXml` é melhoria pendente.
- Técnica de teste local do parser: standalone node + `fast-xml-parser` (mesma config) contra o XML real;
  testar endpoints autenticados via JWT mintado sem sessionId (ver nfse-nacional-cenario-b.md).
</content>
