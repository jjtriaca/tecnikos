#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Script de deploy — Tecnikos SaaS
#  Uso: bash scripts/deploy-production.sh
#  Opcoes:
#    --skip-build    Pular rebuild das imagens
#    --ssl-only      Apenas renovar/gerar SSL
# ═══════════════════════════════════════════════════════════════

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

COMPOSE_FILE="docker-compose.production.yml"

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}  Tecnikos SaaS — Deploy de Producao${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""

# ── Parse argumentos ─────────────────────────────────────────
SKIP_BUILD=false
SSL_ONLY=false
for arg in "$@"; do
  case $arg in
    --skip-build) SKIP_BUILD=true ;;
    --ssl-only)   SSL_ONLY=true ;;
  esac
done

# ── Verificar .env.production ────────────────────────────────
if [ ! -f .env.production ]; then
  echo -e "${RED}❌ Arquivo .env.production nao encontrado!${NC}"
  echo "   Copie .env.production.example para .env.production e preencha os valores"
  echo "   cp .env.production.example .env.production"
  exit 1
fi

# Carregar variaveis
set -a
source .env.production
set +a

# ── Verificar variaveis obrigatorias ─────────────────────────
echo -e "${YELLOW}🔍 Verificando variaveis de ambiente...${NC}"
REQUIRED_VARS="DOMAIN EMAIL_ADMIN POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD JWT_SECRET FRONTEND_URL"
for var in $REQUIRED_VARS; do
  if [ -z "${!var}" ]; then
    echo -e "${RED}❌ Variavel $var nao definida no .env.production${NC}"
    exit 1
  fi
done

# Verificar JWT_SECRET minimo
if [ ${#JWT_SECRET} -lt 32 ]; then
  echo -e "${RED}❌ JWT_SECRET deve ter pelo menos 32 caracteres${NC}"
  exit 1
fi

echo -e "${GREEN}  ✅ Variaveis verificadas${NC}"

# ── SSL / Let's Encrypt ─────────────────────────────────────
echo ""
echo -e "${YELLOW}🔒 Verificando SSL...${NC}"
mkdir -p nginx/ssl

generate_self_signed() {
  echo -e "${YELLOW}  ⚠️  Gerando certificado auto-assinado temporario...${NC}"
  openssl req -x509 -nodes -days 30 -newkey rsa:2048 \
    -keyout nginx/ssl/privkey.pem \
    -out nginx/ssl/fullchain.pem \
    -subj "/CN=${DOMAIN}" 2>/dev/null
  echo -e "${GREEN}  ✅ Certificado temporario criado (30 dias)${NC}"
}

obtain_letsencrypt() {
  echo -e "${YELLOW}  🔐 Obtendo certificado Let's Encrypt para ${DOMAIN}...${NC}"

  # Precisamos do nginx rodando para o desafio ACME
  # Primeiro subir com certificado auto-assinado se nao existir
  if [ ! -f nginx/ssl/fullchain.pem ]; then
    generate_self_signed
  fi

  # Subir nginx temporariamente
  docker compose -f ${COMPOSE_FILE} --env-file .env.production up -d nginx 2>/dev/null || true
  sleep 3

  # Solicitar certificado real
  docker compose -f ${COMPOSE_FILE} --env-file .env.production run --rm certbot \
    certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d ${DOMAIN} \
    -d www.${DOMAIN} \
    --email ${EMAIL_ADMIN} \
    --agree-tos \
    --no-eff-email \
    --force-renewal

  # Copiar certificados para o local esperado pelo nginx
  if [ -d "nginx/ssl/live/${DOMAIN}" ]; then
    cp -L nginx/ssl/live/${DOMAIN}/fullchain.pem nginx/ssl/fullchain.pem
    cp -L nginx/ssl/live/${DOMAIN}/privkey.pem nginx/ssl/privkey.pem
    echo -e "${GREEN}  ✅ Certificado Let's Encrypt obtido!${NC}"
  fi

  # Recarregar nginx
  docker compose -f ${COMPOSE_FILE} exec nginx nginx -s reload 2>/dev/null || true
}

if [ "$SSL_ONLY" = true ]; then
  obtain_letsencrypt
  echo -e "${GREEN}✅ SSL atualizado!${NC}"
  exit 0
fi

# Verificar se certificados existem
if [ ! -f nginx/ssl/fullchain.pem ] || [ ! -f nginx/ssl/privkey.pem ]; then
  echo -e "${YELLOW}  Certificados SSL nao encontrados${NC}"
  read -p "  Deseja obter certificado Let's Encrypt? (s/n): " USE_LE
  if [ "$USE_LE" = "s" ]; then
    obtain_letsencrypt
  else
    generate_self_signed
  fi
else
  echo -e "${GREEN}  ✅ Certificados SSL encontrados${NC}"
fi

# ── Build das imagens Docker ─────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  echo ""
  echo -e "${YELLOW}📦 Construindo imagens Docker...${NC}"
  docker compose -f ${COMPOSE_FILE} --env-file .env.production build
  echo -e "${GREEN}  ✅ Imagens construidas${NC}"
fi

# ── Subir banco de dados ─────────────────────────────────────
echo ""
echo -e "${YELLOW}🗄️  Subindo banco de dados...${NC}"
docker compose -f ${COMPOSE_FILE} --env-file .env.production up -d postgres
echo "  Aguardando PostgreSQL ficar pronto..."
sleep 8

# Verificar health do postgres
for i in $(seq 1 30); do
  if docker compose -f ${COMPOSE_FILE} exec postgres pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB} > /dev/null 2>&1; then
    echo -e "${GREEN}  ✅ PostgreSQL pronto${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}❌ PostgreSQL nao ficou pronto em 30 tentativas${NC}"
    exit 1
  fi
  sleep 2
done

# ── Migrations do Prisma ─────────────────────────────────────
echo ""
echo -e "${YELLOW}📊 Rodando migrations do Prisma...${NC}"
docker compose -f ${COMPOSE_FILE} --env-file .env.production run --rm backend npx prisma migrate deploy
echo -e "${GREEN}  ✅ Migrations aplicadas${NC}"

# ── Subir todos os servicos ──────────────────────────────────
echo ""
echo -e "${YELLOW}🌐 Subindo todos os servicos...${NC}"
docker compose -f ${COMPOSE_FILE} --env-file .env.production up -d
echo -e "${GREEN}  ✅ Servicos iniciados${NC}"

# ── Verificar health ─────────────────────────────────────────
echo ""
echo -e "${YELLOW}🩺 Verificando saude dos servicos...${NC}"
sleep 10
docker compose -f ${COMPOSE_FILE} ps

# ── Limpar imagens antigas ───────────────────────────────────
echo ""
echo -e "${YELLOW}🧹 Limpando imagens Docker antigas...${NC}"
docker image prune -f > /dev/null 2>&1
echo -e "${GREEN}  ✅ Limpeza concluida${NC}"

# ── Resumo ───────────────────────────────────────────────────
echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Deploy concluido!${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""
echo -e "  🌐 Site:    ${GREEN}${FRONTEND_URL}${NC}"
echo -e "  🩺 Health:  ${GREEN}${FRONTEND_URL}/health${NC}"
echo ""
echo "📋 Comandos uteis:"
echo "  Logs:      docker compose -f ${COMPOSE_FILE} logs -f"
echo "  Logs back: docker compose -f ${COMPOSE_FILE} logs -f backend"
echo "  Status:    docker compose -f ${COMPOSE_FILE} ps"
echo "  Parar:     docker compose -f ${COMPOSE_FILE} down"
echo "  Seed:      docker compose -f ${COMPOSE_FILE} run --rm backend npx prisma db seed"
echo "  Backup:    bash scripts/backup.sh"
echo "  SSL:       bash scripts/deploy-production.sh --ssl-only"
echo "  Redeploy:  bash scripts/deploy-production.sh"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
