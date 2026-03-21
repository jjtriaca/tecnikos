# TAREFA ATUAL

## Versao: v1.06.43
## Ultima sessao: 153 (21/03/2026)

## Pendencias

### A FAZER
- **Fase 3 — Offline-first**: IndexedDB para OS locais + fila de sync (futuro)

### PENDENTE VALIDACAO
- **PWA Token Persistente**: Testar os 6 fluxos (ver abaixo). Deploy necessario para validar em producao.

### CONCLUIDO (sessao 153)

#### PWA Token Persistente — 3 Camadas de Auth
- **DeviceToken model**: Nova tabela no Prisma (partnerId, tokenHash, deviceName, expiresAt, revokedAt)
- **1 dispositivo por tecnico**: Ao criar novo deviceToken, revoga todos os anteriores
- **deviceToken vinculado ao TECNICO**: Nao depende de OS especifica — funciona pra sempre
- **TTLs atualizados**: Refresh cookie 90 dias, deviceToken 365 dias
- **3 camadas de recovery**: cookie httpOnly → deviceToken localStorage → tela OTP
- **POST /tech-auth/device-recover**: Novo endpoint para PWA recuperar sessao via localStorage
- **GET /tech-auth/my-orders**: Lista OS ativas do tecnico (so assignedPartnerId, nao directedTechnicianIds)
- **Todos os logins emitem deviceToken**: login, loginWithOtp, loginWithToken (welcome + OS)
- **Logout limpa tudo**: Sessao + cookie + deviceToken (localStorage + DB)
- **Tela de login redesenhada**: Input telefone + OTP por WhatsApp (substitui tela estatica)
- **Token page inteligente**: Se ja autenticado, vai direto pra OS. Se token revogado, mensagem amigavel "OS ja atribuida"
- **Mensagem generica no token revogado**: "Esta OS ja foi atribuida" (sem "a voce") — outro tecnico pode clicar
- **OS direcionada (OFERTADA) NAO aparece no PWA**: So aparece apos aceitar via link (assignedPartnerId)

#### Fluxos a validar
1. Login via link → fechar app → reabrir → silentRefresh OK → /tech/orders
2. Fechar app → limpar cookies → reabrir → deviceRecover OK → /tech/orders
3. Limpar cookies + localStorage → tela OTP → codigo WhatsApp → /tech/orders
4. Login no celular B → celular A perde acesso (deviceToken revogado)
5. Clicar link antigo com sessao ativa → vai direto pra OS
6. Clicar link revogado → mensagem amigavel + botao "Abrir minhas OS"

### CONCLUIDO (sessao 152)

#### GPS Block — Botao "Cheguei" + Melhorias
- **Botao Cheguei configuravel**: Quando autoAdvanceOnProximity=false, mostra ConfirmButtonEditor
- **ConfirmButtonEditor expandido**: Adicionado seletor de tamanho (Pequeno/Medio/Grande)
- **Texto dinamico auto-avancar**: Texto muda conforme checkbox
- **Botao renderizado no mobile**: Aparece no app do tecnico com cor/emoji/tamanho configurados

#### GPS — Envio de posicao e distancia
- **sendPosition sempre ativo**: Envia sempre no modo continuo
- **Distancia ao destino no mobile**: Toggle configuravel (showDistanceToTech)
- **Health check GPS**: Detecta GPS desligado mid-tracking
- **Banner GPS desativado**: Aparece sempre que v2GpsDenied

### BLOQUEADO
- (nenhum)

### REGRAS APRENDIDAS (sessao 153)
- **deviceToken vinculado ao TECNICO, nao a OS**: Funciona independente de links
- **OS OFERTADA nao aparece no PWA**: So apos aceitar (assignedPartnerId)
- **Mensagem generica em token revogado**: Nao dizer "atribuida a voce" — pode ser outro tecnico
