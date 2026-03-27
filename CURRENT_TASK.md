# TAREFA ATUAL

## Versao: v1.08.29
## Ultima sessao: 162 (27/03/2026)

## CONCLUIDO (sessao 162)

### Financeiro — Extrato Consolidado + Conciliacao Bancaria
- Extrato consolidado na aba Resumo com filtro por periodo e conta
- Taxa de cartao como linha separada no extrato (usando valores confirmados pelo gestor)
- Cards individuais por conta (caixa/banco) com nome e saldo
- Saldo inicial como linha no extrato
- Modal conciliacao melhorado: deteccao cartao, split liquido/taxa, auto-match
- Transferencia automatica transito→banco ao conciliar
- Reversao automatica ao desfazer conciliacao
- Toggle Baixa Cartoes (padrao OFF)
- Toggles showInReceivables/showInPayables por conta
- Auto-selecao de conta: dinheiro→caixa, outros→transito

### Orcamentos
- Converter orcamento em OS via formulario pre-preenchido (nao mais direto)
- Desvincular orcamento automaticamente ao excluir OS

### PDF OS e Orcamento
- 4 layouts (Executivo, Corporativo, Moderno, Minimalista)
- Layout configuravel nas opcoes do sistema
- Botao Visualizar com preview de dados ficticios
- Correcao formatacao telefone

### NFS-e
- Variaveis template organizadas em grupos coloridos (Cliente, OS, Nota, Prestador)
- Sanitizacao de infComplementares (remove labels vazios)
- Correcao parser OFX (regex-based, sem XML parser)

### Padrao (...) Actions Dropdown
- Aplicado em: OS, Orcamentos, Parceiros, Produtos, Servicos, NFS-e Saida, Financeiro (A Receber/Pagar), Baixa Cartoes, Conciliacao

### Plano de Contas
- Grupo 6000 Despesas Tributarias com subgrupos ISS/PIS/COFINS/IRPJ/CSLL
- Renomeado "Categoria" → "Plano de Contas"
- Correcao allowPosting nos subgrupos criados manualmente

### Produtores Rurais
- 473 parceiros PF com IE numerica convertidos para isRuralProducer=true
- Campo CAEPF adicionado ao modelo (pendente frontend/backend completo)

## PENDENTE
- Campo CAEPF no formulario de parceiro + payload Focus NFe
- Mascara IE por estado no cadastro de parceiro
- Labels nos campos do formulario de parceiro (PF/PJ/Produtor Rural)
- Data do saldo inicial ao criar conta caixa/banco
- Modal confirmacao ao desfazer conciliacao (mostrar lancamentos)
- Conciliacao automatica (toggle no sistema)
