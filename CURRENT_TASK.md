# TAREFA ATUAL

## Versao: v1.07.87
## Ultima sessao: 161 (27/03/2026)

## CONCLUIDO (sessao 161)

### Toggle "Exibir aba Baixa de Cartoes" no Financeiro
- Backend: adicionado `showBaixaCartoes: false` ao DEFAULT_SYSTEM_CONFIG.financial
- Settings: novo toggle na secao Financeiro com label e descricao explicativa
- Finance page: carrega systemConfig e filtra dinamicamente a aba "Baixa Cartoes" (oculta por padrao)

## CONCLUIDO (sessao 160) — Deploy v1.07.87

### PDF de Ordem de Servico
- Novo ServiceOrderPdfService: gera PDF com header empresa, dados cliente, detalhes OS, tabela itens, total, observacoes
- Endpoint GET /service-orders/:id/pdf (autenticado, qualquer status)
- Filename automatico: {CODIGO}_{NOME_CLIENTE}.pdf (ex: OS-00047_ALESSANDRA_PINHEIRO_COSTA_NASCIMENTO.pdf)
- Botao "Abrir PDF" no menu de acoes (tres pontinhos) da lista de OS — disponivel para TODAS as OS

## CONCLUIDO (sessao 159) — Deploys v1.07.76 → v1.07.86 (11 deploys)

### Orcamentos — Correcoes Multiplas
- Fix PDF 401: botao PDF abre via blob URL em nova aba (autenticado) ou endpoint publico /q/:token/pdf
- Fix envio indevido: workflow de orcamento NAO dispara mais no create, somente no send() explicito
- Fix campo Data vazio no WhatsApp: {data_agendamento} mostra "A definir" quando OS sem agendamento
- Fix rota system-config: corrigido /company/ → /companies/ em 4 arquivos

### Dispatch Panel — Config de Comportamento
- Menu engrenagem na barra minimizada com opcoes checkbox:
  - "Abrir ao lancar nova OS" (padrao: ligado)
  - "Abrir ao atualizar status" (padrao: desligado)
  - Sem nenhuma opcao marcada: abre somente ao clicar
- Config salva em user preferences (persiste por usuario)
- Fix: engrenagem nao abre mais os cards (data-dispatch-gear stopPropagation)
- Fix: painel inicia minimizado ao carregar pagina

### Edicao de OS Terminal (Concluida/Aprovada)
- 2 novos toggles em Configuracoes > Sistema:
  - "Permitir editar OS Concluida" (desligado por padrao)
  - "Permitir editar OS Aprovada" (desligado por padrao)
- Backend: validacao com systemConfig, bloqueia se CANCELADA sempre
- APROVADA: bloqueia edicao se tem financeiro PAID/CONFIRMED (msg: "Estorne os recebimentos")
- Frontend: botao Editar laranja para OS terminal, tooltip quando bloqueado por financeiro
- Menu contexto: "Lancar Financeiro" e "Cancelar" NAO aparecem para OS terminal (so Editar)
- Pagina de edicao: carrega sysConfig e permite editar se toggle ligado, com aviso laranja

### Re-fetch de Cadastros na Edicao
- Ao editar OS, busca dados frescos do cliente (/partners/:id) e servicos (/services/:id)
- Nome, telefone, endereco, preco, unidade atualizados automaticamente
- Quantidade da OS preservada (nao sobrescreve)
- Fallback para dados salvos se cadastro foi excluido

### Exclusao de Fotos da OS
- Endpoint DELETE /service-orders/:id/attachments/:attachmentId
- Botao X vermelho ao hover sobre cada thumbnail (ADMIN/DESPACHO)
- Confirmacao antes de excluir, audit log

### Financeiro — Valor Zero
- Sistema NAO cria lancamento A Pagar com valor R$ 0,00
- Verificacao em approveAndFinalize e earlyFinancial

### Toggle "Lancar Financeiro ao Aprovar" — Modo Opcional
- Ligado: cria automaticamente A Receber e A Pagar (comportamento anterior)
- Desligado: modal com checkboxes para gestor escolher quais lancar
- Lancamentos com valor zero nao aparecem
- Pode aprovar sem criar nenhum financeiro
- Backend: flags skipReceivable/skipPayable no approveAndFinalize

### Timeline de Avaliacoes
- Linha "Aval. Gestor" com estrelas + comentario (icone amarelo)
- Linha "Aval. Cliente" com status de entrega da notificacao:
  - Enviada / Entregue / Lida / Falhou + telefone destinatario
  - Se avaliou: estrelas + comentario (icone roxo)
  - Se nao avaliou: "Aguardando avaliacao do cliente..."
- Comentario do gestor salvo no evento de aprovacao

### Status de Delivery WhatsApp
- Webhook Meta agora atualiza tabela Notification diretamente (antes so WhatsAppMessage)
- Pagina de Notificacoes mostra: Lida / Entregue / Enviada / Falhou
- Timeline da OS mostra status real de delivery da avaliacao

### Nota: WhatsApp Meta — Pagamento
- Erro 131042 resolvido pelo usuario (pagamento atualizado no Meta Business Suite)
- Novas mensagens terao tracking de delivery correto

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

### BLOQUEADO
- Nota 48 Focus NFe: aguardando correcao da Focus (contato: Cesar/Natan)
