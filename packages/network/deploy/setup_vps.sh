#!/usr/bin/env bash
# ==============================================================================
# MYCA Sovereign Cognitive Infrastructure — Production VPS Provisioning Script
# Target OS: Ubuntu 22.04 / 24.04 LTS
# Designed for: bootstrap-01.mycai.pro, bootstrap-02.mycai.pro, validator-01.mycai.pro
# ==============================================================================

set -euo pipefail

echo "===================================================================="
echo "🌐 PROVISIONING MYCA PRODUCTION SOVEREIGN NODE (CHAIN ID 108)"
echo "===================================================================="

# 1. Update OS Packages
echo ">>> [1/6] Updating system packages..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git ufw fail2ban certbot build-essential

# 2. Install Node.js 20 LTS
echo ">>> [2/6] Installing Node.js 20 LTS..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node version: $(node -v)"
echo "NPM version:  $(npm -v)"

# 3. Configure Firewall (UFW)
echo ">>> [3/6] Hardening Firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP / ACME'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 4040/tcp comment 'MYCA JSON-RPC & NEXUS Dashboard'
ufw allow 50346:50360/tcp comment 'MYCA P2P Protocol & Consensus'
ufw --force enable

# 4. Clone or Sync Repository
echo ">>> [4/6] Synchronizing MYCA Codebase to /opt/myc-network..."
mkdir -p /opt/myc-network
if [ ! -d "/opt/myc-network/.git" ]; then
  # If running locally from deployment kit, copy files
  if [ -f "./server.js" ]; then
    cp -r ./* /opt/myc-network/
  else
    echo "Please clone the repository into /opt/myc-network"
  fi
fi

cd /opt/myc-network
if [ -f "package.json" ]; then
  npm install --omit=dev || true
fi

# 5. Setup Systemd Service
echo ">>> [5/6] Registering Systemd Service (myc-node.service)..."
cp /opt/myc-network/deploy/systemd/myc-node.service /etc/systemd/system/myc-node.service
systemctl daemon-reload
systemctl enable myc-node
systemctl restart myc-node

# 6. Verify Node Health
echo ">>> [6/6] Verifying Node Status..."
sleep 2
if systemctl is-active --quiet myc-node; then
  echo "✅ MYCA Node Service is RUNNING!"
  echo "RPC endpoint accessible at: http://127.0.0.1:4040/api/rpc"
  echo "NEXUS Dashboard accessible at: http://$(curl -s ifconfig.me):4040/nexus"
else
  echo "❌ Error: Node service failed to start. Logs:"
  journalctl -u myc-node -n 20 --no-pager
  exit 1
fi

echo "===================================================================="
echo "🎉 VPS PROVISIONING COMPLETED SUCCESSFULLY!"
echo "===================================================================="
