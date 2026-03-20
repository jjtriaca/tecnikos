# TAREFA ATUAL

## Versao: v1.05.66
## Ultima sessao: 145 (20/03/2026)

## Pendencias

### A FAZER
- **Wizard ChatIA**: Atualizar system prompt para saber sobre modulo Orcamentos e fluxo avaliacao
- **Flutuante OS — Reatribuir tecnico**: Quando tecnico recusa, gestor ve no flutuante e pode reatribuir a outro sem criar nova OS
- **Fase 3 — Offline-first**: IndexedDB para OS locais + fila de sync (futuro)

### PENDENTE VALIDACAO
- **Tech refresh TTL**: Atualmente 1 dia para teste. Apos validar, mudar para 90 dias em `auth.constants.ts`
- **Fluxo Avaliacao Orcamento**: Testar criacao de OS avaliacao com novo engine (variaveis, status OFERTADA, aceite)
- **Tech Portal Config**: Testar reordenacao, labels editaveis (comissao/telefone empresa), toggles no portal do tecnico

### CONCLUIDO (sessao 145)

#### Engine V3 — transitionMode removido
- **transitionMode manual eliminado**: Removidas 7 referencias no workflow-engine.service.ts — STATUS blocks nunca param o engine

#### Portal do Tecnico — Config Global
- **TechPortalConfig**: Config global no workflow que controla visibilidade e ordem dos campos no portal do tecnico
- **Phone mockup preview**: Preview em tempo real no formato celular mostrando exatamente o que o tecnico vera
- **Campos reordenaveis**: Setas up/down controlam ordem dos campos; fieldOrder salvo no config
- **Labels editaveis inline**: Telefone da empresa e Comissao tem label editavel direto no toggle (borda tracejada)
- **Comissao sem porcentagem**: Preview mostra apenas valor monetario, sem percentual
- **13 campos configuraveis**: osCode, status, description, client, clientPhone, siteContact, address, value, deadline, commission, companyPhone, creator, attachments
- **Mensagem customizada**: Banner azul com texto livre do gestor

#### PWA — Fix cache com token
- **Service Worker bypass**: Paginas com `?token=` param usam network-only (nunca cache)

#### Criado por na OS
- **createdByUserId/createdByName**: Campos snapshot no ServiceOrder, populados automaticamente na criacao
- **Dispatch card**: "Criado por" exibido no card flutuante do despacho

#### Dispatch Panel — Limpeza
- **HorizontalTimeline removido**: Barra de evolucao de status removida do painel de despacho

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

### BLOQUEADO
- (nenhum)
