# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 80 EM ANDAMENTO — Contratos de Tecnico

## Ultima sessao: 80 (08/03/2026)
- Sessoes 61-62: Dashboard Financeiro + Auditoria (v1.01.18-19)
- Sessao 63: Fix NFe Import Flow (v1.01.20)
- Sessoes 64-68: 4 estudos fiscais completos
- Sessao 69-70: Fase 1 — Fundacao Fiscal (regime, contabilista, impostos NFe)
- Sessao 71: Fase 2 — NFS-e de Entrada + Fase 3 — Escrituracao e Relatorios (v1.01.22)
- Sessao 72: Fase 4 — Geracao SPED + Deploy v1.01.23
- Sessao 73: WhatsApp Test Send + Modulo Email SMTP + Fix + Privacy Page (v1.01.24-27)
- Sessao 74: Zoho Mail DNS + Logo Tecnikos + Deploy v1.01.28
- Sessao 75: Manifestacao do Destinatario + Fix IMPORTED + Deploy v1.01.29-30
- Sessao 76: Finalidade Fiscal + Acoes Primeira Coluna + DraggableHeader em tudo (v1.01.31)
- Sessao 77: Codigos Sequenciais (SKU) + Deteccao Duplicados (v1.01.32)
- Sessao 78: Reverter Importacao NFe (v1.01.39) + WhatsApp Business API (v1.01.56)
- Sessao 79: Instrumentos de Pagamento (v1.01.58)
- Sessao 80: Contratos de Tecnico (onboarding via workflow)

## O que foi feito na sessao 80:

### Sistema de Contrato/Aceite de Tecnicos
- [x] Schema: modelo TechnicianContract (token, status, conteudo snapshot, aceite com IP/UA)
- [x] Migration: 20260309000000_technician_contracts
- [x] Backend: ContractModule (service + controller + public controller)
- [x] Backend: sendContract(), getByToken(), markViewed(), acceptContract(), cancelContract()
- [x] Backend: Endpoint publico GET/POST /contract/:token (com @Public() e Throttle)
- [x] Backend: Endpoint autenticado GET /contracts/partner/:id, POST /contracts/send, POST /contracts/:id/cancel
- [x] Backend: Integracao no PartnerService — dispara contrato ao criar TECNICO ou nova especializacao
- [x] Frontend: TechnicianOnboardingConfig no WorkflowFormConfig (stage-config.ts)
- [x] Frontend: TechnicianOnboardingSection (secao "Novo Tecnico" no workflow editor)
- [x] Frontend: Pagina publica /contract/[token] — visualizacao e aceite de contrato
- [x] Frontend: Config salva/restaurada no JSON V2 do workflow (compileToV2/decompileFromV2)
- [x] Build: backend 0 erros, frontend 0 erros
- [x] Deploy: v1.01.59 em producao + migration SQL aplicada
- [x] Modelos de contrato padrao (DEFAULT_CONTRACT_CONTENT + DEFAULT_SPECIALIZATION_CONTRACT)
- [x] Deploy: v1.01.60 em producao
- [x] Fix: validacao workflow aceita onboarding sem etapas (v1.01.61)
- [x] Fix: dispatchTechnicianContract busca TODOS os workflows, nao so default (v1.01.62)
- [x] Fix: log de notificacao para email e mock (v1.01.63)
- [x] Fix: compileToV2 early return perdendo technicianOnboarding (v1.01.64) — ROOT CAUSE
- [x] Fix: formatPhone strip leading zero para Meta API (v1.01.65)
- [x] Fix: sanitizePhone + 1465 phones corrigidos no DB + maskPhone frontend (v1.01.66)
- [x] Fix: substituicao de variaveis {nome}/{empresa}/etc no contrato + contrato 10 clausulas (v1.01.67)
- [x] Assinatura digital: requireSignature/requireAcceptance/signatureData no schema (v1.01.68)
- [x] Migration: 20260309010000_contract_signature_fields
- [x] Backend: flags passadas no sendContract, retornadas no getByToken, signatureData validada e salva no accept
- [x] Frontend: componente SignaturePad (canvas touch/mouse)
- [x] Frontend: pagina /contract/[token] com assinatura digital quando requireSignature=true
- [x] Variavel {razao_social} adicionada: backend (substituicao), frontend (templates + botoes)
- [x] Deploy: v1.01.68 em producao + migration aplicada

## O que foi feito na sessao 79:

### Instrumentos de Pagamento da Empresa
- [x] Schema: modelo PaymentInstrument + campo paymentInstrumentId em FinancialEntry
- [x] Migration: 20260308210000_add_payment_instrument
- [x] Backend: PaymentInstrumentService CRUD (findAll, findActive, findByMethod, create, update, remove)
- [x] Backend: DTOs (CreatePaymentInstrumentDto, UpdatePaymentInstrumentDto)
- [x] Backend: Endpoints GET/POST/PATCH/DELETE /finance/payment-instruments
- [x] Backend: paymentInstrumentId salvo no fluxo de pagamento (changeEntryStatus)
- [x] Backend: DRE com paymentBreakdown (byMethod + byInstrument)
- [x] Frontend: Interface PaymentInstrument + tipos DRE breakdown
- [x] Frontend: PaymentInstrumentsTab (aba CRUD completa)
- [x] Frontend: Dropdown instrumento no modal de pagamento
- [x] Frontend: DreReport com toggle agrupamento por pagamento
- [x] Build: backend 0 erros, frontend 0 erros
- [x] Deploy: v1.01.58 em producao

### Sessao 78 (anterior):

### Reverter Importacao NFe
- [x] Backend: NfeService.revert() — reverte importacao PROCESSED
- [x] Frontend: botoes "Reverter" nas abas Upload e SEFAZ
- [x] Deploy: v1.01.39 em producao

### WhatsApp Business API
- [x] Chip Vivo ativado (+55 66 9665-2916)
- [x] Token permanente gerado, webhook configurado
- [x] Fix sendTestMessage (texto direto em vez de hello_world)
- [x] Deploy: v1.01.56 em producao

### Sessao 77 (anterior):

### Codigos Sequenciais (SKU) em Todos os Cadastros
- [x] Schema: `code String?` + `@@unique([companyId, code])` em Partner, ServiceOrder, FinancialEntry, Evaluation, User
- [x] CodeCounter model para geracao atomica de codigos por empresa+entidade
- [x] CodeGeneratorService: generateCode() com upsert+increment atomico
- [x] PrismaService: self-healing ensureCodeColumns() — cria colunas, tabela, backfill
- [x] Backend: auto-geracao de codigo em partner, order, finance, evaluation, user, nfe services
- [x] Frontend: coluna "Codigo" em Partners, Orders, Finance, Users (layout v3)

### Deteccao de Duplicados
- [x] Backend: checkDuplicateDocument() no PartnerService
- [x] Backend: GET /partners/check-duplicate endpoint
- [x] Frontend: PartnerForm — check onBlur CPF/CNPJ
- [x] CNPJ: block (nao permite cadastro duplicado)
- [x] CPF: warning com checkbox "Cadastrar mesmo assim (produtor rural com IE diferente)"
- [x] NFe: duplicidade ja coberta pela unicidade da chave de acesso (nfeKey)

### Deploy v1.01.32
- [x] Backend: 0 erros TypeScript
- [x] Frontend: 0 erros build
- [x] Deploy: sucesso

### WhatsApp Business API — CONCLUIDO (08/03/2026)
- [x] Chip Vivo comprado e ativado: +55 66 9665-2916
- [x] Numero adicionado e verificado no Meta WhatsApp Manager (WABA: SLS Sol e Lazer Soluções)
- [x] Token permanente gerado do System User "Tecnikos API" (nunca expira)
- [x] Credenciais configuradas no Tecnikos (Phone Number ID: 996592133539837)
- [x] Numero registrado via API (POST /register)
- [x] Template "teste_conexao" criado (pt_BR, UTILITY)
- [x] Cartao de pagamento adicionado no Meta (Mastercard *9767)
- [x] Verificacao da empresa Meta: em andamento
- [x] Mensagem de teste enviada com sucesso para +5566999861230
- [x] Webhook configurado no Meta (Callback URL + Verify Token + campo messages assinado)
- [x] Fix: sendTestMessage usa texto em vez de hello_world (v1.01.56)
- PENDENTE: Template "teste_conexao" aprovado pelo Meta (status PENDING)

## Projetos Futuros
- **Registro de marca INPI**: Solicitar registro da marca "Tecnikos" no INPI (Instituto Nacional da Propriedade Industrial). Logo SVG disponivel em `brand/`.

## Versao atual: v1.01.68 — em producao

## Se reconectar no MEIO de uma tarefa:
- Verifique o TODO list no Claude (se existir)
- Leia o ultimo bloco do CHAT_LOG.md para contexto
- Continue exatamente do ponto onde parou
- NAO pergunte ao Juliano — ele autorizou execucao irrestrita

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
