# Focus NFe API - Manifestacao do Destinatario (MDe)

Pesquisa realizada em 2026-03-07.

## Ambientes

| Ambiente | Base URL |
|----------|----------|
| Producao | `https://api.focusnfe.com.br/v2` |
| Homologacao | `https://homologacao.focusnfe.com.br/v2` |

## Autenticacao

HTTP Basic Auth:
- Username: `SEU_TOKEN_API`
- Password: (vazio)

Alternativa: query param `?token=SEU_TOKEN_API`

---

## 1. Listar NFes Recebidas

```
GET /v2/nfes_recebidas?cnpj=CNPJ_EMPRESA
```

### Query Parameters

| Parametro | Tipo | Obrigatorio | Descricao |
|-----------|------|-------------|-----------|
| `cnpj` | string | Sim | CNPJ da empresa recebedora |
| `versao` | number | Nao | Retorna docs com versao maior que o valor informado (paginacao incremental) |
| `pendente` | number | Nao | Lista apenas notas pendentes de manifestacao final |
| `pendente_ciencia` | number | Nao | Lista apenas notas sem ciencia registrada |

### Response Headers

| Header | Tipo | Descricao |
|--------|------|-----------|
| `X-Total-Count` | integer | Total de registros |
| `X-Max-Version` | integer | Versao maxima nos documentos retornados (usar para paginacao) |

### Paginacao

Retorna as 100 primeiras notas. Para pegar mais, usar o valor de `X-Max-Version` como parametro `versao` na proxima chamada.

### Response Fields (Array)

```json
[
  {
    "nome_emitente": "string",
    "documento_emitente": "string (CNPJ/CPF)",
    "cnpj_destinatario": "string",
    "chave_nfe": "string (44 digitos)",
    "valor_total": "string",
    "data_emissao": "string (date-time)",
    "situacao": "autorizada|cancelada|denegada",
    "manifestacao_destinatario": "nulo|ciencia|confirmacao|desconhecimento|nao_realizada",
    "nfe_completa": "boolean string",
    "tipo_nfe": "0 (entrada) | 1 (saida)",
    "versao": "number",
    "digest_value": "string",
    "numero_carta_correcao": "string (optional)",
    "carta_correcao": "string (optional)",
    "data_carta_correcao": "string date-time (optional)",
    "data_cancelamento": "string date-time (optional)",
    "justificativa_cancelamento": "string (optional)"
  }
]
```

### Status Codes
- 200: Sucesso
- 400: Requisicao invalida
- 401: Nao autorizado
- 403: Permissao negada

---

## 2. Consultar NFe Individual

```
GET /v2/nfes_recebidas/{chave}
```

### Query Parameters
| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `cnpj` | string | CNPJ da empresa (desambiguar multiplas empresas) |
| `completa` | string ("1"/"0") | Retorna dados completos se disponiveis |

---

## 3. Consultar NFe em JSON (dados completos)

```
GET /v2/nfes_recebidas/{chave}.json
```

### Query Parameters
- `completa`: "1" para dados completos (se nfe_completa = true)

### Response (quando completa=1)
Inclui objetos aninhados:
- `requisicao_nota_fiscal` — dados da nota com items, emitente, destinatario, ICMS/PIS/COFINS
- `protocolo_nota_fiscal` — protocolo de autorizacao
- `requisicao_carta_correcao` — carta de correcao (se houver)
- `protocolo_carta_correcao`
- `requisicao_cancelamento`
- `protocolo_cancelamento`

### Campos de Item
- `numero_item`, `codigo_produto`, `descricao`
- `codigo_ncm`, `cfop`
- `quantidade_comercial`, `valor_unitario_comercial`
- `icms_valor`, `pis_valor`, `cofins_valor`
- Campos de calculo ICMS, PIS, COFINS

### Campos de Totais
- `icms_base_calculo`, `icms_valor_total`
- `valor_produtos`, `valor_frete`, `valor_desconto`
- `valor_pis`, `valor_cofins`
- `formas_pagamento` (array com metodos de pagamento)

---

## 4. Download XML da NFe

```
GET /v2/nfes_recebidas/{chave}.xml
```

Retorna o XML completo (procNFe) da nota fiscal.

**IMPORTANTE**: O XML completo so fica disponivel APOS a manifestacao de ciencia.
O campo `nfe_completa` deve ser `true` para o XML estar disponivel.

---

## 5. Download DANFe (PDF)

```
GET /v2/nfes_recebidas/{chave}.pdf
```

Retorna redirect para URL do PDF do DANFe.
- O PDF pode estar disponivel mesmo com `nfe_completa = false`
- Se a lib HTTP nao segue redirects, capturar URL do header `Location`

---

## 6. MANIFESTAR NFe RECEBIDA (ENDPOINT PRINCIPAL)

```
POST /v2/nfes_recebidas/{chave}/manifesto
```

### Path Parameters
| Parametro | Tipo | Obrigatorio |
|-----------|------|-------------|
| `chave` | string | Sim — chave de acesso da NFe (44 digitos) |

### Request Body (JSON)

```json
{
  "tipo": "ciencia"
}
```

### Valores aceitos para `tipo`

| Valor | Descricao | Justificativa |
|-------|-----------|---------------|
| `ciencia` | Ciencia da Operacao — evento NAO conclusivo, apenas declara ciencia | Nao obrigatoria |
| `confirmacao` | Confirmacao da Operacao — confirma que ocorreu conforme descrito | Nao obrigatoria |
| `desconhecimento` | Desconhecimento da Operacao — nao reconhece a operacao | Obrigatoria |
| `nao_realizada` | Operacao Nao Realizada — operacao nao foi realizada | Obrigatoria |

### Exemplos de Request Body

**Ciencia:**
```json
{
  "tipo": "ciencia"
}
```

**Confirmacao:**
```json
{
  "tipo": "confirmacao"
}
```

**Desconhecimento:**
```json
{
  "tipo": "desconhecimento",
  "justificativa": "Empresa nao reconhece esta operacao"
}
```

**Operacao Nao Realizada:**
```json
{
  "tipo": "nao_realizada",
  "justificativa": "Mercadoria nao foi entregue"
}
```

### Exemplos cURL

```bash
# Ciencia da Operacao
curl -X POST \
  -u "SEU_TOKEN:" \
  -H "Content-Type: application/json" \
  -d '{"tipo":"ciencia"}' \
  "https://api.focusnfe.com.br/v2/nfes_recebidas/CHAVE_NFE_44_DIGITOS/manifesto"

# Confirmacao da Operacao
curl -X POST \
  -u "SEU_TOKEN:" \
  -H "Content-Type: application/json" \
  -d '{"tipo":"confirmacao"}' \
  "https://api.focusnfe.com.br/v2/nfes_recebidas/CHAVE_NFE_44_DIGITOS/manifesto"

# Operacao Nao Realizada
curl -X POST \
  -u "SEU_TOKEN:" \
  -H "Content-Type: application/json" \
  -d '{"tipo":"nao_realizada","justificativa":"Motivo da nao realizacao"}' \
  "https://api.focusnfe.com.br/v2/nfes_recebidas/CHAVE_NFE_44_DIGITOS/manifesto"
```

### Response (200 OK)
Atualiza o campo `manifestacao_destinatario` da NFe para o valor informado.

### Response de Erro

```json
{
  "codigo": "requisicao_invalida",
  "mensagem": "CNPJ do emitente nao autorizado ou nao informado"
}
```

### Status Codes
- 200: Sucesso (sincrono)
- 400: Requisicao invalida
- 401: Nao autorizado
- 403: Permissao negada

---

## 7. Consultar Ultima Manifestacao

```
GET /v2/nfes_recebidas/{chave}/manifesto
```

Retorna dados da ultima manifestacao registrada para a NFe.

---

## 8. Webhooks (Gatilhos)

### Criar Webhook

```
POST /v2/hooks
```

### Request Body

```json
{
  "cnpj": "12345678000123",
  "event": "nfe_recebida",
  "url": "https://seu-sistema.com/webhook/nfe-recebida",
  "authorization": "Bearer seu-token-interno",
  "authorization_header": "Authorization"
}
```

### Eventos Disponiveis

| Evento | Descricao |
|--------|-----------|
| `nfe` | NFe emitida |
| `nfse` | NFSe emitida |
| `nfsen` | NFSe Nacional |
| `nfce_contingencia` | NFCe contingencia |
| `nfe_recebida` | **NFe recebida (MDe)** |
| `nfe_recebida_falha_consulta` | Falha ao consultar NFe recebida |
| `nfse_recebida` | NFSe recebida |
| `cte_recebida` | CTe recebido |
| `inutilizacao` | Inutilizacao |
| `cte` | CTe emitido |
| `mdfe` | MDFe |
| `nfcom` | NFCom |

### Response

```json
{
  "id": "Vj5rmkBq",
  "url": "https://seu-sistema.com/webhook/nfe-recebida",
  "authorization": "Bearer seu-token-interno",
  "authorization_header": "Authorization",
  "event": "nfe_recebida",
  "cnpj": "12345678000123",
  "cpf": null
}
```

### Listar Webhooks
```
GET /v2/hooks
```

### Deletar Webhook
```
DELETE /v2/hooks/{id}
```

---

## Regras e Prazos

### Fluxo Obrigatorio
1. NFe chega na SEFAZ e Focus NFe recebe dados basicos (emitente, chave, data, valor)
2. Focus notifica via webhook (`nfe_recebida`) ou voce consulta via polling (`GET /nfes_recebidas`)
3. Voce registra **ciencia** (`POST manifesto` com tipo=ciencia)
4. Apos ciencia, Focus busca o XML completo da SEFAZ e disponibiliza
5. `nfe_completa` muda para `true` (pode levar ate 2h por limitacao da SEFAZ)
6. Agora voce pode baixar o XML completo (`GET /nfes_recebidas/{chave}.xml`)
7. Voce registra manifestacao conclusiva (confirmacao, desconhecimento, ou nao_realizada)

### Prazos
- **180 dias** apos autorizacao da NFe para registrar manifestacao conclusiva
- **30 dias** apos primeira manifestacao para retificar (alterar evento)
- Apenas o **ultimo evento** e considerado valido pelo Fisco
- Maximo de **2 eventos** de cada tipo conclusivo por NFe

### Sincronizacao
- API atualiza notas recebidas a cada **2 horas**
- SEFAZ limita consultas: **20 chaves por hora**
- Ao ativar manifestacao para empresa, Focus envia notas dos ultimos **90 dias**

### Obrigatoriedade
Manifestacao e obrigatoria para:
- Combustiveis
- Cigarros
- Bebidas alcoolicas
- Refrigerantes
- Agua mineral (distribuidores/atacadistas)
- NFes com valor acima de R$ 100.000

### Efeitos da Manifestacao
- **Ciencia**: NAO e conclusiva, apenas libera acesso ao XML completo
- **Confirmacao**: Impede cancelamento pelo emitente, garante credito fiscal
- **Desconhecimento**: Informa que destinatario nao reconhece a operacao
- **Nao Realizada**: Informa que operacao nao foi efetuada

---

## Links da Documentacao

- Docs oficiais: https://focusnfe.com.br/doc/
- API Reference: https://doc.focusnfe.com.br/reference/manifestarnferecebida
- API Reference (listar): https://doc.focusnfe.com.br/reference/consultarnferecebidas
- API Reference (JSON): https://doc.focusnfe.com.br/reference/consultarnferecebidaindividualjson
- API Reference (PDF): https://doc.focusnfe.com.br/reference/consultarnferecebidaindividualpdf
- API Reference (webhook): https://doc.focusnfe.com.br/reference/criarwebhook
- Postman: https://www.postman.com/focusnfe/focus-nfe/documentation/906jrtc/focus-nfe
- Forum: https://forum.focusnfe.com.br/
