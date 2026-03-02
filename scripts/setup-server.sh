#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Setup inicial do servidor — Tecnikos SaaS
#  Rodar como root no servidor Hetzner (Ubuntu 22.04/24.04)
#  Uso: curl -sSL <url> | bash  OU  bash setup-server.sh
# ═══════════════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════"
echo "  Tecnikos — Setup do Servidor"
echo "═══════════════════════════════════════"

# ── Verificar se e root ─────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  echo "❌ Execute como root: sudo bash setup-server.sh"
  exit 1
fi

# ── 1. Atualizar sistema ────────────────────────────────────
echo ""
echo "📦 [1/7] Atualizando sistema..."
apt update && apt upgrade -y

# ── 2. Instalar dependencias basicas ────────────────────────
echo ""
echo "🔧 [2/7] Instalando dependencias..."
apt install -y \
  curl \
  wget \
  git \
  unzip \
  htop \
  nano \
  ufw \
  fail2ban \
  logrotate

# ── 3. Instalar Docker + Docker Compose ─────────────────────
echo ""
echo "🐳 [3/7] Instalando Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "  ✅ Docker instalado"
else
  echo "  ✅ Docker ja instalado"
fi

# Verificar Docker Compose (vem incluido no Docker moderno)
docker compose version

# ── 4. Configurar Firewall (UFW) ────────────────────────────
echo ""
echo "🔒 [4/7] Configurando firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
echo "  ✅ Firewall ativo (SSH + HTTP + HTTPS)"

# ── 5. Configurar Fail2Ban ──────────────────────────────────
echo ""
echo "🛡️  [5/7] Configurando Fail2Ban..."
cat > /etc/fail2ban/jail.local <<'JAIL'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port    = ssh
logpath = /var/log/auth.log
maxretry = 3
bantime  = 7200
JAIL

systemctl enable fail2ban
systemctl restart fail2ban
echo "  ✅ Fail2Ban configurado (SSH protegido)"

# ── 6. Configurar Swap (importante para 4-8GB RAM) ──────────
echo ""
echo "💾 [6/7] Configurando swap..."
if [ ! -f /swapfile ]; then
  # Criar swap de 4GB
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Otimizar swappiness para servidor
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
  echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.conf
  sysctl -p
  echo "  ✅ Swap de 4GB configurado"
else
  echo "  ✅ Swap ja existe"
fi

# ── 7. Configurar timezone e locale ─────────────────────────
echo ""
echo "🕐 [7/7] Configurando timezone..."
timedatectl set-timezone America/Sao_Paulo
echo "  ✅ Timezone: America/Sao_Paulo"

# ── Criar usuario deploy (opcional) ─────────────────────────
echo ""
read -p "Criar usuario 'deploy' para gerenciar a aplicacao? (s/n): " CREATE_USER
if [ "$CREATE_USER" = "s" ]; then
  if ! id "deploy" &>/dev/null; then
    adduser --disabled-password --gecos "" deploy
    usermod -aG docker deploy
    usermod -aG sudo deploy
    mkdir -p /home/deploy/.ssh
    cp /root/.ssh/authorized_keys /home/deploy/.ssh/ 2>/dev/null || true
    chown -R deploy:deploy /home/deploy/.ssh
    chmod 700 /home/deploy/.ssh
    echo "  ✅ Usuario 'deploy' criado com acesso Docker"
  else
    echo "  ✅ Usuario 'deploy' ja existe"
  fi
fi

# ── Criar diretorio da aplicacao ─────────────────────────────
echo ""
echo "📁 Criando diretorio da aplicacao..."
mkdir -p /opt/tecnikos
mkdir -p /opt/tecnikos/backups
chown -R ${SUDO_USER:-root}:${SUDO_USER:-root} /opt/tecnikos 2>/dev/null || true
echo "  ✅ /opt/tecnikos criado"

# ── Resumo ───────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════"
echo "✅ Setup concluido!"
echo "═══════════════════════════════════════"
echo ""
echo "📋 Proximos passos:"
echo "  1. Apontar DNS de tecnikos.com.br para este servidor"
echo "  2. Clonar repositorio em /opt/tecnikos"
echo "     git clone <repo-url> /opt/tecnikos/app"
echo "  3. Configurar .env.production"
echo "     cp .env.production.example .env.production"
echo "     nano .env.production"
echo "  4. Rodar deploy"
echo "     bash scripts/deploy-production.sh"
echo ""
echo "🔍 Info do servidor:"
echo "  IP:     $(curl -s ifconfig.me)"
echo "  RAM:    $(free -h | awk '/Mem:/{print $2}')"
echo "  Disco:  $(df -h / | awk 'NR==2{print $2}')"
echo "  Docker: $(docker --version)"
echo "═══════════════════════════════════════"
