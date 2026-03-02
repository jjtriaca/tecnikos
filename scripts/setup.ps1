# ============================================================
# Tecnikos SaaS - Script de Instalacao (Windows PowerShell)
# ============================================================
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Blue
Write-Host "  Tecnikos - Instalador do Sistema      " -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Navegar para raiz do projeto
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
Set-Location $RootDir

# -- 1. Verificar pre-requisitos --
Write-Host "[1/7] Verificando pre-requisitos..." -ForegroundColor Yellow

# Docker
$dockerPath = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerPath) {
    Write-Host "  X Docker nao encontrado. Instale em: https://docs.docker.com/get-docker/" -ForegroundColor Red
    exit 1
}
$dockerVer = docker --version
Write-Host "  OK $dockerVer" -ForegroundColor Green

# Docker Compose
$composeTest = docker compose version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  X Docker Compose nao encontrado." -ForegroundColor Red
    exit 1
}
Write-Host "  OK Docker Compose disponivel" -ForegroundColor Green

# Node.js
$nodePath = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodePath) {
    Write-Host "  X Node.js nao encontrado. Instale em: https://nodejs.org/" -ForegroundColor Red
    exit 1
}
$nodeVer = node -v
Write-Host "  OK Node.js $nodeVer" -ForegroundColor Green

# npm
$npmPath = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmPath) {
    Write-Host "  X npm nao encontrado." -ForegroundColor Red
    exit 1
}
$npmVer = npm -v
Write-Host "  OK npm $npmVer" -ForegroundColor Green

# -- 2. Subir banco de dados --
Write-Host ""
Write-Host "[2/7] Subindo banco de dados (PostgreSQL 16)..." -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "  X Falha ao subir containers. Verifique se o Docker Desktop esta aberto." -ForegroundColor Red
    exit 1
}
Write-Host "  OK Container do PostgreSQL rodando na porta 5433" -ForegroundColor Green

Write-Host "  Aguardando PostgreSQL aceitar conexoes..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    docker compose exec -T postgres pg_isready -U tecnikos_user -d tecnikos 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 1
}
if ($ready) {
    Write-Host "  OK PostgreSQL pronto!" -ForegroundColor Green
} else {
    Write-Host "  X Timeout esperando PostgreSQL. Verifique o Docker." -ForegroundColor Red
    exit 1
}

# -- 3. Instalar dependencias do backend --
Write-Host ""
Write-Host "[3/7] Instalando dependencias do backend..." -ForegroundColor Yellow
Set-Location backend
npm install --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "  X Falha ao instalar dependencias do backend." -ForegroundColor Red
    exit 1
}
Write-Host "  OK Dependencias do backend instaladas" -ForegroundColor Green

# -- 4. Rodar migrations --
Write-Host ""
Write-Host "[4/7] Rodando migrations do banco de dados..." -ForegroundColor Yellow
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "  X Falha ao rodar migrations." -ForegroundColor Red
    exit 1
}
Write-Host "  OK Migrations aplicadas" -ForegroundColor Green

# -- 5. Rodar seed --
Write-Host ""
Write-Host "[5/7] Populando banco com dados iniciais..." -ForegroundColor Yellow
npx prisma db seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "  X Falha ao popular banco." -ForegroundColor Red
    exit 1
}
Write-Host "  OK Dados iniciais inseridos" -ForegroundColor Green

# -- 6. Instalar dependencias do frontend --
Write-Host ""
Write-Host "[6/7] Instalando dependencias do frontend..." -ForegroundColor Yellow
Set-Location ../frontend
npm install --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "  X Falha ao instalar dependencias do frontend." -ForegroundColor Red
    exit 1
}
Write-Host "  OK Dependencias do frontend instaladas" -ForegroundColor Green

# -- 7. Build do frontend --
Write-Host ""
Write-Host "[7/7] Compilando frontend..." -ForegroundColor Yellow
npx next build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  X Falha ao compilar frontend." -ForegroundColor Red
    exit 1
}
Write-Host "  OK Frontend compilado" -ForegroundColor Green

# -- Pronto! --
Set-Location $RootDir

$versionStr = "desconhecida"
if (Test-Path "version.json") {
    $versionData = Get-Content "version.json" -Raw | ConvertFrom-Json
    $versionStr = "v$($versionData.version) (build #$($versionData.build))"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Instalacao concluida com sucesso!     " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Versao: $versionStr" -ForegroundColor Blue
Write-Host ""
Write-Host "  Para iniciar o sistema:" -ForegroundColor Yellow
Write-Host ""
Write-Host "    Terminal 1 (Backend):  cd backend; npm run start:dev" -ForegroundColor Blue
Write-Host "    Terminal 2 (Frontend): cd frontend; npm run dev" -ForegroundColor Blue
Write-Host ""
Write-Host "  Acesse:" -ForegroundColor Yellow
Write-Host "    Painel Gestor:  http://localhost:3000" -ForegroundColor Blue
Write-Host "    API Health:     http://localhost:4000/health" -ForegroundColor Blue
Write-Host ""
