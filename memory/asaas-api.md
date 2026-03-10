# Asaas API — Referencia Tecnica Completa (Pagamentos Recorrentes)

> Pesquisa realizada em 10/03/2026 a partir da documentacao oficial: docs.asaas.com

---

## 1. VISAO GERAL

Asaas e uma conta digital e plataforma de gestao financeira para PMEs no Brasil. Opera como Instituicao de Pagamento autorizada pelo Banco Central do Brasil, com certificacao PCI-DSS.

**Modelo de precos**: Sem mensalidade. Cobra por transacao:
- **Cartao de credito**: R$ 0,49 por cobranca + 1,99% para parcelamento/assinatura
- **Boleto**: R$ 1,99 por boleto pago
- **PIX**: 30 transacoes gratuitas/mes
- **Transferencias**: 30 gratuitas/mes

---

## 2. AUTENTICACAO

### API Key
- Transmitida em TODAS as requisicoes via header `access_token`
- Modelo "nao-recuperavel" — exibida apenas uma vez ao criar
- Expira apos 6 meses de inatividade (webhook `ACCESS_TOKEN_EXPIRED`)

### Prefixos
| Ambiente | Prefixo da API Key |
|----------|-------------------|
| Producao | `$aact_prod_...` |
| Sandbox | `$aact_hmlg_...` |

### Onde obter
- Painel Asaas > Configuracoes da Conta > Aba Integracoes
- Sandbox: criar conta de teste em sandbox.asaas.com

### Header de autenticacao
```
access_token: $aact_prod_XXXXXXXX
```

### Erros de autenticacao (HTTP 401)
```json
{
  "errors": [
    {
      "code": "access_token_not_found",
      "description": "Header access_token nao encontrado"
    }
  ]
}
```
Codigos possiveis: `access_token_not_found`, `invalid_access_token_format`, `invalid_access_token`

---

## 3. BASE URLs

| Ambiente | URL |
|----------|-----|
| **Producao** | `https://api.asaas.com/v3` |
| **Sandbox** | `https://sandbox.asaas.com/api/v3` |

> **IMPORTANTE**: API Keys sao distintas entre Sandbox e Producao. Trocar a key ao mudar de ambiente.

---

## 4. CUSTOMER (CLIENTE)

### Criar Cliente
```
POST /v3/customers
```

#### Request Body
| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| `name` | string | **SIM** | Nome do cliente |
| `cpfCnpj` | string | **SIM** | CPF ou CNPJ do cliente |
| `email` | string | nao | Email |
| `phone` | string | nao | Telefone fixo |
| `mobilePhone` | string | nao | Celular |
| `address` | string | nao | Logradouro |
| `addressNumber` | string | nao | Numero |
| `complement` | string | nao | Complemento (max 255 chars) |
| `province` | string | nao | Bairro |
| `postalCode` | string | nao | CEP |
| `externalReference` | string | nao | ID do cliente no seu sistema |
| `notificationDisabled` | boolean | nao | Desabilitar notificacoes |
| `additionalEmails` | string | nao | Emails adicionais separados por virgula |
| `municipalInscription` | string | nao | Inscricao municipal |
| `stateInscription` | string | nao | Inscricao estadual |
| `observations` | string | nao | Observacoes |
| `groupName` | string | nao | Grupo do cliente |
| `company` | string | nao | Nome da empresa |
| `foreignCustomer` | boolean | nao | true para clientes nao-brasileiros |

#### Request Example
```json
{
  "name": "SLS Obras LTDA",
  "cpfCnpj": "47226599000140",
  "email": "admin@tecnikos.com.br",
  "mobilePhone": "11999999999",
  "address": "Rua Exemplo",
  "addressNumber": "100",
  "province": "Centro",
  "postalCode": "01310000",
  "externalReference": "tenant_abc123",
  "notificationDisabled": false
}
```

#### Response (HTTP 200)
```json
{
  "object": "customer",
  "id": "cus_G7Dvo4iphUNk",
  "dateCreated": "2026-03-10",
  "name": "SLS Obras LTDA",
  "cpfCnpj": "47226599000140",
  "personType": "JURIDICA",
  "email": "admin@tecnikos.com.br",
  "phone": null,
  "mobilePhone": "11999999999",
  "address": "Rua Exemplo",
  "addressNumber": "100",
  "complement": null,
  "province": "Centro",
  "city": 1,
  "cityName": "Sao Paulo",
  "state": "SP",
  "country": "Brasil",
  "postalCode": "01310000",
  "externalReference": "tenant_abc123",
  "notificationDisabled": false,
  "additionalEmails": null,
  "municipalInscription": null,
  "stateInscription": null,
  "observations": null,
  "foreignCustomer": false,
  "deleted": false
}
```

### Outros Endpoints de Customer
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| `GET` | `/v3/customers` | Listar clientes |
| `GET` | `/v3/customers/{id}` | Buscar cliente |
| `PUT` | `/v3/customers/{id}` | Atualizar cliente |
| `DELETE` | `/v3/customers/{id}` | Remover cliente (remove cobracas pendentes) |

---

## 5. SUBSCRIPTION (ASSINATURA) — FLUXO PRINCIPAL

### 5.1 Criar Assinatura

```
POST /v3/subscriptions
```
**Permission**: `SUBSCRIPTION:WRITE`

#### Request Body — Campos Principais
| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| `customer` | string | **SIM** | ID do cliente Asaas (ex: `cus_G7Dvo4iphUNk`) |
| `billingType` | string | **SIM** | Forma de pagamento: `BOLETO`, `CREDIT_CARD`, `PIX`, `UNDEFINED` |
| `value` | number | **SIM** | Valor da cobranca |
| `nextDueDate` | string | **SIM** | Data do primeiro vencimento (YYYY-MM-DD) |
| `cycle` | string | nao | Ciclo: `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `QUARTERLY`, `SEMIANNUAL`, `ANNUAL` |
| `description` | string | nao | Descricao (max 500 chars) |
| `endDate` | string | nao | Data de encerramento da assinatura |
| `maxPayments` | integer | nao | Numero maximo de cobracas |
| `externalReference` | string | nao | Referencia externa (seu sistema) |
| `notificationDisabled` | boolean | nao | Desabilitar notificacoes |

#### Campos de Desconto
```json
{
  "discount": {
    "value": 10.00,
    "dueDateLimitDays": 5,
    "type": "PERCENTAGE"
  }
}
```
- `type`: `FIXED` ou `PERCENTAGE`
- `dueDateLimitDays`: dias antes do vencimento para aplicar desconto

#### Campos de Multa e Juros
```json
{
  "fine": {
    "value": 2.00,
    "type": "PERCENTAGE"
  },
  "interest": {
    "value": 1.00
  }
}
```

#### Campos de Split (Divisao de Pagamento)
```json
{
  "split": [
    {
      "walletId": "wal_XXXXXXXX",
      "fixedValue": 20.00,
      "percentualValue": null,
      "externalReference": "partner_001",
      "description": "Comissao parceiro"
    }
  ]
}
```

### 5.2 Assinatura com BOLETO
```json
{
  "customer": "cus_G7Dvo4iphUNk",
  "billingType": "BOLETO",
  "nextDueDate": "2026-04-10",
  "value": 199.90,
  "cycle": "MONTHLY",
  "description": "Plano Pro - Tecnikos"
}
```

### 5.3 Assinatura com PIX
```json
{
  "customer": "cus_G7Dvo4iphUNk",
  "billingType": "PIX",
  "nextDueDate": "2026-04-10",
  "value": 199.90,
  "cycle": "MONTHLY",
  "description": "Plano Pro - Tecnikos"
}
```

### 5.4 Assinatura com CARTAO DE CREDITO
```json
{
  "customer": "cus_G7Dvo4iphUNk",
  "billingType": "CREDIT_CARD",
  "value": 129.90,
  "cycle": "MONTHLY",
  "nextDueDate": "2026-04-10",
  "description": "Plano Pro - Tecnikos",
  "creditCard": {
    "holderName": "Juliano Triaca",
    "number": "4111111111111111",
    "expiryMonth": "12",
    "expiryYear": "2028",
    "ccv": "123"
  },
  "creditCardHolderInfo": {
    "name": "Juliano Triaca",
    "email": "admin@tecnikos.com.br",
    "cpfCnpj": "47226599000140",
    "postalCode": "01310000",
    "addressNumber": "100",
    "phone": "11999999999",
    "mobilePhone": "11999999999"
  }
}
```

**IMPORTANTE para cartao**:
- Se transacao autorizada: assinatura criada, HTTP 200
- Se recusada: assinatura NAO persiste, HTTP 400
- Cartao fica salvo automaticamente para recorrencia
- Uso de SSL (HTTPS) obrigatorio na captura dos dados do cartao
- Timeout minimo recomendado: 60 segundos

#### creditCard Object
| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| `holderName` | string | **SIM** | Nome do titular |
| `number` | string | **SIM** | Numero do cartao |
| `expiryMonth` | string | **SIM** | Mes de expiracao (MM) |
| `expiryYear` | string | **SIM** | Ano de expiracao (YYYY) |
| `ccv` | string | **SIM** | Codigo de seguranca |

#### creditCardHolderInfo Object
| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| `name` | string | **SIM** | Nome do titular |
| `email` | string | **SIM** | Email |
| `cpfCnpj` | string | **SIM** | CPF ou CNPJ |
| `postalCode` | string | **SIM** | CEP |
| `addressNumber` | string | **SIM** | Numero do endereco |
| `addressComplement` | string | nao | Complemento |
| `phone` | string | nao | Telefone fixo |
| `mobilePhone` | string | nao | Celular |

### 5.5 Assinatura com BILLING_TYPE UNDEFINED
Quando `billingType` = `UNDEFINED`, o proprio cliente escolhe a forma de pagamento ao receber a cobranca.

### 5.6 Response da Criacao (HTTP 200)
```json
{
  "object": "subscription",
  "id": "sub_VXJBYgP2u0eO",
  "dateCreated": "2026-03-10",
  "customer": "cus_G7Dvo4iphUNk",
  "billingType": "CREDIT_CARD",
  "value": 129.90,
  "netValue": 124.90,
  "status": "ACTIVE",
  "cycle": "MONTHLY",
  "nextDueDate": "2026-04-10",
  "endDate": null,
  "maxPayments": null,
  "paymentCount": 0,
  "description": "Plano Pro - Tecnikos",
  "externalReference": null,
  "notificationDisabled": false,
  "creditCard": {
    "creditCardNumber": "1111",
    "creditCardBrand": "VISA"
  },
  "discount": {
    "value": 0,
    "dueDateLimitDays": 0,
    "type": "FIXED"
  },
  "fine": {
    "value": 0
  },
  "interest": {
    "value": 0
  },
  "deleted": false
}
```

---

## 6. CICLOS DE COBRANCA (BILLING CYCLES)

| Ciclo | Valor no API | Frequencia |
|-------|-------------|------------|
| Semanal | `WEEKLY` | A cada 7 dias |
| Quinzenal | `BIWEEKLY` | A cada 14 dias |
| Mensal | `MONTHLY` | A cada mes |
| Trimestral | `QUARTERLY` | A cada 3 meses |
| Semestral | `SEMIANNUAL` | A cada 6 meses |
| Anual | `ANNUAL` | A cada 12 meses |

**Geracao antecipada**: Cobracas sao geradas 40 dias antes do vencimento (configuravel para 14 ou 7 dias via Account Manager).

---

## 7. PERIODO DE TRIAL (TESTE GRATUITO)

Nao existe um campo `trialDays` dedicado. O trial e implementado via `nextDueDate`:

1. Criar assinatura com `nextDueDate` = data apos o trial (ex: 7 dias no futuro)
2. Para cartao: se validado na criacao, fica salvo para cobranca automatica no `nextDueDate`
3. **ATENCAO**: Se criar assinatura SEM dados do cartao e o cliente inserir depois, a cobranca ocorre IMEDIATAMENTE ao inserir o cartao, independente do `nextDueDate`

### Exemplo: Trial de 7 dias
```json
{
  "customer": "cus_G7Dvo4iphUNk",
  "billingType": "CREDIT_CARD",
  "value": 99.90,
  "nextDueDate": "2026-03-17",
  "cycle": "MONTHLY",
  "description": "Plano Starter - 7 dias gratis",
  "creditCard": { ... },
  "creditCardHolderInfo": { ... }
}
```

---

## 8. GERENCIAMENTO DE ASSINATURAS

### 8.1 Buscar Assinatura
```
GET /v3/subscriptions/{id}
```

### 8.2 Listar Assinaturas
```
GET /v3/subscriptions
```
Query params: `offset`, `limit` (max 100), `customer`, `billingType`, `status`

### 8.3 Listar Pagamentos da Assinatura
```
GET /v3/subscriptions/{id}/payments
```
**IMPORTANTE**: Ao contrario de parcelamentos, a cobranca e criada APOS a assinatura. Use este endpoint para acessar as cobracas geradas.

### 8.4 Atualizar Assinatura
```
PUT /v3/subscriptions/{id}
```
**Permission**: `SUBSCRIPTION:WRITE`

#### Campos atualizaveis
| Campo | Tipo | Descricao |
|-------|------|-----------|
| `nextDueDate` | string | Proximo vencimento |
| `value` | number | Novo valor |
| `cycle` | string | Novo ciclo |
| `description` | string | Nova descricao |
| `endDate` | string | Data de encerramento |
| `updatePendingPayments` | boolean | Aplicar mudancas a cobracas pendentes |
| `status` | string | `ACTIVE` ou `INACTIVE` |
| `billingType` | string | Nova forma de pagamento |

**NOTA**: Ao atualizar valor ou forma de pagamento, apenas cobracas FUTURAS sao afetadas. Para atualizar cobracas ja criadas mas nao pagas, enviar `updatePendingPayments: true`.

#### Exemplo: Alterar valor
```json
PUT /v3/subscriptions/sub_VXJBYgP2u0eO
{
  "value": 149.90,
  "updatePendingPayments": true
}
```

### 8.5 Suspender Assinatura (Pausar)
```json
PUT /v3/subscriptions/sub_VXJBYgP2u0eO
{
  "status": "INACTIVE"
}
```
Novas cobracas NAO serao geradas ate reativar.

### 8.6 Reativar Assinatura
```json
PUT /v3/subscriptions/sub_VXJBYgP2u0eO
{
  "status": "ACTIVE",
  "nextDueDate": "2026-05-10"
}
```
**OBRIGATORIO**: Informar `nextDueDate` ao reativar.

### 8.7 Cancelar/Deletar Assinatura
```
DELETE /v3/subscriptions/{id}
```
Dispara webhook `SUBSCRIPTION_DELETED`.

### 8.8 Status da Assinatura
| Status | Descricao |
|--------|-----------|
| `ACTIVE` | Assinatura ativa, gerando cobracas |
| `INACTIVE` | Suspensa, sem novas cobracas |
| `EXPIRED` | Expirada (atingiu endDate ou maxPayments) |

---

## 9. TOKENIZACAO DE CARTAO DE CREDITO

### Endpoint
```
POST /v3/creditCard/tokenizeCreditCard
```
**Permission**: `CREDIT_CARD:WRITE`

### Request Body
```json
{
  "customer": "cus_G7Dvo4iphUNk",
  "creditCard": {
    "holderName": "Juliano Triaca",
    "number": "4111111111111111",
    "expiryMonth": "12",
    "expiryYear": "2028",
    "ccv": "123"
  },
  "creditCardHolderInfo": {
    "name": "Juliano Triaca",
    "email": "admin@tecnikos.com.br",
    "cpfCnpj": "47226599000140",
    "postalCode": "01310000",
    "addressNumber": "100",
    "phone": "11999999999"
  },
  "remoteIp": "200.100.50.25"
}
```

### Response
```json
{
  "creditCardNumber": "1111",
  "creditCardBrand": "VISA",
  "creditCardToken": "tok_XXXXXXXXXXXXXXXX"
}
```

### Usando o Token
Em transacoes futuras, substitua os objetos `creditCard` e `creditCardHolderInfo` pelo `creditCardToken`:
```json
{
  "customer": "cus_G7Dvo4iphUNk",
  "billingType": "CREDIT_CARD",
  "value": 99.90,
  "creditCardToken": "tok_XXXXXXXXXXXXXXXX"
}
```

### Atualizar Cartao da Assinatura (Sem Cobrar)
```
POST /v3/subscriptions/{id}/updateCreditCard
```
Atualiza o cartao sem disparo de cobranca imediata. Cobracas pendentes tambem sao atualizadas com `updatePendingPayments: true`.

**Bandeiras suportadas**: VISA, MASTERCARD, ELO, DINERS, DISCOVER, AMEX

---

## 10. PIX RECORRENTE (PIX AUTOMATICO)

O Asaas oferece **Pix Recorrente** — pagamento automatico e periodico via PIX:
- Funciona como debito automatico, mas usando infraestrutura PIX
- Transferencia executada automaticamente nas datas configuradas
- Sem necessidade de confirmacao manual a cada transacao
- Cancelamento da autorizacao a qualquer momento

Para usar PIX em assinatura, basta criar com `billingType: "PIX"`. A cada cobranca gerada, um QR Code dinamico e criado para o cliente pagar.

---

## 11. SPLIT DE PAGAMENTOS

### Conceito
Divide automaticamente o valor recebido entre contas Asaas. Funcionalidade exclusiva da API (nao disponivel pelo painel web).

### walletId
- Retornado ao criar subconta via API
- Cada conta Asaas tem um walletId unico
- NAO enviar seu proprio walletId no split (o saldo residual fica automaticamente na conta emissora)

### Tipos de Split
| Tipo | Campo | Exemplo |
|------|-------|---------|
| Valor fixo | `fixedValue` | R$ 20,00 por cobranca |
| Percentual | `percentualValue` | 10% do netValue |

### Na Assinatura
O split configurado na assinatura serve como **template** — aplicado automaticamente a cada nova cobranca gerada.

```json
{
  "customer": "cus_G7Dvo4iphUNk",
  "billingType": "BOLETO",
  "value": 200.00,
  "nextDueDate": "2026-04-10",
  "cycle": "MONTHLY",
  "split": [
    {
      "walletId": "wal_PARTNER001",
      "percentualValue": 15.00,
      "description": "Comissao revenda"
    }
  ]
}
```

### Regras
- Split calculado sobre `netValue` (valor liquido, apos taxas)
- Sem limite de walletIds por split
- Valor residual fica na conta emissora
- Atualizar split: usar `PUT /v3/subscriptions/{id}` com novo array `split`
- Enviar `split: null` ou `split: []` DESATIVA o split

### Subcontas
```
POST /v3/accounts
```
Retorna `apiKey` e `walletId` da subconta criada (exibidos apenas uma vez).

---

## 12. WEBHOOKS

### Configuracao via API
```
POST /v3/webhooks
```
**Permission**: `WEBHOOK:WRITE`

#### Request Body
```json
{
  "name": "Tecnikos Webhook",
  "url": "https://tecnikos.com.br/api/webhooks/asaas",
  "email": "admin@tecnikos.com.br",
  "enabled": true,
  "interrupted": false,
  "authToken": "meu_token_seguro_com_pelo_menos_32_caracteres_aqui",
  "sendType": "SEQUENTIALLY",
  "events": [
    "PAYMENT_CREATED",
    "PAYMENT_CONFIRMED",
    "PAYMENT_RECEIVED",
    "PAYMENT_OVERDUE",
    "PAYMENT_DELETED",
    "PAYMENT_REFUNDED",
    "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
    "SUBSCRIPTION_CREATED",
    "SUBSCRIPTION_UPDATED",
    "SUBSCRIPTION_INACTIVATED",
    "SUBSCRIPTION_DELETED"
  ]
}
```

### authToken
- Entre 32 e 255 caracteres
- Sem espacos
- Sem sequencias numericas (12345) ou 4 letras repetidas
- Nao pode ser uma API key do Asaas
- Enviado no header `asaas-access-token` em todas as notificacoes
- Gerado automaticamente se nao fornecido (exibido apenas uma vez)

### Limites
- Ate 10 URLs de webhook por conta
- Eventos mantidos por 14 dias
- Se falhar 15 vezes consecutivas (nao retornar HTTP 200), fila interrompida

### IPs do Asaas
Configurar firewall para aceitar apenas IPs oficiais do Asaas nas URLs de webhook.

---

## 13. EVENTOS DE WEBHOOK — PAYMENT

| Evento | Descricao |
|--------|-----------|
| `PAYMENT_CREATED` | Nova cobranca gerada |
| `PAYMENT_AWAITING_RISK_ANALYSIS` | Cartao aguardando analise de risco manual |
| `PAYMENT_APPROVED_BY_RISK_ANALYSIS` | Cartao aprovado pela analise de risco |
| `PAYMENT_REPROVED_BY_RISK_ANALYSIS` | Cartao reprovado pela analise de risco |
| `PAYMENT_AUTHORIZED` | Cartao autorizado, aguardando captura |
| `PAYMENT_UPDATED` | Alteracao de vencimento ou valor |
| `PAYMENT_CONFIRMED` | Cobranca confirmada (paga, saldo nao disponivel ainda) |
| `PAYMENT_RECEIVED` | Cobranca recebida (saldo disponivel) |
| `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` | Falha na captura do cartao |
| `PAYMENT_ANTICIPATED` | Cobranca antecipada |
| `PAYMENT_OVERDUE` | Cobranca vencida |
| `PAYMENT_DELETED` | Cobranca removida |
| `PAYMENT_RESTORED` | Cobranca restaurada |
| `PAYMENT_REFUNDED` | Cobranca estornada |
| `PAYMENT_PARTIALLY_REFUNDED` | Estorno parcial |
| `PAYMENT_REFUND_IN_PROGRESS` | Estorno em processamento |
| `PAYMENT_REFUND_DENIED` | Estorno negado (apenas boleto) |
| `PAYMENT_RECEIVED_IN_CASH_UNDONE` | Recebimento em dinheiro desfeito |
| `PAYMENT_CHARGEBACK_REQUESTED` | Chargeback recebido |
| `PAYMENT_CHARGEBACK_DISPUTE` | Em disputa de chargeback |
| `PAYMENT_AWAITING_CHARGEBACK_REVERSAL` | Disputa ganha, aguardando repasse |
| `PAYMENT_DUNNING_RECEIVED` | Negativacao recebida |
| `PAYMENT_DUNNING_REQUESTED` | Negativacao solicitada |
| `PAYMENT_BANK_SLIP_CANCELLED` | Boleto cancelado por expiracao |
| `PAYMENT_BANK_SLIP_VIEWED` | Boleto visualizado pelo cliente |
| `PAYMENT_CHECKOUT_VIEWED` | Fatura visualizada pelo cliente |
| `PAYMENT_SPLIT_DIVERGENCE_BLOCK` | Bloqueio por divergencia de split |
| `PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED` | Bloqueio por divergencia de split finalizado |

### Payload de Payment Webhook
```json
{
  "id": "evt_XXXXXXXX",
  "event": "PAYMENT_RECEIVED",
  "dateCreated": "2026-03-10 14:30:00",
  "payment": {
    "object": "payment",
    "id": "pay_XXXXXXXX",
    "customer": "cus_G7Dvo4iphUNk",
    "subscription": "sub_VXJBYgP2u0eO",
    "billingType": "CREDIT_CARD",
    "value": 129.90,
    "netValue": 124.90,
    "status": "RECEIVED",
    "dueDate": "2026-04-10",
    "paymentDate": "2026-04-10",
    "description": "Plano Pro - Tecnikos",
    "externalReference": null,
    "confirmedDate": "2026-04-10"
  }
}
```

### Fluxos tipicos
- **Boleto pago em dia**: `PAYMENT_CREATED` > `PAYMENT_CONFIRMED` > `PAYMENT_RECEIVED`
- **Boleto pago em atraso**: `PAYMENT_CREATED` > `PAYMENT_OVERDUE` > `PAYMENT_CONFIRMED` > `PAYMENT_RECEIVED`
- **PIX pago**: `PAYMENT_CREATED` > `PAYMENT_RECEIVED`
- **Cartao aprovado**: `PAYMENT_CREATED` > `PAYMENT_CONFIRMED` > `PAYMENT_RECEIVED`
- **Cartao recusado**: `PAYMENT_CREATED` > `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED`

---

## 14. EVENTOS DE WEBHOOK — SUBSCRIPTION

| Evento | Descricao |
|--------|-----------|
| `SUBSCRIPTION_CREATED` | Nova assinatura criada |
| `SUBSCRIPTION_UPDATED` | Assinatura alterada |
| `SUBSCRIPTION_INACTIVATED` | Assinatura inativada |
| `SUBSCRIPTION_DELETED` | Assinatura removida |
| `SUBSCRIPTION_SPLIT_DISABLED` | Split da assinatura desabilitado |
| `SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK` | Assinatura bloqueada por divergencia de split |
| `SUBSCRIPTION_SPLIT_DIVERGENCE_BLOCK_FINISHED` | Bloqueio por divergencia finalizado |

### Payload de Subscription Webhook
```json
{
  "id": "evt_XXXXXXXX",
  "event": "SUBSCRIPTION_CREATED",
  "dateCreated": "2026-03-10 14:30:00",
  "subscription": {
    "object": "subscription",
    "id": "sub_VXJBYgP2u0eO",
    "dateCreated": "10/03/2026",
    "customer": "cus_G7Dvo4iphUNk",
    "paymentLink": null,
    "value": 129.90,
    "nextDueDate": "10/04/2026",
    "cycle": "MONTHLY",
    "description": "Plano Pro - Tecnikos",
    "billingType": "CREDIT_CARD",
    "deleted": false,
    "status": "ACTIVE",
    "externalReference": null,
    "sendPaymentByPostalService": false,
    "discount": {
      "value": 0,
      "limitDate": null,
      "dueDateLimitDays": 0,
      "type": "PERCENTAGE"
    },
    "fine": {
      "value": 0,
      "type": "PERCENTAGE"
    },
    "interest": {
      "value": 0,
      "type": "PERCENTAGE"
    },
    "split": []
  }
}
```

**NOTA IMPORTANTE**: O Asaas NAO tem webhooks dedicados para ciclo de vida da assinatura alem dos listados acima. O controle principal e feito via webhooks de PAYMENT. Ao criar uma assinatura, o `PAYMENT_CREATED` e disparado automaticamente e contem o `subscription` ID no payload.

---

## 15. RESUMO DE TODOS OS ENDPOINTS

### Customers
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| `POST` | `/v3/customers` | Criar cliente |
| `GET` | `/v3/customers` | Listar clientes |
| `GET` | `/v3/customers/{id}` | Buscar cliente |
| `PUT` | `/v3/customers/{id}` | Atualizar cliente |
| `DELETE` | `/v3/customers/{id}` | Remover cliente |

### Subscriptions
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| `POST` | `/v3/subscriptions` | Criar assinatura |
| `GET` | `/v3/subscriptions` | Listar assinaturas |
| `GET` | `/v3/subscriptions/{id}` | Buscar assinatura |
| `PUT` | `/v3/subscriptions/{id}` | Atualizar assinatura |
| `DELETE` | `/v3/subscriptions/{id}` | Deletar assinatura |
| `GET` | `/v3/subscriptions/{id}/payments` | Listar cobracas da assinatura |

### Credit Card
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| `POST` | `/v3/creditCard/tokenizeCreditCard` | Tokenizar cartao |
| `POST` | `/v3/subscriptions/{id}/updateCreditCard` | Atualizar cartao da assinatura |

### Webhooks
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| `POST` | `/v3/webhooks` | Criar webhook |
| `GET` | `/v3/webhooks` | Listar webhooks |

### Subcontas (Split)
| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| `POST` | `/v3/accounts` | Criar subconta |

---

## 16. CONSIDERACOES PARA INTEGRACAO TECNIKOS

### Fluxo sugerido para SaaS Billing
1. Tenant faz signup → criar Customer no Asaas (`POST /v3/customers`)
2. Tenant escolhe plano → criar Subscription no Asaas (`POST /v3/subscriptions`)
3. Webhook `PAYMENT_RECEIVED` → ativar/manter tenant ativo
4. Webhook `PAYMENT_OVERDUE` → notificar tenant, iniciar grace period
5. Webhook `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` → notificar, pedir novo cartao
6. Upgrade/downgrade → `PUT /v3/subscriptions/{id}` com novo valor
7. Cancelamento → `DELETE /v3/subscriptions/{id}` ou `status: INACTIVE`

### Campos para armazenar no banco Tecnikos
- `asaasCustomerId` (string) — ID do cliente no Asaas
- `asaasSubscriptionId` (string) — ID da assinatura no Asaas
- `asaasPaymentStatus` (string) — Status do ultimo pagamento

### Seguranca
- API keys em variaveis de ambiente (nunca no codigo)
- Webhook authToken para validar origem das notificacoes
- Idempotencia: tratar duplicatas de webhook (guardar event ID)
- TLS 1.3 recomendado

---

## 17. LINKS DA DOCUMENTACAO OFICIAL

- Visao geral: https://docs.asaas.com/docs/welcome-to-asaas
- Autenticacao: https://docs.asaas.com/docs/authentication-2
- Sandbox: https://docs.asaas.com/docs/sandbox-en
- Criar cliente: https://docs.asaas.com/reference/create-new-customer
- Criar assinatura: https://docs.asaas.com/reference/create-new-subscription
- Assinatura com cartao: https://docs.asaas.com/reference/create-subscription-with-credit-card
- Atualizar assinatura: https://docs.asaas.com/reference/update-existing-subscription
- Listar assinaturas: https://docs.asaas.com/reference/list-subscriptions
- Pagamentos da assinatura: https://docs.asaas.com/reference/list-payments-of-a-subscription
- Tokenizacao cartao: https://docs.asaas.com/reference/credit-card-tokenization
- Webhooks overview: https://docs.asaas.com/docs/about-webhooks
- Eventos payment: https://docs.asaas.com/docs/payment-events
- Eventos subscription: https://docs.asaas.com/docs/subscription-events
- Criar webhook via API: https://docs.asaas.com/docs/create-new-webhook-via-api
- Split overview: https://docs.asaas.com/docs/payment-split-overview
- Split em assinaturas: https://docs.asaas.com/docs/split-on-subscriptions
- Pix recorrente: https://docs.asaas.com/docs/recurring-pix
- Precos: https://www.asaas.com/precos-e-taxas
