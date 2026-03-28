# TAREFA ATUAL

## Versao: v1.08.44
## Ultima sessao: 165 (28/03/2026)

## CONCLUIDO (sessao 164)

### Modal Receber — Auto-preenchimento + Toggles
- Auto-selecao Conta/Caixa por forma de pagamento (Dinheiro/Cheque->Caixa, outros->Transito)
- Auto-selecao Plano de Contas "1100 - Receita de Servicos" para recebimentos
- 2 toggles em Configuracoes > Sistema > Financeiro (lockAccountOnReceive, lockPlanOnReceive)
- Novos tenants carregam defaults via mergeDeep automaticamente

### Card Valores em Transito — Breakdown Creditos/Debitos
- Backend calcula transitCredits e transitDebits
- Card mostra creditos (verde) e debitos (vermelho) separados

### Cards Caixas/Bancos — Drag Individual
- Cards individuais reordenaveis via drag & drop dentro do bloco
- Ordem salva em localStorage

### NFS-e — Contatos + Variaveis + IE
- Fallback: email/phone do cadastro do parceiro exibidos automaticamente na tela de envio
- Nova variavel {complemento_cliente} no template de informacoes complementares
- IE formatada automaticamente por estado no backend (formatIE)
- Botao "Salvar Alteracoes" duplicado no final da pagina de configuracoes

### Parceiros — Filtro Produtor Rural + Busca Ampliada
- Filtro "Produtor Rural" no dropdown Tipo Pessoa (separado de PF)
- Busca agora inclui tradeName (fantasia/fazenda) e code (PAR-XXXXX)

### Mascara IE MT
- Ajustada para aceitar 9 digitos (formato predominante no cadastro)
- MT sem separadores (formato SEFAZ: apenas digitos)

### Planilha Orcamento Piscinas (fora do sistema)
- 46 formulas SUMIF corrigidas: Descricao -> Etapa
- Tabela83[Descricao] (Previsao de Termino) preservada

## CONCLUIDO (sessoes anteriores, confirmado sessao 165)
- Conciliacao debitos: logica de saldos correta (bank decrement, transit increment)
- DTO update cash account aceita type TRANSITO
- showInReceivables persiste corretamente ao salvar conta
- Campo CAEPF no formulario de parceiro + payload Focus NFe
- Mascara IE por estado no cadastro de parceiro (maskIE por estado)
- Labels condicionais no formulario de parceiro (PF/PJ/Produtor Rural)

## CONCLUIDO (sessao 165)

### Data do Saldo Inicial — Contas Caixa/Banco
- Novo campo initialBalanceDate no schema CashAccount (DateTime?)
- DTO, service e frontend atualizados
- Campo date picker ao lado do saldo inicial no formulario
- Editavel a qualquer momento (nao depende do saldo ser zero)

### Conciliacao Automatica — Toggle + Engine
- Toggle "Conciliacao automatica" em Configuracoes > Sistema > Financeiro
- Default: desligado (autoReconciliation: false)
- Ao importar extrato com toggle ativo: auto-match por valor exato
- So concilia quando ha exatamente 1 candidato (sem ambiguidade)
- Busca entries PAID no transito com mesmo valor e tipo (RECEIVABLE/PAYABLE)
- Marcado como "(auto)" no campo matchedByName

## PENDENTE
- (sem pendencias)
