# TAREFA ATUAL

## Versao: v1.08.35
## Ultima sessao: 163 (28/03/2026)

## CONCLUIDO (sessao 163)

### Conciliacao Bancaria — Bug Fixes
- Bug unmatch: `mode: 'insensitive'` faltando na busca por conta transit (name UPPER)
- FIN-00272 movida manualmente de volta para Valores em Transito (saldo corrigido)
- Removidas transferencias AccountTransfer duplicadas

### Conta Caixa/Banco — Codigo Sequencial + Tipo TRANSITO
- Novo enum CashAccountType: TRANSITO (alem de CAIXA/BANCO)
- Campo `code` (CX-00001) no CashAccount — gerado automaticamente, nao editavel
- Reconciliacao usa `type: 'TRANSITO'` em vez de busca por nome (robusto)
- Auto-selecao no frontend usa `type` em vez de nome
- Card "Em Transito" no resumo de saldos (roxo)
- Formulario: mostra codigo nao editavel, tipo TRANSITO bloqueado, sem botao excluir
- Labels TRANSITO em todos os dropdowns do financeiro
- Auto-criacao conta TRANSITO no provisioning de novos tenants
- Dados migrados: CX-00001 (Caixa), CX-00002 (Sicredi), CX-00003 (Transito)

## PENDENTE
- Campo CAEPF no formulario de parceiro + payload Focus NFe
- Mascara IE por estado no cadastro de parceiro
- Labels nos campos do formulario de parceiro (PF/PJ/Produtor Rural)
- Data do saldo inicial ao criar conta caixa/banco
- Conciliacao automatica (toggle no sistema)
