# TAREFA ATUAL

## Versao: v1.07.64
## Ultima sessao: 158 (25/03/2026)

## CONCLUIDO (sessao 158) — Deploys v1.07.49 → v1.07.64 (16 deploys)

### Consulta SEFAZ — Importar dados Produtor Rural
- Modal "Importar dados da SEFAZ" no cadastro de parceiros (estilo Sankhya)
- Consulta CadConsultaCadastro4 via SOAP com mTLS (certificado A1)
- Metodo SOAP dinamico por estado (consultaCadastro vs consultaCadastro4)
- XML compacto (MT rejeita whitespace), SOAPAction no Content-Type (Axis2)
- Parse recursivo de namespaces (soapenv:, soap:, env:, etc.)
- Suporte: AM, BA, GO, MG, MS, MT, PE, PR, RS, SP + SVRS (AC, ES, PB, RN, SC)
- Limitacao: SLS Obras e isenta de IE, nao pode consultar SEFAZ (funciona para tenants com certificado NF-e)

### Produtor Rural PF + IE — Estudo Fiscal
- Estudo completo: NF-e vs NFS-e para produtor rural PF
- NFS-e (Focus NFe): IE NAO vai no XML do tomador (ISS, nao ICMS)
- IE e dado cadastral interno, nao impacta emissao NFS-e
- Multiplas IEs por parceiro: adiado (campo unico suficiente por enquanto)

### Lancamento Financeiro Antecipado
- Novo botao "Lancar Financeiro" no menu de acoes da OS
- Modal com checkboxes: A Receber (cliente) + A Pagar (tecnico)
- Lancamentos criados como PAGO com metodo de pagamento, vencimento e conta
- finalize() e approveAndFinalize() ajustados para nao duplicar entries
- Evento EARLY_FINANCIAL para auditoria
- Endpoint retry-workflow para re-executar workflow de OS existente

### Workflow — Trigger Agenda
- Fix: OS com scheduledStartAt agora dispara trigger os_agenda_created
- Independente do techAssignmentMode (DIRECTED, BY_SPECIALIZATION, etc.)

### Workflow — Chips de Variaveis
- Fix: chips inserem na posicao do cursor (ref textarea + selectionStart/selectionEnd)
- Labels dos chips mostram variavel exata ({nome_cliente} em vez de "Nome Cliente")

### Workflow — Notificacoes WhatsApp
- Fix: newlines removidas do parametro do template Meta (erro 132018)
- Fix: timezone de {data_agendamento} usa Company.timezone (nao UTC do servidor)
- Fix: query company inclui campo timezone

### Servicos — Unidade e Quantidade
- Nova unidade KM (Quilometro) no cadastro de servicos
- Quantidade decimal: campo mudou de Int para Float (ex: 2,5 diarias)
- Math.round em todos calculos de centavos para evitar fracoes
- Input: onFocus seleciona tudo, permite apagar e digitar, onBlur valida min 1
- Validacao: nao permite criar OS com servico com quantidade zero

### Outros
- Fix texto apagado no modal de busca (SearchLookupModal: text-slate-900)

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
