# WhatsApp Business API — Auditoria Completa (Março 2026)

## Status: Conta reativada após ban pelo Meta (motivo não informado)

## Arquitetura Atual
- Provider: Meta Cloud API v21.0
- Módulo: `backend/src/whatsapp/`
- Config por empresa (multi-tenant): `WhatsAppConfig` no schema do tenant
- Token encriptado com EncryptionService
- Webhook público: `GET/POST /whatsapp/webhook/meta/:companyId`

## Templates em Uso
1. **aviso_os** (pt_BR) — 1 parâmetro body `{{1}}` — usado como fallback por `sendTextWithTemplateFallback()`
2. **teste_conexao** (pt_BR) — sem parâmetros — usado pelo botão "Testar conexão"

## Fluxo de Envio (sendTextWithTemplateFallback)
1. Se `forceTemplate=false`: tenta texto puro primeiro (funciona dentro janela 24h)
2. Se texto falha ou `forceTemplate=true`: envia via template `aviso_os`
3. Se template falha: loga erro detalhado (code, subcode, msg)
- Sanitização: remove `\n\r\t`, limita 4+ espaços, trunca em 1000 chars

## Pontos de Envio Automático (SEM ação do usuário)
| Local | Tipo | forceTemplate? | Risco |
|-------|------|----------------|-------|
| notification.service → workflow engine | OS status change, proximity, arrival | **NÃO** | ⚠️ MÉDIO — texto pode falhar silenciosamente fora janela 24h |
| quote.service (enviar orçamento) | QUOTE_SENT | **NÃO** | ⚠️ MÉDIO — idem |
| quote.service (aprovação/recusa gestor) | QUOTE_APPROVED/REJECTED | **NÃO** | ⚠️ MÉDIO — idem |
| contract.service (welcome CLT) | CONTRACT_SENT | via notification.send | ⚠️ MÉDIO — idem |
| partner.service (onboarding trigger) | WELCOME | via contract.service | ⚠️ MÉDIO |
| nfse-emission.service | NFS-e enviada | **sendText direto** | 🔴 ALTO — NÃO passa pelo fallback de template |
| whatsapp.service (reply CLT accept/decline) | Reply automática | `forceTemplate=true` ✅ | ✅ OK |
| public-offer.service (OTP código) | OTP | via notification.send | ⚠️ MÉDIO |

## RISCOS IDENTIFICADOS

### 🔴 ALTO — NFS-e usa sendText() direto
`nfse-emission.service.ts:698` chama `this.whatsApp.sendText()` em vez de `sendTextWithTemplateFallback()`.
Se o cliente nunca mandou mensagem (ou janela 24h expirou), a mensagem será **silenciosamente descartada** pelo Meta (retorna 200 mas não entrega).
**Correção**: Usar `sendTextWithTemplateFallback(companyId, phone, message, true)`.

### ⚠️ MÉDIO — Chamadores não passam forceTemplate
Os serviços de quote, workflow, proximity, OTP chamam `notification.send()` sem `forceTemplate: true`.
O `notification.service` passa `dto.forceTemplate` que é `undefined` → `sendTextWithTemplateFallback(... false)`.
Resultado: tenta texto primeiro, se falha cai no template `aviso_os`.
**Isto funciona** mas gera 2 calls à API quando fora da janela 24h (text fail + template retry).
**Melhoria opcional**: Para mensagens business-initiated (quote, proximity, arrival), passar `forceTemplate: true` para evitar a primeira chamada desnecessária.

### ⚠️ MÉDIO — Mensagem de OTP via template genérico
O código OTP (`public-offer.service:475`) envia "Seu código de verificação..." via `sendTextWithTemplateFallback`.
Se cair no template `aviso_os`, o cliente recebe o código mas dentro de um formato genérico.
**Ideal**: Ter template específico de OTP aprovado pelo Meta.

### ✅ OK — Webhook seguro
- Verificação de token por empresa (metaVerifyToken)
- Deduplicação por `whatsappMsgId`
- Status updates processados corretamente (sent/delivered/read/failed)
- Endpoint @Public() mas validado pelo verifyToken

### ✅ OK — Sem cron de envio automático
Não há nenhum cron/scheduler que envie WhatsApp automaticamente. Todos os envios são disparados por ação do usuário ou evento do sistema (webhook, status change).

### ✅ OK — Rate limiting natural
Não há envio em massa. Cada mensagem é individual, disparada por evento.

### ✅ OK — Error handling robusto
Códigos de erro 131047, 131056, 132000, 132001, 132005, 132007, 132012, 132015, 135000 documentados no código.

## POSSÍVEIS CAUSAS DO BAN ANTERIOR
1. **sendText fora da janela 24h** — Meta pode interpretar como spam (muitas tentativas text→fail)
2. **Envio de NFS-e sem template** — mensagem de negócio fora da janela sem template aprovado
3. **Template aviso_os com conteúdo variável demais** — se o parâmetro body muda muito, Meta pode flaggar
4. **Volume repentino** — se muitas OS mudaram de status de uma vez

## RECOMENDAÇÕES ANTES DE REATIVAR
1. ✅ Corrigir NFS-e para usar template fallback
2. ✅ Verificar status dos templates na conta Meta (aviso_os e teste_conexao podem ter sido desabilitados)
3. ⚠️ Iniciar com volume baixo (1-2 mensagens/dia) e subir gradualmente
4. ⚠️ Criar template OTP específico se possível
5. ⚠️ Monitorar logs de erro 135000 (anti-spam) nos primeiros dias
