# TAREFA ATUAL

## Versao: v1.06.55
## Ultima sessao: 154 (22/03/2026)

## Pendencias

### A FAZER
- **Fase 3-7 Offline**: Testar em dispositivo real (GPS + fotos + sync)
- **Fase 4-7**: Hardening offline (crash recovery, forcar sync, limites storage)

### PENDENTE VALIDACAO
- **Bloco MATERIALS**: Testar no PWA — nota + lista rapida + enviar + visualizar no dashboard
- **Bug PHOTO minPhotos**: Testar bloco com minPhotos=2,3 — botao so habilita com N fotos
- **Historico compacto**: Verificar novos eventos com dados resumidos (GPS, materiais, etc.)
- **Offline-first**: Testar workflow completo offline → online → sync
- **PWA Token Persistente**: Testar os 6 fluxos em producao

### CONCLUIDO (sessao 154)

#### Bug Fix: PHOTO minPhotos
- **blockId** no Attachment + migration + upload controller
- **Backend validates** photo count per blockId (async)
- **Frontend** conta fotos por bloco, contador "X/Y fotos"

#### Offline-First PWA — Foundation
- **IndexedDB** (idb): 4 stores (service-orders, offline-workflow-state, offline-photos, sync-queue)
- **Execucao offline** de blocos com branching local
- **Fotos offline**: comprime (1920px, JPEG 0.7), salva blob no IDB
- **Sync automatico**: fila FIFO quando volta online
- **Service Worker v2**: cache API GETs + Background Sync
- **OfflineIndicator**: banner amber offline, badge sync

#### Novo Bloco MATERIALS
- **BlockType + BLOCK_CATALOG**: Tipo MATERIALS em todos os registros
- **Config**: label, notePlaceholder, noteRequired, minItems, confirmButton
- **PWA UI**: Textarea diagnostico + lista rapida (nome texto + qtd numerico + botao +)
- **Auto-focus**: cursor volta pro campo nome apos cada adicao
- **Backend validate**: minItems + noteRequired
- **Editor**: painel de config + subtitulo no node visual
- **Offline**: suportado (ACTIONABLE_TYPES)

#### Dashboard OS Detail — Timeline + Historico
- **Timeline enriquecido**: mostra dados inline por tipo de bloco:
  - MATERIALS: lista de itens com quantidades (card amber)
  - GPS: coordenadas
  - CHECKLIST: contagem de verificados
  - FORM: contagem de campos
  - QUESTION/CONDITION: resposta
- **Eventos enriquecidos**: payload inclui note, GPS, materialCount, checkedCount, answer, fieldCount
- **Historico compacto**: single-line por evento, icone por tipo, chips resumo, data curta
- **Limite eventos**: 20 → 50

### BLOQUEADO
- (nenhum)

### REGRAS APRENDIDAS (sessao 154)
- **BLOCK_CATALOG vs FLOW_CATALOG**: Sidebar do editor usa BLOCK_CATALOG (workflow-blocks.ts), nao FLOW_CATALOG (flow-blocks.ts). Novo bloco precisa estar em AMBOS
- **normaliseWfSteps**: Precisa incluir type + responseData para exibir dados inline
- **inputMode="numeric"**: Forca teclado numerico no celular sem type=number
- **Evento enriquecido**: Guardar resumo no payload do evento (truncar strings longas)
