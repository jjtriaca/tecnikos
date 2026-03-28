# TAREFA ATUAL

## Versao: v1.08.39
## Ultima sessao: 164 (28/03/2026)

## CONCLUIDO (sessao 164)

### Conciliacao Bancaria — Bug Debito/Credito
- Bug: conciliacao de DEBITOS (pagamentos) invertia a direcao dos saldos (banco+, transito-)
- Identificado: codigo sempre fazia transito->banco, ignorando linhas negativas
- Correcao pendente (nao deployada ainda nesta sessao — apenas diagnosticado)

### Modal Receber — Auto-preenchimento + Toggles
- Auto-selecao Conta/Caixa por forma de pagamento (Dinheiro/Cheque->Caixa, outros->Transito)
- Auto-selecao Plano de Contas "1100 - Receita de Servicos" para recebimentos
- 2 toggles em Configuracoes > Sistema > Financeiro:
  - lockAccountOnReceive: trava conta/caixa (default: ligado)
  - lockPlanOnReceive: trava plano de contas (default: ligado)
- sysConfig passado como prop para EntriesTab

### Conta Caixa — Bug Save TRANSITO
- Identificado: DTO de update so aceita CAIXA/BANCO, rejeita TRANSITO
- Correcao pendente

## PENDENTE
- **Bug critico**: Conciliacao debitos inverte saldos (banco+ em vez de banco-)
- **Bug**: DTO update cash account nao aceita type TRANSITO
- **Bug**: showInReceivables nao persiste ao salvar conta
- Campo CAEPF no formulario de parceiro + payload Focus NFe
- Mascara IE por estado no cadastro de parceiro
- Labels nos campos do formulario de parceiro (PF/PJ/Produtor Rural)
- Data do saldo inicial ao criar conta caixa/banco
- Conciliacao automatica (toggle no sistema)
