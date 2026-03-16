# TAREFA ATUAL — Leia este arquivo ao reconectar

## Status: SESSAO 118 — Continuacao pos-compactacao

## Ultima sessao: 117 (16/03/2026)
- Sessao 115: Unificar create/edit OS form (v1.03.66)
- Sessao 116: Field restrictions by status + deploy (v1.03.67)
- Sessao 117: WhatsApp notification fix + API research (v1.03.68-70)

## O que foi feito nas sessoes 116-117 (compactadas):

### Restricao de campos por status da OS (v1.03.67)
- [x] ABERTA: todos os campos editaveis
- [x] OFERTADA: tipo atendimento bloqueado
- [x] ATRIBUIDA: cliente/endereco/servicos/tipo bloqueados
- [x] EM_EXECUCAO: so descricao/prazo/contato/timeouts editaveis
- [x] AJUSTE: descricao/prazo/contato/servicos/timeouts editaveis
- [x] Terminal: tudo bloqueado

### WhatsApp notification fix (v1.03.68-70)
- [x] Investigacao: OS criada mas notificacao via WhatsApp falhava (#135000)
- [x] v1.03.68: Removido forceTemplate (errado - revertido)
- [x] v1.03.69: Template+text strategy (errado - revertido)
- [x] v1.03.70: Rewrite completo sendTextWithTemplateFallback seguindo docs oficiais
- [x] Template self-contained (toda info no template, sem fallback text)
- [x] Melhor error logging com codigos e mensagens completas
- [x] Novo endpoint GET /whatsapp/templates para diagnostico
- [x] Pesquisa completa da WhatsApp Business Cloud API salva em memory/

### ROOT CAUSE DESCOBERTO:
**Conta WhatsApp Business (SLS Sol e Lazer Solucoes) RESTRITA pelo Meta**
- Causa erro #135000 em envios de template
- Bloqueia edicao de templates tambem
- PRECISA ser resolvido pelo Juliano no Meta Business Support
- Nao e problema de codigo

### Template aviso_os — edicao planejada (BLOQUEADA pela restricao):
- Adicionar botao CTA URL: "Acessar OS"
- URL dinamica: `https://sls.tecnikos.com.br/p/{{1}}`
- Exemplo descriptivo (nao UUID)
- Apos desbloqueio: atualizar codigo para enviar parametro do botao

## Pendente:
- **BLOQUEADO: Resolver restricao da conta WhatsApp no Meta Business Support**
- Apos desbloqueio: editar template aviso_os com botao CTA
- Apos template aprovado: atualizar codigo para enviar parametro do botao CTA
- FUTURO: Verificacao visual completa do workflow editor
- FUTURO: Mecanismo para clientes solicitarem melhorias
- FUTURO: Contrato do cliente com a Tecnikos
- FUTURO: Fix logradouro em dados importados do Sankhya
- FUTURO: Discutir/remover commissionBps global da empresa
- FUTURO: Workflow config "Respeitar tecnico direcionado"

## Versao atual: v1.03.70 (deployed)

## Regras permanentes (decididas pelo Juliano):
- Claude decide toda a parte tecnica sozinho e executa sem perguntar
- Registrar SEMPRE em CHAT_LOG.md e PROJETO_LOG.md
- Build e verificar antes de encerrar qualquer sessao
- Versao em version.json sempre atualizada
- Variaveis em campos de texto: SEMPRE clicaveis (botoes chip que inserem no cursor)
- NUNCA usar Preview Screenshot — trava o chat. Usar preview_snapshot/preview_inspect.
- TODOS os campos de texto (textarea/input de mensagem) DEVEM ter texto exemplo preenchido
