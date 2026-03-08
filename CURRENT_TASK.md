# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 77 CONCLUIDA — v1.01.32 em producao

## Ultima sessao: 77 (07/03/2026)
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

## O que foi feito na sessao 77:

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

### PENDENTE — WhatsApp (parado)
- Comprar chip dedicado para WhatsApp Business API — Chip Vivo comprado, ativacao pendente
- Adicionar numero real no Meta > API Setup
- Gerar token permanente do System User "Tecnikos API"
- Configurar no Tecnikos com novo Phone Number ID e token

## Projetos Futuros
- **Registro de marca INPI**: Solicitar registro da marca "Tecnikos" no INPI (Instituto Nacional da Propriedade Industrial). Logo SVG disponivel em `brand/`.

## Versao atual: v1.01.31 — em producao

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
