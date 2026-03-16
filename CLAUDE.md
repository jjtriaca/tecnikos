# Tecnikos — Contexto do Projeto

## REGRAS OBRIGATORIAS DE SESSAO (NUNCA IGNORAR)
1. Ao INICIAR qualquer sessao: LER `CHAT_LOG.md`, `CURRENT_TASK.md` e `PROJETO_LOG.md` ANTES de fazer qualquer coisa
2. A CADA mensagem do usuario com orientacoes/decisoes: SALVAR no `CHAT_LOG.md` IMEDIATAMENTE, ANTES de responder ou executar codigo
3. A CADA tarefa concluida: ATUALIZAR `CHAT_LOG.md` e `CURRENT_TASK.md` ANTES de prosseguir
4. Claude decide toda a parte tecnica sozinho e executa sem perguntar — so para em decisoes de NEGOCIO
5. NUNCA confiar que a sessao vai durar — salvar incrementalmente a cada passo
6. Se a sessao anterior ficou incompleta, retomar do ponto exato registrado nos logs
7. Ao finalizar qualquer estudo ou pesquisa: GRAVAR resultado completo em arquivo IMEDIATAMENTE
8. CHAT_LOG.md: ao iniciar sessao nova, manter apenas os ultimos 3 dias de registro — arquivar ou remover o restante
9. Quando o usuario der uma instrucao que parece ser global/permanente: PERGUNTAR se quer gravar no CLAUDE.md

## AUTORIZACAO GERAL DO USUARIO
O usuario (Juliano) autoriza TODAS as acoes sem pedir confirmacao. Isso inclui:
- WebSearch, WebFetch, Bash, Read, Write, Edit, Glob, Grep — TUDO liberado
- Edicoes em qualquer arquivo do projeto
- Rodar builds, dev servers, testes, deploys
- Pesquisas na web, fetch de URLs, downloads de documentacao
- Criacao e modificacao de arquivos
- NUNCA pedir "Permitir que o Claude...?" — EXECUTAR DIRETO
- O arquivo `.claude/settings.local.json` ja esta configurado com permissoes totais

## Visao Geral
**Tecnikos** e uma plataforma SaaS B2B de Gestao de Servicos Tecnicos (Field Service Management).
Empresa: SLS Obras LTDA (CNPJ: 47.226.599/0001-40)
Dominio: tecnikos.com.br
Dono: Juliano (@jjtriaca no GitHub)

## Stack Tecnica
- **Backend**: NestJS + Prisma + PostgreSQL (porta 4000)
- **Frontend**: Next.js 15 (App Router) + Tailwind CSS (porta 3000)
- **Banco**: PostgreSQL 16 (Docker container)
- **Infra**: Docker Compose, Nginx reverse proxy, Let's Encrypt SSL
- **Servidor**: Hetzner Cloud CPX21 (Ashburn VA), IP: 178.156.240.163
- **Git**: https://github.com/jjtriaca/tecnikos (privado)

## Estrutura do Projeto
```
sistema-terceirizacao/
  backend/           → NestJS API (src/, prisma/, Dockerfile)
  frontend/          → Next.js App (src/app/, src/lib/, Dockerfile)
  nginx/             → nginx.conf + ssl/
  scripts/           → deploy-remote.sh, bump-build.js, backup.sh
  docker-compose.production.yml
  version.json       → Versao unica do sistema (lido pelo /health)
```

## Producao
- URL: https://tecnikos.com.br
- Health: https://tecnikos.com.br/api/health
- SSH: `ssh root@178.156.240.163`
- App dir: `/opt/tecnikos/app/`
- Containers: tecnikos_postgres, tecnikos_backend, tecnikos_frontend, tecnikos_nginx, tecnikos_certbot
- Compose file: `docker-compose.production.yml` com `--env-file .env.production`
- SSL: Let's Encrypt (expira maio/2026)
- Backup: cron diario as 3AM em `/opt/tecnikos/backups/`

## Deploy
Para fazer deploy de qualquer mudanca, rodar do Git Bash:
```bash
bash scripts/deploy-remote.sh          # incrementa patch (ex: 1.03.01 → 1.03.02)
bash scripts/deploy-remote.sh minor    # incrementa minor (ex: 1.03.02 → 1.04.01)
```
O script automaticamente: incrementa versao → empacota → envia SCP → build Docker → restart → commit + push + tag git.

## Deploy Manual (sem script)
```bash
# 1. Empacotar
tar -czf /tmp/tk.tar.gz --exclude=node_modules --exclude=.next --exclude=dist --exclude=.git .
# 2. Enviar
scp /tmp/tk.tar.gz root@178.156.240.163:/opt/tecnikos/app/deploy.tar.gz
# 3. No servidor
ssh root@178.156.240.163
cd /opt/tecnikos/app && tar -xzf deploy.tar.gz && rm deploy.tar.gz
docker compose -f docker-compose.production.yml --env-file .env.production build backend frontend
docker compose -f docker-compose.production.yml --env-file .env.production up -d backend frontend
docker exec tecnikos_nginx nginx -s reload
```

## Login Admin
- Email: admin@tecnikos.com.br
- Senha: Tecnikos2026!
- Empresa: SLS Obras LTDA

## Versionamento
- Arquivo: `version.json` na raiz
- Formato: `MAJOR.MINOR.PATCH` (ex: 1.03.02)
- Script: `node scripts/bump-build.js` incrementa automaticamente
- O health endpoint (`/health`) le o `version.json` de dentro do container
- O `version.json` deve ser copiado para `backend/version.json` antes do build Docker

## ERP Sankhya
O cliente usa Sankhya como ERP. A importacao de parceiros aceita .xlsx exportado direto do Sankhya.
Colunas mapeadas: Nome Parceiro, CNPJ/CPF, Tipo de pessoa, Cliente, Fornecedor, Ativo, Email, Telefone, CEP, Nome (Bairro), Nome + UF (Cidade), Insc. Estadual/Identidade, Razao social, Complemento, Numero.

## Modulos do Sistema
1. **Auth** - Login JWT + refresh token (gestores e tecnicos)
2. **Partners** - CRUD clientes/fornecedores/tecnicos com importacao Sankhya
3. **Service Orders** - Ordens de servico com workflow engine
4. **Workflow** - Templates de etapas customizaveis
5. **Automation** - Regras automaticas (ex: auto-assign tecnico)
6. **Finance** - Lancamentos financeiros (a receber, a pagar, repasses)
7. **Evaluation** - Avaliacoes de tecnicos (gestor + cliente)
8. **Dashboard** - KPIs e resumos
9. **Specializations** - Especializacoes de tecnicos

## REGRA ABSOLUTA: Pagamento Asaas (NUNCA VIOLAR)
**NADA muda no sistema ate o webhook PAYMENT_CONFIRMED do Asaas retornar.**
Isso vale para TODOS os fluxos de compra/upgrade/add-on:
1. **Signup**: Subscription criada como `PENDING`. Tenant fica `PENDING_PAYMENT`. So ativa no webhook.
2. **Upgrade**: Salva `pendingPlanId` na subscription. Cria pagamento avulso no Asaas. Plano/limites so mudam no webhook.
3. **Add-on**: Cria `AddOnPurchase` como `PENDING`. Limites da Company so creditados no webhook.
4. **Downgrade**: Nao precisa de pagamento (e reducao). Agenda para proximo ciclo via `pendingPlanId`.
5. **NUNCA** mudar: `Tenant.status`, `Subscription.status`, `Tenant.planId`, `Company.maxOsPerMonth/maxUsers/maxTechnicians/maxAiMessages` antes do pagamento confirmado.
6. **Excecao unica**: Credito pro-rata cobre 100% do valor → aplicar imediatamente (ja foi pago antes).
7. **Teste obrigatorio**: Ao implementar qualquer fluxo de pagamento, verificar que o fluxo NÃO altera dados antes do webhook.

## ALERTA: APIs Externas com Risco de Ban (Meta, Focus NFe, etc.)
Quando o contexto envolver QUALQUER API da Meta (WhatsApp Business, Facebook, Instagram) ou Focus NFe:
1. **ACENDER ALERTA** — essas APIs tem regras rigidas e consequencias graves (ban, desativacao permanente)
2. **CONSULTAR** os arquivos de memoria ANTES de qualquer alteracao:
   - `memory/whatsapp-business-api-research.md` — documentacao completa da API
   - `memory/whatsapp-lessons-learned.md` — erros cometidos e regras de ouro
3. **NUNCA** implementar baseado em suposicoes — estudar documentacao oficial primeiro
4. **NUNCA** fazer multiplos deploys rapidos com mudancas de comportamento na integracao
5. **TESTAR** com 1 numero/caso primeiro, nunca em producao direto
6. **ATUALIZAR** todos os arquivos de memoria se houver novo aprendizado ou mudanca de entendimento
7. **IA Embarcada**: as tools da IA (configurar_whatsapp, testar_conexao_whatsapp, configurar_focus_nfe, testar_focus_nfe) permitem configuracao pelo gestor, mas NUNCA devem ser uma janela de entrada no sistema — apenas configuracoes liberadas para o perfil ADMIN
8. **Sincronismo obrigatorio**: Sempre que houver melhorias/mudancas sobre API WhatsApp ou Focus NFe, ATUALIZAR AUTOMATICAMENTE: (a) arquivos de memoria, (b) tools da IA embarcada, (c) wizard instructions, (d) system prompt da IA. Manter TUDO sincronizado e atualizado.

## Convencoes
- Commits: conventional commits (feat:, fix:, release:, etc.)
- Idioma do codigo: ingles (nomes de variaveis, funcoes)
- Idioma da UI: portugues brasileiro
- Sem acentos em nomes de arquivo
- CSS: Tailwind utility classes, design system slate/blue

## Regras de Variaveis/Templates em Campos de Texto (System-Wide)
- Todos os campos textarea/input que aceitam variaveis (ex: {nome}, {empresa}, {razao_social}) DEVEM ter botoes clicaveis
- Clicar no botao da variavel INSERE a variavel na posicao do cursor (ou no final se nao houver cursor)
- Padrao visual: botoes tipo "chip" pequenos abaixo do campo (text-[10px], bg-slate-100, hover:bg-green-100)
- Nunca exibir variaveis apenas como texto statico/informativo — sempre clicaveis
- Usar refs (useRef) nos textareas para inserir na posicao do cursor via selectionStart/selectionEnd
- Variaveis comuns: {nome}, {empresa}, {razao_social}, {data}, {documento}, {email}, {telefone}, {resposta}

## Regras de Tabelas (System-Wide)
- Todas as tabelas DEVEM usar `DraggableHeader` (`@/components/ui/DraggableHeader`) para colunas redimensionaveis e reordenaveis
- Todas as tabelas DEVEM usar `SortableHeader` (`@/components/ui/SortableHeader`) para colunas que suportam ordenacao
- Todas as tabelas DEVEM usar `FilterBar` (`@/components/ui/FilterBar`) com `FilterDefinition[]` para filtros
- Todas as tabelas DEVEM usar o componente `Pagination` (`@/components/ui/Pagination`)
- Filtros DEVEM ser persistidos via `useTableParams({ persistKey: "nome-unico" })` — filtros sobrevivem ao fechar pagina e logoff
- Layout de colunas (ordem e largura) DEVE ser persistido via `useTableLayout("table-id", columns)`
- Hooks: `useTableParams` para estado de filtros/sort/page; `useTableLayout` para ordem/largura de colunas
- Nunca usar `<th>` plain — sempre `DraggableHeader` wrapping `SortableHeader`
- Nunca criar funcao `renderPagination()` customizada — usar componente `Pagination`
- Tipos: `ColumnDefinition<T>` e `FilterDefinition` de `@/lib/types/table`
