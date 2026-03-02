# Tecnikos SaaS — Guia de Deploy (Hetzner)

## Visao Geral

```
Servidor:  Hetzner CX32 (4 vCPU, 8GB RAM, 80GB SSD)
SO:        Ubuntu 24.04 LTS
Dominio:   tecnikos.com.br
SSL:       Let's Encrypt (automatico)
Stack:     Docker (NestJS + Next.js + PostgreSQL + Nginx)
Custo:     ~EUR 7,49/mes (~R$ 47)
```

---

## Passo 1 — Criar Servidor na Hetzner

1. Acesse [console.hetzner.cloud](https://console.hetzner.cloud)
2. Crie uma conta (precisa de cartao internacional)
3. Clique em **"Add Server"**
4. Configure:
   - **Location:** Falkenstein (mais barato) ou Ashburn (mais perto do BR)
   - **Image:** Ubuntu 24.04
   - **Type:** Shared vCPU → **CX32** (4 vCPU / 8GB RAM / 80GB SSD)
   - **SSH Key:** Adicione sua chave publica SSH
   - **Name:** `tecnikos-prod`
5. Clique **"Create & Buy Now"**
6. Anote o **IP do servidor** (ex: `65.108.xx.xx`)

### Gerar chave SSH (se nao tiver)

```bash
# No seu computador local (Windows PowerShell ou Git Bash)
ssh-keygen -t ed25519 -C "admin@tecnikos.com.br"
# A chave publica fica em: ~/.ssh/id_ed25519.pub
cat ~/.ssh/id_ed25519.pub
# Copie o conteudo e cole no painel da Hetzner
```

---

## Passo 2 — Configurar DNS no Registro.br

1. Acesse [registro.br](https://registro.br) e entre na sua conta
2. Clique no dominio **tecnikos.com.br**
3. Va em **"DNS"** → **"Editar zona"**
4. Adicione os registros:

```
Tipo    Nome    Valor                 TTL
A       @       65.108.xx.xx          3600
A       www     65.108.xx.xx          3600
```

> Substitua `65.108.xx.xx` pelo IP real do seu servidor

5. Aguarde propagacao DNS (pode levar ate 24h, geralmente 1-2h)

### Verificar propagacao

```bash
# No terminal
nslookup tecnikos.com.br
# Deve retornar o IP do servidor
```

---

## Passo 3 — Setup do Servidor

Conecte via SSH e rode o script de setup:

```bash
# Conectar ao servidor
ssh root@65.108.xx.xx

# Baixar e rodar script de setup
# (opcao 1: clonar o repo primeiro)
apt update && apt install -y git
git clone https://github.com/SEU_USUARIO/sistema-terceirizacao.git /opt/tecnikos/app
cd /opt/tecnikos/app
bash scripts/setup-server.sh
```

O script instala automaticamente:
- Docker + Docker Compose
- Firewall (UFW) — portas 22, 80, 443
- Fail2Ban — protecao contra brute-force SSH
- Swap de 4GB — evita OOM killer
- Timezone America/Sao_Paulo

---

## Passo 4 — Configurar Variaveis de Ambiente

```bash
cd /opt/tecnikos/app

# Copiar exemplo
cp .env.production.example .env.production

# Editar com seus valores reais
nano .env.production
```

### Gerar valores seguros

```bash
# Gerar POSTGRES_PASSWORD (32 chars)
openssl rand -base64 32

# Gerar JWT_SECRET (64 chars)
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Exemplo do .env.production preenchido

```env
DOMAIN=tecnikos.com.br
EMAIL_ADMIN=admin@tecnikos.com.br

POSTGRES_DB=tecnikos_prod
POSTGRES_USER=tecnikos_user
POSTGRES_PASSWORD=SuaSenhaForteAqui123!@#$%

JWT_SECRET=SeuSecretJWTMuitoForteAquiCom64CaracteresOuMais
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=604800

FRONTEND_URL=https://tecnikos.com.br

NODE_ENV=production
```

---

## Passo 5 — Deploy

```bash
cd /opt/tecnikos/app

# Rodar deploy (build + migrations + start)
bash scripts/deploy-production.sh
```

O script faz automaticamente:
1. Valida variaveis de ambiente
2. Gera ou solicita certificado SSL
3. Constroi imagens Docker
4. Sobe PostgreSQL e aguarda ficar pronto
5. Roda migrations do Prisma
6. Sobe todos os servicos
7. Limpa imagens antigas

### Verificar se tudo esta rodando

```bash
# Ver status dos containers
docker compose -f docker-compose.production.yml ps

# Deve mostrar algo como:
# tecnikos_postgres   running (healthy)
# tecnikos_backend    running (healthy)
# tecnikos_frontend   running (healthy)
# tecnikos_nginx      running
# tecnikos_certbot    running

# Testar health
curl https://tecnikos.com.br/health

# Ver logs
docker compose -f docker-compose.production.yml logs -f
```

---

## Passo 6 — Configurar Backup Automatico

```bash
# Testar backup manual
bash scripts/backup.sh

# Configurar cron para backup diario as 3h da manha
crontab -e

# Adicionar esta linha:
0 3 * * * cd /opt/tecnikos/app && bash scripts/backup.sh >> /var/log/tecnikos-backup.log 2>&1
```

---

## Comandos Uteis

### Gerenciamento

```bash
# Status dos servicos
docker compose -f docker-compose.production.yml ps

# Logs de todos os servicos
docker compose -f docker-compose.production.yml logs -f

# Logs apenas do backend
docker compose -f docker-compose.production.yml logs -f backend

# Reiniciar um servico
docker compose -f docker-compose.production.yml restart backend

# Parar tudo
docker compose -f docker-compose.production.yml down

# Subir tudo
docker compose -f docker-compose.production.yml up -d
```

### Banco de Dados

```bash
# Acessar PostgreSQL
docker compose -f docker-compose.production.yml exec postgres psql -U tecnikos_user -d tecnikos_prod

# Rodar seed (dados iniciais)
docker compose -f docker-compose.production.yml run --rm backend npx prisma db seed

# Nova migration
docker compose -f docker-compose.production.yml run --rm backend npx prisma migrate deploy
```

### SSL

```bash
# Renovar certificado SSL manualmente
bash scripts/deploy-production.sh --ssl-only

# Verificar validade do certificado
echo | openssl s_client -servername tecnikos.com.br -connect tecnikos.com.br:443 2>/dev/null | openssl x509 -noout -dates
```

### Atualizar Aplicacao

```bash
cd /opt/tecnikos/app

# Puxar atualizacoes
git pull origin main

# Redeploy
bash scripts/deploy-production.sh
```

### Monitoramento

```bash
# Uso de memoria/CPU
htop

# Espaco em disco
df -h

# Tamanho do banco
docker compose -f docker-compose.production.yml exec postgres psql -U tecnikos_user -d tecnikos_prod -c "SELECT pg_size_pretty(pg_database_size('tecnikos_prod'));"

# Tamanho dos volumes Docker
docker system df -v
```

---

## Troubleshooting

### Container nao sobe

```bash
# Ver logs detalhados
docker compose -f docker-compose.production.yml logs backend --tail=50

# Verificar se porta esta em uso
ss -tlnp | grep -E '80|443|4000|3000'
```

### Erro de SSL

```bash
# Regenerar certificado
rm -rf nginx/ssl/*.pem
bash scripts/deploy-production.sh --ssl-only
```

### Banco corrompido

```bash
# Restaurar ultimo backup
gunzip -c /opt/tecnikos/backups/db_YYYY-MM-DD_HHMM.sql.gz | \
  docker compose -f docker-compose.production.yml exec -T postgres \
  psql -U tecnikos_user -d tecnikos_prod
```

### Sem espaco em disco

```bash
# Limpar Docker (imagens/volumes nao usados)
docker system prune -a --volumes

# Verificar backups antigos
du -sh /opt/tecnikos/backups/
```

---

## Migracao Futura (DigitalOcean)

Quando o sistema crescer (30+ empresas), migrar para DigitalOcean:

```bash
# 1. No servidor atual — fazer backup completo
bash scripts/backup.sh

# 2. Copiar backup para novo servidor
scp /opt/tecnikos/backups/db_latest.sql.gz root@NOVO_IP:/opt/tecnikos/backups/

# 3. No novo servidor — restaurar
cd /opt/tecnikos/app
bash scripts/deploy-production.sh      # Sobe servicos
# Restaurar banco
gunzip -c /opt/tecnikos/backups/db_latest.sql.gz | \
  docker compose -f docker-compose.production.yml exec -T postgres \
  psql -U tecnikos_user -d tecnikos_prod

# 4. Atualizar DNS no Registro.br → novo IP
# 5. Aguardar propagacao DNS
# 6. Desligar servidor antigo
```

Total da migracao: ~30 minutos com zero perda de dados.
