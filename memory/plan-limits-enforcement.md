# Enforcement de Limites dos Planos — Decisoes do Juliano (16/03/2026)

## 1. maxUsers — Limite de usuarios gestores
- **Bloqueio**: Hard no backend (403)
- **Frontend**: Mensagem + botao "Comprar +1 usuario" (add-on)
- **Desativado**: NAO conta no limite (libera vaga)
- **Anti-fraude**: Cooldown para reativar dobra a cada desativacao
  - 1a desativacao: reativa imediato
  - 2a desativacao: espera 24h para reativar
  - 3a: 48h, 4a: 96h, etc.
- **0 = ilimitado** (nao checa)

## 2. maxOsPerMonth — Limite de OS por mes
- **Bloqueio**: Hard no backend (403)
- **Frontend**: Modal compra rapida inline (add-on OS)
- **OS cancelada**: NAO devolve ao contador (criou = contou)
- **0 = ilimitado** (nao checa)
- Contador reseta no 1o dia do mes

## 3. maxTechnicians — Limite de tecnicos
- **Bloqueio**: Hard no backend (403) ao criar Partner tipo TECNICO
- **Frontend**: Mensagem "Faca upgrade para adicionar mais tecnicos"
- **Desativado**: NAO conta no limite (libera vaga)
- **Anti-fraude**: Mesma regra de cooldown de usuarios (dobra a cada desativacao)
- **0 = ilimitado** (nao checa)

## 4. maxAiMessages — Limite de mensagens IA por mes
- **Bloqueio**: Hard no backend (403)
- **Frontend**: Mensagem + botao "Comprar +100 msgs IA" (add-on)
- **Fonte do limite**: Campo `maxAiMessages` real do Tenant (ELIMINAR calculo hardcoded baseado em OS tier)
- **Quem consome**: Gestores + usuarios que o gestor liberar
- **Liberacao**: Toggle "Acesso ao Chat IA" (`chatIAEnabled` Boolean) no cadastro de cada usuario
  - ADMIN: sempre tem acesso (ignora toggle)
  - Outros usuarios: so se chatIAEnabled = true
  - Tecnicos: NAO tem acesso (so usam link)
- **0 = ilimitado** (nao checa)
- Contador reseta mensalmente (chatIAMonthReset existente)

## 5. supportLevel — Nivel de suporte
- **Status**: PENDENTE (nao implementar agora)
- Campo salvo e editavel no plano, sem enforcement
- Implementar quando houver sistema de suporte integrado

## 6. allModulesIncluded — Acesso a modulos
- **Status**: PENDENTE (nao implementar agora)
- Campo salvo e editavel no plano, sem enforcement
- Quando implementar: false bloqueia Financeiro, NFe, Chat IA

## Implementacao tecnica

### Schema changes necessarias
- User model: +chatIAEnabled Boolean @default(false)
- User model: +deactivationCount Int @default(0)
- User model: +lastDeactivatedAt DateTime?
- Partner model (tecnico): +deactivationCount Int @default(0)
- Partner model (tecnico): +lastDeactivatedAt DateTime?

### Backend enforcement points
1. POST /users (user.service.ts create) → checar maxUsers vs count ativos
2. POST /users reativar → checar cooldown anti-fraude
3. POST /service-orders (service-order.service.ts create) → checar maxOsPerMonth vs count do mes
4. POST /partners tipo TECNICO (partner.service.ts create) → checar maxTechnicians vs count ativos
5. POST /chat-ia (chat-ia.service.ts) → usar Tenant.maxAiMessages real + checar chatIAEnabled do user
6. PATCH /users desativar → incrementar deactivationCount, setar lastDeactivatedAt
7. PATCH /partners desativar tecnico → mesma logica

### Frontend changes
1. Formulario usuario: toggle "Acesso ao Chat IA"
2. Sidebar Chat IA: so aparece se user.chatIAEnabled || user tem role ADMIN
3. Mensagens de limite em cada tela (users, OS, partners, chat)
4. Botoes de compra add-on quando limite atingido
