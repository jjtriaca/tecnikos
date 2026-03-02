#!/bin/bash
# ============================================================
# Tecnikos SaaS — Script de Instalacao (Linux/Mac)
# ============================================================
set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Tecnikos — Instalador do Sistema            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Detectar diretorio raiz do projeto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

# ── 1. Verificar pre-requisitos ──
echo -e "${YELLOW}[1/7]${NC} Verificando pre-requisitos..."

# Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker nao encontrado. Instale em: https://docs.docker.com/get-docker/${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Docker instalado ($(docker --version | head -1))"

# Docker Compose
if ! docker compose version &> /dev/null 2>&1; then
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}✗ Docker Compose nao encontrado.${NC}"
        exit 1
    fi
fi
echo -e "  ${GREEN}✓${NC} Docker Compose disponivel"

# Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js nao encontrado. Instale em: https://nodejs.org/${NC}"
    exit 1
fi
NODE_VER=$(node -v)
echo -e "  ${GREEN}✓${NC} Node.js $NODE_VER"

# npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm nao encontrado.${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} npm $(npm -v)"

# ── 2. Subir banco de dados ──
echo ""
echo -e "${YELLOW}[2/7]${NC} Subindo banco de dados (PostgreSQL 16)..."
docker compose up -d
echo -e "  ${GREEN}✓${NC} Container do PostgreSQL rodando na porta 5433"

# Aguardar o banco ficar pronto
echo "  Aguardando PostgreSQL aceitar conexoes..."
for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U tecnikos_user -d tecnikos &>/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} PostgreSQL pronto!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "  ${RED}✗ Timeout esperando PostgreSQL. Verifique o Docker.${NC}"
        exit 1
    fi
    sleep 1
done

# ── 3. Instalar dependencias do backend ──
echo ""
echo -e "${YELLOW}[3/7]${NC} Instalando dependencias do backend..."
cd backend
npm install --silent
echo -e "  ${GREEN}✓${NC} Dependencias do backend instaladas"

# ── 4. Rodar migrations ──
echo ""
echo -e "${YELLOW}[4/7]${NC} Rodando migrations do banco de dados..."
npx prisma migrate deploy
echo -e "  ${GREEN}✓${NC} Migrations aplicadas"

# ── 5. Rodar seed ──
echo ""
echo -e "${YELLOW}[5/7]${NC} Populando banco com dados iniciais..."
npx prisma db seed
echo -e "  ${GREEN}✓${NC} Dados iniciais inseridos"

# ── 6. Instalar dependencias do frontend ──
echo ""
echo -e "${YELLOW}[6/7]${NC} Instalando dependencias do frontend..."
cd ../frontend
npm install --silent
echo -e "  ${GREEN}✓${NC} Dependencias do frontend instaladas"

# ── 7. Build do frontend ──
echo ""
echo -e "${YELLOW}[7/7]${NC} Compilando frontend..."
npx next build
echo -e "  ${GREEN}✓${NC} Frontend compilado"

# ── Pronto! ──
cd "$ROOT_DIR"
VERSION=$(node -e "const v = require('./version.json'); console.log('v' + v.version + ' (build #' + v.build + ')')")

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ Instalacao concluida com sucesso!        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Versao: ${BLUE}${VERSION}${NC}"
echo ""
echo -e "  ${YELLOW}Para iniciar o sistema:${NC}"
echo ""
echo -e "    Terminal 1 (Backend):  ${BLUE}cd backend && npm run start:dev${NC}"
echo -e "    Terminal 2 (Frontend): ${BLUE}cd frontend && npm run dev${NC}"
echo ""
echo -e "  ${YELLOW}Acesse:${NC}"
echo -e "    Painel Gestor:  ${BLUE}http://localhost:3000${NC}"
echo -e "    API Health:     ${BLUE}http://localhost:4000/health${NC}"
echo ""
