# TAREFA ATUAL

## Versao: v1.07.26
## Ultima sessao: 156 (23/03/2026)

## CONCLUIDO (sessao 156) — Deploys v1.07.07 → v1.07.26 (20 deploys)

### Financeiro — Reorganizacao completa
- Abas agrupadas: Caixas/Bancos, Formas Pgto, Instrumentos, Cobranca, Plano de Contas → dropdown "Cadastros"
- Resumo compactado: KPI cards (Receita, Custos, Resultado Liquido) + A Receber/Pagar + Caixas/Bancos
- Drag-and-drop entre secoes do Resumo com persistencia localStorage
- Plano de Contas movido de Resultados para Financeiro > Cadastros

### Financeiro — Fluxo de status simplificado
- Eliminado status CONFIRMED (era confuso, 2 cliques pra pagar)
- Novo fluxo: PENDING → PAID → ESTORNADO (volta PENDING) | CANCELLED
- 119 entries migradas de CONFIRMED para PENDING
- Botao "Pagar"/"Receber" agora vai direto para PAID
- Estorno volta para PENDING (nao mais CONFIRMED)

### Financeiro — Campos e colunas
- Campo Categoria (plano de contas) obrigatorio em: modal Pagar/Receber, Nova Entrada, Wizard NFS-e, Wizard NF-e, Approve-and-finalize
- Campo Data de Pagamento/Recebimento no modal (default hoje, editavel)
- Coluna "Pago em" / "Recebido em" na tabela
- Filtros por data de pagamento (paidFrom/paidTo)
- Total filtrado no rodape da tabela (aggregate backend)
- Colunas diferenciadas: A Receber tem NFS-e, A Pagar tem Comissao (sem NFS-e)
- Fontes reduzidas para melhor leitura
- Aviso visual quando sem conta/caixa selecionada

### Financeiro — Pagamento em lote
- Checkboxes na tabela para selecao multipla (so entradas pendentes)
- Barra flutuante: "X selecionados — R$ Y | Pagar todos | Limpar"
- Modal com data, forma pagamento, conta/caixa, lista dos selecionados
- Backend batch-pay com batchPaymentId para rastreio

### Financeiro — Vinculacao NFS-e a lancamentos existentes
- Wizard NFS-e Entrada: 3 opcoes (Vincular existente / Criar novo / Nao criar)
- Busca automatica de A Pagar pendentes do mesmo parceiro
- Tabela N:N NfseEntradaEntryLink para vinculo multiplo
- Evita duplicacao de lancamentos (OS + NFS-e)

### NFS-e Import
- Modal de confirmacao com aviso de cota + campo data antes de importar
- Backend aceita dateFrom para filtrar notas por data

### Filtro A Receber
- Status PAID mostra "Recebido" (nao "Pago") na aba A Receber

### Sidebar
- Auto-expand no hover quando recolhido (expande ao passar mouse, recolhe apos 1.5s)

### NFS-e Saida — Vinculacao manual
- Nota 52 (R$ 3.000 CONSTRUTORA COSENTINO) emitida no portal, importada manualmente e vinculada ao lancamento

## PROXIMA SESSAO — PRIORIDADES

### 1. Enriquecer Bloco GPS (Etapas Configuraveis) — PENDENTE
- Adicionar ao editor do bloco GPS (modo continuo) secao de etapas de escalonamento
- Config JSON com offlineSteps, onlineIntervalSeconds, highAccuracyOnline

### 2. Auditoria de Funcionalidades
- Verificar TODOS os toggles do sistema estao realmente sendo lidos e aplicados
- Verificar se endpoints de pausa/resume/incident funcionam no PWA
- Verificar se approve-and-finalize cria financeiro corretamente
- Testar retorno de OS (botao + pre-fill + parentOrderId)

### 3. CLT Fase 2
- Alertas no PWA: banner 4h sem pausa refeicao
- Alertas no PWA: banner 8h de jornada
- Push pro gestor nos alertas
- Verificar intervalo interjornada (11h)

### PENDENCIAS FUTURAS
- Cadastro Parceiros: tratamento de empresas com filiais
- ChatIA: revisar orientacoes onboarding geral
- NFS-e: importacao de XML de nota emitida externamente (feature para importar como a nota 52)
- Conciliacao bancaria: integrar batchPaymentId na reconciliacao

### BLOQUEADO
- (nenhum)
