#!/bin/bash
# ============================================================
# FieldService — Deploy / Atualização
# Incrementa build, roda migrations, rebuilda tudo.
# ============================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   FieldService — Deploy / Atualização        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Incrementar build ──
echo -e "${YELLOW}[1/5]${NC} Incrementando build..."
node scripts/bump-build.js ${1:---patch}
VERSION=$(node -e "const v = require('./version.json'); console.log('v' + v.version + ' (build #' + v.build + ')')")
echo -e "  ${GREEN}✓${NC} Nova versão: ${BLUE}${VERSION}${NC}"

# ── 2. Atualizar dependências ──
echo ""
echo -e "${YELLOW}[2/5]${NC} Atualizando dependências..."
cd backend && npm install --silent
cd ../frontend && npm install --silent
cd "$ROOT_DIR"
echo -e "  ${GREEN}✓${NC} Dependências atualizadas"

# ── 3. Migrations ──
echo ""
echo -e "${YELLOW}[3/5]${NC} Verificando migrations..."
cd backend
npx prisma migrate deploy
cd "$ROOT_DIR"
echo -e "  ${GREEN}✓${NC} Banco atualizado"

# ── 4. Gerar Prisma Client ──
echo ""
echo -e "${YELLOW}[4/5]${NC} Gerando Prisma Client..."
cd backend
npx prisma generate
cd "$ROOT_DIR"
echo -e "  ${GREEN}✓${NC} Prisma Client atualizado"

# ── 5. Build frontend ──
echo ""
echo -e "${YELLOW}[5/5]${NC} Compilando frontend..."
cd frontend
npx next build
cd "$ROOT_DIR"
echo -e "  ${GREEN}✓${NC} Frontend compilado"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ Deploy concluído! ${VERSION}   ${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Reinicie os serviços para aplicar:"
echo -e "    Backend:  ${BLUE}Ctrl+C → npm run start:dev${NC}"
echo -e "    Frontend: ${BLUE}Ctrl+C → npm run dev${NC}"
echo ""
