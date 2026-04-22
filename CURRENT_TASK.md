# TAREFA ATUAL

## Versao: v1.09.96 (pendente deploy)
## Ultima sessao: 179 (22/04/2026)

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
