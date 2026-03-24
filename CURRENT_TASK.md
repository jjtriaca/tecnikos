# TAREFA ATUAL

## Versao: v1.07.35
## Ultima sessao: 157 (23/03/2026)

## CONCLUIDO (sessao 157) — Deploys v1.07.28 → v1.07.35 (8 deploys)

### PWA — Valor do Tecnico
- Lista de OS no PWA mostra techCommissionCents ao inves de valueCents quando disponivel
- Detalhe da OS: comissao aparece mesmo sem ledger (cascata: ledger → techCommissionCents → BPS)
- Lista respeita toggles do emulador (showValue/showCommission) por workflow via steps.techPortalConfig
- Backend my-orders retorna techCommissionCents

### Dashboard — Comissao Tecnico
- Nova coluna "Comissao Tecnico" na tabela de OS (verde, sortavel)
- Campo "Comissao Tecnico" no detalhe da OS (secao Financeiro e Datas)
- CSV export inclui coluna de comissao
- Auto-calculo de techCommissionCents na criacao da OS a partir dos items (techFixedValueCents + commissionBps)

### Emulador — Seguranca
- Removido botao "Usar OS existente" (so permite criar OS de teste)
- Backend resetPreviewOs bloqueado para OS reais (so PREVIEW)
- Auditoria dos toggles: showAttachments e fieldOrder identificados como fantasma (nao implementados no portal)

### PWA — Offline Safety
- ACTION_BUTTONS (Aceitar/Recusar/A Caminho) bloqueados quando offline
- Banner amarelo "Sem conexao — conecte-se para continuar" com auto-dismiss ao voltar online

### NFS-e
- Corrigido valor da nota 52 no banco (3000 centavos → 300000 centavos = R$ 3.000)
- Corrigido item da OS-00038 com techFixedValueCents
- PDF de notas importadas manualmente: mensagem clara "PDF nao disponivel para notas importadas manualmente"
- DanfseService criado (PDFKit) mas revertido — DANFSe oficial da Focus/prefeitura tem QR code e logo que nao conseguimos replicar
- Frontend mostra mensagem de erro do backend no toast (NFS-e Saida + Financeiro)

### Focus NFe
- Nota 50 cancelada pela engenharia da Focus (confirmado)
- Nota 48 ainda inconsistente (AUTHORIZED na Focus, CANCELLING no Tecnikos) — aguardando correcao

## PROXIMA SESSAO — PRIORIDADES

### 1. Emulador — Toggles Fantasma
- showAttachments: decidir se remove toggle ou implementa secao de galeria no portal
- fieldOrder: decidir se remove drag-and-drop ou implementa reordenacao dinamica no portal

### 2. Enriquecer Bloco GPS (Etapas Configuraveis) — PENDENTE
- Adicionar ao editor do bloco GPS (modo continuo) secao de etapas de escalonamento
- Config JSON com offlineSteps, onlineIntervalSeconds, highAccuracyOnline

### 3. Auditoria de Funcionalidades
- Verificar se endpoints de pausa/resume/incident funcionam no PWA
- Verificar se approve-and-finalize cria financeiro corretamente com novos campos
- Testar retorno de OS (botao + pre-fill + parentOrderId)

### 4. CLT Fase 2
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
- DANFSe local: implementar com logo prefeitura + QR code quando viavel

### BLOQUEADO
- Nota 48 Focus NFe: aguardando correcao da Focus (contato: Cesar/Natan)
