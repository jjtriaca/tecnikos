# TECNIKOS — Fluxo Completo: Do Primeiro Click ate a Liberacao Total

---

## VISAO GERAL DO FLUXO

```
  LANDING PAGE          SIGNUP (5 steps)              PAGAMENTO             LOGIN + USO
 ____________      _________________________      ________________      ___________________
|            |    |                         |    |                |    |                   |
|  Conhecer  | -> | 1. Plano                | -> | Asaas Checkout | -> | Login no host     |
|  planos    |    | 2. Dados empresa+senha  |    | (PIX/Boleto/   |    | sls.tecnikos.     |
|  CTA       |    | 3. Upload documentos    |    |  Cartao)       |    | com.br/login      |
|  "Comecar" |    | 4. Pagamento            |    |                |    |                   |
|____________|    | 5. Sucesso!             |    |________________|    |___________________|
                  |_________________________|            |                       |
                                                         |              _________|_________
                                                         v             |                   |
                                                   WEBHOOK Asaas ----> | RESTRICOES ativas |
                                                   PAYMENT_CONFIRMED   | ate docs aprovados|
                                                         |             |___________________|
                                                         v                      |
                                                   Tenant ACTIVE                |
                                                   Email boas-vindas            v
                                                                        _______________
                                                                       |               |
                                                                       | ADMIN aprova  |
                                                                       | documentos    |
                                                                       |_______________|
                                                                              |
                                                                              v
                                                                     ACESSO TOTAL LIBERADO
```

---

## PASSO A PASSO DETALHADO

---

### PASSO 1 — LANDING PAGE (tecnikos.com.br)

```
+================================================================+
|  TECNIKOS - Gestao de Servicos Tecnicos                        |
|================================================================|
|                                                                 |
|  Hero: "Gerencie sua equipe tecnica com inteligencia"          |
|                                                                 |
|  [Comecar agora]  [Ver planos]                                 |
|                                                                 |
|  Segmentos: Piscinas | Telecom | Clima | Solar | Seguranca     |
|  (mostra vagas do Programa Pioneiro se disponivel)             |
|                                                                 |
|  Funcionalidades: OS | Financeiro | Workflow | WhatsApp | ...  |
|                                                                 |
|  Planos:  [Mensal] / [Anual]                                  |
|  +------------------+  +------------------+                     |
|  | ESSENCIAL        |  | PROFISSIONAL     |                    |
|  | R$ 149/mes       |  | R$ 249/mes       |                    |
|  | 3 usuarios       |  | 10 usuarios      |                    |
|  | 100 OS/mes       |  | 500 OS/mes       |                    |
|  | [Assinar]        |  | [Assinar]        |                    |
|  +------------------+  +------------------+                     |
+================================================================+
```

**O que acontece:**
- Usuario visita tecnikos.com.br
- Ve os planos, segmentos e funcionalidades
- Clica em **"Comecar agora"** ou **"Assinar"** em um plano
- E redirecionado para `/signup` (com plano pre-selecionado se clicou em "Assinar")

**Rastreamento:** Evento `landing_view` registrado + UTM params capturados da URL

---

### PASSO 2 — SIGNUP STEP 1: Escolher Plano

```
+================================================================+
|  TECNIKOS          Passo 1 de 5          Ja tenho conta ->     |
|================================================================|
|                                                                 |
|  Escolha seu plano                                             |
|                                                                 |
|  Cobranca: [Mensal] / [Anual -20%]                            |
|                                                                 |
|  +------------------+  +------------------+                     |
|  | [x] ESSENCIAL   |  | [ ] PROFISSIONAL |                    |
|  | R$ 149/mes       |  | R$ 249/mes       |                    |
|  | 3 usuarios       |  | 10 usuarios      |                    |
|  | 100 OS/mes       |  | 500 OS/mes       |                    |
|  +------------------+  +------------------+                     |
|                                                                 |
|  Codigo promocional / Voucher:                                 |
|  [ PIONEIRO-PISCINAS    ] [Validar]                            |
|  "Desconto de R$134/mes por 6 meses!"                         |
|                                                                 |
|  +----------------------------------------------+              |
|  | RESUMO                                       |              |
|  | Plano: Essencial (Mensal)                    |              |
|  | Valor: R$ 149,00/mes                         |              |
|  | Desconto: -R$ 134,00 (6 meses)              |              |
|  | Total: R$ 15,00/mes                          |              |
|  +----------------------------------------------+              |
|                                                                 |
|  [Voltar]                              [Continuar ->]          |
+================================================================+
```

**O que o usuario faz:**
1. Seleciona um plano (clica no card)
2. Escolhe ciclo: Mensal ou Anual
3. (Opcional) Digita codigo promocional e clica "Validar"
4. Clica **"Continuar"**

**O que o sistema faz:**
- Busca planos ativos da API (`GET /public/saas/plans`)
- Se veio com `?voucher=` na URL, pre-preenche e valida automaticamente
- Valida o codigo promocional (`GET /public/saas/validate-code?code=XXX`)
- Registra tentativa de signup (`POST /public/saas/signup-attempt`)

**Validacoes:**
- Plano obrigatorio (botao fica desabilitado sem plano)
- Codigo promo: verifica existencia, ativo, nao expirado, com vagas, aplicavel ao plano

---

### PASSO 3 — SIGNUP STEP 2: Dados da Empresa + Senha

```
+================================================================+
|  TECNIKOS          Passo 2 de 5                                |
|================================================================|
|                                                                 |
|  Dados da empresa                                              |
|                                                                 |
|  Subdominio:                                                   |
|  [ sls        ] .tecnikos.com.br    "Disponivel!"             |
|                                                                 |
|  CNPJ:                                                         |
|  [ 47.226.599/0001-40 ] [Consultar CNPJ]                      |
|                                                                 |
|  +----------------------------------------------+              |
|  | CNPJ encontrado na Receita Federal           |              |
|  | Razao Social: SLS OBRAS LTDA                 |              |
|  | Situacao: ATIVA                               |              |
|  | Endereco: Rua xxx, Sao Paulo - SP            |              |
|  +----------------------------------------------+              |
|                                                                 |
|  Nome da empresa:                                              |
|  [ SLS Obras LTDA          ] (preenchido auto)                 |
|                                                                 |
|  --- Responsavel ---                                           |
|  Nome: [ Juliano Triaca           ]                            |
|  Email: [ contato@slsobras.com.br ]                            |
|  Telefone: [ (11) 99999-9999      ]                            |
|                                                                 |
|  --- Senha de acesso ---                                       |
|  Senha:          [ ************    ]                           |
|  Confirmar:      [ ************    ]                           |
|  Forca: [|||||] Forte                                          |
|  [x] Maiuscula [x] Minuscula [x] Numero [x] Especial [x] 8+  |
|                                                                 |
|  [<- Voltar]                           [Continuar ->]          |
+================================================================+
```

**O que o usuario faz:**
1. Digita o subdominio desejado (ex: `sls`) — sistema verifica disponibilidade em tempo real
2. Digita o CNPJ e clica **"Consultar CNPJ"** — dados da empresa sao buscados automaticamente
3. Confere/edita nome da empresa (preenchido automaticamente)
4. Preenche dados do responsavel: nome, email, telefone
5. Cria senha forte (minimo 8 chars, maiuscula, minuscula, numero, caractere especial)
6. Clica **"Continuar"**

**O que o sistema faz ao clicar "Continuar":**

```
FRONTEND                          BACKEND                           BANCO DE DADOS
   |                                 |                                    |
   |-- POST /signup ---------------->|                                    |
   |   {slug, cnpj, name,           |-- Valida campos obrigatorios       |
   |    email, password,             |-- Valida CNPJ (checksum)           |
   |    planId, billingCycle,        |-- Verifica duplicatas              |
   |    promoCode}                   |   (slug, cnpj, email)              |
   |                                 |-- Limpa tenants PENDING antigos    |
   |                                 |                                    |
   |                                 |-- Hash da senha (bcrypt)           |
   |                                 |                                    |
   |                                 |-- provisionTenant() ------------->| Cria Tenant
   |                                 |                                    | status: PENDING_VERIFICATION
   |                                 |                                    | schemaName: tenant_sls
   |                                 |                                    |
   |                                 |                                    | CREATE SCHEMA tenant_sls
   |                                 |                                    | (copia todas tabelas do public)
   |                                 |                                    |
   |                                 |-- onboard(tenantId, hash) ------->| Cria Company em tenant_sls
   |                                 |                                    | Cria User (USR-00001, ADMIN)
   |                                 |                                    | com email e senha do cadastro
   |                                 |                                    |
   |<-- {tenantId, slug} ------------|                                    |
   |                                 |                                    |
   |-- POST /create-verification --->|                                    |
   |   {tenantId}                    |-- Cria VerificationSession ------>| token, reviewStatus: PENDING
   |                                 |                                    | uploadComplete: false
   |<-- {token, verifyUrl} ----------|                                    |
```

**IMPORTANTE:** Neste momento o usuario JA TEM conta criada! O User com email e senha ja existe no schema `tenant_sls`. Ele poderia fazer login, mas o sistema tem restricoes.

**Status neste ponto:**
- Tenant: `PENDING_VERIFICATION`
- VerificationSession: `reviewStatus: PENDING`, `uploadComplete: false`
- User: criado com role ADMIN

---

### PASSO 4 — SIGNUP STEP 3: Upload de Documentos

```
+================================================================+
|  TECNIKOS          Passo 3 de 5                                |
|================================================================|
|                                                                 |
|  FASE A: Cartao CNPJ (no desktop)                             |
|  ________________________________________                      |
| |                                        |                     |
| |   Arraste o Cartao CNPJ aqui           |                     |
| |   ou clique para selecionar            |                     |
| |                                        |                     |
| |   PDF, JPEG, PNG (max 10MB)            |                     |
| |________________________________________|                     |
|                                                                 |
|  Nao tem o cartao? Acesse comprovante.receita.fazenda.gov.br  |
|                                                                 |
|  Apos upload do CNPJ card...                                  |
|  ________________________________________________________      |
|                                                                 |
|  FASE B: Documentos de identidade (via celular)               |
|                                                                 |
|  [x] Cartao CNPJ             (enviado!)                       |
|  [ ] Documento (Frente)       (pendente)                       |
|  [ ] Documento (Verso)        (pendente)                       |
|  [ ] Selfie 1 (perto)        (pendente)                       |
|  [ ] Selfie 2 (distancia)    (pendente)                       |
|                                                                 |
|  +------------------+                                          |
|  |   [QR CODE]      |  Escaneie com seu celular para          |
|  |                   |  enviar os documentos restantes         |
|  |                   |                                         |
|  +------------------+                                          |
|  Link direto: tecnikos.com.br/verify/abc123...                 |
|                                                                 |
|  Progresso: [====____] 1/5 documentos                          |
+================================================================+
```

**O que o usuario faz:**
1. Faz upload do Cartao CNPJ no desktop (arrasta ou seleciona arquivo)
2. Escaneia o QR Code com o celular
3. No celular, tira foto do documento (frente e verso)
4. No celular, tira 2 selfies (perto e distancia)
5. Progresso atualiza em tempo real no desktop

**O que o sistema faz:**
- Upload do CNPJ card: `POST /verification/<token>/upload` com `type=cnpjCard`
- Polling a cada 3 segundos: `GET /verification/<token>/status`
- Quando `uploadComplete: true` (5/5 docs) → avanca automaticamente

**5 documentos obrigatorios:**
| # | Tipo | Descricao | Onde |
|---|------|-----------|------|
| 1 | cnpjCard | Cartao CNPJ da empresa | Desktop |
| 2 | docFront | Documento de identidade (frente) | Celular |
| 3 | docBack | Documento de identidade (verso) | Celular |
| 4 | selfieClose | Selfie de perto | Celular (camera frontal) |
| 5 | selfieMedium | Selfie a distancia | Celular (camera frontal) |

**Auto-avanco:** Quando 5/5 docs uploadados → vai para Step 4 (Pagamento)

---

### PASSO 5 — SIGNUP STEP 4: Pagamento

```
+================================================================+
|  TECNIKOS          Passo 4 de 5                                |
|================================================================|
|                                                                 |
|  Pagamento                                                     |
|                                                                 |
|  +----------------------------------------------+              |
|  | RESUMO DO PEDIDO                             |              |
|  | Plano: Essencial (Mensal)                    |              |
|  | Valor: R$ 149,00/mes                         |              |
|  | Desconto Pioneiro: -R$ 134,00 (6 meses)     |              |
|  | Total: R$ 15,00/mes                          |              |
|  +----------------------------------------------+              |
|                                                                 |
|  O pagamento sera processado em uma pagina segura              |
|  do Asaas. Voce pode pagar via PIX, Boleto ou Cartao.        |
|                                                                 |
|  [<- Voltar]                    [Pagar R$ 15,00 ->]           |
+================================================================+

  Ao clicar "Pagar":
  1. Abre nova aba com pagina do Asaas Checkout
  2. Tela muda para "Aguardando pagamento"

+================================================================+
|  TECNIKOS          Passo 4 de 5                                |
|================================================================|
|                                                                 |
|       (  ...spinner girando...  )                              |
|                                                                 |
|  Aguardando confirmacao do pagamento...                        |
|                                                                 |
|  Conclua o pagamento na aba que foi aberta.                   |
|  O sistema detectara automaticamente quando o                  |
|  pagamento for confirmado.                                     |
|                                                                 |
|  [Reabrir pagina de pagamento]                                 |
|                                                                 |
|  +----------------------------------------------+              |
|  | Plano: Essencial | R$ 15,00/mes              |              |
|  +----------------------------------------------+              |
+================================================================+
```

**O que o usuario faz:**
1. Confere o resumo do pedido
2. Clica **"Pagar"**
3. Uma nova aba abre com a pagina do Asaas
4. Na pagina do Asaas, escolhe: **PIX**, **Boleto** ou **Cartao de Credito**
5. Conclui o pagamento
6. Volta para a aba do Tecnikos (que detecta automaticamente)

**O que o sistema faz:**

```
FRONTEND                          BACKEND                           ASAAS
   |                                 |                                 |
   |-- POST /subscribe ------------->|                                 |
   |   {tenantId, billingCycle,      |                                 |
   |    promoCode}                   |                                 |
   |                                 |-- ensureCustomer() ------------>| Cria customer
   |                                 |   (cria customer Asaas          | cus_000XXXXXXX
   |                                 |    se nao existe)               |
   |                                 |                                 |
   |                                 |-- createSubscription() -------->| Cria subscription
   |                                 |   billingType: UNDEFINED        | sub_XXXXXXXXXXXX
   |                                 |   (usuario escolhe no           |
   |                                 |    checkout)                    |
   |                                 |                                 |
   |                                 |-- getInvoiceUrl() ------------->| Busca URL da fatura
   |                                 |                                 | invoiceUrl
   |                                 |                                 |
   |                                 |-- Tenant → PENDING_PAYMENT      |
   |                                 |-- Cria Subscription local       |
   |                                 |                                 |
   |<-- {checkoutUrl} ---------------|                                 |
   |                                 |                                 |
   |-- window.open(checkoutUrl) ---->|                    NOVA ABA --->| Pagina Asaas
   |                                 |                                 | PIX / Boleto / Cartao
   |                                 |                                 |
   |-- polling cada 5s ------------->|                                 |
   |   GET /payment-status/:id      |                                 |
   |                                 |                                 |
   |   (usuario paga no Asaas...)    |                                 |
   |                                 |                                 |
   |                                 |<--- WEBHOOK -------------------|
   |                                 |    PAYMENT_CONFIRMED            |
   |                                 |                                 |
   |                                 |-- activate(tenantId)            |
   |                                 |   Tenant → ACTIVE               |
   |                                 |   Incrementa promo currentUses  |
   |                                 |                                 |
   |                                 |-- sendWelcomeEmail()            |
   |                                 |   (email com credenciais)       |
   |                                 |                                 |
   |<-- {isActive: true} ------------|                                 |
   |                                 |                                 |
   |-- Avanca para Step 5           |                                 |
```

**Status apos pagamento:**
- Tenant: `ACTIVE` ✅
- Subscription: `ACTIVE`
- VerificationSession: `reviewStatus: PENDING` (docs ainda nao revisados)
- Email de boas-vindas: **ENVIADO**

---

### PASSO 6 — SIGNUP STEP 5: Sucesso!

```
+================================================================+
|  TECNIKOS          Passo 5 de 5                                |
|================================================================|
|                                                                 |
|              ( checkmark verde )                               |
|                                                                 |
|         Pagamento confirmado!                                  |
|                                                                 |
|  Seu pagamento foi confirmado com sucesso.                     |
|  Seus documentos estao em analise.                             |
|                                                                 |
|  +----------------------------------------------+              |
|  | (relogio) Aguardando analise de documentos   |              |
|  | Voce recebera um email quando sua conta      |              |
|  | for totalmente ativada.                      |              |
|  +----------------------------------------------+              |
|                                                                 |
|  Seu endereco:                                                 |
|  https://sls.tecnikos.com.br                                   |
|                                                                 |
|  Email de acesso enviado para:                                 |
|  contato@slsobras.com.br                                       |
|  [ Alterar email ] [ Reenviar email ]                          |
|                                                                 |
|  [Voltar para inicio]                                          |
+================================================================+
```

**O que o usuario ve:**
- Confirmacao de pagamento
- Aviso que documentos estao em analise
- Endereco do sistema: `sls.tecnikos.com.br`
- Email de acesso (com opcao de alterar e reenviar)

---

### PASSO 7 — EMAIL DE BOAS-VINDAS (recebido na caixa de entrada)

```
+================================================================+
|  De: Tecnikos <contato@tecnikos.com.br>                        |
|  Assunto: Bem-vindo ao Tecnikos — SLS Obras LTDA              |
|================================================================|
|                                                                 |
|  +----------------------------------------------+              |
|  |           TECNIKOS                            |              |
|  |     Gestao de Servicos Tecnicos               |              |
|  +----------------------------------------------+              |
|                                                                 |
|  Bem-vindo ao Tecnikos!                                        |
|                                                                 |
|  Ola, Juliano! O pagamento da assinatura Essencial             |
|  da empresa SLS Obras LTDA foi confirmado com sucesso.         |
|                                                                 |
|  Seu sistema ja esta ativo! Enquanto nossos analistas          |
|  verificam seus documentos, algumas funcionalidades            |
|  ficam temporariamente restritas (ordens de servico,           |
|  orcamentos e financeiro). Voce sera notificado assim          |
|  que a analise for concluida.                                  |
|                                                                 |
|  +----------------------------------------------+              |
|  | Seus dados de acesso:                        |              |
|  | Email: contato@slsobras.com.br               |              |
|  | Senha: A senha que voce definiu no cadastro   |              |
|  | Endereco: sls.tecnikos.com.br                |              |
|  +----------------------------------------------+              |
|                                                                 |
|  +----------------------------------------------+              |
|  | Enquanto isso, voce pode configurar:         |              |
|  | 1. Certificado Digital (Configuracoes)       |              |
|  | 2. Email SMTP (Configuracoes > Email)        |              |
|  | 3. WhatsApp (Configuracoes > WhatsApp)       |              |
|  | 4. Usuarios da equipe                        |              |
|  | 5. Workflow e automacoes                     |              |
|  +----------------------------------------------+              |
|                                                                 |
|         [ Acessar o Sistema ]                                  |
|                                                                 |
+================================================================+
```

---

### PASSO 8 — LOGIN NO HOST (sls.tecnikos.com.br/login)

```
+================================================================+
|                                                                 |
|              TECNIKOS                                          |
|       Gestao de Servicos Tecnicos                              |
|                                                                 |
|  Email:                                                        |
|  [ contato@slsobras.com.br        ]                            |
|                                                                 |
|  Senha:                                                        |
|  [ ************             ] [👁]                             |
|                                                                 |
|  [ ] Lembrar meu email                                        |
|  Esqueceu a senha?                                             |
|                                                                 |
|         [ Entrar ]                                             |
|                                                                 |
+================================================================+
```

**O que acontece ao fazer login:**

```
BROWSER                            BACKEND
   |                                  |
   |-- POST /auth/login ------------->|
   |   {email, password}              |-- Extrai slug do host (sls)
   |                                  |-- Busca tenant por slug
   |                                  |-- Conecta no schema tenant_sls
   |                                  |-- Busca User por email
   |                                  |-- Valida senha (bcrypt)
   |                                  |-- Gera JWT (accessToken)
   |                                  |-- Set cookie refresh_token
   |                                  |
   |<-- {accessToken, user} ----------|
   |                                  |
   |-- GET /auth/me ----------------->|
   |                                  |-- Retorna dados do user
   |                                  |-- Busca VerificationSession
   |                                  |-- Retorna verificationStatus: "PENDING"
   |                                  |-- Retorna tenantStatus: "ACTIVE"
   |                                  |
   |<-- {user, tenantStatus: ACTIVE,  |
   |     verificationStatus: PENDING} |
   |                                  |
   |-- Redireciona para /dashboard    |
```

---

### PASSO 9 — DASHBOARD COM RESTRICOES (verificacao pendente)

```
+================================================================+
| [!] Documentos em analise — voce pode configurar o sistema     |
|     enquanto aguarda a aprovacao.                    (amarelo)  |
|================================================================|
|          |                                                      |
| SIDEBAR  |  DASHBOARD                                          |
|          |                                                      |
| Dashboard|  Bem-vindo ao Tecnikos!                             |
|          |                                                      |
| ---------+  (conteudo do dashboard)                            |
| BLOQUEADO|                                                      |
| ---------+                                                      |
| 🔒 OS    |                                                      |
| 🔒 Orcam.|                                                      |
| 🔒 Parce.|                                                      |
| 🔒 Produt|                                                      |
| 🔒 Financ|                                                      |
| 🔒 NFe   |                                                      |
|          |                                                      |
| ---------+                                                      |
| LIBERADO |                                                      |
| ---------+                                                      |
| Usuarios |                                                      |
| Workflow  |                                                      |
| Config.  |                                                      |
| Notific. |                                                      |
|          |                                                      |
+================================================================+
```

**O que esta BLOQUEADO (com cadeado no sidebar):**

| Menu | Motivo |
|------|--------|
| 🔒 Ordens de Servico | Requer `@RequireVerification` no backend |
| 🔒 Orcamentos | Requer `@RequireVerification` no backend |
| 🔒 Parceiros | Bloqueado no sidebar |
| 🔒 Produtos | Bloqueado no sidebar |
| 🔒 Financeiro | Requer `@RequireVerification` no backend |
| 🔒 NFe / Fiscal | Bloqueado no sidebar |
| 🔒 Relatorios | Bloqueado no sidebar |

**O que esta LIBERADO (pode usar normalmente):**

| Menu | O que pode fazer |
|------|------------------|
| ✅ Dashboard | Ver painel (vazio por enquanto) |
| ✅ Usuarios | Criar equipe, convidar pessoas |
| ✅ Workflow | Configurar templates de workflow |
| ✅ Configuracoes | Certificado digital, SMTP, WhatsApp, billing |
| ✅ Notificacoes | Ver notificacoes |

**Banner amarelo topo:** "Documentos em analise — voce pode configurar o sistema enquanto aguarda a aprovacao."

**Se tentar acessar rota bloqueada:**
- Sidebar: item fica com opacidade reduzida + cursor proibido + tooltip "Disponivel apos validacao dos documentos"
- API: retorna HTTP 403 "Funcionalidade bloqueada enquanto seus documentos estao em analise."

---

### PASSO 10 — ADMIN REVISA DOCUMENTOS (painel ctrl-zr8k2x)

```
+================================================================+
|  PAINEL ADMIN — ctrl-zr8k2x.tecnikos.com.br                   |
|================================================================|
|                                                                 |
|  Empresas > SLS Obras LTDA > Verificacao                       |
|                                                                 |
|  Status: PENDING                                               |
|                                                                 |
|  Documentos enviados:                                          |
|  [x] Cartao CNPJ        [Ver]                                 |
|  [x] Documento (Frente)  [Ver]                                 |
|  [x] Documento (Verso)   [Ver]                                 |
|  [x] Selfie 1            [Ver]                                 |
|  [x] Selfie 2            [Ver]                                 |
|                                                                 |
|  Acao:                                                         |
|  [ Aprovar documentos ]   [ Recusar ]                          |
|                                                                 |
+================================================================+
```

**Cenario A — Admin APROVA:**
- VerificationSession.reviewStatus → `APPROVED`
- Proximo login do usuario (ou refresh): verificationStatus muda para APPROVED

**Cenario B — Admin RECUSA:**
- VerificationSession.reviewStatus → `REJECTED`
- Pode informar motivo da recusa (rejectionReason)
- Usuario ve banner vermelho com motivo + botao para reenviar docs

---

### PASSO 11a — DOCUMENTOS APROVADOS (banner verde)

```
+================================================================+
| [✓] Documentos aprovados! Todas as funcionalidades estao       |
|     liberadas.                              [Recarregar]       |
|                                                      (verde)   |
|================================================================|
```

Apos clicar "Recarregar" (ou proximo login):
- Banner desaparece
- TODOS os menus do sidebar ficam liberados
- TODAS as APIs funcionam normalmente

---

### PASSO 11b — DOCUMENTOS RECUSADOS (banner vermelho)

```
+================================================================+
| [!] Documentos recusados — Foto do documento ilegivel.         |
|                                      [Reenviar documentos]     |
|                                                   (vermelho)   |
|================================================================|
```

- Usuario clica "Reenviar documentos"
- Abre pagina de upload novamente (`/verify/<token>`)
- Apos reenvio, volta ao status PENDING (banner amarelo)
- Admin revisa novamente

---

### PASSO 12 — ACESSO TOTAL LIBERADO!

```
+================================================================+
|          |                                                      |
| SIDEBAR  |  DASHBOARD                                          |
| (tudo    |                                                      |
| liberado)|  KPIs, graficos, resumos...                         |
|          |                                                      |
| Dashboard|                                                      |
| OS       |  Pode criar OS, orcamentos, lancamentos,            |
| Orcam.   |  parceiros, produtos, tudo!                         |
| Parceiros|                                                      |
| Produtos |                                                      |
| Financ.  |                                                      |
| NFe      |                                                      |
| Relat.   |                                                      |
| Usuarios |                                                      |
| Workflow  |                                                      |
| Config.  |                                                      |
| Notific. |                                                      |
|          |                                                      |
+================================================================+
```

**Sistema 100% operacional. Sem banners, sem restricoes.**

---

## DIAGRAMA DE ESTADOS DO TENANT

```
                      POST /signup
                          |
                          v
               +---------------------+
               | PENDING_VERIFICATION |
               | (schema criado,      |
               |  user criado,        |
               |  docs pendentes)     |
               +---------------------+
                          |
                    POST /subscribe
                          |
                          v
               +---------------------+
               |   PENDING_PAYMENT   |
               | (subscription Asaas  |
               |  criada, aguardando  |
               |  pagamento)          |
               +---------------------+
                          |
                   Webhook: PAYMENT_CONFIRMED
                          |
                          v
               +---------------------+
               |       ACTIVE        | <-- ESTADO PRINCIPAL
               | (pode logar,        |
               |  restricoes por     |
               |  verificacao)       |
               +---------------------+
                    |          |
           Pagamento |          | Subscription
           atrasado  |          | cancelada
                    v          v
            +-----------+  +------------+
            |  BLOCKED  |  | SUSPENDED  |
            | (7 dias   |  |            |
            |  atraso)  |  |            |
            +-----------+  +------------+
                    |
              Pagou divida
                    |
                    v
               +---------------------+
               |       ACTIVE        |
               +---------------------+
```

---

## DIAGRAMA DE VERIFICACAO (independente do status do tenant)

```
               Upload 5 documentos
                      |
                      v
              +--------------+
              |   PENDING    | ← Estado inicial
              | (em analise) |
              +--------------+
               /            \
         Admin aprova    Admin recusa
             /                \
            v                  v
    +-----------+       +------------+
    |  APPROVED |       |  REJECTED  |
    | (liberado)|       | (motivo)   |
    +-----------+       +------------+
                              |
                        Reenvia docs
                              |
                              v
                      +--------------+
                      |   PENDING    |
                      | (nova analise)|
                      +--------------+
```

---

## REGRAS IMPORTANTES DE NEGOCIO

### 1. "Quem pagar primeiro tem o direito"
- Codigos promo tem vagas limitadas (ex: PIONEIRO-PISCINAS = 5 vagas)
- O uso so e contabilizado NO MOMENTO DO PAGAMENTO (nao no cadastro)
- Varios usuarios podem comecar o signup com o mesmo codigo
- Quem concluir o pagamento primeiro "garante" a vaga

### 2. Cadastros abandonados nao travam recursos
- Slugs, CNPJs e emails so ficam "travados" para tenants ACTIVE/BLOCKED/SUSPENDED
- Tenants PENDING sao automaticamente limpos se alguem tentar cadastrar com os mesmos dados

### 3. Login possivel antes do pagamento
- Tecnicamente o usuario pode logar no host apos o Step 2 (conta ja existe)
- Mas com tenant PENDING_VERIFICATION, tera restricoes maximas
- O fluxo normal e: cadastro → docs → pagamento → login

### 4. Verificacao independente do pagamento
- Mesmo apos pagar e virar ACTIVE, o sistema fica com restricoes
- Restricoes sao removidas APENAS quando admin aprova documentos
- Isso garante compliance (KYC) antes de permitir operacoes financeiras

### 5. Periodo de carencia para inadimplencia
- 7 dias de atraso antes de bloquear o tenant
- Banner vermelho avisa durante os 7 dias
- Apos bloqueio: so libera com pagamento da divida

---

## RESUMO VISUAL — TIMELINE COMPLETA

```
TEMPO ──────────────────────────────────────────────────────────────────────>

[Landing]  [Step1]  [Step2]  [Step3]  [Step4]  [Step5]  [Login]  [Uso]
  page     Plano    Dados    Docs     Pagar    Sucesso   Host    Sistema
   |         |        |        |        |         |        |        |
   |         |        |        |        |         |        |        |
   v         v        v        v        v         v        v        v
  Visit   Escolhe  Preenche  Upload   Asaas    Email     Entra   Configura
  site    plano +  empresa   5 docs   Checkout  boas-    no      enquanto
          promo    + senha            PIX/CC/   vindas   host    aguarda
                                      Boleto                     aprovacao
                                        |
                                        | webhook
                                        v
                                   Tenant ACTIVE
                                   Email enviado
                                        |
                                        |.............. RESTRICOES ATIVAS ..........
                                        |                                          |
                                        |     Admin revisa e aprova docs           |
                                        |                                          v
                                        |                                   ACESSO TOTAL
                                        |                                   (sem restricoes)
```

---

*Documento gerado em 13/03/2026 — Sessao 116*
*Versao do sistema: v1.02.56*
