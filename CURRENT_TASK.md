# TAREFA ATUAL

## Versao: v1.06.51 (pendente deploy v1.06.52)
## Ultima sessao: 154 (22/03/2026)

## Pendencias

### A FAZER
- **Fase 3-7 Offline**: Testar em dispositivo real (GPS + fotos + sync)
- **Fase 4-7**: Hardening offline (crash recovery, forcar sync, limites storage)

### PENDENTE VALIDACAO
- **Bug PHOTO minPhotos**: Testar bloco com minPhotos=2,3 — botao so habilita com N fotos
- **Offline-first**: Testar workflow completo offline → online → sync
- **PWA Token Persistente**: Testar os 6 fluxos em producao
- **Tech refresh TTL**: Agora 90 dias. Monitorar se tecnicos perdem sessao

### CONCLUIDO (sessao 154)

#### Bug Fix: PHOTO minPhotos
- **Prisma**: `blockId String?` no model Attachment + index composto
- **Migration**: `20260322120000_add_blockid_to_attachment`
- **Upload controller/service**: Aceita `blockId` via query string
- **Backend validateBlockRequirements**: Agora `async`, conta fotos por blockId no DB
- **Frontend PhotoUpload**: Envia `blockId` no upload, filtra galeria por blockId
- **Frontend isDisabled**: Conta fotos por bloco vs `config.minPhotos`, fallback legacy
- **Frontend handleAdvanceBlockV2**: Envia `photoCount` + `photoUrls` no responseData
- **Contador visual**: "2/3 fotos" no bloco PHOTO quando minPhotos > 1
- **Backward compat**: Fotos sem blockId (legacy) contam como fallback

#### Offline-First PWA — Foundation + Core
- **`idb` instalado**: Wrapper IndexedDB (~1.2KB)
- **`lib/offline/db.ts`**: Schema IDB com 4 stores (service-orders, offline-workflow-state, offline-photos, sync-queue)
- **`lib/offline/sync-queue.ts`**: Fila de sync FIFO, fotos primeiro, advances depois
- **`lib/offline/offline-workflow.ts`**: Execucao local de blocos com branching (CONDITION, ACTION_BUTTONS)
- **`hooks/useOffline.ts`**: Deteccao online/offline com health ping
- **`components/OfflineIndicator.tsx`**: Banner amber offline, badge sync, erros
- **Service Worker v2**: Cache API GETs (network-first), Background Sync handler
- **loadOrder() com cache**: Salva em IDB quando online, le do IDB quando offline
- **handleAdvanceBlockV2 dual-mode**: Online = API tempo real, Offline = execucao local + queue
- **PhotoUpload offline**: Comprime foto (max 1920px, JPEG 0.7), salva blob no IDB
- **Auto-sync**: Processa fila quando volta online (event + SW Background Sync)

### BLOQUEADO
- (nenhum)

### REGRAS APRENDIDAS (sessao 154)
- **blockId no Attachment**: Associa foto ao bloco especifico do workflow
- **validateBlockRequirements async**: Precisa de DB query para contar fotos
- **Foto offline = blob + objectURL**: Comprime antes de salvar, preview local com createObjectURL
- **FIFO por OS no sync**: Upload fotos ANTES de advance (advance referencia URL do servidor)
- **navigator.onLine pode mentir**: Health ping /api/health a cada 30s como validacao real
- **Background Sync API**: Fallback manual com evento online + polling
