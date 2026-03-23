# TAREFA ATUAL

## Versao: v1.07.27
## Ultima sessao: 156 (23/03/2026)

## CONCLUIDO (sessao 156) — Deploys v1.07.07 → v1.07.27 (21 deploys)

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
- Estorno volta para PENDING

### Financeiro — Campos e colunas
- Campo Categoria obrigatorio em: modal Pagar/Receber, Nova Entrada, Wizard NFS-e, Wizard NF-e, Approve-and-finalize (com defaults 1100/2100)
- Campo Data de Pagamento/Recebimento no modal (default hoje, editavel)
- Coluna "Pago em" / "Recebido em" na tabela (sortavel)
- Filtros compactos: dropdown "Periodo por" (Criacao/Pagamento/Vencimento) + De/Ate
- Filtro "Vencidas" no status (pendentes com vencimento passado)
- Total filtrado no rodape da tabela (aggregate backend)
- Colunas diferenciadas: A Receber tem NFS-e, A Pagar tem Comissao (sem NFS-e)
- Fontes reduzidas para melhor leitura
- Aviso visual quando sem conta/caixa selecionada
- Status "Recebido" (nao "Pago") na aba A Receber

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

### NFS-e Saida
- Nota 52 (R$ 3.000 CONSTRUTORA COSENTINO) importada manualmente e vinculada ao lancamento
- Auto-cleanup do vinculo quando NFS-e cancelada JA EXISTIA no codigo (todos os pontos cobertos)

### NF-e Import
- Campos Forma de Pagamento e Categoria obrigatorios no step Financeiro
- Botao Proximo bloqueado sem preencher

### Sidebar
- Auto-expand no hover quando recolhido (expande ao passar mouse, recolhe apos 1.5s)

## PROXIMA SESSAO — PRIORIDADES

### 1. Enriquecer Bloco GPS (Etapas Configuraveis) — PENDENTE
- Adicionar ao editor do bloco GPS (modo continuo) secao de etapas de escalonamento
- Config JSON com offlineSteps, onlineIntervalSeconds, highAccuracyOnline

### 2. Auditoria de Funcionalidades
- Verificar TODOS os toggles do sistema estao realmente sendo lidos e aplicados
- Verificar se endpoints de pausa/resume/incident funcionam no PWA
- Verificar se approve-and-finalize cria financeiro corretamente com novos campos
- Testar retorno de OS (botao + pre-fill + parentOrderId)

### 3. CLT Fase 2
- Alertas no PWA: banner 4h sem pausa refeicao
- Alertas no PWA: banner 8h de jornada
- Push pro gestor nos alertas
- Verificar intervalo interjornada (11h)

### PENDENCIAS FUTURAS
- Cadastro Parceiros: tratamento de empresas com filiais
- ChatIA: revisar orientacoes onboarding geral
- NFS-e: feature para importar XML de nota emitida externamente (como nota 52)
- Conciliacao bancaria: integrar batchPaymentId na reconciliacao
- Financeiro: conciliacao automatica (match por valor/data entre extrato e lancamentos)

### BLOQUEADO
- (nenhum)
