# TAREFA ATUAL

## Versao: v1.06.09
## Ultima sessao: 148 (20/03/2026)

## Pendencias

### A FAZER
- **Wizard ChatIA**: Atualizar system prompt para saber sobre modulo Orcamentos e fluxo avaliacao
- **Flutuante OS — Reatribuir tecnico**: Quando tecnico recusa, gestor ve no flutuante e pode reatribuir a outro sem criar nova OS
- **Fase 3 — Offline-first**: IndexedDB para OS locais + fila de sync (futuro)

### PENDENTE VALIDACAO
- **Tech refresh TTL**: Atualmente 1 dia para teste. Apos validar, mudar para 90 dias em `auth.constants.ts`
- **Fluxo Avaliacao Orcamento**: Testar criacao de OS avaliacao com novo engine (variaveis, status OFERTADA, aceite)

### CONCLUIDO (sessao 148)

#### Portal do Tecnico — Remocao total de legados
- **Botoes legados removidos**: ATRIBUIDA/A_CAMINHO/EM_EXECUCAO/AJUSTE/PAUSE/RESUME — tudo controlado por blocos do workflow
- **Fotos Antes/Depois removidas**: Secao V1 de fotos eliminada (PHOTO block controla)
- **Completed state V1 removido**: Tela verde de conclusao V1 eliminada (TerminalScreen controla)
- **Pause modal removido**: Modal de pausa e toda logica associada eliminada
- **GPS tracking legado removido**: Banner de distancia A_CAMINHO eliminado (GPS block controla)
- **Dead code limpo**: handleStatusChange, handlePause, handleResume, PAUSE_REASONS, haversineDistance, formatDistance, watchIdRef, estados de pausa

#### Workflow Engine — Fix terminal status
- **Stale status fix**: advanceBlockV2 re-le status do DB apos transacao para nao sobrescrever RECUSADA→CONCLUIDA
- **Emulador flutuante**: Componente draggavel com posicao persistente, expand/collapse, reset OS
- **Emulador OS picker**: Endpoint emulator-os lista TODAS as OS do workflow, auto-reset para terminal
- **ACTION_BUTTONS label**: "Confirmar ✓" ao inves de "Confirmar: Botoes de Acao"

### CONCLUIDO (sessao 147)

#### NOTE block — min/max caracteres
- **Config no editor**: Campos minChars/maxChars no painel de propriedades do bloco NOTE
- **Backend enforcement**: validateBlockRequirements valida min/max no servidor (impede bypass pelo frontend)
- **Frontend UX**: Botao Confirmar desabilitado se fora do range, contador de caracteres no textarea
- **Limite hard**: maxChars bloqueia digitacao alem do limite

#### Emulador — OS real com token
- **Endpoint active-tokens**: Lista OS ativas com token valido para usar no emulador
- **Selecao de OS real**: Emulador permite carregar OS real alem de preview

#### Workflow Engine — Fixes criticos
- **ACTION_BUTTONS branching**: getProgressV2 agora segue branch correto (buttonId → nextBlockId)
- **Status OFERTADA/A_CAMINHO**: Backend aceita avancar blocos nestes status
- **canAct inclui OFERTADA**: Frontend mostra botoes de acao para tecnico em OS ofertada
- **Info interna escondida**: Progress bar e blocos concluidos removidos da view do tecnico

### CONCLUIDO (sessao 146)

#### Portal do Tecnico — Emulador Real
- **Iframe real substituiu mockup estatico**: Celular no editor carrega pagina real `/tech/os/{token}` em iframe
- **Endpoint POST /workflows/:id/preview-os**: Cria OS real de teste com token 7 dias (channel=PREVIEW)
- **Auto-save + reload**: Mudanca de config salva workflow automaticamente (debounce 800ms) e recarrega iframe
- **Botao "Criar {gatilho}"**: Dentro do celular, mostra botao com nome do gatilho selecionado para criar OS de teste
- **Reutiliza preview existente**: Se ja existe OS preview com token valido, reutiliza sem criar nova
- **Tech atribuido automaticamente**: OS preview atribui primeiro tecnico disponivel para token auth funcionar

#### Workflow Editor — Salvar sem fechar
- **Botao Salvar nao fecha mais**: Em edicao de workflow existente, salvar mostra feedback 2s sem navegar
- **Criacao ainda navega**: Ao criar workflow novo, salvar navega de volta (editor nao tem ID do novo)

#### Preview Page (legado)
- **`/tech/preview` criada**: Pagina standalone com postMessage — substituida pelo iframe real mas mantida

### CONCLUIDO (sessao 145)

#### Engine V3 — transitionMode removido
- **transitionMode manual eliminado**: Removidas 7 referencias no workflow-engine.service.ts — STATUS blocks nunca param o engine

#### Portal do Tecnico — Config Global
- **TechPortalConfig**: Config global no workflow que controla visibilidade e ordem dos campos no portal do tecnico
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

### BLOQUEADO
- (nenhum)
