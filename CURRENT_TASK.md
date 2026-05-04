# TAREFA ATUAL

## Versao: v1.10.29 (em prod)
## Ultima sessao: 185 (04/05/2026)

## v1.10.29 — Fix Layout Municipal: omitir regime_especial_tributacao quando "0"
- **Erro persistente apos v1.10.28**: trocar nfseLayout pra MUNICIPAL (via SQL) destravou o conversor bugado do Focus (XML agora gerado completo). Mas erro novo apareceu: `Element 'RegimeEspecialTributacao': [facet 'pattern'] The value '0' is not accepted by the pattern '1|2|3|4|5|6'`.
- **Causa**: XSD ABRASF do Layout Municipal so aceita valores 1-6 pra RegimeEspecialTributacao (Microempresa Municipal, Estimativa, Sociedade Profissionais, Cooperativa, MEI, ME/EPP). Valor "0" (Nenhum) NAO existe nesse XSD — eh especifico do Layout Nacional.
- **Diferenca relevante** entre Layouts:
  - NACIONAL: `regime_especial_tributacao` eh OBRIGATORIO (enviar sempre, mesmo 0)
  - MUNICIPAL: campo opcional, MAS valor "0" rejeitado pelo XSD ABRASF (omitir quando 0)
- **Fix**: linha ~838 do nfse-emission.service.ts, branch Layout Municipal — spread condicional omitindo regime quando "0" ou vazio.
- **Estado SLS**: nfseLayout mudou de NACIONAL para MUNICIPAL (workaround pelo conversor Nacional→ABRASF do Focus estar bugado pra Primavera do Leste apos Reforma Tributaria). IM 9648219 mantida.

## v1.10.28 — REVERT v1.10.27 — voltar ao contrato oficial do Focus NFe
- **Descoberta apos consultar doc oficial Focus** (https://focusnfe.com.br/doc/#nfse-nacional_campos): meus fixes de v1.10.27 estavam VIOLANDO o contrato de entrada do Focus.
- **Doc oficial mostra**:
  1. `data_emissao` deve ser ISO 8601 com horario: `"2024-05-07T07:34:56-0300"` (xs:dateTime)
  2. `regime_especial_tributacao` eh OBRIGATORIO — enviado mesmo com valor 0 (Nenhum)
- **Revert**: 
  - linha ~720: `brazilToday()` → `brazilNow()` (Layout Nacional)
  - linha ~770: spread condicional → `regime_especial_tributacao: regimeEspecial` sempre enviado
  - linha ~830: `brazilToday()` → `brazilNow()` (Layout Municipal, manter consistencia)
  - `focus-nfe.provider.ts`: `regime_especial_tributacao` voltou a ser required (sem `?`)
- **Por que cometi o erro em v1.10.27**: vi erro de prefeitura "DataEmissao not xs:date" e inferi (errado) que devia mandar xs:date pro Focus. Na verdade Focus exige xs:dateTime, e a CONVERSAO pra xs:date final eh responsabilidade do Focus. Violar contrato de entrada do Focus fez ele gerar XML incompleto (sem Prestador, Tomador, Valores).
- **Comentarios e memoria atualizados**: header de service e provider corrigidos com referencia a doc oficial. memory/nfse-lessons-learned.md reescrito com 5 gotchas baseados em doc oficial + 3 cenarios da Reforma Tributaria.
- **Reforma Tributaria** (Cenarios A/B/C): doc Focus explica 3 modos de adesao do municipio. Primavera do Leste/MT (5107040) provavelmente mudou de cenario entre 30/04 e 04/05, exigindo revisao das flags `habilita_nfse` / `habilita_nfsen` no painel Focus.

## v1.10.27 — Fix NFS-e Layout NACIONAL: DataEmissao xs:date + omitir RegimeEspecial=0
- **Erro persistia em prod** apos v1.10.26 (que so corrigiu Layout MUNICIPAL). SLS Obras esta configurado como `nfseLayout: NACIONAL` (codigoMunicipio 5107040 = Sinop/MT). Endpoint `/v2/nfsen` ainda gera XML com namespace ABRASF que a prefeitura valida estritamente.
- **Diagnostico via JSON do Focus** (`tk-00000000-5234f478`): user enviou o payload exato do painel Focus. Confirmou 2 problemas no nfsenPayload (linhas 718-727):
  1. `data_emissao: brazilNow()` -> `2026-05-04T18:03:26-03:00` (xs:dateTime). Sinop/MT valida como xs:date.
  2. `regime_especial_tributacao: 0` sendo enviado mesmo com valor 0 (sem regime). Focus gerava `<RegimeEspecialTributacao>0</...>` no XML que esta prefeitura rejeita ("This element is not expected").
- **Fix**: 
  - linha 719: `brazilNow()` -> `brazilToday()` (mesmo padrao da v1.10.26 mas no branch Nacional)
  - linha 727: `regime_especial_tributacao: regimeEspecial` -> spread condicional `...(regimeEspecial > 0 ? { regime_especial_tributacao: regimeEspecial } : {})`
  - `focus-nfe.provider.ts` FocusNfsenRequest: `regime_especial_tributacao` virou opcional
- **Diferenca chave** entre RPS 23 (CARUS, 30/04 AUTORIZADA) e RPS 24 (VITORIO, 04/05 ERROR): provavelmente prefeitura Sinop/MT atualizou XSD no intervalo. Mesma config NfseConfig em ambos.

## v1.10.26 — Fix NFS-e Layout Municipal: DataEmissao xs:date (nao xs:dateTime)
- **Erro em prod (SLS Obras)**: prefeitura rejeitou XML com `Element 'DataEmissao': '2026-05-04T17:50:48-03:00' is not a valid value of the atomic type 'xs:date'`. Outros 2 erros (CodigoMunicipio e RegimeEspecialTributacao em posicao errada) parecem ser cascata XSD — XSD validacao para no primeiro erro.
- **Causa**: `nfse-emission.service.ts:782` (Layout Municipal `/v2/nfse`) enviava `data_emissao: brazilNow()` que retorna `YYYY-MM-DDTHH:mm:ss-03:00` (xs:dateTime). Esta prefeitura valida estritamente como `xs:date` (so YYYY-MM-DD).
- **Fix**: `brazilNow()` -> `brazilToday()` na linha 782 (so Layout Municipal). Layout Nacional `/v2/nfsen` linha 719 mantem `brazilNow()` pois DPS aceita dateTime.
- **Risco**: outras prefeituras Layout Municipal que aceitavam dateTime continuam aceitando date (xs:date eh formato mais comum no ABRASF, raramente alguem rejeita).

## v1.10.25 — Extensao isMaster: bypass de cobranca/expiracao + SLS marcado como master
- **Contexto**: NFS-e import bloqueado pra SLS (`maxNfseImports = 0`). Add-on `+72 Import. NFS-e/mes` (id `8adf0806`) expirou em 16/04 (inicio do ciclo). Sistema nao tem auto-renew (gotcha 10: "Add-on NAO faz rollover").
- **Decisao** (opcao 2): SLS e o tenant dono do SaaS — nao paga pra si mesmo. Estendeu flag `Tenant.isMaster` (que ja existia, so pulava KYC) pra tambem pular crons de cobranca e expiracao. Esse plano ja estava documentado em `asaas.service.ts:88` ("Flag isMaster ja existe mas so pula KYC — poderia ser estendida pra pular cobranca tambem").
- **Mudancas**:
  - `asaas.service.ts:checkOverdueSubscriptions` (cron 07:00) — adiciona `tenant: { isMaster: false }` ao where, pra nao bloquear masters por inadimplencia
  - `asaas.service.ts:applyPendingDowngrades` (cron 00:30) — idem, masters nao sofrem downgrade automatico
  - `asaas.service.ts:expireAddOnPurchases` (cron 00:15) — `subscription: { tenant: { isMaster: false } }`, masters nao tem add-on revertido
- **Estado SLS em prod**: `Tenant.isMaster = true`, todos os limites (Tenant + Company `maxNfseImports/maxOsPerMonth/maxUsers/maxTechnicians/maxAiMessages`) setados pra 999999.

## v1.10.24 — Fix erro "Record to update not found" na confirmacao de import NFe
- **Erro**: Toast `Invalid prisma.sefazDocument.update() invocation: Record to update not found` ao clicar "Confirmar Importacao" (etapa 5/5).
- **Causa**: NfeImport `d8a8d37d` (L.J.TRIACCA, R$ 509,94, criado 14/04) tinha `sefazDocumentId = 4259617f` apontando pra SefazDocument inexistente (deletado em algum momento). Existia outro SefazDocument valido com a mesma `nfeKey` (id `0c7e0ff3`, nsu real do SEFAZ, status FETCHED, com `nfeImportId` correto). O `tx.sefazDocument.update({ where: { id: nfeImport.sefazDocumentId }})` falhava por record ausente, derrubando a transacao toda.
- **Fix**: `nfe.service.ts:818` — `update` -> `updateMany` (tolerante a record ausente). Tambem passou a sempre rodar a sincronizacao por `nfeKey` em paralelo com a sincronizacao por id, garantindo que qualquer SefazDocument com a mesma chave seja marcado como IMPORTED mesmo quando o forward-link da NfeImport esta dangling.
- Comportamento: import agora completa mesmo se o ref estiver quebrado; SefazDocument certo (mesmo nfeKey) sempre fica IMPORTED.

## v1.10.22 — NFS-e Nacional: bloco obra ANINHADO + UX unificada SERVICO/OBRA
- **Problema**: emissao com obra (RPS 21, FIN-00490 Spe Terraz) falhou com erro Focus local: `Element '{http://www.sped.fazenda.gov.br/nfse}end': This element is not expected.` — XSD validacao antes de chegar SEFAZ.
- **Causa**: interface `FocusNfsenRequest` enviava obra como campos flat (codigo_obra, logradouro_obra, cep_obra) — Focus NFsen Nacional espera **objeto aninhado**. Confirmado via doc Focus (Lavras/MG guide): `$.obra.codigo`, `$.obra.endereco.{logradouro, numero, complemento, bairro, codigo_municipio, uf, cep}`.
- **Fix backend**:
  - `focus-nfe.provider.ts`: substituido bloco flat por `obra: { codigo, art?, inscricao_imobiliaria?, codigo_cib?, endereco: { logradouro, numero, complemento, bairro, codigo_municipio, uf, cep } }`
  - `nfse-emission.service.ts`: payload monta `obra.endereco` usando `obra.ibgeCode` (cMun) e `obra.state` (UF) do cadastro.
- **Refatoracao UX (NfseEmissionModal)**:
  - **Removido toggle SERVICO/OBRA** — NFS-e Nacional sempre é "Servico"; obra é so um bloco anexado.
  - Service codes nao filtrados mais por `tipo` — lista unificada.
  - Bloco obra agora aparece automaticamente quando: (a) cTribNac selecionado começa com "07" (construcao civil — obrigatorio) OU (b) parceiro tem obras cadastradas (opcional).
  - Backend valida: cTribNac 07.xx sem obra → BadRequestException.
- **Backend lib**: removido `dto.tipoNota === 'OBRA'` como gate; obra carrega sempre que `dto.obraId` enviado.

## PENDENTE PROXIMA SESSAO

(nada urgente — auditoria SICREDI fechou 100% na sessao 182)

### 🟡 Melhorias UX possiveis (decididas como nao-prioritarias na sessao 181)
- **Filtro "Recebido em SICREDI"** poderia incluir AccountTransfer entrando, alem de FinancialEntry com cashAccountId=SICREDI. Hoje entries de cartao ficam em VT mesmo apos conciliacao (design v1.09.94 preserva ciclo da maquininha) — visualmente confuso pra quem espera ver "tudo que entrou no banco". User decidiu manter design atual; melhoria seria opcional.
- **Flag por PaymentInstrument**: "Apos conciliar, mover entry pra banco" (alternativa a manter em VT). Adia v1.10.13+.

### 🟡 Fluxos legados que ainda criam FinancialInstallment
- `finance.service.ts:981` (renegotiate com parcelas): continua criando FinancialInstallment legado. Migrar pro novo fluxo (entries filhas).
- `nfe.service.ts:791` (import NFe parcelada): idem.
- `collection.service.ts`: usa FinancialInstallment. Sem impacto imediato (zero CollectionRule ativa no tenant_sls), mas precisa adaptar se alguem ativar.

### 🟢 Entries parcelados "a vista" (installmentCount=1, sem impacto)
- FIN-00012, FIN-00344, FIN-00454 — nao precisam migrar urgente

---

## Sessao 181 — Multiplos descontos na conciliacao + UX tabelas (v1.10.07-1.10.11)

### v1.10.07 — Backend matchAsMultiple aceita mistura RECEIVABLE+PAYABLE
- **Caso de uso:** linha credito SICREDI R$ 115,86 = venda RECEIVABLE R$ 360 − N PAYABLE R$ 244,14 (taxa cartao + alugueis maquininha)
- `reconciliation.service.ts:matchAsMultiple` — antes rejeitava entry.type !== expectedType; agora valida `sumExp − sumOpp === lineAbs` (tol 1c)
- Entries do tipo OPOSTO (descontos) DEVEM estar PAID antes do match
- **Fix bug latente Royalle:** banco recebia apenas `pendingTotal` (PENDING que viraram PAID); entries PAID em outra conta nao incrementavam banco. Agora `banco += lineAbs` em UM update (cobre todos os casos)
- AccountTransfer rastreavel por origem com sinal correto (origem -= liquid se positivo, += se negativo)
- `unmatchLine`: reverte saldo banco em `lineAbs` + soft-delete entries com marker `[AUTO_RECONCILIATION_DESCONTO]` (alem do `_ADJUST` ja existente)

### v1.10.07 — Frontend overlay "Descontos detectados"
- **MultipleMatchModal**: quando soma selecionados > linha, mostra UI rosa com N linhas de despesa. Validacao live: soma despesas == |diff|
- **ConciliationModal (1-para-1)**: ao clicar Conciliar com entry > linha em fluxo nao-cartao, abre overlay de descontos
- Atalhos: "+ Taxa cartao" (5200), "+ Aluguel maquininha" (3201), "+ Outro desconto", "⚖ Fechar diferença"
- Cria N entries PAYABLE PAID na mesma conta do entry expected (VT) com marker `[AUTO_RECONCILIATION_DESCONTO]` + match-multiple

### v1.10.08 — UX tabelas (hover + selected state global)
- **Hover**: `hover:bg-slate-50` (#f8fafc, quase invisivel) → `hover:bg-slate-100` (#f1f5f9, bem mais notavel) em 83 arquivos via sed
- **Selected state**: listener global em `TableRowSelectionListener.tsx` adiciona `data-row-selected="true"` ao tr clicado. CSS global em `globals.css` aplica fundo azul-100 + barra azul lateral. Sem precisar tocar em nenhum `<tr>` existente
- Click fora limpa selecao; click em botao/input dentro do tr nao atrapalha
- Opt-out: `data-no-row-select="true"`

### v1.10.09 — Deteccao automatica de descontos no fluxo cartao
- Antes: `ConciliationModal` so abria overlay de descontos quando `!isCard` (cartao usava taxa unica auto)
- Bug detectado: linha cartao R$ 115,86 conciliada com FIN-00002 R$ 360 criou taxa unica falsa de R$ 2,72 (devia ser R$ 244,14 de descontos). User precisou desfazer
- Fix: agora cartao tambem detecta divergencia. Se `taxa_implicita > config_fee + 5pp`, abre overlay de descontos pre-populado com taxa cartao 5200 (config%) + resto em aluguel maquininha 3201
- Mantem fluxo legado de taxa unica quando divergencia <= 5pp (taxa real bate com config)

### v1.10.10 — Auto-select inputs numericos + alerta divergencia taxa
- Listener global no `TableRowSelectionListener` ouve `focusin` em inputs com `type="number"`, `inputMode="decimal"`, `inputMode="numeric"` ou `data-auto-select="true"` e chama `select()` em `setTimeout(0)` (evita race com click)
- Opt-out: `data-no-auto-select="true"` (usado no input date)
- **Alerta divergencia taxa** no overlay descontos: detecta linha com plano 5200 (Taxa cartao); se taxa_real diverge da cadastrada > 0,05pp, mostra alerta amarelo + botao "Atualizar para X%". Reusa endpoint `PATCH /finance/payment-instrument-fee-rates/:id` ou `/finance/card-fee-rates/:id` (mesma rota da tela de detalhamento cartao)
- Refactor: extraido helper `updateRateBy(percent)` reusado em `updateConfiguredRate()` e no novo botao do overlay

### v1.10.11 — Input cents com digitacao livre + campo data por linha
- **Bug**: input do valor formatava `"9,00"` em cada keystroke → cursor pulava pro fim, impossivel digitar `9,24`
- **Fix**: trocado `amountCents: number` por `amountText: string` no DiscountRow. Input livre durante digitacao; formata `0,00` so no `onBlur` (segue padrao do `CurrencyInput.tsx`)
- **Novo campo**: `dueDate` por linha de desconto. Default = data da linha do extrato; user pode editar individualmente (ex: aluguel cobrado em outro dia)
- Layout overlay: descricao (5) + plano (3) + **data (2)** + valor (2) = 12 cols
- `dueDate` aplicado em `dueDate` e `paidAt` do entry (com `T12:00:00` pra evitar bug timezone)

### Caso real conciliado com sucesso (validado via SQL)
- **Linha SICREDI R$ 115,86** (06/04/2026, id `bfecc4f2`) — MATCHED
- FIN-00002 RECEIVABLE PAID R$ 360 (Trade Solar) + FIN-00480 R$ 9,18 (Taxa cartao 5200) + FIN-00481 R$ 105,96 (Aluguel 3201) + FIN-00482 R$ 129 (Aluguel 3201)
- Validacao: 360 − 244,14 = **115,86** ✓
- AccountTransfer VT → SICREDI R$ 115,86 em 06/04 ✓
- Movimentos VT desta operacao: zerados ✓; SICREDI: +R$ 115,86 ✓

### Operacional: tenant SLS desbloqueado
- Cron AsaasService bloqueou tenant SLS as 7h ("Pagamento nao efetuado ha mais de 7 dias"). User pediu desbloqueio pra testar.
- SQL: Tenant.status = ACTIVE, blockReason/blockedAt limpos. Subscription.status = ACTIVE, overdueAt limpo, nextBillingDate movido pra 16/05/2026
- **Atencao**: cron de sync 7AM com Asaas pode re-bloquear se la continuar overdue

### v1.10.12 — Fix duplicacao de taxa cartao no extrato consolidado
- Bug: linha "Taxa cartao Mastercard X.XX%" gerada virtualmente pelo extrato + FIN-00480 desconto real = mesma despesa duas vezes na visualizacao
- Causa: `finance.service.ts:getStatement` deduplicacao so reconhecia entry tecnica `isRefundEntry=true` criada pelo fluxo legado matchLine
- Fix: estendido pra detectar tambem entries de match-multiple — `e.invoiceMatchLineId === other.invoiceMatchLineId && other.type !== e.type`
- Ajuste manual via SQL: FIN-00480 descricao 2.29% → 2.55% (coerente com R$ 9,18); CardSettlement `626cf832` PENDING (R$ 8,24/2.29%) marcado como CANCELLED

### v1.10.13 — Auto-cancelamento de CardSettlement + sync descricao taxa
- Backend `matchAsMultiple`: ao detectar `sumOpposite > 0` (descontos via overlay), cancela CardSettlements PENDING vinculados aos entries RECEIVABLE de cartao no batch. Evita orfaos automaticamente
- Frontend `updateRateBy`: ao clicar "Atualizar para X%" no overlay, regenera descricao das linhas de desconto que matcham padrao auto `^Taxa cart(ao|ão) X.XX%$`. Linhas editadas manualmente sao preservadas

---

## Sessao 182 — Timezone fix sistemico + Auditoria SICREDI (27/04/2026)

### v1.10.14 — Helper tenantDate centralizado + fix parser OFX + backfill
- **Bug raiz**: `parseOfxDate` em `ofx-parser.service.ts` usava `new Date(year, month-1, day, 0, 0, 0)` que no servidor UTC virava `00:00 UTC = 21:00 BRT do dia anterior`. DTASOF=20260331 ficava 30/03 BR.
- Helper centralizado `backend/src/common/util/tenant-date.util.ts`: `tenantNoon`, `parseTenantDate`, `breakInTenantTz`, `startOfTenantDay`, `endOfTenantDay`. Padrao: meio-dia BRT (12:00 -03:00 = 15:00 UTC) — fica dentro do mesmo dia em qualquer fuso
- Fixes: parser OFX, `getBrazilianPeriod`, `getStatementBalanceCompare` (D = endOfTenantDay), boleto Sicredi provider (paidAt do webhook)
- Backfill 339 registros tenant_sls (+15h em colunas de data com hora=0): 68 BankStatementLine.transactionDate, 2 BankStatement.statementBalanceDate, 83 FinancialEntry.paidAt, 178 dueDate, 8 AccountTransfer.transferDate
- CLAUDE.md atualizado proibindo `new Date(y,m,d)` em codigo financeiro

### Auditoria SICREDI: diff R$ 3.003,70 (banco vs sistema 31/03)
- **Causas rastreadas (R$ 2.980)**: Royalle cleanup 24/04 criou AccountTransfer 2.980 mas saldo SICREDI nao foi creditado (bug do cleanup script).
- **Causas rastreadas (R$ 85,30)**: 3 conciliacoes legacy de cartao (FIN-00336/335/272) com codigo pre-v1.09.94 — entry foi criado em SICREDI direto com gross, saldo recebeu liquido, taxa nao foi lancada.
- **R$ 320,00 inexplicado** (R$ 296,30 excesso interno SICREDI + R$ 23,70 residual): historico nao rastreavel sem audit log de UPDATEs em CashAccount.

### Fix aplicado em prod (script `fix-sicredi-balance-2026-04-27.sql`)
1. **Royalle**: `UPDATE SICREDI saldo += R$ 2.980` (refletindo AccountTransfer ja existente)
2. **3 conciliacoes legacy refeitas via fluxo transito v1.09.94**:
   - Entries FIN-00336/335/272 movidos pra VT
   - 3 AccountTransfers VT->SICREDI criados (R$ 157,60 + R$ 156 + R$ 5.181,10)
   - 3 entries de taxa criadas: FIN-00484 (R$ 2,40), FIN-00485 (R$ 4), FIN-00486 (R$ 78,90), todas PAYABLE PAID em VT, isRefundEntry=true, plano 5200
- Resultado: saldo SICREDI 2.809,80 → 5.789,80. Diff caiu de R$ 3.003,70 pra R$ 23,70 (99,2%)

### v1.10.15 — Feature "Rebalancear conta" + Fechamento 100% SICREDI
- **Backend**: `cashAccountService.rebalance` (linha ~205) + endpoint `POST /finance/cash-accounts/:id/rebalance` em finance.controller.ts. DTO `RebalanceCashAccountDto` (direction CREDIT/DEBIT, amountCents, reason min 10 chars, financialAccountId opcional).
- Cria entry tecnico isRefundEntry=true com motivo registrado em notes (marker `[REBALANCE_AJUSTE]`) + snapshot saldo antes/depois. Atualiza saldo em transacao atomica.
- **Frontend**: botao "⚖" (Rebalancear) na tela CashAccountsTab.tsx (Configuracoes > Contas Caixa/Banco) abre modal com form: direcao, valor, motivo (textarea), plano de contas opcional. Preview ao vivo do saldo antes/depois. Validacoes: valor > 0 e motivo >= 10 chars.
- Fechamento 100% SICREDI:
  - **FIN-00487** RECEIVABLE R$ 296,30 PAID 31/03 isRefundEntry — registra mov ausente que gerou excesso de saldo (insert sem update saldo, compensa UPDATE antigo nao rastreado)
  - **FIN-00488** RECEIVABLE R$ 23,70 PAID 31/03 isRefundEntry — diff residual conferencia banco
  - **FIN-00287** (Marcia OS-00059, R$ 320 cartao credito 10/04): movido de cashAccountId NULL pra VT (aguardando deposito operadora ~10/05)
- **Conferencia final**: sistema 31/03 = banco 31/03 = R$ 1.919,33. Saldo SICREDI bate sum_calc. Divergencia 0.

### Operacional
- Tenant SLS desbloqueado (07h cron AsaasService bloqueou — reativado na sessao 181)
- Cron sync Asaas pode re-bloquear amanha se la continuar overdue

---

## Sessao 180 — Parcelas viram entries filhas + fluxos conciliacao (v1.09.97-1.10.06)

### v1.09.97 — Fix batch payment auto-select conta
- Modal "Receber batch" tinha `lockAccountOnReceive=true` travando o dropdown vazio (o onChange de paymentMethod nao chamava autoSelectAccount como o modal individual)
- Fix: extraido `resolveAccountIdForMethod` (funcao pura) reusada em single + batch. Onchange do batchPayMethod agora auto-seleciona conta.

### v1.09.98 — Conciliacao fuzzy + N-para-1
- **Fuzzy search**: busca por nome de parceiro agora dedupla letras consecutivas. "royale" bate "royalle", "pizaria" bate "pizzaria". Pragmatico pra typos PT-BR.
- **Novo endpoint `matchAsMultiple`** (backend): 1 linha x N entries nao-cartao (PIX/boleto/transferencia). Valida direcao pelo sinal da linha. Auto-marca PENDING como PAID.
- **Novo botao "📈 Conciliar multiplos lancamentos"** no LineActionsDropdown (rosa/verde). Abre MultipleMatchModal generico: search pre-preenchida com palavra da descricao da linha, multi-select com soma live.

### v1.09.99 — Parcelas como entries filhas (refactor arquitetural)
- **`InstallmentService.generateInstallments`** agora cria N `FinancialEntry` filhas (via `parentEntryId`) ao inves de `FinancialInstallment`
- Filhas herdam: partnerId, serviceOrderId, paymentMethod, paymentInstrumentId, cashAccountId, financialAccountId, nfseStatus/nfseEmissionId, config juros/multa
- Pai: fica CANCELLED (depois virou SPLIT na v1.10.01), preserva NFS-e/historico
- Endpoints legados (`GET /entries/:id/installments`, `PATCH /installments/:id`, `.../pay`, `.../cancel`) continuam funcionando via **adapter** — formata entries filhas no shape FinancialInstallment pro frontend nao mudar
- `applyInterestToOverdue` e `getOverdueAgingReport` lidam com entries filhas
- **Migracao dados FIN-00444** (2x R$ 550 renegociacao Flavio):
  - FIN-00444 → CANCELLED, depois SPLIT
  - FIN-00467 PENDING R$ 550 venc 15/04
  - FIN-00468 PENDING R$ 550 venc 10/05
  - NFS-e AUTHORIZED herdada do avo FIN-00282
- `collection.service.ts` NAO adaptado (zero CollectionRule ativa)

### v1.10.01 — Novo status SPLIT
- Enum `FinancialEntryStatus` ganhou `SPLIT` (migration `20260424190000`)
- TenantMigratorService sincroniza o valor novo no boot do backend
- Pai parcelado agora vira **SPLIT** (nao CANCELLED). Semanticamente correto: "foi dividido em filhas", nao "foi cancelado"
- Filtros atualizados: `finance.service.ts#findEntries`, `financial-report.service`, `service-order.service.ts` (4 pontos) → `notIn: ['CANCELLED', 'SPLIT']`
- Frontend: type + ENTRY_STATUS_CONFIG ganhou badge **roxa "Parcelado"**
- FIN-00444 atualizado pra SPLIT
- Arquivado: `memory/feedback_os_concluida_aberta.md`

### v1.10.02 — Descricao automatica do parcelamento
- `generateInstallments` popula `notes` do pai com detalhe formatado:
  ```
  [Parcelado em Nx] Total: R$ X,XX
  - FIN-XXXXX (R$ X,XX venc DD/MM/YY)
  - FIN-XXXXX (R$ X,XX venc DD/MM/YY)
  ```
- Primeira linha entre `[]` pra renderizar como hint na coluna "Observacoes" da tabela financeiro
- FIN-00444 atualizado com novo formato

### v1.10.03 — Auto-ajuste juros/multa no multi-match
- Modal `MultipleMatchModal`: ao haver diferenca positiva entre linha e soma dos entries, botao "+ Criar lancamento de ajuste (juros/multa recebida)"
- Mini-form inline: descricao auto, plano de contas dropdown (pre-seleciona code 7100 ou nome match "juros/multa"), botao "Criar e adicionar"
- Cria entry PENDING do ajuste + auto-seleciona pra conciliacao final

### v1.10.04 — Auto-ajuste no ConciliationModal single tambem
- Fluxo: user clica "Conciliar" no card de UM entry → se diff > 0 e nao e cartao → abre overlay "Diferenca detectada" com form de ajuste → cria entry + concilia [entry + ajuste] via match-multiple
- UX mais natural (user nao precisa escolher "multiplos" antes de saber que tem diferenca)
- Plano de contas 7100 "Juros e Multas Recebidos" cadastrado pelo user

### v1.10.05 — Dropdown forma de pagamento no ajuste
- Auto-ajuste estava criando entries sem paymentMethod — ficava "—" no extrato
- Adicionado dropdown "Forma de pagamento" no overlay
- Pre-seleciona: entry.paymentMethod do original OU matchPaymentMethod do modal

### v1.10.06 — Fix bugs unmatchLine + AccountTransfer
**Bugs descobertos ao user conciliar + desfazer:**
1. Royalle: 4 entries (R$ 2.980) em VT conciliadas com linha do banco, mas `matchAsMultiple` NAO criou AccountTransfer VT→SICREDI pra entries que ja eram PAID. Saldo VT e SICREDI ambos inflados.
2. Flavio: conciliacao desfeita mas entries ficaram PAID com invoiceMatchLineId — `unmatchLine` so tratava `isCardInvoice=true`. Match-multiple normal nao era revertido.

**Cleanup SQL** (scripts/cleanup-royalle-flavio.sql):
- Royalle: criou AccountTransfer rastreavel VT→SICREDI R$ 2.980 em 22/04. VT decrementou. SICREDI preservado (ja tinha credito da linha).
- Flavio: FIN-00467 voltou pra PENDING. FIN-00469 (juros auto) soft-deletado. SICREDI decrementou R$ 573,70.
- Saldos finais: SICREDI R$ 1.851,76 / VT R$ 6.430,00

**Fixes de codigo:**
- `matchAsMultiple`: entries ja PAID em conta diferente agora geram AccountTransfer rastreavel `origem → banco`. Banco nao e duplamente creditado.
- `unmatchLine`: novo branch pra match-multiple nao-cartao. Reverte saldos, deleta AccountTransfers criados, volta entries pra PENDING, **soft-delete entries com marker `[AUTO_RECONCILIATION_ADJUST]`** (ajustes de juros criados pelo fluxo).
- Frontend: entries de ajuste auto-criados (ConciliationModal + MultipleMatchModal) recebem `notes: [AUTO_RECONCILIATION_ADJUST]` pra serem identificaveis no unmatch.

### Migracao dados FIN-00273 (3x cartao Mastercard, recebido antecipado)
- Opcao B escolhida (3 filhas PAID em VT, espelha estado atual)
- FIN-00273 → SPLIT, notes formatado
- FIN-00472/473/474 — PAID em VT, vencimentos 23/04, 23/05, 23/06
- Saldo VT nao mexeu (R$ 905 permanece)
- Quando operadora depositar dia 23, usuario concilia cada parcela → cria AccountTransfer VT→SICREDI automaticamente (matchLine 1-para-1)

---

## Sessao 179 — OS-00064 fix + protecoes contra mutacao indevida (v1.09.96)
- Bug reportado: OS-00064 ficou CONCLUIDA com assignedPartnerId=NULL. Ueslei finalizou fisicamente em 17/04 09:06 mas nunca aceitou no sistema (offline queue nao sincronizou). Iago clicou botao "Confirmar" no header (que chamava finalize() e nao approveAndFinalize()), entao faltou Evaluation + evento STATUS_CHANGE + o status ficou CONCLUIDA ao inves de APROVADA.
- **Correcao de dados OS-00064 via SQL** (scripts/fix-os-00064.sql):
  - status CONCLUIDA → APROVADA
  - assignedPartnerId → Ueslei
  - acceptedAt/startedAt/completedAt corrigidos para 17/04
  - Evaluation GESTOR AVA-00034 (5 estrelas) criada
  - ServiceOrderEvent STATUS_CHANGE + AuditLog APPROVED_AND_FINALIZED_MANUAL
  - NAO criado FIN PAYABLE (Ueslei sem comissao). Ledger e FIN-00449 ja existiam.
- **Frontend**: removido botao "Confirmar" do header da OS (orders/[id]/page.tsx) que chamava finalize() em vez de approveAndFinalize. Removido state/import/modal FinalizeOrderModal no mesmo arquivo (o componente em components/os/FinalizeOrderModal.tsx ficou orfao, nao foi deletado).
- **Backend protecoes** (baseado em auditoria dos paths de mutacao de ServiceOrder):
  - `finalize()`: se `assignedPartnerId=null`, tenta fallback pra `directedTechnicianIds[0]`; sem nenhum, lanca BadRequestException. Evita novo bug OS-00064.
  - `finalize()`: cria `ServiceOrderEvent` STATUS_CHANGE na transacao (consistencia com approveAndFinalize).
  - `update()`: bloqueia mudanca de techAssignmentMode/requiredSpecializationIds/directedTechnicianIds/workflowTemplateId em OS terminal (CONCLUIDA/APROVADA). Edicao de conteudo (titulo, itens, valor, endereco) continua liberada.
  - `PATCH /service-orders/:id`: adicionado `@Roles(ADMIN, DESPACHO)` (antes qualquer user autenticado podia mudar status).
- **Pulado (pra sessao futura, risco de quebrar workflows)**: AutomationEngine.executeChangeStatus + WorkflowEngine.autoChangeStatus sem bloqueio terminal; loop CONCLUIDA↔AJUSTE sem limite.
- Memory: feedback_os_concluida_aberta.md (CONCLUIDA nao eh terminal no filtro "Abertas" — aguarda aprovacao).

## Sessao 178 — Conciliacao preserva historico no VT (v1.09.94)
- Bug: matchLine movia entry.cashAccountId pro banco em TODOS cenarios (A-PENDING e B-PAID). VT nunca esvaziava — so entradas, nunca saidas. Impossivel ver ciclo completo de cada cartao
- Fix reconciliation.service.ts matchLine:
  - Se entry tem cashAccountId != banco (ex: VT) ou existe CashAccount type='TRANSITO': fluxo novo. Entry fica em VT, cria AccountTransfer VT->banco, entry de taxa (auto-detectada se gross>liquido) fica em VT
  - Senao: fluxo legado preservado (entry vai pro banco)
- Fix reconciliation.service.ts unmatchLine: detecta fluxo pelo AccountTransfer com description contendo `linha {prefix}` e reverte corretamente (reverte transfer + receita VT + tax entry, NAO move entry)
- Typecheck 0 erros; frontend sem alteracao; nao afeta matches antigos (so novos daqui pra frente)
- Memory: memory/conciliacao-preserve-transit.md
- Frontend melhoria auxiliar: Extrato Consolidado auto-recarrega ao mudar De/Ate (useEffect debounce 350ms) [finance/page.tsx:634]

## Fix manifestacao SEFAZ direto — Envelope + URL + parser (v1.09.32-37) ✅
Migrado de Focus NFe (que falhava com "documento fiscal não encontrado" pois nao tinha as NFes no banco dele)
para SEFAZ direto via NFeRecepcaoEvento4. Processo foi iterativo ate descobrir 3 erros fundamentais:

### Erro #1: URL errada (causa raiz do NullReferenceException)
- Usavamos `www1.nfe.fazenda.gov.br` (endpoint do NFeDistribuicaoDFe, NAO do RecepcaoEvento4)
- CORRETO: `www.nfe.fazenda.gov.br` (SEM o "1") pra producao
- Homologacao continua `hom1.nfe.fazenda.gov.br`
- Chave: o www1 aceitava o handshake SSL mas caia num handler diferente que nao deserializa evento — isso dava NullRef no .NET

### Erro #2: Wrapper <nfeRecepcaoEvento> nao existe no NFe 4.00
- Tinhamos `<soap:Body><nfeRecepcaoEvento><nfeDadosMsg>...`
- CORRETO conforme nfephp/sped-nfe (referencia canonica PHP): `<soap:Body><nfeDadosMsg xmlns="...wsdl/NFeRecepcaoEvento4">...`
- Sem wrapper. xmlns WSDL vai direto em `<nfeDadosMsg>`.

### Erro #3: versaoDados nao existe em <nfeDadosMsg>
- Removido — esse atributo nao faz parte do schema

### Outros ajustes
- Action de `nfeRecepcaoEventoNF` (do endpoint errado) pra `nfeRecepcaoEvento` (correto conforme WSDL)
- Action vai no Content-Type (parametro), nao como header SOAPAction separado (SOAP 1.2 pattern)
- Parser da resposta: wrapper real e `nfeRecepcaoEventoNFResult` (confirmado em prod), nao Response
- Aceita cStat 135 (registrado), 136 (registrado sem vinculacao), 573 (duplicidade, idempotente), 128 (lote fallback)
- Rejeicoes com mensagem SEFAZ real: 573 duplicidade, 596 fora do prazo de 10 dias, etc.

### Estrutura final do envelope SEFAZ (funcionando em prod)
```xml
<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="..." xmlns:xsd="..." xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">
      <envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
        <idLote>{{timestamp}}</idLote>
        <evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
          <infEvento Id="ID{{tpEvento}}{{chNFe}}{{nSeqEvento.padStart(2,'0')}}">
            <cOrgao>91</cOrgao> <!-- AN para MDe -->
            <tpAmb>1</tpAmb>
            <CNPJ>{{14 digits}}</CNPJ>
            <chNFe>{{44 digits}}</chNFe>
            <dhEvento>2026-04-15T18:23:47-03:00</dhEvento>
            <tpEvento>210210</tpEvento> <!-- ciencia -->
            <nSeqEvento>1</nSeqEvento>
            <verEvento>1.00</verEvento>
            <detEvento versao="1.00">
              <descEvento>Ciencia da Operacao</descEvento> <!-- SEM acento -->
              <xJust>...</xJust> <!-- apenas p/ 210240 -->
            </detEvento>
          </infEvento>
          <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">...</Signature>
        </evento>
      </envEvento>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>
```
Assinatura: xml-crypto C14N inclusive (xml-c14n-20010315), RSA-SHA1, SHA-1 digest.
Certificado A1 PFX em X509Data > X509Certificate (cert folha, sem chain).
Headers HTTP: Content-Type: `application/soap+xml;charset=UTF-8;action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento"`

## Fase 5 — Conciliacao consistente (v1.08.96) ✅
### Auto-pagar PENDING ao conciliar
- Schema: FinancialEntry.autoMarkedPaid Boolean default false — marca entries PAID via match para reverter corretamente no unmatch
- Migration 20260414190000 (coluna nullable com default, 0 risco multi-tenant)
- matchLine: se entry.status = PENDING/CONFIRMED, muda para PAID, paidAt = line.transactionDate, cashAccountId = banco da linha, marca autoMarkedPaid=true; atualiza saldo do banco diretamente (sem auto-transfer de transito); entry PAID mantem fluxo tradicional (auto-transfer TRANSITO->banco). Bloqueia entries CANCELLED
- matchAsCardInvoice: mesma logica per-entry do grupo; entries PENDING no grupo viram PAID individualmente (autoMarkedPaid=true), entries PAID so ganham invoiceMatchLineId
- unmatchLine 1-para-1: detecta autoMarkedPaid, reverte entry para PENDING, limpa paidAt/cashAccountId/autoMarkedPaid, decrementa saldo do banco
- unmatchLine cardInvoice: particiona entries do grupo em autoPaidIds vs outherIds, reverte os autoPaidIds para PENDING e apenas remove vinculo dos ja-PAID-antes; retorna revertedPending count
- Findcandidates agora aceita status IN [PAID, PENDING, CONFIRMED], com OR em paidAt OR dueDate para cobrir entries ainda nao pagos

### Plano de contas obrigatorio na conciliacao
- companyUsesChartOfAccounts(companyId): checa se ha FinancialAccount ativo com allowPosting
- matchLine: se empresa usa, valida entry.financialAccountId (ou dto.financialAccountId); bloqueia BadRequest se ausente; entries isRefundEntry sao isentos
- matchAsCardInvoice: aceita entryAccountAssignments[] no DTO; valida planos informados (ativo, allowPosting); bloqueia se entry sem plano e sem atribuicao; aplica atribuicoes no update de cada entry
- DTO: MatchLineDto ganha financialAccountId; MatchCardInvoiceDto ganha entryAccountAssignments: EntryAccountAssignmentDto[]

### Frontend
- ConciliationModal: carrega /finance/financial-accounts em paralelo; filtra isActive+allowPosting; state accountAssignments (Record<entryId,accountId>); inline select em cada candidate sem plano (borda ambar destacada); badge verde "Plano: X" quando entry ja tem; needsChartAccount desabilita botao "Conciliar" com tooltip; handleMatch envia financialAccountId no body; toast adaptado "Conciliado e marcado como PAGO!" se entry era PENDING
- CardInvoiceMatchModal: state accountAssignments + bulkAccountId; barra "⚠ N sem plano" com select + botao "Aplicar a todos" que popula os assignments; select inline abaixo da row de cada entry selecionado sem plano; badge "sera marcado como pago" para entries PENDING selecionados; entriesMissingAccount.length bloqueia botao final com tooltip; handleMatch envia entryAccountAssignments[]; toast adaptado com contagem de PENDING

### Multi-tenant
- Empresa sem plano de contas configurado: campo some, nenhuma validacao bloqueia (progressive disclosure)
- Empresa com plano: obrigatorio na conciliacao, auto-pagamento respeita isolamento por companyId
- Entries isRefundEntry (tecnicos) dispensam plano

## EM ANDAMENTO (sessao 175) — Cartao de credito como conta virtual

### Decisao arquitetural
Cartao de credito vira CashAccount virtual (tipo novo CARTAO_CREDITO). Pagar compra com cartao debita titulo e credita na conta-cartao (acumula divida). Pagar fatura = transferencia banco->cartao (zera divida). Mesma abordagem de Omie/ContaAzul/QuickBooks.

### Fase 1 — cardLast4 no dropdown (v1.08.93) ✅
- Dropdown "Meio de Pagamento" exibe "Master Ueslei •••• 1234 (Credito)"
- Filtro de tipo no extrato consolidado mostra os 4 digitos
- Form de cadastro de PaymentInstrument ja tinha campo cardLast4; exibicao no dropdown foi ajustada

### Fase 2 — Conta virtual CARTAO_CREDITO (v1.08.94) ✅
- Enum CashAccountType ganhou CARTAO_CREDITO (migration 20260414160000)
- PaymentInstrumentService.create: se PaymentMethod.code e "CARTAO_CREDITO"/"CREDITO"/etc., cria CashAccount virtual automaticamente e vincula via cashAccountId
- PaymentInstrumentService.update: sincroniza nome/ativo da conta virtual; se trocar tipo (credito<->outro), cria/desativa conta
- PaymentInstrumentService.remove: soft-deleta a conta virtual junto
- ensureVirtualCardAccounts(companyId): backfill idempotente rodado em findAll/findActive — migra cartoes existentes (Master Ueslei, Visa Juliano) para ter sua propria conta virtual
- Frontend PaymentInstrumentsTab: form esconde "Vincular Conta" para cartao credito (substitui por alerta informativo); dropdown de conta nao mostra CARTAO_CREDITO (usuario escolhe conta manualmente quando nao-credito)
- Frontend CashAccountsTab: badge rosa 💳 "Cartao"; saldo exibido como "Em aberto"/"Fatura quitada" (negativo=divida, zero=quitado); botoes Editar/Excluir ocultos para CARTAO_CREDITO; legend "Gerenciado em Meios de Pagamento"
- Frontend finance/page.tsx: labels de tipo atualizados para incluir "Cartao"

### Fase 3 — Dashboard de cartoes + pagar fatura (PENDENTE)
- Card destacado "Cartoes em aberto" com lista: nome, •••• 1234, valor devedor, dias ate fechamento
- Botao "Pagar fatura" 1-click: modal pre-preenchido com valor e conta de origem, cria transferencia banco->cartao

### Fase 4 — Conciliacao N-para-1 no extrato (v1.08.95) ✅
- Schema: FinancialEntry.invoiceMatchLineId (FK opcional -> BankStatementLine) + index; BankStatementLine.isCardInvoice bool default false
- Migration 20260414170000 com FK ON DELETE SET NULL + index (TenantMigratorService propaga sem risco — apenas colunas nullable/com default)
- Backend: ReconciliationService.findCardInvoiceCandidates(companyId, {paymentInstrumentIds, fromDate, toDate, includeAlreadyMatched}) — filtra entries PAID por paymentInstrumentId (estavel, pega historico anterior a Fase 2)
- Backend: ReconciliationService.matchAsCardInvoice(lineId, dto {entryIds, notes}) — valida status UNMATCHED + linha de debito + soma dos entries === |line.amountCents| (tol 1c) + entries PAID sem grupo previo; transacao: seta invoiceMatchLineId nos entries, line.status=MATCHED + isCardInvoice=true + matchedByName, recalcCounts
- Backend: unmatchLine deteta isCardInvoice e reverte o grupo (zera invoiceMatchLineId de todos os entries) antes do fluxo refund pair
- Controller: GET /finance/reconciliation/card-invoice-candidates + POST /finance/reconciliation/lines/:lineId/match-card-invoice
- Frontend: LineActionsDropdown ganha acao "💳 Conciliar fatura de cartao" (rosa), so aparece em linhas UNMATCHED de debito (amountCents<0); itemCount ajustado para calculo de altura do popup
- Frontend: novo CardInvoiceMatchModal — carrega PaymentInstruments de credito (filtra por code), multi-select chips de cartao, range de datas (default: 40 dias antes da data da linha), auto-fetch candidates via GET endpoint; lista com checkbox, "Selecionar todas"/"Limpar", soma vs valor da fatura com indicador visual (verde ✓ quando bate, vermelho com delta caso contrario), botao "Conciliar fatura" so habilita com match exato, desabilita entries ja em outra fatura
- ReconciliationTab: novo state cardInvoiceLine, passa para LineActionsDropdown onConciliarCardInvoice, renderiza modal no fim do componente

### Fase 3 — Dashboard de cartoes + pagar fatura (PENDENTE — adiada a pedido)
- Card destacado "Cartoes em aberto" com lista: nome, •••• 1234, valor devedor, dias ate fechamento
- Botao "Pagar fatura" 1-click: modal pre-preenchido com valor e conta de origem, cria transferencia banco->cartao

### Efeitos colaterais ao testar Fase 2
- Ao abrir a tela "Meios de Pagamento" pela primeira vez apos v1.08.94: backfill cria contas virtuais para cartoes existentes (Master Ueslei, Visa Juliano). Aparecem na tela "Contas Caixa/Banco" com badge 💳 Cartao e saldo R$ 0,00 (Fatura quitada) porque ainda nao foi feita nenhuma compra movimentando a nova conta
- Pagamentos anteriores com cartao que estao hoje em "VALORES EM TRANSITO" NAO foram migrados — continuam onde estao. Nova arquitetura so afeta pagamentos dali em diante
- Se precisar migrar historico, fazer SQL manual decidindo caso a caso (arriscado mexer em dados financeiros)

## CONCLUIDO (sessao 167)

### Dispatch Panel — Status notificacao preso em "Enviando..."
- Bug: polling detalhado (5s) so rodava para OS com `enRouteAt` (tecnico a caminho)
- OS recém-atribuidas com WhatsApp enviado ficavam presas em "Enviando..." ate o tecnico clicar a caminho
- Fix: polling agora roda tambem para OS com notificacao pendente (nao SENT/FAILED/DELIVERED/READ)
- Assim que status muda para SENT, polling para aquela OS para (eficiencia)

### GPS Continuo — Respeitar intervalo do bloco
- Bug: quando online, hardcoded 5s ignorava `intervalSeconds` do bloco GPS do workflow
- Fix: `getEffectiveIntervalMs()` agora usa `intervalMs` do bloco (default 30s)
- Offline: mantém escalonamento por distancia, mas nunca abaixo do intervalo configurado
- `maximumAge` do watchPosition tambem ajustado para respeitar o intervalo

### PhotoUpload — Retry 401 com token refresh
- Bug: upload de foto usava `fetch()` direto, sem retry de token expirado (15min TTL)
- Se tecnico ficava 15+ min offline/idle, upload falhava com "Unauthorized"
- Fix: `uploadOnline()` agora detecta 401, tenta `techSilentRefresh()` + `techDeviceRecover()`, e retenta
- Exportadas `techSilentRefresh` e `techDeviceRecover` do TechAuthContext

### getDispatchStatus — Priorizar notificacao enviada
- Bug: retornava a ULTIMA notificacao (orderBy createdAt desc), que podia ser de um NOTIFY block que falhou
- Resultado: card ficava em "Enviando..." mesmo com notificacao anterior enviada com sucesso
- Fix: busca primeiro a ultima notificacao com status SENT; fallback para ultima geral

### Aprovacao OS — Permitir aprovar OS ja APROVADA por workflow
- Bug: `finalizePreview` e `finalize` bloqueavam com "OS já está em status terminal"
- Quando workflow tem bloco STATUS→APROVADA, a OS ja chega como terminal antes do gestor avaliar
- Fix: checagem agora so bloqueia CANCELADA (nao APROVADA), pois aprovacao sem ledger/avaliacao ainda precisa ser feita
- `approveAndFinalize` ja nao tinha essa checagem — agora consistente

### Timeline — Unificar linhas de avaliação do gestor
- Bug: ao aprovar OS, timeline mostrava 2 linhas: "Status: Aprovada ⭐ 5/5" + "Aval. Gestor ★★★★★ 5/5"
- Fix: quando existe avaliação do gestor + evento APROVADA, faz merge em 1 linha "Aprovada ★★★★★"
- Aval. Gestor como linha separada só aparece se não há evento APROVADA (caso raro)
- Label "Aval. Cliente" renomeado para "Nota Cliente" (distinguir da notificação "Aval. Cliente")

### Modal Aprovacao — Contatos para notificacao (padrao NFS-e)
- Modal agora mostra secao "Notificacoes" com contatos de Cliente e Tecnico
- Checkboxes Email/WhatsApp com lista de contatos do PartnerContact + fallback partner.phone/email
- Opcao "+ Novo email" / "+ Novo WhatsApp" salva no PartnerContact via API
- Backend: `finalizePreview` retorna `clientContact` e `techContact` (partnerId, name, phone, email)
- Backend: `approveAndFinalize` aceita clientPhone/Email/Channels + techPhone/Email/Channels
- Backend: atualiza Partner.phone/email se novos valores fornecidos
- Backend: `generateAndSendEvaluationLink` agora multi-canal (WhatsApp + Email)
- Backend: nova `sendTechApprovalNotification` notifica tecnico da aprovacao
- Canal EMAIL no notification.service ainda e MOCK (registro no banco, sem envio real) — TODO futuro

### Toggle excluir lancamento financeiro
- Novo toggle em Sistema > Financeiro: "Permitir excluir lancamentos" (default: OFF)
- Botao "Excluir" no menu de acoes so aparece quando toggle ativo + status PENDING/CONFIRMED
- Backend ja tinha DELETE /finance/entries/:id (soft delete) — agora acessivel pelo UI

### Meios de Pagamento (Fase 1)
- Tab "Instrumentos" renomeado para "Meios de Pagamento"
- Modal Pagar: dropdown direto com instrumentos cadastrados, auto-preenche conta e metodo
- Modal Receber cheque: campos numero, banco, agencia, conta, compensacao, titular
- Schema: 6 campos de cheque no FinancialEntry + migration
- Backend: DTO + Service para persistir/limpar cheque no PAID/REVERSED

### Contatos no modal de envio de orcamento
- Modal "Orcamento Salvo" agora tem selecao de contatos padrao NFS-e
- Lista WhatsApp/Email do PartnerContact + fallback partner.phone/email
- "+ Novo WhatsApp" / "+ Novo email" com salvamento automatico

### PDF orcamento — fix 404
- Botao PDF tentava abrir rota publica inexistente (/q/{token}/pdf)
- Corrigido: sempre usa endpoint autenticado /api/quotes/{id}/pdf

### Fatura de cartao — vencimento + filtros no extrato
- PaymentInstrument: novos campos billingClosingDay e billingDueDay
- CardSettlement: denormalizado paymentInstrumentId para facilitar filtro
- Backend: createFromEntry propaga paymentInstrumentId
- Form instrumento: campos "Dia Fechamento Fatura" e "Dia Vencimento Fatura" (so cartoes)
- Extrato Consolidado: filtros Direcao (Pagamento/Recebimento) + Tipo (forma de pagamento)
- Tipo dinamico: mostra apenas formas de pagamento presentes nos dados filtrados

### Bloco Reagendar (RESCHEDULE) no workflow
- Novo bloco interativo: tecnico preenche nova data/hora + motivo
- Backend: atualiza scheduledStartAt + limpa timestamps do ciclo + registra evento RESCHEDULE
- Editor: toggle "Motivo obrigatorio" + "Data obrigatoria" + motivo padrao
- App tecnico: campos datetime + textarea motivo
- Funciona offline (mesma queue que outros blocos)

### Toggle foto obrigatoria no bloco PHOTO
- Checkbox "Foto obrigatoria" no editor (default: marcado)
- Quando desmarcado: tecnico pode pular sem tirar foto
- Backend: se required===false, permite advance sem photoUrl
- Node no editor: mostra "Opcional" em vez de "Min: X foto(s)"

### Fix linhas Fim no editor de workflow
- Logica melhorada para nao duplicar "Fim" quando branch mergea de volta

### Orcamento rascunho → OS
- Botao "Gerar OS" e "Converter em OS" agora disponiveis para orcamentos em RASCUNHO

### Fix menu servicos
- Dropdown usava position fixed dentro de overflow-hidden → portal no body
- Click propagation: onMouseDown + setTimeout para executar apos portal fechar
- Scroll to top ao abrir formulario de edicao

### Fix CI GitHub
- Frontend build com continue-on-error (bug Next.js 16 __IsExpected)
- next.config.ts: ignoreBuildErrors true

## CONCLUIDO (sessao 172)

### Fix pagina em branco no PDF (orcamento + OS)
- Bug: PDFKit adicionava pagina em branco ao renderizar rodape em `pageHeight - 35`
- Fix: `drawFooter()` desativa temporariamente `page.margins.bottom = 0`
- Corrigido em: `quote-pdf.service.ts` e `service-order-pdf.service.ts`

### Fix envio WhatsApp orcamento ignora contato selecionado
- Bug: modal de envio coletava contato mas enviava so boolean; backend usava `clientPartner.phone`
- Fix: frontend envia `whatsappPhone`/`emailAddress` do contato selecionado
- Backend: `send()` e `sendEmailInternal()` aceitam override de telefone/email via DTO

### Pagina de detalhe do parceiro (404)
- "Ver detalhes" navegava para `/partners/{id}` que nao existia
- Criado `partners/[id]/page.tsx` com PartnerForm carregado

### Fix DeviceToken schema errado (FK violation)
- Bug: `deviceToken` faltava na lista `TENANT_MODEL_DELEGATES` do PrismaService
- Todas operacoes DeviceToken iam pro schema `public` em vez do tenant
- Causava FK violation ao criar token (partnerId nao existe no public)
- PWA perdia sessao pois device-recover buscava no schema errado

### Fix OTP login tecnico — telefone sem prefixo 55
- Bug: todos tecnicos tinham telefone sem `55` (ex: `66999861230`)
- `normalizePhone` adicionava `55` → busca por `5566999861230` nao encontrava
- Fix: `requestOtp` e `loginWithOtp` tentam ambas variantes (com/sem 55)

### PhotoUpload — otimizacao memoria para celulares fracos
- Compressao via `createImageBitmap` com resize nativo (zero full-decode)
- Leitura de dimensoes via header JPEG/PNG (32KB, sem decodificar imagem)
- OffscreenCanvas preferido, fallback canvas regular, fallback envio original
- Object URLs revogados no unmount, canvas limpo apos uso
- ~5MB por foto em vez de ~100MB

### Background GPS keepalive para PWA
- Audio silencioso em loop impede Chrome Android de suspender tab em background
- Wake Lock API impede tela de desligar durante tracking
- setInterval backup com getCurrentPosition se watchPosition parar
- Cleanup automatico quando bloco GPS termina

### Modal aprovacao — ocultar financeiro ja lancado
- `finalizePreview` agora verifica se ja existem entries (hasExistingReceivable/Payable)
- Frontend oculta cards de lancamento que ja existem

### Pagina detalhe parceiro
- Criado `partners/[id]/page.tsx` — "Ver detalhes" agora funciona

### Parcelas — edicao inline de datas + menu acoes
- Coluna ACOES como primeira (menu `...` horizontal padrao)
- Data de vencimento editavel inline (input date direto na tabela)
- Botao "Salvar datas (N)" no header salva todas mudancas de uma vez
- Backend: `PATCH /finance/installments/:id` com dueDate e amountCents
- Fix timezone: `T12:00:00` na criacao e edicao de parcelas

### Fix NFS-e check em renegociacao
- Bug: entry renegociado nao herda nfseStatus do original
- `checkNfseBeforePayment` agora verifica tambem o parentEntryId
- Se pai tem AUTHORIZED, renegociacao e considerada OK

## EM ANDAMENTO (sessao 174)

### Fix bankStatement nao registrado em TENANT_MODEL_DELEGATES (v1.08.89)
- Apos v1.08.88 a UI ainda mostrava "Nenhum extrato importado"
- Logs confirmaram que GET /finance/reconciliation/statements retornava 200 em 7ms mas resposta vazia
- Causa: o model novo `bankStatement` nao foi adicionado ao Set TENANT_MODEL_DELEGATES em PrismaService. Resultado: queries iam pro schema `public` (vazio) em vez de `tenant_sls`
- Fix: adicionado `bankStatement` ao TENANT_MODEL_DELEGATES logo antes de `bankStatementImport`
- Regra obrigatoria: SEMPRE adicionar models novos ao TENANT_MODEL_DELEGATES quando eles sao por-tenant

### Fix tenant-migrator — NOT NULL sem default em tabela populada (v1.08.88)
- Incidente no deploy v1.08.87: migration `20260410180000_bank_statement_monthly` rodou no schema public mas falhou silenciosamente no tenant_sls
- Causa: TenantMigratorService.addColumn tentou `ALTER TABLE ... ADD COLUMN statementId TEXT NOT NULL` em tabela com 40 linhas. Postgres rejeitou. Erro foi capturado como warn e o deploy continuou
- Resultado: BankStatement table vazia no tenant, UI "Nenhum extrato importado", coluna statementId ausente em BankStatementLine
- Fix manual: rodado script `fix-tenant-statements.sql` em producao (popula BankStatement, backfill statementId, recalcula contadores). 40 linhas preservadas, 1 conciliacao intacta
- Fix do codigo: `addColumn` agora detecta NOT NULL sem default + tabela populada, adiciona como NULLABLE e emite warning LOUD instruindo backfill manual + SET NOT NULL
- Memory: `memory/tenant-migrator-not-null-gotcha.md` com detalhes do incidente e licao aprendida
- CLAUDE.md: adicionada regra "Migrations Prisma em Multi-Tenant" com checklist

### Conciliacao — Extrato mensal por conta (antes: arquivo por arquivo)
- Problema: cada import OFX criava um card separado com progresso isolado (0/11, 1/29) — ao importar incrementalmente a UI virava uma bagunca de arquivos
- Solucao: novo model BankStatement = 1 por conta+mes. Imports passam a alimentar o extrato mensal correspondente (com merge automatico dentro do mesmo mes). Mes novo abre extrato novo.
- Schema: novo model BankStatement (cashAccountId, periodYear, periodMonth, lineCount, matchedCount, lastFileName, lastImportAt, lastImportByName) com unique (cashAccountId, year, month). BankStatementLine e BankStatementImport ganharam statementId FK
- Migration: 20260410180000_bank_statement_monthly com data migration — agrupa linhas existentes por conta+mes (usando transactionDate em America/Sao_Paulo), cria BankStatements retroativamente, vincula linhas e imports, recalcula contadores
- Backend: ReconciliationService.importFile refatorado — agrupa transacoes por mes (Brazilian timezone), faz find-or-create de BankStatement por periodo, append de linhas, atualiza lastFileName/lastImportAt sobrescrevendo pelo mais recente. 1 import pode tocar varios statements se arquivo cruza meses
- Backend: novos endpoints GET /reconciliation/statements e GET /reconciliation/statements/:id/lines. Antigos (/imports) mantidos por compat
- Backend: helper recalcCounts() usado em todas as mutacoes (matchLine, unmatchLine, matchAsRefund, ignoreLine, unignoreLine) para manter lineCount/matchedCount do statement sincronizado
- Frontend: StatementsSection substitui ImportsHistorySection — agrupa extratos por conta, cada card mostra "Marco / 2026" + "Ultimo arquivo: extrato.ofx" + progresso N/M + badge "100% conciliado"
- Frontend: LinesDetail agora recebe statement em vez de importData, titulo muda para "Transacoes — Marco / 2026 (Sicredi 0001-40)", fetch usa novo endpoint /statements/:id/lines
- Frontend: callback onChanged propaga atualizacoes do LinesDetail de volta ao StatementsSection para manter progresso em tempo real ao conciliar

### Conciliacao — PIX indevido + Devolucao (estorno de terceiro)
- Caso: cliente manda PIX errado (sem OS) e empresa devolve; sobram 2 linhas no extrato sem FIN para casar
- Schema: BankStatementLine ganhou refundPairLineId (self-FK) + isRefund; FinancialEntry ganhou refundPairEntryId + isRefundEntry
- Migration manual: 20260410140000_add_refund_pair_fields
- Backend: ReconciliationService.matchAsRefund(lineId, pairedLineId) — valida sinais opostos + mesmo valor, cria 2 FIN tecnicos (RECEIVABLE PAID + PAYABLE PAID) com isRefundEntry=true, linka via refundPairEntryId, marca ambas as linhas como MATCHED com refundPairLineId cross + isRefund=true
- Backend: auto-deteccao de pares no findLines — para cada UNMATCHED busca candidato com sinal oposto, mesmo valor absoluto (tol 1c), <60 dias de distancia e nome da contraparte similar (extrai tokens do description ignorando RECEBIMENTO/DEVOLUCAO/PIX/numeros). Retorna suggestedPairLineId como campo virtual
- Backend: unmatchLine detecta isRefund e desfaz o par inteiro (apaga os 2 FIN tecnicos + reseta as 2 linhas)
- Endpoint: POST /finance/reconciliation/lines/:lineId/match-as-refund { pairedLineId, counterpartyName?, notes? }
- Frontend: nova acao "Conciliar como devolucao" no menu da linha (roxa) com tag "par detectado" quando tem sugestao
- Frontend: RefundPairModal novo — lista candidates (sinal oposto + mesmo valor + UNMATCHED), destaca "Par sugerido", campo de observacao, cria par ao confirmar
- Frontend: badge "Possivel estorno" na coluna descricao quando linha UNMATCHED tem suggestedPairLineId; badge "Estorno" quando MATCHED com isRefund
- Frontend: loadLines agora busca tambem todas as linhas (sem filtro de status) quando ha filtro ativo, para alimentar o RefundPairModal sem precisar refazer requisicao
- Efeito liquido no caixa: zero. Efeito contabil: 2 FIN tecnicos rastreados com isRefundEntry=true, filtravel no DRE/MRR

### Fix conciliacao cartao — taxa nao bate com extrato
- Bug: modal calculava `bruto = liquido / (1 - taxa%)` usando a taxa configurada, desconectado do lancamento. Produzia bruto teorico (ex: R$ 5.262,86) que nao bate com o entry real (R$ 5.260,00). A taxa salva era ficticia
- Causa raiz: operadora nunca cobra exatamente o % configurado; a taxa real so e conhecida quando se casa o lancamento com o deposito
- Fix ReconciliationTab: taxa agora derivada do entry selecionado (`tax = entry.gross - bank.amount`), nao do rate teorico
- Auto-selecao: ao abrir modal, busca o melhor candidate (entry cuja taxa implicita mais se aproxima da configurada, tolerancia 1.5%)
- Row click: clicar em qualquer linha seleciona aquele entry e recalcula breakdown
- Sort cartao: candidates ordenados por proximidade da taxa implicita com a taxa configurada
- Display: badges separados "Config: 1.55%" e "Real: 1.50%", com cores verde/vermelho conforme divergencia
- Alerta de divergencia: quando diferenca > 0.05pp, mostra warning amarelo com data da ultima atualizacao da taxa + botao "Atualizar para X%" que faz PATCH direto em /finance/card-fee-rates/{id}
- `matchedRate` state armazena o objeto completo (id, feePercent, updatedAt) para exibicao e update inline
- `manualOverride` state evita sobrescrita quando usuario edita os campos

### Descricao completa na tabela de transacoes (extrato)
- Coluna "Descricao" da tabela de transacoes ficava truncada em 300px com "..."
- Fix: removido `truncate` e `max-w-[300px]`, adicionado `break-words` e fonte `text-[11px]` para caber tudo sem aumentar altura



### Sistema de Boleto Bancario — Fase 1: Estrutura Base
- Schema: BoletoStatus enum, BoletoConfig model, Boleto model + relacoes
- TENANT_MODEL_DELEGATES: boletoConfig, boleto adicionados
- Provider interface abstrata (BoletoProvider) com factory pattern
- Providers implementados: Inter (077), Sicredi (748)
- BoletoConfigService: CRUD + encryption AES-256-GCM (padrao NfseConfig)
- BoletoService: criar boleto, registrar no banco, cancelar, consultar, download PDF, webhook, reconciliacao
- BoletoController: 13 endpoints autenticados + webhook publico
- BoletoCronService: marcar vencidos diariamente 7AM
- BoletoModule registrado no AppModule
- Frontend: pagina settings/boleto com 5 steps (banco, credenciais, teste, defaults, comportamento)
- Sidebar: link "Boleto Bancario" adicionado em Configuracoes
- Migration SQL criada manualmente (shadow DB issue)
- Backend + Frontend compilam sem erros

### Sistema de Boleto Bancario — Fase 4: Integracao Financeiro
- Tipos TypeScript: Boleto, BoletoStatusType, BOLETO_STATUS_CONFIG em types/finance.ts
- BoletoStatusBadge: badge colorido por status (9 estados)
- BoletoGenerationModal: gerar boleto de entry com opcao "Gerar e Registrar" ou "Rascunho"
- BoletoDetailModal: detalhes completos, linha digitavel (copiar), codigo barras, PIX, PDF, acoes
- Tabela financeiro: coluna "Boleto" com badge para RECEIVABLE + acoes "Gerar Boleto" / "Ver Boleto"
- Carregamento automatico de boletos ao listar entries RECEIVABLE

### Fix NFS-e status em entries renegociadas/parceladas
- Bug: entry filha de renegociacao nao herdava nfseStatus do pai
- Menu mostrava "Emitir NFS-e" em vez de "PDF NFS-e" quando pai ja tinha nota autorizada
- Fix backend: `renegotiate()` agora propaga nfseStatus + nfseEmissionId para entry filha
- Fix backend: `findEntries()` agora inclui `parentEntry.nfseStatus/nfseEmissionId` no response
- Fix frontend: funcao `resolveNfse()` faz fallback para parentEntry quando entry nao tem nfseStatus
- Coluna NFS-e e menu de acoes agora usam `resolveNfse()` para resolver status efetivo
- `checkNfseBeforePayment` ja tinha fallback para parentEntry (sem mudanca)

### Boleto — Pendente para proximas sessoes
- Teste real com sandbox Sicredi (banco escolhido pelo Juliano)
- Provider Sicredi ajuste fino com API real
- Auto-geracao quando autoRegisterOnEntry=true
- Regua de cobranca: actionType BOLETO
- Providers adicionais (BB, Itau, Sicoob, Bradesco, Santander, Caixa)
- Wizard ChatIA para config boleto

## CONCLUIDO (sessao 177 - 16/04/2026)

### Refatoracao centralizada autoMarkPaid (v1.09.72)
- Helper `resolveAutoPay()` + `applyBalanceDelta()` em PaymentInstrumentService
- Refatorado finance.service.ts createEntry, nfe.service.ts process, nfse-entrada.service.ts process
- Todos os 16 fluxos de criacao de FinancialEntry agora usam o mesmo helper
- Migrados 10 PAYABLE CARTAO_CREDITO + 3 PIX RECEIVABLE que estavam PENDING por bug

### Toggle "Lancar financeiro" no modal de pagamento (v1.09.73-74)
- ChangeEntryStatusDto: novo campo skipCashAccount (boolean)
- Backend: quando skipCashAccount=true, nao cria CardSettlement, nao debita saldo, nao faz fallback
- Frontend: toggle discreto "Lancar financeiro" (padrao ligado) no modal de pagar
- Util para: pagamento com cartao pessoa fisica, reembolso ja compensado fora do sistema

### Lancamento parcelas remanescentes cartao Sicredi (dados)
- 57 parcelas criadas (FIN-00374 a FIN-00430) de 12 compras parceladas pre-sistema
- 8 entries corrigidas de cartao errado (Visa Juliano → Master Ueslei)
- 3 entries PENDING marcadas como PAID no cartao correto
- 7 compras avulsas criadas (FIN-00431 a FIN-00437)
- Saldos finais: Master Ueslei -R$ 11.022,85 / Visa Juliano -R$ 5.913,51

### Auditorias + correcoes (sessao 177, v1.09.72-93)
- `memory/auditoria-modais-pagamento-2026-04-16.md` — 11 modais, 8 toggles, 11 inconsistencias
- `memory/auditoria-financeira-2026-04-16.md` — 5 contas, saldos auditados

**Correcoes implementadas:**
- v1.09.72: resolveAutoPay centralizado
- v1.09.74: Toggle "Lancar financeiro" no modal
- v1.09.79-80: Nova coluna cardBillingDate (separa data fatura de paidAt)
- v1.09.81: matchAsCardInvoice cria AccountTransfer (fix balance-compare)
- v1.09.83: IC-01 a IC-04 (batch skipCashAccount, filtro contas, transaction atomica, cheque backend)
- v1.09.84: IM-01 a IM-03 (renegociacao preserva campos, estorno padronizado, lock no batch)
- v1.09.85: Im-01 a Im-03 (tipo conta batch, warning saldo, preview instrumento)
- v1.09.86: Busca por codigo FIN no financeiro
- v1.09.87-88: Card TRANSITO corrigido (breakdown → so saldo)
- v1.09.89: matchLine e CardSettlement.settle criam AccountTransfer
- v1.09.90: Entries skipCashAccount nao aparecem no extrato + fix taxa duplicada
- v1.09.91-93: Auto-detect paymentMethod na conciliacao + dropdown obrigatorio

**Dados corrigidos:**
- Duplicata FIN-00270 removida (R$ 4.525)
- FIN-00444 codigo atribuido (renegociacao sem codigo)
- FIN-00015 dueDate setado (31/03)
- 37 entries backfill paymentMethod
- 57 parcelas cartao Sicredi + 7 avulsas + 6 encargos lancados
- 8 entries corrigidas de cartao errado (Visa→Master)

## PENDENTE
- 🟡 CardSettlement FIN-00002 vencido (R$ 351,76, deposito nao chegou)
- 🟡 Saldo TRANSITO -R$ 831,55 (ajustes diretos pre-v1.09.89, nao rast reaveis)
- 🟡 FIN-00294 cashAccountId TRANSITO mas conciliada c/ SICREDI (fluxo esperado, nao corrigir)
- 🟢 FIN-00008 diferenca 13c (225,25 vs 225,12)
- 🟢 Contas instrumentos PIX/Boleto/Transf: decisao do usuario manter TRANSITO por enquanto
- IM-04: NFS-e entrada modal processamento (usuario vai testar e reportar)
- Fase 2: cheques de terceiros
- Auto-ajuste de periodo do extrato ao selecionar cartao com billingClosingDay
