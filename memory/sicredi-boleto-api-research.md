# Sicredi Boleto API - Pesquisa Completa

Data: 2026-04-08

## 1. URLs Base

| Ambiente | URL |
|----------|-----|
| Producao | `https://api-parceiro.sicredi.com.br` |
| Sandbox | `https://api-parceiro.sicredi.com.br/sb` |

Nota: sandbox usa o MESMO dominio, apenas com prefixo `/sb` nos paths.

## 2. Autenticacao

### Metodo: OAuth2 Password Grant

**Token Endpoint:**
- Producao: `POST https://api-parceiro.sicredi.com.br/auth/openapi/token`
- Sandbox: `POST https://api-parceiro.sicredi.com.br/sb/auth/openapi/token`

**Content-Type:** `application/x-www-form-urlencoded`

**Body:**
```
username=<codigoBeneficiario+cooperativa>
password=<codigo_acesso>
grant_type=password
scope=cobranca
```

**Refresh Token:**
```
grant_type=refresh_token
refresh_token=<token>
```

**Headers obrigatorios em TODAS as requests:**
```
x-api-key: <token_gerado_no_portal_developer>
context: COBRANCA
Authorization: Bearer <access_token>
cooperativa: <codigo_cooperativa>
posto: <codigo_posto/agencia>
accept: application/json
content-type: application/json
```

**Resposta do token:**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": <seconds>,
  "refresh_expires_in": <seconds>
}
```

### Credenciais necessarias:
1. **username** = codigoBeneficiario (5 digitos) + cooperativa (4 digitos) = 9 digitos
2. **password** = Codigo de acesso gerado no Internet Banking (Cobranca > Codigo de acesso > Gerar)
3. **x-api-key** = Token gerado no Portal do Desenvolvedor (developer.sicredi.com.br)
4. **cooperativa** = Codigo da cooperativa (4 digitos)
5. **posto** = Codigo da agencia/posto (2 digitos)
6. **codigoBeneficiario** = Codigo do beneficiario (5 digitos)
7. **scope** = "cobranca"

## 3. Endpoints

### APIs necessarias no Portal Developer:
- `OPEN API - OAUTH - PARCEIROS 1.0.0` (autenticacao)
- `OPEN API - COBRANCA - PARCEIROS 1.0.0` (boletos)

### 3.1 Registrar Boleto
```
POST /cobranca/boleto/v1/boletos
```

### 3.2 Consultar Boleto
```
GET /cobranca/boleto/v1/boletos?nossoNumero={nossoNumero}&codigoBeneficiario={cod}
```

### 3.3 Baixar/Cancelar Boleto
```
PATCH /cobranca/boleto/v1/boletos/{nossoNumero}/baixa?codigoBeneficiario={cod}
```
NOTA: Desabilitado no sandbox!

### 3.4 Alterar Data de Vencimento
```
PATCH /cobranca/boleto/v1/boletos/{nossoNumero}/data-vencimento?codigoBeneficiario={cod}
Body: { "dataVencimento": "YYYY-MM-DD" }
```

### 3.5 Download PDF
```
GET /cobranca/boleto/v1/boletos/pdf?linhaDigitavel={linhaDigitavel}
```
Retorna o PDF codificado.

### 3.6 Listar Boletos Liquidados por Dia
```
GET /cobranca/boleto/v1/boletos/liquidados/dia?dia={dd/MM/yyyy}&codigoBeneficiario={cod}&pagina={n}
```

### 3.7 Webhook - Contratar
```
POST /cobranca/boleto/v1/webhook/contrato/
```
Body:
```json
{
  "cooperativa": "0001",
  "posto": "01",
  "codBeneficiario": "12345",
  "eventos": ["LIQUIDACAO"],
  "url": "https://meusite.com/webhook",
  "urlStatus": "ATIVO",
  "contratoStatus": "ATIVO"
}
```

Eventos disponiveis:
- LIQUIDACAO
- LIQUIDACAO_PIX
- LIQUIDACAO_COMPE_H5
- LIQUIDACAO_COMPE_H6
- LIQUIDACAO_COMPE_H8
- LIQUIDACAO_REDE
- LIQUIDACAO_CARTORIO
- AVISO_PAGAMENTO_COMPE
- ESTORNO_LIQUIDACAO_REDE

### 3.8 Webhook - Consultar
```
GET /cobranca/boleto/v1/webhook/contrato/?cooperativa={}&posto={}&beneficiario={}
```

### 3.9 Webhook - Atualizar
```
PUT /cobranca/boleto/v1/webhook/contrato/
```
Body: mesmo formato do POST, com campos atualizados.

### 3.10 Webhook - Desativar
```
PUT /cobranca/boleto/v1/webhook/contrato/
```
Body: mesmo formato, com `contratoStatus: "INATIVO"` e `status: "INATIVO"`.

## 4. Campos Obrigatorios para Registro de Boleto

### Boleto:
| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| codigoBeneficiario | string | Sim | Codigo do beneficiario |
| dataVencimento | string (Y-m-d) | Sim | Data de vencimento |
| valor | float (14,2) | Sim | Valor do boleto |
| especieDocumento | string | Sim | Tipo do documento |
| tipoCobranca | string | Sim | NORMAL ou HIBRIDO (com QR Pix) |
| seuNumero | string | Nao | Controle interno |
| nossoNumero | int | Nao | Se nao informado, Sicredi gera automaticamente |
| validadeAposVencimento | int | Nao | Dias de validade apos vencimento (default: 60) |
| multa | float | Nao | Percentual de multa |
| juros | float | Nao | Percentual/valor de juros por dia |
| tipoJuros | string | Nao | VALOR ou PERCENTUAL |
| tipoDesconto | string | Nao | VALOR ou PERCENTUAL |
| valorDesconto1/2/3 | float | Nao | Valor do desconto |
| dataDesconto1/2/3 | string | Nao | Data limite desconto |
| mensagens | string[] | Nao | Mensagens no boleto |

### Especies de Documento:
DUPLICATA_MERCANTIL_INDICACAO, DUPLICATA_RURAL, NOTA_PROMISSORIA, NOTA_PROMISSORIA_RURAL,
NOTA_SEGUROS, RECIBO, LETRA_CAMBIO, NOTA_DEBITO, DUPLICATA_SERVICO_INDICACAO,
OUTROS, BOLETO_PROPOSTA, CARTAO_CREDITO, BOLETO_DEPOSITO

### Pagador (obrigatorio):
| Campo | Tipo | Obrigatorio | Descricao |
|-------|------|-------------|-----------|
| tipoPessoa | string | Sim | PESSOA_FISICA ou PESSOA_JURIDICA |
| documento | string | Sim | CPF ou CNPJ |
| nome | string | Sim | Nome completo |
| logradouro | string | Nao | Endereco |
| numeroEndereco | string | Nao | Numero |
| cidade | string | Nao | Cidade |
| uf | string(2) | Nao | Estado |
| cep | string(8) | Nao | CEP |
| telefone | string | Nao | Telefone |
| email | string | Nao | Email |

### Resposta do registro:
```json
{
  "linhaDigitavel": "...",
  "codigoBarras": "...",
  "cooperativa": "0001",
  "posto": "01",
  "nossoNumero": "221000144",
  "txid": "...",       // se HIBRIDO
  "qrCode": "..."      // se HIBRIDO
}
```

### Payload do Webhook (exemplo liquidacao):
```json
{
  "agencia": "9999",
  "posto": "99",
  "beneficiario": "12345",
  "nossoNumero": "221000144",
  "dataEvento": [2024,3,20,11,40,39,24000000],
  "movimento": "LIQUIDACAO_PIX",
  "valorLiquidacao": "101.01",
  "valorDesconto": "0",
  "valorJuros": "0",
  "valorMulta": "0",
  "valorAbatimento": "0",
  "carteira": "CARTEIRA SIMPLES",
  "dataPrevisaoPagamento": [2024,3,20],
  "idEventoWebhook": "N000000000000000000000000000000LIQUIDACAO_PIX"
}
```

## 5. Como Obter Credenciais de Sandbox

### Passo 1: Criar conta no Portal Developer
URL: https://developer.sicredi.com.br/api-portal/pt-br/user/register
Selecionar "Conta Profissional" e preencher com dados do titular da conta Sicredi.

### Passo 2: Criar App Sandbox
- Ir em "Minha Conta" > "Minhas Apps"
- Criar nova aplicacao com nome prefixado "API Cobranca SandBox"
- Selecionar APIs:
  - OPEN API - OAUTH - PARCEIROS 1.0.0
  - OPEN API - COBRANCA - PARCEIROS 1.0.0
- Copiar o Client ID gerado

### Passo 3: Solicitar Access Token
- Abrir chamado no portal: "Suporte" > "Abrir chamado"
- Solicitar Access Token para Sandbox
- Aguardar 5-60 minutos (pode levar ate 48h)
- O token aparecera em "Minhas Apps" > detalhes da app

### Passo 4: Gerar Codigo de Acesso (Password)
- Acessar Internet Banking Sicredi
- Menu: Cobranca > Codigo de acesso > Gerar
- Aceitar termos
- Confirmar via app Sicredi (QR Code)
- Copiar o codigo gerado

### Passo 5: Contratar produto (se necessario)
- Nem todas as contas tem permissao automatica
- Pode ser necessario contratar "Cobranca Online Ecom" via sistema SIAT

## 6. Observacoes Importantes

- Boletos registrados em ate 5 minutos apos criacao
- Baixa de boleto (cancelamento) NAO funciona no sandbox
- Token de sandbox e producao sao DIFERENTES (gerar separadamente)
- O x-api-key e diferente por ambiente
- Boleto HIBRIDO inclui QR Code Pix para pagamento
- Webhook precisa ser contratado separadamente
- Consulta de liquidados por dia: paginada, formato data dd/MM/yyyy

## Fontes
- Portal Developer Sicredi: https://developer.sicredi.com.br
- PHP Connector (v3.3): https://github.com/Ctrl-Mota/banco-sicredi-connector-php
- IXC Wiki: https://wiki-erp.ixcsoft.com.br
- Kobana: https://ajuda.kobana.com.br
- Sicredi Pioneira Blog: https://sicredipioneira.com.br/blog/
