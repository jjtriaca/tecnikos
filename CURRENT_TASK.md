# TAREFA ATUAL

## Versao: v1.07.76
## Ultima sessao: 159 (26/03/2026)

## CONCLUIDO (sessao 159) — Deploy v1.07.76

### Orcamentos — Correcoes Multiplas
- Fix PDF 401: botao PDF agora abre via blob URL em nova aba (autenticado) ou via endpoint publico /q/:token/pdf
- Fix envio indevido: workflow de orcamento NAO dispara mais no create, somente no send() explicito
- Fix campo Data vazio no WhatsApp: {data_agendamento} mostra "A definir" quando OS sem agendamento

### Dispatch Panel — Config de Comportamento
- Menu engrenagem na barra minimizada com opcoes:
  - "Abrir ao lancar nova OS" (checkbox, padrao: ligado)
  - "Abrir ao atualizar status" (checkbox, padrao: desligado)
  - Sem nenhuma opcao marcada: abre somente ao clicar
- Config salva em user preferences (persiste por usuario)
- Deteccao automatica de novas OS e mudancas de status no polling

### Nota: WhatsApp Meta — Pagamento Bloqueado
- Erro 131042: "Business eligibility payment issue" — Meta bloqueou envio de templates
- Usuario precisa resolver metodo de pagamento no Meta Business Suite

## PROXIMA SESSAO — PRIORIDADES

### 1. Testar Fluxo Completo OS Agendada
- Criar OS com agendamento → workflow dispara → tecnico aceita → notifica cliente
- Testar notificacao ao cliente (adicionar destinatario Cliente no bloco Notificar)
- Testar lancamento financeiro antecipado → aprovar OS → nao duplica

### 2. Cadastro de Unidades Customizaveis
- Botao "+" ao lado do select de unidade para cadastrar novas unidades
- Possibilidade de tabela ServiceUnit por empresa

### 3. Emulador — Toggles Fantasma
- showAttachments: decidir se remove toggle ou implementa
- fieldOrder: decidir se remove ou implementa reordenacao

### 4. CLT Fase 2
- Alertas no PWA: banner 4h sem pausa refeicao
- Alertas no PWA: banner 8h de jornada
- Push pro gestor nos alertas

### PENDENCIAS FUTURAS
- Cadastro Parceiros: tratamento de empresas com filiais
- ChatIA: revisar orientacoes onboarding geral
- NFS-e: feature para importar XML de nota emitida externamente
- Conciliacao bancaria: integrar batchPaymentId na reconciliacao
- Financeiro: conciliacao automatica
- DANFSe local: implementar com logo prefeitura + QR code quando viavel
- Consulta SINTEGRA: API terceiros para empresas sem certificado NF-e
- Investigar: tela flutuante dispatch some ao editar OS (nao reproduzido apos refresh)

### BLOQUEADO
- Nota 48 Focus NFe: aguardando correcao da Focus (contato: Cesar/Natan)
