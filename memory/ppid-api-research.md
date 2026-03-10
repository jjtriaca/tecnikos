# PPID API Research — Verificacao de Identidade Digital

## Data da Pesquisa: 2026-03-10

---

## 1. Visao Geral

**PPID** (ppid.com.br) e uma plataforma brasileira de verificacao de identidade digital.
- +50 milhoes de verificacoes realizadas
- +1.200 empresas clientes
- Certificada INMETRO, ISO 27001, SOC 2 Type II
- Servidores no Brasil, 100% LGPD compliant
- Sede: Av. Brigadeiro Faria Lima, 3477, Sao Paulo
- Suporte: +55-11-95675-7384 (24/7 em portugues)

---

## 2. Servicos Oferecidos

| Servico | Descricao | Custo | Tempo Resposta |
|---------|-----------|-------|----------------|
| **OCR** | Extracao de dados de documentos (RG, CNH, RNE, CTPS, Passaporte, +40 tipos) | 1 credito | ~300ms |
| **Face Match** | Comparacao biometrica entre foto do documento e selfie (80+ pontos faciais, 99.9% acuracia) | 1 credito | ~200ms |
| **Liveness** | Prova de vida passiva (100+ caracteristicas faciais, anti-spoofing) | 1 credito | - |
| **Classification** | Classificacao automatica do tipo de documento | 1 credito | - |
| **Onboarding Completo** | Jornada completa: OCR + Liveness + Face Match + Biometria | a partir de R$ 0,49/consulta | ~500ms |

---

## 3. Plano Gratuito

- **500 verificacoes gratuitas por mes**
- Sem cartao de credito
- Sem compromisso
- Ideal para testes e validacao

---

## 4. API — Detalhes Tecnicos

### 4.1 Base URL
```
https://api.ppid.com.br
```

### 4.2 Autenticacao

**JWT Bearer Token** via header `Authorization`.

**Login:**
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "seu-email@example.com",
  "senha": "sua-senha"
}
```

**Resposta (200):**
```json
{
  "token": "eyJhbGciOi...",
  "expiration": "2025-12-15T23:00:00Z",
  "nome": "Joao"
}
```

**Uso em todas as requests:**
```
Authorization: Bearer eyJhbGciOi...
```

### 4.3 Endpoints

---

#### OCR — Extracao de Dados de Documentos

**Via Base64:**
```
POST /api/ocr/consultar
Content-Type: application/json
Authorization: Bearer {token}

{
  "imagemBase64": "data:image/jpeg;base64,...",
  "mimeType": "image/jpeg"  // opcional
}
```

**Via Upload de Arquivo:**
```
POST /api/ocr/consultar-arquivo
Content-Type: multipart/form-data
Authorization: Bearer {token}

arquivo: (file binary)
```

**Resposta (200):**
```json
{
  "sucesso": true,
  "consultaId": "uuid-da-consulta",
  "resultado": {
    "documentType": "CNH",
    "confidence": 0.987,
    "fields": {
      "nome": "...",
      "cpf": "...",
      "rg": "...",
      "dataNascimento": "...",
      "validade": "...",
      "numeroDocumento": "..."
    }
  },
  "saldoRestante": 499
}
```

**Custo: 1 credito**

---

#### Face Match — Comparacao Facial

**Via Base64:**
```
POST /api/facematch/consultar
Content-Type: application/json
Authorization: Bearer {token}

{
  "documentoBase64": "data:image/jpeg;base64,...",
  "selfieBase64": "data:image/jpeg;base64,..."
}
```

**Via Upload de Arquivo:**
```
POST /api/facematch/consultar-arquivo
Content-Type: multipart/form-data
Authorization: Bearer {token}

documento: (file binary)
selfie: (file binary)
```

**Resposta (200):**
```json
{
  "sucesso": true,
  "similaridade": 95.7,
  "saldoRestante": 498
}
```

**Custo: 1 credito**
**Score: 0 a 100** (threshold configuravel pelo negocio)

---

#### Liveness — Prova de Vida

**Via Base64:**
```
POST /api/liveness/consultar
Content-Type: application/json
Authorization: Bearer {token}

{
  "imagemBase64": "data:image/jpeg;base64,..."
}
```

**Via Upload de Arquivo:**
```
POST /api/liveness/consultar-arquivo
Content-Type: multipart/form-data
Authorization: Bearer {token}

arquivo: (file binary)
```

**Resposta (200):**
```json
{
  "sucesso": true,
  "score": 98.5,
  "detalhes": {
    "singleFaceDetected": true,
    "photoOfPhotoDetected": false,
    "maskDetected": false,
    "lightingQuality": "good"
  },
  "saldoRestante": 497
}
```

**Custo: 1 credito**
**Score: 0 a 100**
**Deteccao: fotos impressas, videos gravados, mascaras 2D/3D, deepfakes**
**Certificacao: ISO 30107-3 Level 2, iBeta (laboratorio NIST)**

---

#### Classification — Classificacao de Documentos

**Via Base64:**
```
POST /api/classification/consultar
Content-Type: application/json
Authorization: Bearer {token}

{
  "imagemBase64": "data:image/jpeg;base64,..."
}
```

**Via Upload de Arquivo (aceita PDF):**
```
POST /api/classification/consultar-arquivo
Content-Type: multipart/form-data
Authorization: Bearer {token}

arquivo: (file binary)
```

**Resposta (200):**
```json
{
  "sucesso": true,
  "tipoDocumento": "CNH",
  "confianca": 0.995,
  "detalhes": {
    "category": "identification",
    "side": "front",
    "isComplete": true
  },
  "saldoRestante": 496
}
```

**Custo: 1 credito**
**Documentos suportados:** RG, CNH, RNE, Passaporte, CTPS, Reservista, Holerite, IR, Extrato, Contas, IPTU

---

### 4.4 Codigos HTTP

| Codigo | Significado |
|--------|-------------|
| 200 | Sucesso |
| 400 | Requisicao invalida (params faltando, formato errado) |
| 401 | Nao autenticado (token invalido/expirado) |
| 402 | Saldo insuficiente (sem creditos) |
| 500 | Erro interno do servidor |

### 4.5 SDKs Disponiveis

- JavaScript
- Python
- Java
- PHP
- C#
- Outros (mencionados mas nao detalhados)

---

## 5. Fluxo Recomendado para Onboarding

1. **Classification** — Identificar tipo de documento automaticamente
2. **OCR** — Extrair dados do documento (nome, CPF, etc.)
3. **Liveness** — Verificar que a selfie e de pessoa real
4. **Face Match** — Comparar selfie com foto do documento

Custo total do fluxo completo: **4 creditos** (1 por servico)
Ou usar endpoint de Onboarding que combina tudo por R$ 0,49.

---

## 6. Integracao NestJS — Plano de Implementacao

### Estrutura proposta:
```
backend/src/ppid/
  ppid.module.ts          — Modulo NestJS
  ppid.service.ts         — Service com metodos para cada endpoint
  ppid.controller.ts      — Endpoints internos para o frontend chamar
  dto/
    classify.dto.ts       — DTOs de request/response
    ocr.dto.ts
    face-match.dto.ts
    liveness.dto.ts
```

### Variaveis de ambiente necessarias:
```env
PPID_API_URL=https://api.ppid.com.br
PPID_EMAIL=email-cadastrado@tecnikos.com.br
PPID_PASSWORD=senha-cadastrada
```

### Fluxo de integracao:
1. Na inicializacao do servico, fazer login e cachear o token JWT
2. Renovar token antes da expiracao
3. Expor metodos: classify(), ocr(), liveness(), faceMatch()
4. Cada metodo recebe imagem (Buffer ou base64) e retorna resultado tipado
5. Tratar erro 402 (saldo insuficiente) com alerta para admin
6. Logar todas as consultas para auditoria (LGPD)

---

## 7. Notas Importantes

- **Registro**: Necessario criar conta em ppid.com.br para obter credenciais
- **Creditos**: Sistema pre-pago baseado em creditos, 500 gratis/mes
- **Threshold Face Match**: Configuravel pelo negocio (ex: 80% = aprovado)
- **Liveness passivo**: Nao exige movimentos do usuario, analisa foto unica
- **Documentacao oficial**: https://ppid.com.br/documentacao
- **Contato comercial**: +55-11-95675-7384
