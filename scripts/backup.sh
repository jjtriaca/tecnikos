#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Backup automatizado — Tecnikos SaaS
#  Uso: bash scripts/backup.sh
#  Cron (diario 3h): 0 3 * * * cd /opt/tecnikos/app && bash scripts/backup.sh
# ═══════════════════════════════════════════════════════════════

set -e

# ── Configuracoes ────────────────────────────────────────────
BACKUP_DIR="/opt/tecnikos/backups"
COMPOSE_FILE="docker-compose.production.yml"
DATE=$(date +%Y-%m-%d_%H%M)
RETENTION_DAYS=30

# Cores (desabilitadas se nao for terminal)
if [ -t 1 ]; then
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  RED='\033[0;31m'
  NC='\033[0m'
else
  GREEN='' YELLOW='' RED='' NC=''
fi

echo -e "${YELLOW}═══════════════════════════════════════${NC}"
echo -e "${YELLOW}  Tecnikos — Backup ${DATE}${NC}"
echo -e "${YELLOW}═══════════════════════════════════════${NC}"

# Carregar variaveis
if [ -f .env.production ]; then
  set -a
  source .env.production
  set +a
fi

# Criar diretorio de backup
mkdir -p ${BACKUP_DIR}

# ── 1. Backup do banco PostgreSQL ────────────────────────────
echo ""
echo -e "${YELLOW}🗄️  [1/3] Backup do PostgreSQL...${NC}"
DB_BACKUP="${BACKUP_DIR}/db_${DATE}.sql.gz"

docker compose -f ${COMPOSE_FILE} exec -T postgres \
  pg_dump -U ${POSTGRES_USER:-tecnikos_user} \
          -d ${POSTGRES_DB:-tecnikos_prod} \
          --no-owner \
          --no-privileges \
          --clean \
          --if-exists \
  | gzip > "${DB_BACKUP}"

DB_SIZE=$(du -sh "${DB_BACKUP}" | cut -f1)
echo -e "${GREEN}  ✅ Banco salvo: ${DB_BACKUP} (${DB_SIZE})${NC}"

# ── 2. Backup dos uploads ───────────────────────────────────
echo ""
echo -e "${YELLOW}📁 [2/3] Backup dos uploads...${NC}"
UPLOADS_BACKUP="${BACKUP_DIR}/uploads_${DATE}.tar.gz"

# Copiar uploads do volume Docker
docker compose -f ${COMPOSE_FILE} exec -T backend \
  tar czf - -C /app uploads 2>/dev/null > "${UPLOADS_BACKUP}" || true

if [ -s "${UPLOADS_BACKUP}" ]; then
  UPL_SIZE=$(du -sh "${UPLOADS_BACKUP}" | cut -f1)
  echo -e "${GREEN}  ✅ Uploads salvos: ${UPLOADS_BACKUP} (${UPL_SIZE})${NC}"
else
  rm -f "${UPLOADS_BACKUP}"
  echo -e "${YELLOW}  ⚠️  Sem uploads para backup${NC}"
fi

# ── 3. Limpar backups antigos ────────────────────────────────
echo ""
echo -e "${YELLOW}🧹 [3/3] Limpando backups com mais de ${RETENTION_DAYS} dias...${NC}"
DELETED=$(find ${BACKUP_DIR} -name "*.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
echo -e "${GREEN}  ✅ ${DELETED} arquivo(s) antigo(s) removido(s)${NC}"

# ── Resumo ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Backup concluido!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "📋 Backups disponiveis:"
ls -lh ${BACKUP_DIR}/*.gz 2>/dev/null | tail -10
echo ""
echo "📋 Para restaurar:"
echo "  Banco:   gunzip -c ${DB_BACKUP} | docker compose -f ${COMPOSE_FILE} exec -T postgres psql -U \${POSTGRES_USER} -d \${POSTGRES_DB}"
echo "  Uploads: docker cp ${UPLOADS_BACKUP} tecnikos_backend:/tmp/ && docker exec tecnikos_backend tar xzf /tmp/$(basename ${UPLOADS_BACKUP}) -C /app"
echo ""
TOTAL_SIZE=$(du -sh ${BACKUP_DIR} | cut -f1)
echo "💾 Espaco total de backups: ${TOTAL_SIZE}"
