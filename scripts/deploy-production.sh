#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Script de deploy — Sistema de Terceirização
#  Uso: ./scripts/deploy-production.sh
# ═══════════════════════════════════════════════════════════════

set -e

echo "🚀 Deploy — Sistema de Terceirização"
echo "═══════════════════════════════════════"

# Verificar .env.production
if [ ! -f .env.production ]; then
  echo "❌ Arquivo .env.production não encontrado!"
  echo "   Copie .env.production.example para .env.production e preencha os valores"
  exit 1
fi

# Carregar variáveis
export $(grep -v '^#' .env.production | xargs)

# Verificar variáveis obrigatórias
for var in POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD JWT_SECRET FRONTEND_URL; do
  if [ -z "${!var}" ]; then
    echo "❌ Variável $var não definida no .env.production"
    exit 1
  fi
done

# Verificar JWT_SECRET mínimo
if [ ${#JWT_SECRET} -lt 32 ]; then
  echo "❌ JWT_SECRET deve ter pelo menos 32 caracteres"
  exit 1
fi

echo "✅ Variáveis de ambiente verificadas"

# Criar diretório SSL se não existir
mkdir -p nginx/ssl

# Verificar certificados SSL
if [ ! -f nginx/ssl/fullchain.pem ] || [ ! -f nginx/ssl/privkey.pem ]; then
  echo "⚠️  Certificados SSL não encontrados em nginx/ssl/"
  echo "   Para teste local, gerando certificado auto-assinado..."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/privkey.pem \
    -out nginx/ssl/fullchain.pem \
    -subj "/CN=localhost" 2>/dev/null
  echo "   ⚠️  Use Let's Encrypt em produção real!"
fi

echo "📦 Construindo imagens Docker..."
docker compose -f docker-compose.production.yml --env-file .env.production build

echo "🗄️  Subindo banco de dados..."
docker compose -f docker-compose.production.yml --env-file .env.production up -d postgres
sleep 5

echo "📊 Rodando migrations do Prisma..."
docker compose -f docker-compose.production.yml --env-file .env.production run --rm backend npx prisma migrate deploy

echo "🌐 Subindo todos os serviços..."
docker compose -f docker-compose.production.yml --env-file .env.production up -d

echo ""
echo "═══════════════════════════════════════"
echo "✅ Deploy concluído!"
echo "   Frontend: ${FRONTEND_URL}"
echo "   Health:   ${FRONTEND_URL}/health"
echo ""
echo "📋 Comandos úteis:"
echo "   Logs:     docker compose -f docker-compose.production.yml logs -f"
echo "   Status:   docker compose -f docker-compose.production.yml ps"
echo "   Parar:    docker compose -f docker-compose.production.yml down"
echo "   Seed:     docker compose -f docker-compose.production.yml run --rm backend npx prisma db seed"
echo "═══════════════════════════════════════"
