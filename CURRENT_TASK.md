# TAREFA ATUAL

## Versao: v1.06.25
## Ultima sessao: 151 (21/03/2026)

## Pendencias

### A FAZER
- **Fase 3 — Offline-first**: IndexedDB para OS locais + fila de sync (futuro)

### PENDENTE VALIDACAO
- **Tech refresh TTL**: Atualmente 1 dia para teste. Apos validar, mudar para 90 dias em `auth.constants.ts`
- **Fluxo Avaliacao Orcamento**: Testar criacao de OS avaliacao com novo engine (variaveis, status OFERTADA, aceite)
- **GPS Continuo + Proximidade**: Testar no celular real — raio, distancia, botao "Cheguei", auto-avanco, eventos onEnterRadius

### CONCLUIDO (sessao 151)

#### ChatIA — Tools e conhecimento de Orcamentos e Avaliacoes
- **System prompt atualizado**: Descricao detalhada dos modulos Orcamentos (status, fluxo, funcionalidades) e Avaliacoes (ponderacao, minimo, EM_TREINAMENTO)
- **Tool buscar_orcamentos**: Busca por status/cliente/periodo, retorna resumo por status e lista com valores
- **Tool buscar_avaliacoes**: Busca por tecnico/tipo, retorna medias por tipo e lista com notas/comentarios
- **Flutuante OS Reatribuir**: Verificado — ja estava implementado (DispatchPanel.tsx + service-order.service.ts reassign)

#### GPS Block — Notificacoes enriquecidas (OnEnterRadiusNotifications)
- **Funcao reutilizavel OnEnterRadiusNotifications**: Extraida de GPS e PROXIMITY_TRIGGER, eliminou duplicacao
- **Chips clicaveis**: Variaveis {tecnico}, {cliente}, {codigo}, {titulo}, {endereco}, {empresa}, {telefone_empresa} com insercao na posicao do cursor (useRef + selectionStart/End)
- **Canal para gestor**: Adicionado seletor de canal (WhatsApp/Email/Push) que antes so existia para cliente
- **Canal Email**: Adicionado opcao Email no seletor de canal do cliente (antes so WhatsApp/SMS/Push)
- **Textarea nativo com ref**: Substituiu componente TextArea por textarea nativo para suportar refs de cursor

### CONCLUIDO (sessao 150)

#### Workflow Engine — Deferred removido + fixes criticos
- **Deferred ACTION_BUTTONS removido**: Logica inteira de adiamento eliminada — clicou, grava, executa system blocks, mostra proximo
- **STATUS(ATRIBUIDA) fix**: executeSystemBlock agora seta acceptedAt e revoga ServiceOrderOffer ao mudar para ATRIBUIDA
- **STATUS(RECUSADA) fix**: Revoga offers ao recusar
- **Reset fix**: resetPreviewOs limpa acceptedAt e reabre offers revogadas
- **DELAY respeitado no reset**: Removido skipDelays — blocos sempre executam como configurados

#### CodeCounter — Auto-correcao de colisao
- **Collision detection**: Antes de INSERT, verifica se codigo ja existe no banco
- **Auto-correction**: Busca MAX codigo existente e corrige o counter automaticamente
- **Retry loop**: 3 tentativas com incremento

#### GPS Continuo — Bloco hibrido (GPS + Proximidade)
- **Fusao GPS + PROXIMITY_TRIGGER**: GPS em modo continuo agora inclui toda funcionalidade de proximidade
- **Config no editor**: Raio (10-1000m slider), auto-avancar checkbox, eventos onEnterRadius (notificar cliente/gestor, alert, status)
- **Tech portal**: Distancia em tempo real, barra de progresso, botao "Cheguei" manual
- **autoAdvanceOnProximity**: Opcao que controla se entra no raio e avanca sozinho (true) ou espera clique manual (false)
- **Backend submitProximityPosition**: Aceita GPS continuo alem de PROXIMITY_TRIGGER
- **PROXIMITY_TRIGGER marcado como legado**: Mantido no catalogo para compatibilidade

### CONCLUIDO (sessao 149)

#### Frontend — Remocao total de codigo V1 e V3
- **page.tsx**: Tipos WorkflowStep/WorkflowProgressV1, isV2(), handleAdvanceStepV1(), noteText/showNoteInput state, rendering V1 inteiro removidos
- **page.tsx**: Union type WorkflowProgress eliminado — useState tipado direto como WorkflowProgressV2
- **page.tsx**: isV2Workflow/isV2() checks removidos — tudo e V2, sem ternarios
- **workflow-blocks.ts**: WorkflowStepV1, convertV1toV2(), isV2Format() removidos; parseWorkflowSteps simplificado
- **flow-blocks.ts**: FlowBlock, FlowDefinition (V3), createFlowBlock, createDefaultFlow, convertFlowToV2 removidos
- **stage-config.ts**: decompileV1(), decompileV3Blocks() removidos; decompileFromV2 so aceita V2

### BLOQUEADO
- (nenhum)
