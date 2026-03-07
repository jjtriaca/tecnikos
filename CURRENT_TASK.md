# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: ✅ FASE 2 CONCLUIDA — NFS-e de Entrada

## Última sessão: 71 (07/03/2026)
- Sessões 61-62: Dashboard Financeiro + Auditoria (v1.01.18-19)
- Sessão 63: Fix NFe Import Flow (v1.01.20)
- Sessões 64-68: 4 estudos fiscais completos
- Sessão 69-70: Fase 1 — Fundação Fiscal (regime, contabilista, impostos NFe)
- Sessão 71: Fase 2 — NFS-e de Entrada completa (backend + frontend)

## O que foi feito na Fase 2:
- [x] Model NfseEntrada no Prisma (50+ campos, indexes, FK)
- [x] Migration SQL aplicada (20260306210000_nfse_entrada)
- [x] Parser XML dual: ABRASF 2.04 + Nacional/SPED (nfse-entrada-parser.service.ts)
- [x] Service CRUD completo (upload XML, manual, findAll, findOne, update, cancel, linkPrestador)
- [x] Controller REST com 7 endpoints protegidos por roles
- [x] Module registrado no app.module.ts
- [x] Frontend: pagina /nfe/entrada com upload XML + formulario manual
- [x] Frontend: tabela com DraggableHeader/SortableHeader, filtros, paginacao, detalhes expandiveis
- [x] Frontend: cards de resumo (total notas, valor servicos, ISS retido)
- [x] Sidebar: link NFS-e Entrada adicionado no submenu NFe
- [x] Build backend + frontend: zero erros

## Projeto Fiscal — Próximas Fases

### FASE 3: Escrituração e Relatórios
- [ ] Model FiscalPeriod
- [ ] Relatório Livro de Entradas
- [ ] Relatório Serviços Tomados
- [ ] Dashboard Fiscal com obrigações e prazos

### FASE 4: Geração SPED
- [ ] Gerador EFD-ICMS/IPI (arquivo TXT)
- [ ] Gerador EFD-Contribuições (arquivo TXT)
- [ ] DeSTDA para SN

## Documentos de referência:
- `memory/projeto-modulo-fiscal.md` — Projeto consolidado com todas as fases
- `memory/estudo-obrigacoes-fiscais-por-regime.md` — Obrigações SN/LP/LR
- `memory/sped-fiscal-efd-icms-ipi.md` — EFD-ICMS/IPI detalhado
- `memory/estudo-sped-contribuicoes.md` — EFD-Contribuições detalhado
- `memory/estudo-nfse-entrada-iss-completo.md` — NFS-e entrada + ISS

## Versão atual: v1.01.20 (pendente deploy com fase 1)

## Se reconectar no MEIO de uma tarefa:
- Verifique o TODO list no Claude (se existir)
- Leia o último bloco do CHAT_LOG.md para contexto
- Continue exatamente do ponto onde parou
- NÃO pergunte ao Juliano — ele autorizou execução irrestrita

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte técnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessão
- Versão em version.json sempre atualizada
