# Tecnikos — Contexto do Projeto

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

## Convencoes
- Commits: conventional commits (feat:, fix:, release:, etc.)
- Idioma do codigo: ingles (nomes de variaveis, funcoes)
- Idioma da UI: portugues brasileiro
- Sem acentos em nomes de arquivo
- CSS: Tailwind utility classes, design system slate/blue
