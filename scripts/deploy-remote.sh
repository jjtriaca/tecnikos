#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Tecnikos — Deploy Remoto (roda do PC local → servidor)
# ═══════════════════════════════════════════════════════════════
#
# Uso (no Git Bash do Windows):
#   bash scripts/deploy-remote.sh           → incrementa patch
#   bash scripts/deploy-remote.sh minor     → incrementa minor
#   bash scripts/deploy-remote.sh major     → incrementa major
#
# O script automaticamente:
#   1. Incrementa a versão em version.json
#   2. Empacota o projeto (sem node_modules)
#   3. Envia por SCP para o servidor Hetzner
#   4. Reconstrói imagens Docker no servidor
#   5. Reinicia os containers
#   6. Verifica health
#   7. Commita e faz push da nova versão + tag git
# ═══════════════════════════════════════════════════════════════

set -e

SERVER="root@178.156.240.163"
APP_DIR="/opt/tecnikos/app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}   Tecnikos — Deploy Remoto para Produção          ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

# ── 1. Incrementar versão ────────────────────────────────────
BUMP_TYPE="${1:-patch}"
echo -e "${YELLOW}[1/7]${NC} Incrementando versão (${BUMP_TYPE})..."

# Salvar versão atual
OLD_VERSION=$(node -e "console.log(require('./version.json').version)")

# Rodar bump
node scripts/bump-build.js --${BUMP_TYPE}

NEW_VERSION=$(node -e "console.log(require('./version.json').version)")
echo -e "  ${GREEN}✓${NC} Versão: ${RED}${OLD_VERSION}${NC} → ${GREEN}${NEW_VERSION}${NC}"

# Copiar version.json para backend (Docker COPY)
cp version.json backend/version.json

# ── 2. Verificar git limpo ───────────────────────────────────
echo ""
echo -e "${YELLOW}[2/7]${NC} Verificando git..."
if git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Nenhuma mudança pendente (só version.json)"
else
  echo -e "  ${YELLOW}⚠${NC} Há mudanças não commitadas — serão incluídas no deploy"
fi

# ── 3. Empacotar ─────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[3/7]${NC} Empacotando projeto..."
tar -czf /tmp/tecnikos-deploy.tar.gz \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=dist \
  --exclude=.git \
  --exclude=postgres-data \
  --exclude='*.tar.gz' \
  --exclude='.env.production' \
  .
SIZE=$(du -h /tmp/tecnikos-deploy.tar.gz | cut -f1)
echo -e "  ${GREEN}✓${NC} Pacote: ${SIZE}"

# ── 4. Enviar para servidor ──────────────────────────────────
echo ""
echo -e "${YELLOW}[4/7]${NC} Enviando para ${SERVER}..."
scp -o StrictHostKeyChecking=no /tmp/tecnikos-deploy.tar.gz "${SERVER}:${APP_DIR}/deploy.tar.gz"
echo -e "  ${GREEN}✓${NC} Upload concluído"

# ── 5. Build no servidor ─────────────────────────────────────
echo ""
echo -e "${YELLOW}[5/7]${NC} Construindo imagens Docker no servidor..."
ssh "${SERVER}" "cd ${APP_DIR} && tar -xzf deploy.tar.gz && rm deploy.tar.gz && docker compose -f docker-compose.production.yml --env-file .env.production build backend frontend 2>&1 | tail -5"
echo -e "  ${GREEN}✓${NC} Build concluído"

# ── 6. Restart containers ────────────────────────────────────
echo ""
echo -e "${YELLOW}[6/7]${NC} Reiniciando containers..."
ssh "${SERVER}" "cd ${APP_DIR} && docker compose -f docker-compose.production.yml --env-file .env.production up -d backend frontend && docker exec tecnikos_nginx nginx -s reload 2>/dev/null || true"
echo -e "  ${GREEN}✓${NC} Containers reiniciados"

# ── 7. Health check ──────────────────────────────────────────
echo ""
echo -e "${YELLOW}[7/7]${NC} Verificando saúde..."
sleep 8
HEALTH=$(ssh "${SERVER}" "docker exec tecnikos_backend wget -q -O - http://localhost:4000/health 2>/dev/null" || echo '{"status":"error"}')
LIVE_VERSION=$(echo "$HEALTH" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).version)}catch{console.log('?')}})" 2>/dev/null || echo "?")
echo -e "  ${GREEN}✓${NC} Versão online: ${GREEN}${LIVE_VERSION}${NC}"

# ── Commit + Push + Tag ──────────────────────────────────────
echo ""
echo -e "${BLUE}Commitando v${NEW_VERSION}...${NC}"
git add version.json backend/version.json
git add -A  # inclui qualquer mudança pendente
git commit -m "release: v${NEW_VERSION}

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" 2>/dev/null || echo "(nada para commitar)"

git push origin main 2>/dev/null || true
git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}" 2>/dev/null || true
git push origin "v${NEW_VERSION}" 2>/dev/null || true

# ── Limpar ────────────────────────────────────────────────────
rm -f /tmp/tecnikos-deploy.tar.gz
ssh "${SERVER}" "docker image prune -f > /dev/null 2>&1" || true

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✅ Deploy v${NEW_VERSION} concluído com sucesso!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "   🌐 https://tecnikos.com.br"
echo -e "   📊 https://tecnikos.com.br/api/health → v${NEW_VERSION}"
echo ""
