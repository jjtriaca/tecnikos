# Integração WhatsApp — Guia de Implementação

## Visão Geral

O sistema de notificações foi construído com uma arquitetura "mock-first":
- Toda notificação é salva no banco de dados (tabela `Notification`)
- O envio real é um mock que apenas loga no console
- Para ativar WhatsApp, basta trocar o mock por uma chamada real

## Como Funciona Hoje (MVP)

```typescript
// notification.service.ts — método send()
// 1. Cria registro no banco com status SENT
// 2. Loga no console: 📨 [MOCK] STATUS_CHANGE → (11) 99999-1234: mensagem
// 3. Retorna o registro criado
```

## Para Integrar com WhatsApp Business API

### Opção 1: Meta Cloud API (Oficial)

1. Crie uma conta no [Meta for Developers](https://developers.facebook.com/)
2. Configure o WhatsApp Business Platform
3. Obtenha: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`

```typescript
// Exemplo de envio via Meta Cloud API
async sendWhatsApp(phone: string, message: string) {
  const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone.replace(/\D/g, ''), // só números
      type: 'text',
      text: { body: message },
    }),
  });
}
```

### Opção 2: Twilio WhatsApp

1. Crie conta no [Twilio](https://www.twilio.com/)
2. Ative o WhatsApp Sandbox ou Business Profile
3. Obtenha: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`

```bash
npm install twilio
```

### Opção 3: Z-API ou Evolution API (Brasil)

Soluções populares no Brasil para WhatsApp não-oficial:
- [Z-API](https://www.z-api.io/) — API REST simples
- [Evolution API](https://evolution-api.com/) — Open source, self-hosted

## Variáveis de Ambiente Necessárias

```env
# .env
NOTIFICATION_CHANNEL=WHATSAPP  # ou MOCK para desenvolvimento
WHATSAPP_TOKEN=seu_token_aqui
WHATSAPP_PHONE_NUMBER_ID=seu_phone_id
```

## Onde Modificar

1. **`notification.service.ts`** — método `send()`:
   - Trocar o mock logger por chamada real da API escolhida
   - Atualizar status para FAILED se o envio falhar
   - Usar canal correto baseado na variável de ambiente

2. **Schema Prisma** — Notification model já possui:
   - `channel` (MOCK, WHATSAPP, SMS, EMAIL)
   - `status` (SENT, FAILED, PENDING)
   - `recipientPhone`
   - `sentAt`

## Templates de Mensagem Atuais

O sistema envia notificações automáticas nestas situações:

| Evento | Mensagem |
|--------|----------|
| OS Atribuída | "A OS '{título}' foi atribuída a um técnico." |
| Em Execução | "O técnico iniciou o atendimento da OS '{título}'." |
| Concluída | "A OS '{título}' foi concluída pelo técnico." |
| Aprovada | "A OS '{título}' foi aprovada." |
| Ajuste | "A OS '{título}' precisa de ajuste." |

## Pontos de Integração no Código

- `ServiceOrderService.updateStatus()` — Dispara notificação em mudança de status
- `ServiceOrderService.assign()` — Dispara notificação quando OS é atribuída
- `WorkflowEngineService.advanceStep()` — Dispara notificação em conclusão de step/workflow
