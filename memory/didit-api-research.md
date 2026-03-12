# Didit API Research — Verificacao de Identidade Digital

## Data da Pesquisa: 2026-03-12

---

## 1. Visao Geral

**Didit** (didit.me) e uma plataforma global de verificacao de identidade digital (KYC).
- 14.000+ documentos de 220+ paises
- Free tier: 500 verificacoes/mes por feature
- Pay-per-success (so cobra se o usuario completar)
- Docs: https://docs.didit.me
- Console: https://business.didit.me
- Suporte: support@didit.me

---

## 2. Pricing

### Features Gratis (500/mes cada)
- ID Verification
- Passive Liveness
- Face Match 1:1
- IP Analysis

### Apos Free Tier
| Feature | Preco |
|---------|-------|
| ID Verification | $0.15 |
| Face Match 1:1 | $0.05 |
| Passive Liveness | $0.10 |
| Active Liveness | $0.15 |
| IP Analysis | $0.03 |
| AML Screening | $0.20 |

**Custo total por verificacao completa (ID + Liveness + FaceMatch)**: ~$0.30 (apos free tier)
- Creditos pre-pagos, nunca expiram
- Sem contrato, sem minimo

---

## 3. API — Detalhes Tecnicos

### 3.1 Base URL
```
https://verification.didit.me/v3/
```

### 3.2 Autenticacao
API Key via header:
```
x-api-key: YOUR_API_KEY
```
- Obter no Console: API & Webhooks
- Scoped por Application

### 3.3 Fluxo de Integracao

1. **Criar Workflow** no Console (drag & drop: ID Verification + Liveness + Face Match)
2. **Criar Sessao** via API → recebe `verification_url`
3. **Redirecionar usuario** para `verification_url` (ou iframe/SDK)
4. **Receber resultado** via Webhook ou polling

### 3.4 Endpoints

#### Criar Sessao
```
POST /v3/session/
x-api-key: YOUR_API_KEY
Content-Type: application/json

{
  "workflow_id": "uuid-do-workflow",
  "callback": "https://tecnikos.com.br/signup?step=4",
  "vendor_data": "tenant-uuid",
  "language": "pt",
  "contact_details": {
    "email": "user@email.com"
  }
}
```

Resposta (201):
```json
{
  "session_id": "uuid",
  "session_token": "token",
  "url": "https://verify.didit.me/session/token",
  "status": "Not Started"
}
```

#### Recuperar Resultado
```
GET /v3/session/{sessionId}/decision/
x-api-key: YOUR_API_KEY
```

Resposta inclui:
- `status`: Approved | Declined | In Review | Not Started | In Progress | Abandoned | Expired
- `id_verifications[]`: tipo documento, dados extraidos (nome, CPF, data nascimento), scores qualidade
- `liveness_checks[]`: score (0-100), metodo, imagem referencia
- `face_matches[]`: score (0-100), imagens comparadas
- `ip_analyses[]`: geolocalizacao, VPN/Tor, device info

### 3.5 Webhook

**Headers:**
- `X-Signature-V2`: HMAC-SHA256 (recomendado)
- `X-Timestamp`: Unix timestamp

**Payload:**
```json
{
  "session_id": "uuid",
  "status": "Approved",
  "webhook_type": "status.updated",
  "vendor_data": "tenant-uuid",
  "decision": {
    "id_verifications": [...],
    "liveness_checks": [...],
    "face_matches": [...]
  }
}
```

**Verificacao de assinatura (Node.js):**
```javascript
const crypto = require("crypto");
function verifyWebhook(body, signature, timestamp, secret) {
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) return false;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}
```

**Retry policy:** 2 retries automaticos em falha (1min, 4min)

### 3.6 Status da Sessao

| Status | Descricao |
|--------|-----------|
| Not Started | Sessao criada, usuario nao iniciou |
| In Progress | Verificacao em andamento |
| In Review | Aguardando analise manual |
| Approved | Aprovado |
| Declined | Reprovado |
| Abandoned | Usuario saiu sem completar |
| Expired | Sessao expirada (7 dias) |

---

## 4. Integracao Tecnikos — Plano

### Variaveis de ambiente
```env
DIDIT_API_KEY=sua-api-key
DIDIT_WEBHOOK_SECRET=sua-webhook-secret
DIDIT_WORKFLOW_ID=uuid-do-workflow
```

### Arquitetura
- `backend/src/didit/didit.service.ts` — Service principal
- `backend/src/didit/didit.module.ts` — Modulo NestJS
- Endpoint publico: `POST /api/public/saas/create-verification` — cria sessao
- Endpoint publico: `POST /api/public/saas/didit-webhook` — recebe resultado
- Frontend: redireciona usuario para `verification_url` do Didit
- Callback redireciona de volta para signup apos verificacao

### Fluxo no Signup
1. Step 1: Dados empresa (CNPJ, razao social)
2. Step 2: Senha + plano
3. Step 3: Verificacao de identidade via Didit (redirect ou iframe)
4. Step 4: Pagamento (Asaas)

### Graceful degradation
- Se DIDIT_API_KEY nao configurado → pula verificacao (como PPID hoje)
