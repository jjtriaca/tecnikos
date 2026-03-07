# CHAT LOG — Historico de Conversas e Decisoes

---

## REGRA PERMANENTE (decidida pelo Juliano):
- **Claude decide toda a parte tecnica sozinho e executa sem perguntar**
- Juliano nao tem conhecimento tecnico de construcao
- Claude so para se for uma decisao de NEGOCIO (funcionalidade, UX, prioridade do produto)
- Decisoes tecnicas (arquitetura, libs, padroes, ordem de implementacao): Claude decide e faz

## HISTORICO ANTERIOR:
- Sessoes 2-50 (20/02 a 25/02/2026) arquivadas em `CHAT_LOG_ARCHIVE_20260220-20260225.md`
- Resumo: sistema construido do zero ate v1.00.50 com Auth, Partners, Service Orders, Workflow Engine, Finance, Evaluation, Dashboard, Specializations, Security Hardening, Docker/Nginx deploy, Swagger, CI/CD

---

## 2026-03-04 — Modulo Fiscal Separado + Auto-Emissao NFS-e

### Decisoes do Usuario
- NFSe deve ser um modulo separado, toggle habilitado/desabilitado
- Quando desabilitado, TODOS os campos fiscais somem do sistema
- Financeiro comunica com modulo fiscal sem duplicidade
- Certificado digital fica dentro do modulo fiscal
- **Auto-emissao de NFS-e ao criar lancamento financeiro**: deve ser opcao configuravel pelo cliente (checkbox), ja implementada
- Abordagem pragmatica aprovada: flag fiscalEnabled, hook useModuleEnabled, guard no backend

### Implementacao Acordada
- Flag `fiscalEnabled` na Company
- Flag `autoEmitNfse` na config fiscal
- Hook `useModuleEnabled('fiscal')` no frontend
- Guard nos endpoints fiscais no backend
- Service dedicado para auto-emissao (financeiro → NFS-e)
- Mover certificado para config fiscal (ja esta la)

---

## Sessao 51 — 04/03/2026

### Pedido do Juliano (literal):
> "Vamos la, quero agora implementar a emissao de nfs nota fiscal de servico, um bloco com bastante configuracoes, tem que estudar tudo sobre a emissao de notas de servico no brasil"

### Contexto:
- Sessoes anteriores (entre sessao 50 e esta) discutiram NFS-e mas travaram sem salvar
- O estudo e orientacoes foram perdidos
- Juliano quer: estudo completo sobre emissao de NFS-e no Brasil + implementacao com configuracoes

### Estudo realizado:
Estudo completo sobre emissao de NFS-e no Brasil salvo em `memory/nfse-emissao.md`.
Cobertura: padrao nacional, ABRASF, fragmentacao municipal, campos obrigatorios, fluxo de emissao, RPS, ISS, cancelamento, certificado digital, provedores intermediarios, regime tributario, CNAE.

### Orientacoes do Juliano sobre CLAUDE.md:
> "No CLAUDE.md deve ter as seguintes orientacoes: Nao pedir liberacao com 'Permitir que o Claude WebSearch?' quando finalizar um estudo gravar ele imediatamente. para o CHAT_log nao ficar tao grande sempre que entrar em um chat novo deixar apenas os ultimos 3 dias. nao pedir permissao para edicoes nas pastas, ou para abrir sistemas que sao necessarios para o funcionamento do codigo que estamos trabalhando. quando eu der uma instrucao que faz sentido que ela sera global perguntar se quero gravar ela no claude.md"

### Acoes tomadas:
1. CLAUDE.md atualizado com regras de permissoes automaticas e limpeza do CHAT_LOG
2. CHAT_LOG limpo — sessoes 2-50 arquivadas em `CHAT_LOG_ARCHIVE_20260220-20260225.md`
3. Estudo NFS-e salvo em `memory/nfse-emissao.md`

### Orientacoes do Juliano sobre EMISSAO NFS-e (literal):
> "A emissao de nota fiscal tem que ter um bloco fiscal com diversas configuracoes, o fluxo que quero usar tem que ter a opcao de configurar porem nao sera igual pra todos os clientes que adquirirem o sistema Tecnikos cada um vai configurar de um jeito. quero que ao finalizar uma OS o sistema me pergunte se ja quero emitir a nota (opcao pedir ou nao), se sim emite, se nao na linha do financeiro vai ter a coluna com status fiscal, no financeiro em caso de nao emitida (opcao) um botao pode emitir a qualquer momento, e ao clicar em emitir abre uma tela para confirmacao dos dados a serem emitidos. ao receber uma conta a receber em caso de aquela OS nao ter sido emitida a nota ainda um aviso aparece que nao foi emitida ainda com opcao de sim ou nao (opcao configuravel tbm) nao nao emite e recebe (Trava nas opcoes que se quiser nao aceita receber sem nota emitida) se sim Abre a mesma tela para confirmacoes dos dados da nota e pede para confirmar. tem que tratar como sera se tiver renegociacao como seria em casos. vamos usar o focus Nfe"

### Decisoes extraidas das orientacoes:
1. **Provedor**: Focus NFe (definido)
2. **Bloco Fiscal**: configuracoes por empresa (cada cliente do Tecnikos configura diferente)
3. **Momento da emissao**: configuravel — perguntar ao finalizar OS (toggle on/off)
4. **Se nao emitir na OS**: status fiscal visivel no financeiro + botao para emitir a qualquer momento
5. **Tela de confirmacao**: sempre abre antes de emitir para revisar dados
6. **Recebimento sem nota**: ao dar baixa em conta a receber sem NFS-e emitida:
   - Aviso aparece (configuravel)
   - Opcao 1: emite agora (abre tela confirmacao) e depois recebe
   - Opcao 2: recebe sem emitir
   - Opcao 3 (config): TRAVAR — nao aceitar recebimento sem nota emitida
7. **Renegociacao**: tratar como fica a NFS-e quando ha renegociacao de divida

### Orientacao adicional do Juliano sobre permissoes:
> "Eu tinha pedido anteriormente para colocar no claude.md que nao precisa pedir nenhum tipo de autorizacao, se quiser faca uma geral onde eu autorizo no inicio de um chat novo."

### Acoes tomadas (permissoes):
1. `.claude/settings.local.json` simplificado — wildcards `Bash(*)`, `WebFetch(*)`, `WebSearch(*)` etc
2. CLAUDE.md atualizado com secao "AUTORIZACAO GERAL DO USUARIO" — tudo liberado

### Pesquisa Focus NFe API — Resultado salvo em `memory/focus-nfe-api.md`:
- Auth: HTTP Basic (token como username, senha vazia)
- URLs: `api.focusnfe.com.br` (prod), `homologacao.focusnfe.com.br` (sandbox)
- Emissao: `POST /v2/nfse?ref={REF}` (assincrono, retorna 201)
- Consulta: `GET /v2/nfse/{REF}` (status: processando/autorizado/erro/cancelado)
- Cancelamento: `DELETE /v2/nfse/{REF}` (body: justificativa)
- PDF: `GET /v2/nfse/{REF}/pdf`
- Webhook: `POST /v2/hooks` (event: "nfse")
- Certificado A1: upload via `POST /v2/empresas` (base64 + senha)
- Preco: R$89.90/mes (Solo, 1 CNPJ, 100 docs)

### Pesquisa modulo financeiro existente — Resultado:
- FinancialEntry: RECEIVABLE/PAYABLE, status PENDING→CONFIRMED→PAID/CANCELLED
- FinancialInstallment: parcelas com juros/multa
- Renegociacao: cancela entry antiga + cria nova linkada
- changeEntryStatus(): valida state machine, atualiza saldo conta
- Frontend: 9 abas (Resumo, A Receber, A Pagar, Parcelas, Caixas, Conciliacao, Formas Pgto, Cobranca, Repasses)

### Orientacao do Juliano sobre certificado digital:
> "Note que a estrutura usada para certificado digital ja existe, usar a mesma"
- DECISAO: Reutilizar a infraestrutura de certificado A1 do modulo SefazConfig (NFe import)
- NAO criar nova tabela/upload de certificado — reaproveitar o que ja existe

### Implementacao realizada (Sessao 51 continuacao):

#### Backend criado:
1. **Prisma Schema**: Models `NfseConfig` e `NfseEmission` + campos `nfseStatus`/`nfseEmissionId` no `FinancialEntry`
2. **Migration**: `20260304160000_nfse_emission/migration.sql`
3. **Self-healing**: `PrismaService.ensureNfseEmissionTables()` cria tabelas se nao existirem
4. **NfseEmissionModule** (`backend/src/nfse-emission/`):
   - `nfse-emission.service.ts` — getConfig, saveConfig, getEmissionPreview, emit, handleWebhook, cancel, findEmissions, refreshStatus, downloadPdf, checkNfseBeforePayment
   - `nfse-emission.controller.ts` — REST endpoints + webhook controller publico
   - `focus-nfe.provider.ts` — Client HTTP para Focus NFe API (emit, query, cancel, downloadPdf, resendEmail)
   - `dto/nfse-emission.dto.ts` — SaveNfseConfigDto, EmitNfseDto, CancelNfseDto
5. **Webhook publico**: `POST /webhooks/focusnfe` com `@Public()` decorator

#### Frontend criado:
1. **Pagina Fiscal Settings** (`/settings/fiscal/page.tsx`) — Configuracao completa NFS-e:
   - Conexao Focus NFe (token + ambiente)
   - Dados do Prestador (IM, cod. municipio)
   - Tributacao (natureza, regime, aliquota ISS, Simples Nacional)
   - Codigos do Servico (Item LC 116, CNAE, cod. tributario)
   - RPS e Discriminacao
   - Comportamento (askOnFinishOS, receiveWithoutNfse, sendEmailToTomador)
2. **Modal NFS-e** (`finance/components/NfseEmissionModal.tsx`) — Tela de confirmacao com campos editaveis
3. **Coluna NFS-e no Financeiro** — Badge colorido (Sem NFS-e, Processando, Autorizada, Erro, Cancelada)
4. **Botao "NFS-e"** no EntryActions — Emitir NFS-e direto da tabela do financeiro
5. **Check antes de recebimento** — BLOCK/WARN/IGNORE conforme config
6. **Prompt na OS concluida** — Banner "Deseja emitir NFS-e?" ao abrir OS concluida
7. **Links sub-configuracoes** — Cards Fiscal e WhatsApp na pagina de Settings

#### Tipos atualizados:
- `FinancialEntry` interface: `nfseStatus`, `nfseEmissionId`
- `NFSE_STATUS_CONFIG`: mapa de cores/labels
- `NfseStatusType`: union type

### Status: IMPLEMENTACAO CONCLUIDA — Backend + Frontend compilando com 0 erros

---

## Sessao 52 — 04/03/2026

### Pedido do Juliano (literal):
> "No sidebar em nfe, colocar um sub link, importacoes que sao as notas de fornecedores, e de saida, onde vai pra uma tela que ainda nao existe onde vai estar todas as notas fiscais emitidas, com opcoes de filtros, opcoes de correcoes de notas com erro, opcao de tentar validacao quando o sistema da prefeitura cair e ela ficar pendente de autorizacao, ou seja um ambiente nfe completo. O botao salvar configuracoes no fiscal fica ativo mesmo depois de clicar em salvar, deve ficar inativo so ativar se tiver modificacoes e quando salvar inativar"

### Implementacao realizada:

#### 1. Sidebar — Submenu NFe com links expandiveis
- `NavItem` agora suporta `children: NavChild[]`
- NFe no sidebar virou menu expansivel com chevron
- Sublinks: "Importacoes" (`/nfe`) e "Saida" (`/nfe/saida`)
- Auto-expande quando uma rota filha esta ativa
- Visual: borda esquerda + indentacao para sublinks
- Funciona com sidebar colapsado (sem submenu)

#### 2. Pagina NFS-e Saida (`/nfe/saida/page.tsx`)
- Listagem de todas NFS-e emitidas pela empresa
- Cards de resumo: Total, Autorizadas, Processando, Com Erro
- Filtros: Status, Data de/ate, Busca por tomador/CNPJ/numero
- Tabela com DraggableHeader + SortableHeader + useTableLayout + useTableParams (padrao do sistema)
- Colunas: Data, NFS-e, Status, Tomador, Valor, OS, Erro
- Acoes por nota:
  - Consultar status (PROCESSING) / Tentar novamente (ERROR)
  - Baixar PDF (AUTHORIZED)
  - Reenviar email (AUTHORIZED)
  - Cancelar NFS-e (AUTHORIZED)
  - Expandir detalhes
- Botao bulk "Validar Pendentes" — atualiza status de todas as notas em processamento
- Detalhes expandidos: prestador, tomador, tributacao, cod verificacao, discriminacao, lancamentos vinculados

#### 3. Backend — Novos endpoints e filtros
- `GET /nfse-emission/emissions` — filtros adicionais: search, dateFrom, dateTo, nfseNumber, sortBy, sortOrder
- `POST /nfse-emission/emissions/:id/resend-email` — reenvio de email
- `POST /nfse-emission/:id/cancel` — cancelamento via POST (alternativa ao DELETE com body)

#### 4. Fix botao Salvar Configuracoes Fiscais
- Criada funcao `editableSnapshot()` que compara apenas campos editaveis (exclui id, companyId, timestamps)
- Corrigido sync do token apos save (mantém valor atual se API retorna mascarado)
- Botao agora desativa corretamente apos salvar e so ativa quando ha mudancas

### Status: BUILD OK — Backend + Frontend compilando com 0 erros

---

## Sessao 53 — 05/03/2026

### Pedido do Juliano (literal):
> "Ja fiz o cadastro na focus vamos preparar e configurar o ambiente NFSe"

### Configuracao Focus NFe (painel externo):
- Empresa: SLS OBRAS LTDA (CNPJ: 47.226.599/0001-40)
- NFSe habilitada no painel Focus NFe
- Inscricao Municipal: 9648219 (informada pelo Juliano)
- Certificado digital: Valido
- Serie RPS Homologacao: 1 / Proximo RPS: 1
- Serie RPS Producao: 1 / Proximo RPS: 1
- Regime Tributario: Simples Nacional
- Tokens coletados: Homologacao + Producao

### Dados do CNPJ (ReceitaWS):
- Municipio: Primavera do Leste - MT (IBGE: 5107040)
- CNAE principal: 41.20-4-00 (Construcao de edificios)
- CNAE secundario: 43.21-5-00 (Instalacoes eletricas)
- Optante Simples Nacional: Sim
- Porte: EPP

### Configuracao Tecnikos (pagina /settings/fiscal):
- Token: configurado (homologacao)
- Ambiente: Homologacao (testes)
- Inscricao Municipal: 9648219
- Codigo IBGE: 5107040
- Natureza Operacao: 1 - Tributacao no municipio
- Regime Especial: 6 - ME/EPP Simples Nacional
- Aliquota ISS: 2%
- Optante Simples Nacional: Sim
- Item LC 116: 7.02
- CNAE: 4321500
- Serie RPS: 1
- Discriminacao: "Prestacao de servicos conforme OS {titulo_os}. {descricao_os}"
- Auto-emitir: Sim
- Perguntar ao finalizar OS: Sim
- Enviar email ao tomador: Sim
- Recebimento sem NFS-e: Avisar

### Status: CONFIGURACAO SALVA COM SUCESSO

---

## Sessao 54 — 05/03/2026 (continuacao)

### Contexto:
- Continuacao das sessoes 53/54 que testaram emissao NFS-e via Focus NFe
- Sessoes anteriores resolveram: erro E0177 (regime especial), erro E9999 (aliquota), erro de schema XML

### Erros resolvidos nas sessoes anteriores:
1. **E0177 - Regime Especial invalido**: Codigo 6 (ME/EPP SN no ABRASF) = "Sociedade de Profissionais" no Nacional. Corrigido para 0 (Nenhum)
2. **E9999 - Aliquota obrigatoria**: Campo correto e `percentual_aliquota_relativa_municipio` (pAliq) + `percentual_total_tributos_simples_nacional` (pTotTribSN), NAO `aliquota` ou `iss_aliquota`
3. **Schema XML - tribFed/totTrib**: pTotTribSN e tribFed/tribEst/tribMun sao MUTUAMENTE EXCLUSIVOS

### Descoberta critica — Campos corretos NFS-e Nacional para Simples Nacional:
- `percentual_aliquota_relativa_municipio` → mapeia para `pAliq` (% ISS municipio)
- `percentual_total_tributos_simples_nacional` → mapeia para `pTotTribSN` (OBRIGATORIO para SN)
- Para NAO optantes SN: usar `percentual_total_tributos_federais/estaduais/municipais`
- Referencia: `campos.focusnfe.com.br/nfse_nacional/EmissaoDPSXml.html`

### Teste final (v1.00.81):
- Payload enviado com campos corretos via `/v2/nfsen`
- Resultado: `processando_autorizacao` → `erro_autorizacao` E1272
- **E1272**: "O codigo do municipio informado nao existe ou nao esta ativo no convenio municipal"
- Causa: Primavera do Leste-MT (5107040) NAO esta ativo no ambiente de homologacao da NFS-e Nacional
- **TODAS as validacoes de campo passaram** — o payload esta 100% correto
- O erro e exclusivamente do ambiente de homologacao

### Configuracao atual NfseConfig (DB):
- `regimeEspecialTributacao: 0` (Nenhum — correto para Nacional SN)
- `nfseLayout: NACIONAL`
- `codigoTributarioNacional: 070202`
- `optanteSimplesNacional: true`

### Acoes realizadas:
1. Emissao testada via UI com todos os campos preenchidos
2. Status refresh via "Validar Pendentes" funcionou corretamente
3. Emissoes de teste limpas do banco (8 emissoes removidas)
4. RPS counter resetado para 1

### Proximo passo:
- Testar em ambiente de PRODUCAO (municipio esta ativo la)
- Ou aguardar Juliano decidir proximo passo

### Status: PAYLOAD VALIDADO — Erro E1272 e limitacao de homologacao

---

## Sessao 55 — 05/03/2026

### Pedido do Juliano:
> "Quando fiz a importação dos parceiros via xls, o endereço de nem um parceiro foi preenchido"
> "ao inves de o nome logradouro, coloque endereço, é mais comum"

### Problema identificado:
- No Sankhya, a coluna "Endereço" contem um CODIGO NUMERICO (ex: 94, 360), nao o nome da rua
- O nome real da rua esta na coluna "Nome (Endereço)" (ex: "BRASIL", "PIRACICABA")
- O csv-parser.ts nao tinha mapeamento para "nome (endereço)" — so mapeava "endereço" que era o codigo numerico
- O codigo corretamente ignorava codigos numericos (`!/^\d+$/.test()`), resultando em addressStreet sempre vazio

### Correcoes realizadas:
1. **csv-parser.ts**: Adicionado "nome (endereço)" e "nome (endereco)" como aliases prioritarios para `addressStreet`
2. **Labels renomeados**: "Logradouro" → "Endereco" em todas as telas:
   - NfseEmissionModal.tsx (label + toast de erro)
   - PartnerForm.tsx (placeholder)
   - orders/new/page.tsx (placeholder)
   - orders/[id]/edit/page.tsx (placeholder)
   - settings/page.tsx (label)
   - automation-blocks.ts (label)
   - csv-parser.ts (FIELD_LABELS)
3. **Dados corrigidos**: Script SQL atualizou addressStreet de 2791 de 2796 parceiros no banco de producao

### Status: CORRIGIDO — Deploy v1.00.82

---

## Sessao 56 — 05/03/2026

### Pedido do Juliano:
> "Porque o campo cod municipio IBGE está ficando em branco na hora de emitir uma nota, precisamos tratar isso, tem que já trazer automatico"

### Problema identificado:
- No `nfse-emission.service.ts` linha 109: `codigoMunicipio: (tomador as any)?.ibgeCode || ''`
- O model Partner NAO tem campo `ibgeCode`, entao sempre retornava vazio
- O IBGE do tomador deve usar fallback para o codigo da empresa emissora

### Correcao:
- Alterado para: `codigoMunicipio: (tomador as any)?.ibgeCode || config.codigoMunicipio || ''`
- Agora usa o IBGE da config da empresa (5107040) como fallback

### Status: CORRIGIDO — Deploy v1.00.83 — Confirmado pelo Juliano que campo aparece preenchido

---

## Sessao 57 — 05/03/2026

### Pedido do Juliano:
> "A descriminação, quando não tem OS cadastrada deve pegar a descrição do lançamento financeiro"
> "nos cadastros quando é preenchido, produtos, nome, endereço, etc o texto tem que ser sempre a primeira letra das palavras em maiúscula, para evitar erro de digitação"

### Correcao 1 — Discriminacao sem OS:
- Problema: template "Prestacao de servicos conforme OS {titulo_os}. {descricao_os}" sem OS virava "Prestacao de servicos conforme OS ." (nao vazio, nao caia no fallback)
- Fix: `nfse-emission.service.ts` — quando nao tem OS, usa `entry.description` diretamente

### Correcao 2 — Title Case automatico:
- Funcao `toTitleCase()` criada em `brazil-utils.ts` — Title Case respeitando preposicoes (de, da, do, etc.)
- Aplicado via `onBlur` em todos os formularios:
  - PartnerForm: name, tradeName, addressStreet, addressComp, neighborhood, city
  - Products: description, brand, model, category, location, supplierDescription
  - Orders new/edit: title, contactPersonName, addressStreet, addressComp, neighborhood
  - Users: name
  - Settings: name, tradeName, addressStreet, addressComp, neighborhood, city, ownerName
  - NfseEmissionModal: tomadorRazaoSocial, tomadorLogradouro, tomadorComplemento, tomadorBairro

### Status: CONCLUIDO — Deploy v1.00.84

---

## Sessao 58 — 05/03/2026

### Pedido do Juliano (literal):
> "Quando no financeiro confirmar a emissão tem que aguardar a resposta em processamento e assim que confirmar a validação uma tela pergunta se quer enviar por email e ou WhatsApp na mesma tela, isso também tem que estar em opções de configurações"

### Contexto sessoes anteriores (57):
- Token producao configurado, erro de auth non-JSON tratado (v1.00.85)
- Timezone corrigido com `brazilNow()`/`brazilToday()` para evitar erro de data futura (v1.00.86)

### Implementacao — Modal NFS-e em 3 Fases:

#### Plano aprovado:
- **Fase 1 (FORM)**: formulario existente, usuario revisa dados e clica "Confirmar e Emitir"
- **Fase 2 (PROCESSING)**: spinner + polling a cada 3s, aguarda autorizacao da prefeitura (timeout 3 min)
- **Fase 3 (SEND)**: banner verde "Autorizada" + checkboxes Email e WhatsApp + botoes "Enviar e Fechar" / "Fechar sem Enviar"

#### Backend:
1. **Prisma Schema**: campo `afterEmissionSendWhatsApp Boolean @default(false)` no NfseConfig
2. **Self-healing migration**: ALTER TABLE adicionado em `prisma.service.ts`
3. **DTO**: `afterEmissionSendWhatsApp` no SaveNfseConfigDto
4. **Module**: `WhatsAppModule` importado no NfseEmissionModule
5. **Service**: WhatsAppService injetado + metodo `sendWhatsApp()` (texto + PDF)
6. **Controller**: endpoint `POST /emissions/:id/send-whatsapp` (ADMIN, FINANCEIRO, FISCAL)

#### Frontend:
1. **Settings Fiscal** (`/settings/fiscal`): toggle "Enviar NFS-e por WhatsApp ao tomador" na secao Comportamento
2. **NfseEmissionModal**: reescrito com 3 fases — state machine FORM → PROCESSING → SEND
   - Preview agora retorna `afterEmissionSendWhatsApp` na config
   - Modal nao fecha durante PROCESSING
   - Polling com `useEffect` + `setInterval`
   - Envia email e WhatsApp em paralelo via `Promise.allSettled`
   - Defaults vem da config (sendEmailToTomador, afterEmissionSendWhatsApp)

### Status: CONCLUIDO — Deploy v1.00.87

---

## Sessao 59 — 05/03/2026

### Pedido do Juliano:
> Adicionar Tipo de NFS-e (Servico/Obra) e seletor de Obra no modal de emissao NFS-e

### Implementacao:

#### Frontend — NfseEmissionModal.tsx:
1. **NfsePreview interface atualizada**: adicionado `tomador.partnerId`, `config.codigoTributarioNacional`, `config.codigoTributarioNacionalServico`, `obra` (objeto com id, name, cno, endereco)
2. **Novos tipos**: `TipoNota` ("SERVICO" | "OBRA"), `ObraOption` interface
3. **Novos states**: `tipoNota`, `obras`, `selectedObraId`, `loadingObras`
4. **Toggle Servico/Obra**: botoes estilo PF/PJ no topo da secao "Servico" — default "OBRA" se preview.obra existe
5. **cTribNac info**: texto abaixo do toggle mostrando qual codigo tributario sera usado (servico vs obra)
6. **Seletor de Obra**: dropdown que busca `/obras?partnerId={id}&activeOnly=true`, aparece so quando tipo=OBRA
7. **Detalhes da obra**: card com CNO + endereco completo quando obra selecionada
8. **Validacao**: botao Emitir desabilitado se tipo=OBRA e nenhuma obra selecionada
9. **Payload**: `tipoNota` e `obraId` incluidos no POST /nfse-emission/emit

#### Backend — nfse-emission.service.ts:
1. **Preview**: adicionado `tomador.partnerId` (ID do parceiro tomador) para frontend buscar obras

### Status: BUILD OK — Frontend + Backend 0 erros TypeScript

---

## Sessao 60 — 05/03/2026

### Pedido do Juliano:
> Verificar se "grupo de informações de obra" é realmente o CNO ou outro campo. Antes de enviar nota com código de obra, se o parceiro não tiver obra cadastrada, pedir o cadastro.

### Pesquisa — Campos do "Grupo de Informações de Obra" (Focus NFe):
- `codigo_obra` (cObra) — CNO (Cadastro Nacional de Obras) ou CEI - String[1-30]
- `logradouro_obra` (xLgr) — Endereço da obra - String[1-255]
- `numero_obra` (nro) — Número - String[1-60]
- `complemento_obra` (xCpl) — Complemento - String[1-156]
- `bairro_obra` (xBairro) — Bairro - String[1-60]
- `cep_obra` (CEP) — CEP numérico 8 dígitos - Integer[8]
- **NÃO tem campo ART** neste layout (NFS-e Nacional flat)
- Fonte: campos.focusnfe.com.br/nfse_nacional/EmissaoDPSXml.html

### Implementacao (continuacao sessao 59):

#### Backend — emit() atualizado:
1. Carrega Obra do banco quando `tipoNota=OBRA` (validação: obra obrigatória + ativa)
2. `codigoTribNac` determinado por tipoNota: OBRA usa `config.codigoTributarioNacional`, SERVICO usa `config.codigoTributarioNacionalServico` (fallback para codigoTributarioNacional)
3. Campos de obra adicionados no payload NACIONAL: `codigo_obra`, `logradouro_obra`, `numero_obra`, `complemento_obra`, `bairro_obra`, `cep_obra`
4. `cTribNac` usado no layout MUNICIPAL também
5. `obraId` salvo no registro NfseEmission
6. Log melhorado com tipoNota e info da obra

#### Backend — ServiceOrder:
1. DTOs Create/Update: campo `obraId` adicionado
2. Service create(): passa `obraId` para Prisma
3. Service update(): `checkField` para obraId com audit

#### Frontend — NfseEmissionModal:
- Mensagem melhorada quando tipo=OBRA e parceiro sem obras: alerta vermelho orientando a cadastrar em "Parceiros > Editar > Obras"

#### Frontend — ObrasSection (PartnerForm):
- Bug fix: `api.patch('/obras/${id}', ...)` corrigido para `api.patch('/obras/${id}/toggle')` (endpoint correto)

#### Frontend — OS new/edit:
- Seletor de obra (dropdown) adicionado abaixo do seletor de cliente
- Só aparece quando cliente tem obras cadastradas
- Busca obras via `GET /obras?partnerId={id}&activeOnly=true`
- Na edição: pré-popula obraId da OS existente
- Fix: resposta API é array direto (não `{ data: [...] }`)

### Status: CONCLUIDO — Deploy v1.00.88

---

## Sessao 63 — 06/03/2026

### Continuacao da Sessao 62 (contexto compactado):
- Sessoes 61-62 implementaram: Dashboard Financeiro (v1.01.18-19), Auditoria do sistema, Inicio fix NFe Import

### Pedido do Juliano:
> "Notas ja aparecem como importadas, deveria ser operador manual"
> "O financeiro tem que pedir confirmacao tbm!"

### Implementacao — Fix Fluxo NFe Import:

#### 1. Backend — Removida auto-importacao (sefaz-dfe.service.ts):
- Bloco que auto-importava procNFe durante fetch SEFAZ (linhas 403-417) REMOVIDO
- Documentos agora ficam como FETCHED ate operador importar manualmente

#### 2. Backend — Lancamento financeiro opcional (nfe.service.ts):
- Nova classe `ProcessFinanceDecision`: `{ createEntry: boolean, dueDate?: string }`
- `ProcessDecisions` agora inclui `finance?: ProcessFinanceDecision`
- Metodo `process()` condicional: so cria FinancialEntry se `finance.createEntry !== false`
- Backward compatible: se `finance` omitido, cria entry (default true)

#### 3. Frontend — Wizard NFe com 5 steps (nfe/page.tsx):
- STEPS alterado de 4 para 5: Upload XML → Fornecedor → Produtos → **Financeiro** → Confirmacao
- Novo step 4 (Financeiro):
  - Toggle "Criar lancamento A Pagar" (default: ativado)
  - Campo data de vencimento (opcional, default = data emissao da NFe)
  - Resumo visual da decisao (azul se criar, cinza se nao)
- Step 5 (Confirmacao) atualizado:
  - Mostra resumo da decisao financeira (criara ou nao)
  - Warning atualizado conforme decisao financeira
- `handleProcess()` envia `finance: { createEntry, dueDate }` no body
- Estados adicionados: `createFinancialEntry`, `financeDueDate`

#### 4. Frontend — Botao "Importar" abre wizard (SEFAZ tab):
- `handleImportDoc()` reescrito: importa XML via backend → abre wizard no step 2
- Operador toma TODAS as decisoes: fornecedor, produtos, financeiro
- Label status FETCHED alterado de "Pendente" para "Baixada"
- Filtro correspondente atualizado

### Status: CONCLUIDO — Deploy v1.01.20

---

## Sessao 64 — 06/03/2026

### Pedido do Juliano:
> Estudo completo sobre questoes fiscais: SPED Fiscal para Simples Nacional, escrituracao de notas de entrada, NFS-e de entrada, SPED vs DeSTDA, formato SPED, NFS-e vs NFe no tratamento fiscal

### Status: CONCLUIDO — Estudo salvo em `memory/estudo-fiscal-sped-nfe-nfse.md`

### Resultado do Estudo:
1. **SPED Fiscal (EFD-ICMS/IPI)**: SLS Obras DISPENSADA (Protocolo ICMS 03/2011, SN)
2. **DeSTDA**: Obrigacao correta para SN (mensal, dia 28, SEDIF-SN) — ST + DIFAL + Antecipacao
3. **Livros obrigatorios SN**: Registro de Entradas, Servicos Prestados, Servicos Tomados
4. **NFS-e de entrada**: NAO distribuida pela SEFAZ — opcoes: ADN, upload XML, portal municipal, manual
5. **NFe vs NFS-e**: NFe = ICMS/IPI (estadual), NFS-e = ISS (municipal), livros diferentes
6. **Formato SPED**: texto pipe-delimited, 10 blocos, leiaute 020 vigente 01/2026
7. **Novidades 2026**: PGDAS-D multa automatica, DEFIS com multa, CBS/IBS no leiaute EFD

---

## Sessao 65 — 06/03/2026

### Pedido do Juliano:
> Estudo COMPLETO sobre todas as obrigacoes fiscais brasileiras por regime tributario: Simples Nacional, Lucro Presumido, Lucro Real, obrigacoes estaduais (foco MT), municipais, e quadro comparativo.

### Status: CONCLUIDO — Estudo salvo em `memory/estudo-obrigacoes-fiscais-por-regime.md`

### Resultado do Estudo (9 secoes):
1. **Simples Nacional**: PGDAS-D (mensal, dia 20, formula aliquota efetiva com RBT12 e Fator R), DEFIS (anual, 31/mar, 13+ campos por estabelecimento), DeSTDA (mensal, dia 28, SEDIF-SN, ST+DIFAL+antecipacao), DAS (guia unica, dia 20), Livros obrigatorios (Caixa, Reg. Entradas, Inventario, Servicos Prestados/Tomados)
2. **Lucro Presumido**: EFD-Contribuicoes (PIS 0,65% + COFINS 3% cumulativo), DCTFWeb (mensal), ECF (anual jul), ECD (anual mai, condicional), IRPJ/CSLL trimestrais com bases de presuncao
3. **Bases de presuncao construcao civil CONFIRMADAS**: Empreitada total c/ material = 8% IRPJ / 12% CSLL; Parcial/mao de obra = 32% IRPJ / 32% CSLL
4. **Novidade 2026 (LC 224/2025)**: Acrescimo 10% nos percentuais sobre receita > R$ 5 mi/ano
5. **Lucro Real**: Tudo do Presumido MAIS EFD ICMS/IPI, LALUR/LACS, PIS/COFINS nao-cumulativo (9,25% - creditos), apuracao trimestral vs anual (estimativa mensal)
6. **Creditos PIS/COFINS (LR)**: Insumos, energia, alugueis, depreciacao, servicos PJ, frete. Conceito STJ: essencialidade/relevancia
7. **Obrigacoes estaduais MT**: GIA DISPENSADA, SINTEGRA DISPENSADO, EFD dia 20, ST via EFD, DeSTDA para SN, centralizacao inscricao (Portaria 059/2025)
8. **Obrigacoes municipais**: NFS-e Nacional obrigatoria 2026 (LC 214/2025), DES tendencia extincao, ISS 2-5%
9. **Quadro comparativo completo**: 4 tabelas cruzando cada obrigacao x regime (SN/LP/LR)

### Reforma Tributaria (timeline):
- 2026: CBS/IBS destaque informativo nas NF-e, sem recolhimento
- 2027: PIS/COFINS extintos, CBS em vigor, EFD-Contribuicoes tende extincao
- 2033: ICMS/ISS extintos, IBS pleno, ST extinta (exceto combustiveis)

---

## Sessao 66 — 06/03/2026

### Pedido do Juliano:
> Estudo COMPLETO sobre NFS-e de entrada (servicos tomados) e ISS para implementacao em sistema ERP brasileiro.

### Status: CONCLUIDO — Estudo salvo em `memory/estudo-nfse-entrada-iss-completo.md`

### Resultado do Estudo (6 secoes):
1. **NFS-e de Entrada — Importacao**: Layout XML ABRASF 2.04 (CompNfse/InfNfse com todos os campos), Layout Nacional DPS (infNFSe/DPS/infDPS com todas as tags), diferencas entre layouts, deteccao automatica por namespace/root element, campos obrigatorios para escrituracao
2. **ISS — Regras de Retencao**: Art. 6o LC 116/2003, lista completa de 13 subitens com retencao obrigatoria (3.05, 7.02, 7.04, 7.05, 7.09, 7.10, 7.12, 7.16, 7.17, 7.19, 11.02, 17.05, 17.10), aliquota minima 2% / maxima 5% (LC 157/2016 art. 8o-A), contabilizacao ISS retido vs devido, ISS no Simples Nacional (segregacao no DAS, aliquota na NF, Fator R)
3. **Escrituracao de Servicos Tomados**: Livro de Registro (campos completos), EFD-Contribuicoes Bloco A (registros A100/A170 — dispensado para SN), EFD ICMS/IPI Bloco B (registros B020/B025 — exclusivo DF), CFPS (existe mas nao padronizado, desnecessario no Tecnikos)
4. **Parser XML NFS-e**: Interface `NfseEntradaParsed` completa (35+ campos), mapeamento tag-a-tag ABRASF vs Nacional, conversao cTribNac -> Item LC 116 (funcao pronta), funcao `detectNfseLayout()` pronta
5. **ADN (Ambiente de Dados Nacional)**: API REST com mTLS + certificado ICP-Brasil, endpoints GET /dfe/{NSU} e consulta por chave, limitacoes (1h entre consultas, 50 docs/lote, 3 meses disponibilidade), ~5.565 municipios aderidos (marco/2026), ~1.843 com sistema ativo
6. **Recomendacoes Tecnikos**: Prioridade 1 = upload XML manual com parser dual, Prioridade 2 = digitacao manual, Prioridade 3 = integracao ADN (longo prazo)

---

## Sessao 67 — 06/03/2026

### Pedido do Juliano:
> Estudo COMPLETO sobre EFD-Contribuicoes (SPED PIS/COFINS) para implementacao em sistema ERP brasileiro.

### Status: CONCLUIDO — Estudo salvo em `memory/estudo-sped-contribuicoes.md`

### Resultado do Estudo (10 secoes):
1. **Obrigatoriedade**: Lucro Real e Presumido OBRIGATORIOS, SN dispensado. Prazo: 10o dia util do 2o mes subsequente. Multa: 0,02%/dia sobre receita bruta (max 1%), calculada automaticamente desde jan/2020.
2. **Formato arquivo**: ASCII ISO 8859-1, pipe-delimitado, mensal, centralizado pela matriz. Regras de campos: N sem milhar, virgula decimal, datas ddmmaaaa.
3. **Blocos**: 0 (abertura/cadastros), A (servicos/NFS-e), C (mercadorias/NFe), D (transporte), F (demais operacoes), M (apuracao PIS/COFINS), 1 (complemento), 9 (encerramento).
4. **Campos detalhados** de TODOS os registros principais: 0000, 0001, 0100, 0110, 0120, 0140, 0150, 0190, 0200, A001, A010, A100, A170, C001, C010, C100, C170, F001, F010, F100, M001, M100, M105, M200, M210, M500, M600, M610, 9900, 9999.
5. **Regras por regime**: Lucro Real = nao-cumulativo (PIS 1,65%, COFINS 7,6%, COM creditos), Lucro Presumido = cumulativo (PIS 0,65%, COFINS 3%, SEM creditos).
6. **CST PIS/COFINS completos**: Saida (01-49), Entrada (50-99), regras praticas por regime.
7. **Relacao NFS-e/NFe**: Servico prestado = Bloco A saida, Servico tomado = Bloco A entrada, Mercadoria = Bloco C, Demais = Bloco F.
8. **Exemplo arquivo minimo valido**: Empresa LP, 1 NFS-e, PIS R$65 + COFINS R$300.
9. **Decisoes de implementacao**: Fase 1 = LP cumulativo (simples), Fase 2 = LR nao-cumulativo (creditos). Dados ja disponiveis no Tecnikos mapeados para registros SPED.
10. **Modelo de dados sugerido**: EfdContribuicao + EfdContribuicaoItem.

---

## Sessao 68 — 06/03/2026

### Pedido do Juliano:
> Estudo COMPLETO sobre SPED Fiscal (EFD-ICMS/IPI) para implementacao em sistema ERP brasileiro. Todos os blocos, registros, campos, regras, CST, CSOSN, CFOP, layout tecnico, exemplo de arquivo.

### Status: CONCLUIDO — Estudo salvo em `memory/sped-fiscal-efd-icms-ipi.md`

### Resultado do Estudo (13 secoes):
1. **Obrigatoriedade**: SN dispensado (regra geral), LP/LR depende da UF. Prazo: dia 20 do mes seguinte. Multa federal: 0,02%/dia (max 1%) sobre receita bruta. Multa estadual: varia por UF.
2. **Layout tecnico**: ASCII ISO 8859-1, pipe-delimitado, datas ddmmaaaa, valores com virgula decimal sem milhar. Perfis A/B/C. Leiaute 020 vigente 2026.
3. **Estrutura blocos**: 0 (abertura/cadastros), B (ISS), C (mercadorias/ICMS/IPI), D (transporte/comunicacao), E (apuracao ICMS/IPI), G (CIAP), H (inventario), K (producao/estoque), 1 (outras info), 9 (encerramento).
4. **Bloco 0 detalhado**: Registros 0000, 0001, 0005, 0100, 0150, 0190, 0200, 0990 — todos os campos com tipo, tamanho, casas decimais e obrigatoriedade.
5. **Bloco C detalhado**: C001, C100 (29 campos — NFe/NF), C170 (38 campos — itens), C190 (12 campos — analitico por CST+CFOP+aliquota), C990.
6. **Bloco E detalhado**: E001, E100 (periodo), E110 (15 campos — apuracao ICMS com formula completa), E111 (ajustes), E116 (obrigacoes recolhimento), E990.
7. **Bloco H detalhado**: H001, H005 (totais inventario com MOT_INV), H010 (11 campos — itens estoque com IND_PROP), H990.
8. **Bloco 9 detalhado**: 9001, 9900 (totalizacao por tipo registro), 9990, 9999.
9. **CST ICMS completo**: Tabela A (origem 0-8) + Tabela B (tributacao 00-90). CSOSN SN (101-900) com equivalencia CST. CSOSN continua valido (Ajuste SINIEF 34/2023 revogou unificacao).
10. **CFOPs principais**: Entradas (1102/2102 comercio, 1403/2403 ST, 1551/2551 ativo), Saidas (5102/6102 venda, 5405 substituido, 6404 ST interestadual, 6108 DIFAL consumidor final).
11. **Credito ICMS**: Direito em compras revenda/industrializacao, sem direito uso/consumo, ativo via CIAP, SN CSOSN 101/201 permite credito ao destinatario.
12. **ST e DIFAL**: Substituto (recolhe cadeia), Substituido (CST 060/CSOSN 500), DIFAL = aliquota interna - interestadual, SN dispensado DIFAL nao-contribuinte (ADI STF).
13. **Exemplo arquivo minimo valido**: 55 linhas com blocos 0, C, E e 9 (demais vazios), 1 NFe entrada 2 itens, credito ICMS R$ 150.

### Consideracoes SLS Obras:
- SLS Obras (SN/EPP): DISPENSADA do SPED Fiscal
- Para clientes Tecnikos LP/LR: gerador de arquivo seria necessario

---

## Sessao 69 — 06/03/2026

### Contexto:
- Continuacao da sessao 68 (contexto compactado)
- 4 agentes de pesquisa lancados nas sessoes 65-68, todos CONCLUIDOS
- Analise completa do schema Prisma realizada

### Consolidacao do Projeto Modulo Fiscal:
- Todos os 4 estudos consolidados em documento unico: `memory/projeto-modulo-fiscal.md`
- Analise de gaps entre sistema atual e requisitos fiscais completa
- Plano de implementacao em 4 fases definido

### Fases planejadas:
1. **Fase 1 — Fundacao**: taxRegime na Company, expansao NFe parser (campos tributarios), expandir NfeImportItem
2. **Fase 2 — NFS-e Entrada**: Model NfseEntrada, parser dual ABRASF+Nacional, upload XML, digitacao manual
3. **Fase 3 — Escrituracao e Relatorios**: FiscalPeriod, Livro Entradas, Servicos Tomados, apuracao ICMS/PIS/COFINS
4. **Fase 4 — Geracao SPED**: EFD-ICMS/IPI, EFD-Contribuicoes, DeSTDA (arquivos TXT)

### Gaps identificados:
- Company: falta taxRegime, crt, cnae, contabilista
- NfeImportItem: falta cstIcms, baseIcms, icms, ipi, pis, cofins, st, frete, seguro, desconto
- NFe Parser: so extrai dados basicos, precisa extrair todos os impostos
- NFS-e Entrada: nao existe (so tem saida)
- Periodo Fiscal / Apuracao: nao existe
- SPED generators: nao existem

### Status: DOCUMENTO DE PROJETO CRIADO — Aguardando decisao do usuario para iniciar implementacao

---

## Sessao 70 — 06/03/2026

### Contexto:
- Continuacao da sessao 69 (contexto compactado)
- Usuario autorizou implementacao da Fase 1 com "Pode fazer"
- Sessao 69 ja tinha implementado: schema Prisma, migration SQL, NFe parser expandido, NFe service atualizado, endpoints fiscal-config backend
- Faltava: frontend fiscal config UI + dados tributarios na NFe page + build final

### Implementacao concluida (Fase 1 Frontend):

#### 1. Frontend `/settings/fiscal` — Regime Tributario + Contabilista:
- **fetchFiscalConfig()**: carrega dados do `GET /companies/fiscal-config` no mount
- **handleSaveFiscal()**: salva via `PATCH /companies/fiscal-config`
- **Secao Regime Tributario**: seletor SN/LP/LR, CRT auto-calculado (readonly), Perfil EFD (A/B/C), CNAE, SUFRAMA
- **Secao Contabilista Responsavel**: nome, CPF, CRC, CNPJ escritorio, CEP, telefone, email
- **Botao "Salvar Dados Fiscais"**: com dirty check independente do botao NFS-e
- **Separador visual**: linha horizontal com label "Configuracoes NFS-e (Saida)" entre fiscal e NFS-e
- Titulo da pagina atualizado de "Configuracoes Fiscais (NFS-e)" para "Configuracoes Fiscais"

#### 2. Frontend `/nfe` — Dados Tributarios na NFe Importada:
- **NfeItem interface expandida**: +24 campos tributarios (cstIcms, baseIcms, aliqIcms, icmsCents, etc.)
- **NfeImport interface expandida**: +14 campos de totais (indOper, finNfe, icmsCents, ipiCents, etc.)
- **Resumo impostos no Step 1**: apos XML processado, mostra grid de impostos (ICMS, ICMS ST, IPI, PIS, COFINS, frete, seguro, desconto, outras despesas) — so aparece se existirem valores > 0
- **Coluna CFOP na tabela de itens**: adicionada entre NCM e Unidade
- **Sub-linha de impostos por item**: abaixo de cada item na tabela, linha sutil mostrando CST, ICMS (valor + aliquota), ICMS ST, IPI, PIS, COFINS — so aparece se existir algum imposto no item
- **React.Fragment**: usado para renderizar 2 `<tr>` por item (principal + impostos)

#### 3. Build verificado:
- Backend: `npx tsc --noEmit` — 0 erros
- Frontend: `npx next build` — 0 erros, todas as paginas compilam

### Resumo completo da Fase 1 (sessoes 69-70):
| Componente | Arquivo | Status |
|---|---|---|
| Schema Prisma | `schema.prisma` | ✅ Company + NfeImport + NfeImportItem |
| Migration SQL | `20260306200000_fiscal_module_phase1/` | ✅ Aplicada |
| NFe Parser | `nfe-parser.service.ts` | ✅ ICMS (21 variantes), IPI, PIS, COFINS |
| NFe Service | `nfe.service.ts` | ✅ Salva todos os campos |
| Company Service | `company.service.ts` | ✅ getFiscalConfig + updateFiscalConfig |
| Company Controller | `company.controller.ts` | ✅ GET/PATCH fiscal-config |
| Settings Fiscal UI | `settings/fiscal/page.tsx` | ✅ Regime + Contabilista |
| NFe Entrada UI | `nfe/page.tsx` | ✅ Impostos no resumo + por item |

### Status: FASE 1 CONCLUIDA — Pronto para deploy

---

## Sessao 71 — 07/03/2026

### Contexto:
- Continuacao da sessao 70 (contexto compactado)
- Sessao 70 concluiu Fase 1 (fundacao fiscal)
- Usuario autorizou "Fase 2" — NFS-e de Entrada

### Implementacao concluida (Fase 2 — NFS-e de Entrada):

#### 1. Schema Prisma + Migration:
- Model `NfseEntrada` com 50+ campos: identificacao, prestador (link Partner), tomador, servico, valores em centavos, construcao civil, XML content, status
- Relations: Company (1:N), Partner (1:N com named relation "NfseEntradaPrestador")
- 4 indexes: companyId, companyId+competencia, companyId+status, prestadorCnpjCpf
- Migration `20260306210000_nfse_entrada/migration.sql` aplicada

#### 2. Backend — Parser XML (`nfse-entrada-parser.service.ts`):
- Interface `ParsedNfseEntrada` com 35+ campos normalizados
- Deteccao automatica de layout: ABRASF 2.04 vs Nacional/SPED
- `parseAbrasf()`: navega CompNfse > Nfse > InfNfse com multiplos fallback paths
- `parseNacional()`: navega NFSe > infNFSe > DPS > infDPS
- Helpers: `dig()` (deep object navigation), `toCents()`, `str()`, `toFloat()`, `extractCnpjCpf()`
- Usa fast-xml-parser

#### 3. Backend — Service (`nfse-entrada.service.ts`):
- `uploadXml()`: parse XML + auto-link prestador por CNPJ + create record
- `createManual()`: criacao via formulario com auto-link prestador
- `findAll()`: paginado com search (numero, razaoSocial, CNPJ, discriminacao), filtros competencia e status, ordenacao dinamica
- `findOne()`, `update()` (whitelist de campos), `cancel()` (soft), `linkPrestador()` (auto-adiciona tipo FORNECEDOR)

#### 4. Backend — Controller (`nfse-entrada.controller.ts`):
- `POST /nfse-entrada/upload` — FileInterceptor, ADMIN/FISCAL
- `POST /nfse-entrada/manual` — ADMIN/FISCAL
- `GET /nfse-entrada` — lista paginada, ADMIN/FISCAL/FINANCEIRO/LEITURA
- `GET /nfse-entrada/:id` — detalhe
- `PATCH /nfse-entrada/:id` — update
- `DELETE /nfse-entrada/:id` — cancel
- `PATCH /nfse-entrada/:id/link-prestador` — vincular parceiro

#### 5. Frontend — Pagina `/nfe/entrada/page.tsx`:
- Upload XML drag & drop (raw fetch com FormData)
- Formulario manual com secoes: Identificacao, Prestador, Servico, Valores (R$), Construcao Civil
- Cards de resumo: total notas, valor servicos, ISS retido
- FilterBar com filtros competencia + status + busca
- Tabela com DraggableHeader + SortableHeader + useTableLayout + useTableParams
- Linhas expandiveis com detalhes fiscais completos
- Acao cancelar usando raw fetch DELETE
- Conversao reais/centavos com helper `reaisToCents()`

#### 6. Sidebar atualizado:
- Submenu NFe: "NFe Entrada" | "NFS-e Entrada" | "NFS-e Saída"

#### 7. Build verificado:
- Backend `npx tsc --noEmit`: 0 erros
- Frontend `npx next build`: 0 erros, pagina /nfe/entrada compilando

### Status: FASE 2 CONCLUIDA — Deploy v1.01.21

---

## Sessao 71 (continuacao) — 07/03/2026

### Fase 3 — Escrituracao e Relatorios

#### 1. Schema Prisma + Migration:
- Model `FiscalPeriod`: id, companyId, year, month, status (OPEN/CLOSED/FILED)
- Campos de apuracao: ICMS (debito/credito/saldo/ST), IPI, PIS, COFINS, ISS (devido/retido)
- Totais: totalEntradaCents, totalSaidaCents, quantidades NFe/NFS-e
- Controle: closedAt, closedByName, filedAt, notes
- Unique constraint: [companyId, year, month]
- Migration `20260307130000_fiscal_period` aplicada

#### 2. Backend — Service (`fiscal-period.service.ts`):
- `findAll()`: lista periodos por ano
- `findOrCreate()`: auto-cria periodo se nao existir
- `calculate()`: apuracao completa — agrega NFe entrada (ICMS, IPI), NFS-e entrada (ISS retido, PIS, COFINS), NFS-e saida (ISS devido, PIS/COFINS debito baseado no regime)
- `close()`: fecha periodo calculando apuracao e salvando resultados
- `reopen()`: reabre periodo fechado
- `getLivroEntradas()`: NFe importadas no periodo com todos os campos fiscais
- `getServicosTomados()`: NFS-e entrada por competencia com retencoes
- `getDashboard()`: overview com regime, apuracao atual, periodos, obrigacoes por regime

#### 3. Backend — Controller (`fiscal-period.controller.ts`):
- `GET /fiscal-periods/dashboard` — dashboard completo
- `GET /fiscal-periods` — lista periodos
- `GET /fiscal-periods/apuracao?year=&month=` — preview apuracao
- `GET /fiscal-periods/livro-entradas?year=&month=` — livro entradas
- `GET /fiscal-periods/servicos-tomados?year=&month=` — servicos tomados
- `GET /fiscal-periods/:id` — detalhe periodo
- `POST /fiscal-periods/close` — fechar periodo
- `POST /fiscal-periods/:id/reopen` — reabrir periodo
- `PATCH /fiscal-periods/:id/notes` — notas
- Protegido com FiscalGuard + Roles (ADMIN, FISCAL, FINANCEIRO, LEITURA)

#### 4. Frontend — Dashboard Fiscal (`/fiscal`):
- Header com regime tributario, CNAE, perfil EFD
- KPI cards: NFe entrada, NFS-e entrada, NFS-e saida, total entradas
- Tabela de apuracao: ICMS, IPI, PIS, COFINS, ISS (debito x credito x saldo)
- Nota informativa para SN (impostos incluidos no DAS)
- Botao "Fechar Periodo" com calculo automatico
- Obrigacoes fiscais com prazos e status vencido/pendente (variam por regime)
- Historico de periodos com status e botao reabrir

#### 5. Frontend — Livro de Entradas (`/fiscal/livro-entradas`):
- Seletor de mes com setas < >
- Cards resumo: total notas, valor total, ICMS, IPI, PIS+COFINS
- Tabela completa: data, numero, emitente, CNPJ, CFOP, valor, BC ICMS, ICMS, ICMS-ST, IPI, PIS, COFINS
- Linha de totais no rodape

#### 6. Frontend — Servicos Tomados (`/fiscal/servicos-tomados`):
- Seletor de mes com setas < >
- Cards resumo: total NFS-e, valor servicos, ISS retido, total retencoes, valor liquido
- Tabela: data, NFS-e, prestador, CNPJ/CPF, item LC 116, valor, aliquota ISS, ISS, retido, liquido
- Linhas expandiveis com discriminacao, municipio, base calculo, competencia, retencoes federais

#### 7. Sidebar — Secao Escrituracao:
- Icone calculadora (fiscal)
- Submenu: Dashboard Fiscal, Livro de Entradas, Servicos Tomados
- Visivel para ADMIN, FISCAL, FINANCEIRO
- Requer fiscalEnabled (requiresFiscal: true)

#### 8. Build: Backend + Frontend 0 erros

### Status: FASE 3 CONCLUIDA — Deploy v1.01.22

---

## Sessao 72 — 07/03/2026

### FASE 4 — Geracao SPED (EFD-ICMS/IPI + EFD-Contribuicoes)

#### 1. Backend — Gerador EFD-ICMS/IPI (`sped-icms-ipi.generator.ts`, 802 linhas):
- Blocos: 0 (abertura/empresa/participantes/produtos), B (ISS vazio), C (NFe mercadorias com C100/C170/C190), D (transporte vazio), E (apuracao ICMS com E100/E110), G/H/K (vazios), 1 (info complementar 1010), 9 (fechamento/controle)
- Participantes enriquecidos da tabela Partner
- Itens (C170) com CST ICMS/IPI/PIS/COFINS, bases, aliquotas, valores
- C190 agrupado por CST+CFOP+aliquota
- E110 soma creditos (entrada) e debitos (saida) por CFOP
- Contagem automatica de registros no Bloco 9

#### 2. Backend — Gerador EFD-Contribuicoes (`sped-contribuicoes.generator.ts`, 763 linhas):
- Blocos: 0 (abertura/contabilista/regime/estabelecimento/participantes/unidades/produtos), A (NFS-e servicos entrada+saida), C (NFe mercadorias), D/F (vazios), M (apuracao PIS/COFINS com M100/M200/M210/M500/M600/M610), 1 (info complementar), 9 (fechamento)
- Regime LP: PIS 0.65%/COFINS 3.00% cumulativo (CST entrada 70, saida 01, COD_CONT 51)
- Regime LR: PIS 1.65%/COFINS 7.60% nao-cumulativo (CST entrada 50, saida 01, COD_CONT 01)
- Creditos PIS/COFINS apenas para LR (M100/M105, M500/M505)
- NfseEntrada como entrada (IND_OPER=0), NfseEmission como saida (IND_OPER=1)
- NFe items com CST do item quando disponivel, fallback para regime

#### 3. Backend — Controller SPED (`sped.controller.ts`):
- `GET /sped/efd-icms-ipi?year=&month=&preview=` — gera/baixa EFD-ICMS/IPI
- `GET /sped/efd-contribuicoes?year=&month=&preview=` — gera/baixa EFD-Contribuicoes
- `GET /sped/info` — informacao de obrigatoriedade por regime (SN dispensado, LP/LR obrigatorio)
- Content-Type: `text/plain; charset=iso-8859-1`, Content-Disposition para download
- Preview mode retorna JSON com conteudo e contagem de linhas
- Protegido com FiscalGuard + Roles (ADMIN, FISCAL)

#### 4. Frontend — Pagina SPED (`/fiscal/sped`):
- Seletor de periodo (mes anterior como padrao)
- Info do regime tributario com CNAE e perfil EFD
- Grid de arquivos SPED: EFD-ICMS/IPI, EFD-Contribuicoes, DeSTDA
- Cards com: nome, descricao, obrigatoriedade, prazo, botoes gerar/visualizar
- DeSTDA com nota informativa (gerado pelo SEDIF-SN oficial)
- Modal de preview com conteudo do arquivo e botao para baixar
- Secao de instrucoes de uso e aviso sobre validacao no PVA
- Download via fetch + blob + createElement anchor

#### 5. Sidebar: link "Geracao SPED" adicionado na secao Escrituracao

#### 6. Build: Backend + Frontend 0 erros

### Status: FASE 4 CONCLUIDA — Pronto para deploy

---

## 2026-03-07 — Sessao 73: WhatsApp Test Send + Modulo Email SMTP

### Solicitacao do Juliano:
- WhatsApp: colocar funcao de teste de envio de mensagem nas configuracoes
- Email: criar modulo de cadastrar servidor email para envio automatico, com teste, ao lado do WhatsApp

### O que foi implementado:

#### WhatsApp — Teste de Envio
- Endpoint `POST /whatsapp/test-send` no controller
- Secao "Teste de Envio" no frontend `/settings/whatsapp` (visivel quando conectado)
- Input com mascara telefone + botao enviar + feedback resultado

#### Email SMTP — Modulo Completo
- Model `EmailConfig` no Prisma (smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass criptografada AES-256-GCM, fromName, fromEmail)
- Migration `20260307150000_email_config`
- `EmailService` — getConfig, saveConfig, disconnect, testConnection, sendTestEmail, sendEmail
- `EmailController` — 5 endpoints REST (config, test-connection, test-send, disconnect)
- `EmailModule` registrado no AppModule
- DTOs com class-validator
- Frontend `/settings/email` — pagina completa com presets SMTP (Gmail/Outlook/Yahoo), teste conexao, teste envio
- Card "Email SMTP" na pagina principal de Settings
- Senha SMTP criptografada com AES-256-GCM (mesmo padrao WhatsApp)
- Email de teste com template HTML profissional

### Build: backend + frontend — zero erros

### Deploy v1.01.24 — WhatsApp Test Send + Email SMTP
- Deploy realizado com sucesso
- Migration `20260307150000_email_config` aplicada em producao

### Fix v1.01.25 — Erro Propagacao WhatsApp Test Send
- Problema: teste de envio retornava "Erro ao enviar mensagem" generico
- Causa: `sendText()` engolia erros (retornava null), perdia a mensagem de erro da Meta API
- Erro real: `#131030 Recipient phone number not in allowed list` (app em modo Development)
- Solucao: criado `sendTestMessage()` no WhatsAppService que propaga erros com mensagens amigaveis em portugues
- Controller atualizado para usar `sendTestMessage()` ao inves de `sendText()`

### Fix v1.01.26 — Pagina de Politica de Privacidade + Publicacao Meta App
- Meta exigia Privacy Policy URL para publicar o app
- Criada pagina `/privacy` (publica, fora do dashboard) — `frontend/src/app/privacy/page.tsx`
- 9 secoes: coleta de dados, uso, WhatsApp API, protecao, compartilhamento, retencao, direitos LGPD, contato, alteracoes
- URL: https://tecnikos.com.br/privacy
- Configurado no Meta App: Privacy Policy URL, Terms of Service URL, Categoria "Negocios e Paginas"
- **App Meta publicado com sucesso em modo Live** — teste de envio agora funciona para qualquer numero

### Nota — Escopo futuro email:
- Toggles por tipo de email (NFS-e, cobranca, OS, etc.) serao implementados depois
- O EmailService.sendEmail() ja esta exportado e pronto para uso pelo NotificationService e NfseEmissionService

### Deploy v1.01.27 — sendTestMessage com Template hello_world
- Problema: em modo Live, Meta nao permite texto livre para iniciar conversa (so template)
- Solucao: `sendTestMessage()` agora usa template `hello_world` (pre-aprovado em todas as contas WhatsApp Business)
- Template funciona tanto em Development quanto em Live mode
- Frontend: texto atualizado informando uso do template

### WhatsApp — Pendente numero real
- Numero de teste da Meta (+1 555 173 4927) so envia para lista de permitidos
- Tentou usar (66) 99986-1230 mas ja esta registrado em WhatsApp pessoal
- Decisao: comprar chip pre-pago dedicado para WhatsApp Business API
- System User "Tecnikos API" criado com WhatsApp Business Account atribuida
- Quando tiver o chip: adicionar numero no Meta > API Setup > verificar > gerar token permanente > configurar no Tecnikos

### Status: SESSAO 74 — v1.01.27 em producao
---

## Sessao 74 — 07/03/2026

### Email com dominio tecnikos.com.br
- Juliano quer configurar emails profissionais com o dominio (ex: contato@tecnikos.com.br)
- Dominio comprado no Registro.br — necessario servico de email externo
- Recomendado Zoho Mail (plano Mail 10GB — mais barato confiavel)
- Juliano assinou Zoho Workplace Mail 10GB

### Zoho Mail — Configuracao
1. [x] Conta criada no Zoho (julianojosetriaca@gmail.com)
2. [x] Dominio tecnikos.com.br adicionado
3. [x] Habilitado "Modo Avancado" no Registro.br para editar zona DNS
4. [x] DNS em transicao (~2h) — impossivel adicionar registros TXT/MX nesse periodo
5. [x] Verificacao por HTML file: criado endpoint nginx `/zohoverify/verifyforzoho.html` que retorna `34977772`
   - Adicionado location block no servidor HTTP (porta 80) e HTTPS (porta 443) no nginx.conf
   - Zoho verificou dominio com sucesso
6. [x] Email contato@tecnikos.com.br criado como Superadministrador
7. [x] Registros DNS adicionados no Registro.br (zona DNS abriu mesmo durante transicao):
   - MX: tecnikos.com.br MX 10 mx.zoho.com ✅
   - MX: tecnikos.com.br MX 20 mx2.zoho.com ✅
   - MX: tecnikos.com.br MX 50 mx3.zoho.com ✅
   - TXT (SPF): tecnikos.com.br TXT v=spf1 include:zohomail.com ~all ✅
   - TXT (DKIM): zmail._domainkey.tecnikos.com.br TXT v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCYKwDYwp0cm5WJnMGCiaG4Bzgtuh6MqCeVSvAaZwYoUhfS07MxGwyRqu4DO+5mrBM6uV/6evqZzlmNK9F6gWYqvGuSrCZ+1M53WconstWkDwnZ7BDN7lKOovGjaU+u5Qz1mDdeX+Yr8iu7zShV6TiepYSPSXUt+OPHQQmnROHZ+QIDAQAB ✅
   - "Zona DNS atualizada com sucesso!" confirmado pelo Registro.br
8. [ ] Verificacao no Zoho: DNS ainda propagando (Zoho informou "registros podem demorar dependendo do TTL")

### Alteracoes no servidor:
- nginx.conf: adicionado 2 location blocks para Zoho verification (HTTP + HTTPS)
  - `location /zohoverify/verifyforzoho.html { return 200 '34977772'; }`
- Reiniciado container nginx

### Status: DNS CONFIGURADO — Aguardando propagacao para verificacao final no Zoho
---
