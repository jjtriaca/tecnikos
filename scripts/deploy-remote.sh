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
#   4. Faz backup do banco antes do deploy
#   5. Reconstrói imagens Docker no servidor
#   6. Aplica migrations Prisma
#   7. Reinicia os containers
#   8. Verifica health (rollback se falhar)
#   9. Commita e faz push da nova versão + tag git
# ═══════════════════════════════════════════════════════════════

set -e

SERVER="root@178.156.240.163"
APP_DIR="/opt/tecnikos/app"
BACKUP_DIR="/opt/tecnikos/backups"
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

# ── 0. Pre-flight: versao local DEVE bater com prod ──────────
# Bloqueio anti-incidente v1.10.71: worktrees diferentes podem ficar dessincronizados
# (deploy push pra origin/main falha silencioso em branches claude/*). Sem este check,
# uma sessao nova abrindo worktree fresco a partir de origin/main pode fazer deploy
# revertendo 15 versoes de prod.
echo -e "${YELLOW}[0/9]${NC} Verificando alinhamento com prod..."
LOCAL_VERSION_PRE=$(node -e "console.log(require('./version.json').version)" 2>/dev/null || echo "")
LIVE_VERSION_PRE=$(curl -s --max-time 5 https://sls.tecnikos.com.br/health 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).version)}catch(e){console.log('')}})" 2>/dev/null || echo "")
if [ -z "$LIVE_VERSION_PRE" ]; then
  echo -e "  ${YELLOW}⚠${NC} Nao consegui consultar /health — pulando check (prod offline?)"
elif [ "$LOCAL_VERSION_PRE" = "$LIVE_VERSION_PRE" ]; then
  echo -e "  ${GREEN}✓${NC} Local e prod alinhados em ${LOCAL_VERSION_PRE}"
else
  # Compara versoes via sort -V (semver-aware): se local > prod, eh recovery de deploy
  # quebrado (bump foi feito mas build/health falhou). Se local < prod, eh worktree
  # defasado — bloquear pra nao reverter prod.
  SMALLER=$(printf '%s\n%s\n' "$LOCAL_VERSION_PRE" "$LIVE_VERSION_PRE" | sort -V | head -1)
  if [ "$SMALLER" = "$LIVE_VERSION_PRE" ]; then
    echo -e "  ${YELLOW}⚠${NC} Local (${YELLOW}${LOCAL_VERSION_PRE}${NC}) > prod (${YELLOW}${LIVE_VERSION_PRE}${NC}) — deploy anterior nao subiu"
    echo -e "  ${YELLOW}⚠${NC} Continuando como recovery (vai bumpar e tentar de novo)"
  else
    echo -e "  ${RED}✗ BLOQUEADO${NC} — versao local (${RED}${LOCAL_VERSION_PRE}${NC}) < prod (${GREEN}${LIVE_VERSION_PRE}${NC})"
    echo ""
    echo -e "  ${YELLOW}Este worktree esta defasado.${NC} Worktrees disponiveis:"
    git worktree list
    echo ""
    echo -e "  ${YELLOW}→${NC} Procure o worktree com version.json = ${LIVE_VERSION_PRE} e rode o deploy de la."
    echo -e "  ${YELLOW}→${NC} Se for um worktree novo, rebaseie em cima do worktree em prod antes de mexer."
    exit 1
  fi
fi
echo ""

# ── 1. Incrementar versão ────────────────────────────────────
BUMP_TYPE="${1:-patch}"
echo -e "${YELLOW}[1/9]${NC} Incrementando versão (${BUMP_TYPE})..."

OLD_VERSION=$(node -e "console.log(require('./version.json').version)")
node scripts/bump-build.js --${BUMP_TYPE}
NEW_VERSION=$(node -e "console.log(require('./version.json').version)")
echo -e "  ${GREEN}✓${NC} Versão: ${RED}${OLD_VERSION}${NC} → ${GREEN}${NEW_VERSION}${NC}"

cp version.json backend/version.json

# ── 2. Verificar git limpo ───────────────────────────────────
echo ""
echo -e "${YELLOW}[2/9]${NC} Verificando git..."
if git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Nenhuma mudança pendente (só version.json)"
else
  echo -e "  ${YELLOW}⚠${NC} Há mudanças não commitadas — serão incluídas no deploy"
fi

# ── 3. Empacotar ─────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[3/9]${NC} Empacotando projeto..."
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
echo -e "${YELLOW}[4/9]${NC} Enviando para ${SERVER}..."
scp -o StrictHostKeyChecking=no /tmp/tecnikos-deploy.tar.gz "${SERVER}:${APP_DIR}/deploy.tar.gz"
echo -e "  ${GREEN}✓${NC} Upload concluído"

# ── 5. Backup pré-deploy ─────────────────────────────────────
echo ""
echo -e "${YELLOW}[5/9]${NC} Fazendo backup do banco..."
BACKUP_FILE="pre-deploy-${NEW_VERSION}-$(date +%Y%m%d_%H%M%S).sql.gz"
ssh "${SERVER}" "mkdir -p ${BACKUP_DIR} && docker exec tecnikos_postgres pg_dump -U \$(grep POSTGRES_USER ${APP_DIR}/.env.production | cut -d= -f2) \$(grep POSTGRES_DB ${APP_DIR}/.env.production | cut -d= -f2) 2>/dev/null | gzip > ${BACKUP_DIR}/${BACKUP_FILE}"
BACKUP_SIZE=$(ssh "${SERVER}" "du -h ${BACKUP_DIR}/${BACKUP_FILE} | cut -f1" 2>/dev/null || echo "?")
echo -e "  ${GREEN}✓${NC} Backup: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ── 6. Build no servidor ─────────────────────────────────────
echo ""
echo -e "${YELLOW}[6/9]${NC} Construindo imagens Docker no servidor..."
ssh "${SERVER}" "cd ${APP_DIR} && tar -xzf deploy.tar.gz && rm deploy.tar.gz && docker compose -f docker-compose.production.yml --env-file .env.production build backend frontend 2>&1 | tail -5"
echo -e "  ${GREEN}✓${NC} Build concluído"

# ── 7. Migrations ─────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[7/9]${NC} Aplicando migrations..."
MIGRATION_OUTPUT=$(ssh "${SERVER}" "cd ${APP_DIR} && docker compose -f docker-compose.production.yml --env-file .env.production run --rm -T backend npx prisma migrate deploy 2>&1" || true)
if echo "$MIGRATION_OUTPUT" | grep -q "error\|Error\|ERROR"; then
  echo -e "  ${RED}✗${NC} Migration falhou!"
  echo "$MIGRATION_OUTPUT" | tail -10
  echo -e "  ${YELLOW}⚠${NC} Backup disponível em: ${BACKUP_DIR}/${BACKUP_FILE}"
  echo -e "  ${YELLOW}⚠${NC} Abortando deploy. Corrija as migrations e tente novamente."
  exit 1
fi
if echo "$MIGRATION_OUTPUT" | grep -q "No pending migrations"; then
  echo -e "  ${GREEN}✓${NC} Nenhuma migration pendente"
else
  echo -e "  ${GREEN}✓${NC} Migrations aplicadas com sucesso"
fi

# ── 8. Restart containers ────────────────────────────────────
echo ""
echo -e "${YELLOW}[8/9]${NC} Reiniciando containers..."
ssh "${SERVER}" "cd ${APP_DIR} && docker compose -f docker-compose.production.yml --env-file .env.production up -d backend frontend && docker exec tecnikos_nginx nginx -s reload 2>/dev/null || true"
echo -e "  ${GREEN}✓${NC} Containers reiniciados"

# ── 9. Health check ──────────────────────────────────────────
echo ""
echo -e "${YELLOW}[9/9]${NC} Verificando saúde..."
sleep 8

HEALTH_OK=false
for i in 1 2 3; do
  HEALTH=$(ssh "${SERVER}" "docker exec tecnikos_backend wget -q -O - http://localhost:4000/health 2>/dev/null" || echo '{"status":"error"}')
  LIVE_VERSION=$(echo "$HEALTH" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).version)}catch{console.log('?')}})" 2>/dev/null || echo "?")
  if [ "$LIVE_VERSION" = "$NEW_VERSION" ]; then
    HEALTH_OK=true
    break
  fi
  echo -e "  ${YELLOW}⚠${NC} Tentativa $i: versão ${LIVE_VERSION} (esperado ${NEW_VERSION}). Aguardando..."
  sleep 5
done

if [ "$HEALTH_OK" = true ]; then
  echo -e "  ${GREEN}✓${NC} Versão online: ${GREEN}${LIVE_VERSION}${NC}"
else
  echo -e "  ${RED}✗${NC} Health check falhou! Versão online: ${LIVE_VERSION}"
  echo -e "  ${YELLOW}⚠${NC} Backup disponível em: ${BACKUP_DIR}/${BACKUP_FILE}"
  echo -e "  ${YELLOW}⚠${NC} Para rollback manual: ssh ${SERVER} 'cd ${APP_DIR} && gunzip -c ${BACKUP_DIR}/${BACKUP_FILE} | docker exec -i tecnikos_postgres psql -U USER DB'"
fi

# ── Commit + Push + Tag ──────────────────────────────────────
echo ""
echo -e "${BLUE}Commitando v${NEW_VERSION}...${NC}"
git add version.json backend/version.json
git add -A
git commit -m "release: v${NEW_VERSION}

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" 2>/dev/null || echo "(nada para commitar)"

# git push HEAD:main funciona em branch local 'main' ou em worktree 'claude/*'.
# Sem silenciamento — push falhando deixaria o worktree defasado de origin/main
# (incidente: 26 versoes perdidas silenciosamente, v1.10.55 -> v1.10.81).
git push origin HEAD:main
git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}" 2>/dev/null || true
git push origin "v${NEW_VERSION}"

# ── Limpar ────────────────────────────────────────────────────
rm -f /tmp/tecnikos-deploy.tar.gz
ssh "${SERVER}" "docker image prune -f > /dev/null 2>&1" || true

# Manter apenas últimos 10 backups pré-deploy
ssh "${SERVER}" "ls -t ${BACKUP_DIR}/pre-deploy-* 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null" || true

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✅ Deploy v${NEW_VERSION} concluído com sucesso!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "   🌐 https://tecnikos.com.br"
echo -e "   📊 https://tecnikos.com.br/api/health → v${NEW_VERSION}"
echo ""
