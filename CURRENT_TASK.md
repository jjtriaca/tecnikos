# TAREFA ATUAL

## Versao: v1.05.40
## Ultima sessao: 144 (19/03/2026)

## Pendencias

### A FAZER
- **Wizard ChatIA**: Atualizar system prompt para saber sobre modulo Orcamentos e fluxo avaliacao
- **Flutuante OS — Reatribuir tecnico**: Quando tecnico recusa, gestor ve no flutuante e pode reatribuir a outro sem criar nova OS
- **Fase 3 — Offline-first**: IndexedDB para OS locais + fila de sync (futuro)

### PENDENTE VALIDACAO
- **Tech refresh TTL**: Atualmente 1 dia para teste. Apos validar, mudar para 90 dias em `auth.constants.ts`
- **Fluxo Avaliacao Orcamento**: Testar criacao de OS avaliacao com novo engine (variaveis, status OFERTADA, aceite)

### CONCLUIDO (sessao 144)

#### Engine V3 — Portal do Tecnico
- **GPS configs avancadas**: Auto-captura, alta precisao, modo continuo/pontual, intervalo — renderizados no app do tecnico
- **GPS rastreamento continuo**: watchPosition com banner "Rastreamento ativo" e botao parar
- **Badges GPS config**: Mostra tags visuais (Alta precisao, Rastreamento continuo, Captura automatica)

#### Canal Push — NOTIFY Block
- **PUSH no notification.service.ts**: Canal PUSH tratado explicitamente — sendToUser ou sendToCompany
- **Tipo NotifyConfig**: Adicionado 'PUSH' ao union type
- **Anti-duplicacao**: Push fire-and-forget nao dispara quando canal ja e PUSH

#### Correcao Memoria V3
- **Status ABERTA**: OS nasce ABERTA (default Prisma), blocos controlam a partir dai. Corrigido memoria que dizia NULL.

### CONCLUIDO (sessao 143)

#### Workflow Engine V3 — Base
- **Gatilho OS Avaliacao/Orcamento**: Novo trigger `os_evaluation_created` com `isEvaluation` flag
- **Bloco Status — Modo manual**: Config `transitionMode: 'manual'` + `buttonLabel` customizavel
- **Bloco GPS — Configs avancadas**: Obrigatorio, Alta precisao, Modo (pontual/continuo), Intervalo, Captura automatica
- **Bloco SE/Condicao — Branches**: Canvas renderiza SIM/NAO com branches independentes e + para adicionar blocos
- **Status RECUSADA**: Adicionado em 7 arquivos frontend (labels, cores, graficos, badges)
- **Canal Push**: Adicionado como opcao no bloco Notificar (WhatsApp, Email, Push)
- **Fix DEL key**: Tecla Delete nao deleta mais bloco quando editando texto em input/textarea
- **Fix variaveis NOTIFY**: {link_app}/{link_os} nao eram mais vazias; {nome} substitui por destinatario correto
- **Fix workflowUsesFromStart**: Detecta STATUS como primeiro bloco apos START
- **WhatsApp reconectado**: Token regenerado no Meta Business (SLS Sol e Lazer Solucoes)

#### Portal do Tecnico — Sessao Persistente
- **Tela "Acesso por link"**: Substituiu formulario telefone+OTP por pagina informativa
- **TTL sessao tecnico**: 1 dia para teste (sera 90 dias apos validacao)
- **Botao Testar removido**: Removido do editor de workflow (confundia usuario)

### CONCLUIDO (sessao 142)

#### TenantMigratorService — Fix FK cross-schema
- **remapForeignKeys()**: Novo metodo detecta FKs que referenciam public schema e remapeia para tenant schema

### BLOQUEADO
- (nenhum)
