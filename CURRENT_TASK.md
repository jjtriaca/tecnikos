# TAREFA ATUAL

## Versao: v1.08.69
## Ultima sessao: 171 (07/04/2026)

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

## CONCLUIDO (sessao 171)

### Fix pagina em branco no PDF (orcamento + OS)
- Bug: PDFKit adicionava pagina em branco ao renderizar rodape em `pageHeight - 35`
- Causa: y do rodape ficava abaixo da margem inferior, triggering auto-pagination
- Fix: `drawFooter()` desativa temporariamente `page.margins.bottom = 0` antes de escrever
- Corrigido em ambos: `quote-pdf.service.ts` e `service-order-pdf.service.ts`

## PENDENTE
- Fase 2: cheques de terceiros como meio de pagamento (controle estoque cheques)
- Auto-ajuste de periodo do extrato ao selecionar cartao com billingClosingDay
