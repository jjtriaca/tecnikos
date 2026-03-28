# TAREFA ATUAL

## Versao: v1.08.40
## Ultima sessao: 164 (28/03/2026)

## CONCLUIDO (sessao 164)

### Modal Receber — Auto-preenchimento + Toggles
- Auto-selecao Conta/Caixa por forma de pagamento (Dinheiro/Cheque->Caixa, outros->Transito)
- Auto-selecao Plano de Contas "1100 - Receita de Servicos" para recebimentos
- 2 toggles em Configuracoes > Sistema > Financeiro:
  - lockAccountOnReceive: trava conta/caixa (default: ligado)
  - lockPlanOnReceive: trava plano de contas (default: ligado)
- sysConfig passado como prop para EntriesTab
- Novos tenants carregam defaults via mergeDeep automaticamente

### Card Valores em Transito — Breakdown Creditos/Debitos
- Backend: calcula transitCredits e transitDebits (entries PAID no transito por tipo)
- Frontend: card mostra creditos (▲ verde) e debitos (▼ vermelho) separados

### Cards Caixas/Bancos — Drag Individual
- Cards individuais podem ser reordenados dentro do bloco via drag & drop
- Ordem salva em localStorage (tecnikos_finance_card_order)
- Drag de secoes inteiras (blocos) mantido funcionando

### Planilha Orcamento Piscinas — Correcao SUMIF
- Bug: formulas SUMIF classificavam produto/servico pela Descricao (nome do item)
- Correcao: trocado para classificar pela Etapa (coluna de classificacao)
- 46 formulas corrigidas em Imp.Tabela e Linear via edicao direta no XML
- Cuidado: Tabela83[Descricao] (Previsao de Termino) preservada intacta
- VBA tambem filtra por Descricao (linha 72 Modulo_casa_maquinas) — pendente

## PENDENTE
- **Bug critico**: Conciliacao debitos inverte saldos (banco+ em vez de banco-)
- **Bug**: DTO update cash account nao aceita type TRANSITO
- **Bug**: showInReceivables nao persiste ao salvar conta
- **VBA Planilha**: Modulo_casa_maquinas linha 72 filtra por Descricao, deveria incluir Etapa
- Campo CAEPF no formulario de parceiro + payload Focus NFe
- Mascara IE por estado no cadastro de parceiro
- Labels nos campos do formulario de parceiro (PF/PJ/Produtor Rural)
- Data do saldo inicial ao criar conta caixa/banco
- Conciliacao automatica (toggle no sistema)
