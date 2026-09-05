#!/usr/bin/env bash
# ==============================================================================
# MYCA Sovereign Edge Node — Rock-Solid Universal 1-Line Installer
# "Her node kendi cihazında çalışır — Sıfır merkezi sunucu"
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "===================================================================="
echo "   Ψ MYCA SOVEREIGN NODE — 1-CLICK UNIVERSAL INSTALLER"
echo "   Decentralized Colony Edge Runtime (Chain ID 108)"
echo "===================================================================="
echo -e "${NC}"

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$ARCH" in
  x86_64) ARCH_NODE="x64" ;;
  arm64|aarch64) ARCH_NODE="arm64" ;;
  *) ARCH_NODE="x64" ;;
esac

INSTALL_DIR="$HOME/.myca"
RUNTIME_DIR="$INSTALL_DIR/runtime"
BIN_DIR="$HOME/.local/bin"

mkdir -p "$INSTALL_DIR"
mkdir -p "$RUNTIME_DIR"
mkdir -p "$BIN_DIR"

# ------------------------------------------------------------------------------
# STEP 1: Verify or Automatically Install Node.js (v20 LTS Portable)
# ------------------------------------------------------------------------------
echo -e "${YELLOW}>>> [1/4] Checking Node.js runtime environment...${NC}"

NODE_CMD="node"
NEED_NODE=false

if ! command -v node >/dev/null 2>&1; then
  NEED_NODE=true
else
  NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VER" -lt 18 ]; then
    echo -e "   ⚠️ System Node.js is too old (v${NODE_VER}). Installing portable Node.js 20 LTS..."
    NEED_NODE=true
  fi
fi

if [ "$NEED_NODE" = true ]; then
  NODE_PORTABLE_DIR="$INSTALL_DIR/nodejs"
  if [ ! -x "$NODE_PORTABLE_DIR/bin/node" ]; then
    echo -e "   📦 Downloading portable Node.js 20 LTS for ${OS} (${ARCH_NODE})..."
    mkdir -p "$NODE_PORTABLE_DIR"

    if [ "$OS" = "Darwin" ]; then
      NODE_TARBALL="node-v20.17.0-darwin-${ARCH_NODE}.tar.gz"
    else
      NODE_TARBALL="node-v20.17.0-linux-${ARCH_NODE}.tar.gz"
    fi

    NODE_URL="https://nodejs.org/dist/v20.17.0/${NODE_TARBALL}"
    curl -fsSL "$NODE_URL" | tar -xz -C "$NODE_PORTABLE_DIR" --strip-components=1
  fi
  NODE_CMD="$NODE_PORTABLE_DIR/bin/node"
  export PATH="$NODE_PORTABLE_DIR/bin:$PATH"
  echo -e "   ${GREEN}✅ Portable Node.js ready: $($NODE_CMD -v)${NC}"
else
  echo -e "   ${GREEN}✅ Verified active Node.js: $(node -v)${NC}"
fi

# ------------------------------------------------------------------------------
# STEP 2: Download & Extract MYCA Sovereign Core Runtime
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}>>> [2/4] Fetching MYCA Sovereign Core Runtime...${NC}"

# Source priority: Local repository directory -> Local server daemon -> Online CDN
LOCAL_SRC="${BASH_SOURCE[0]:-}"
if [ -n "$LOCAL_SRC" ] && [ -f "$LOCAL_SRC" ]; then
  LOCAL_DIR="$(cd "$(dirname "$LOCAL_SRC")" && pwd)"
else
  LOCAL_DIR=""
fi

if [ -n "$LOCAL_DIR" ] && [ -f "$LOCAL_DIR/bin/myc-node.js" ] && [ "$LOCAL_DIR" != "$RUNTIME_DIR" ]; then
  echo "   📁 Synchronizing from local workspace..."
  cp -r "$LOCAL_DIR"/* "$RUNTIME_DIR/"
elif [ -f "$LOCAL_DIR/dist/myc-network-latest.tar.gz" ]; then
  echo "   📦 Unpacking local distribution bundle..."
  tar -xzf "$LOCAL_DIR/dist/myc-network-latest.tar.gz" -C "$RUNTIME_DIR"
else
  echo "   🌐 Fetching distribution bundle..."
  # Try local server port 4040 first if active, else public domain
  if curl -s -f "http://127.0.0.1:4040/dist/myc-network-latest.tar.gz" -o "$INSTALL_DIR/myc-bundle.tar.gz"; then
    tar -xzf "$INSTALL_DIR/myc-bundle.tar.gz" -C "$RUNTIME_DIR"
    rm -f "$INSTALL_DIR/myc-bundle.tar.gz"
  else
    echo "   ⚠️ Downloading from canonical edge repository..."
    curl -sSL "https://mycai.pro/dist/myc-network-latest.tar.gz" 2>/dev/null | tar -xz -C "$RUNTIME_DIR" || {
      # Git fallback if bundle not reachable
      git clone --depth 1 https://github.com/myc-network/myc-network.git "$RUNTIME_DIR" --quiet || true
    }
  fi
fi

# ------------------------------------------------------------------------------
# STEP 3: Setup PATH, Permissions & CLI Symlink
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}>>> [3/4] Configuring CLI Binary & Shell Environment...${NC}"

chmod +x "$RUNTIME_DIR/bin/myc-node.js"

# Create launcher wrapper in $BIN_DIR/myc-node
cat << EOF > "$BIN_DIR/myc-node"
#!/usr/bin/env bash
export PATH="$INSTALL_DIR/nodejs/bin:\$PATH"
exec "$NODE_CMD" "$RUNTIME_DIR/bin/myc-node.js" "\$@"
EOF
chmod +x "$BIN_DIR/myc-node"

# Update PATH in shell profiles if needed
SHELL_PROFILE=""
if [ -f "$HOME/.zshrc" ]; then
  SHELL_PROFILE="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
  SHELL_PROFILE="$HOME/.bashrc"
elif [ -f "$HOME/.profile" ]; then
  SHELL_PROFILE="$HOME/.profile"
fi

if [ -n "$SHELL_PROFILE" ]; then
  if ! grep -q "\$HOME/.local/bin" "$SHELL_PROFILE" 2>/dev/null; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_PROFILE"
  fi
fi

echo -e "   ${GREEN}✅ CLI binary linked: $BIN_DIR/myc-node${NC}"

# ------------------------------------------------------------------------------
# STEP 4: Verification & Readiness Confirmation
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}>>> [4/4] Verifying Sovereign Node Configuration...${NC}"

if "$BIN_DIR/myc-node" help >/dev/null 2>&1; then
  echo -e "   ${GREEN}✅ Node runtime verification successful!${NC}"
fi

echo -e "\n${CYAN}===================================================================="
echo -e "   🎉 MYCA SOVEREIGN NODE KURULUMU EKSİKSİZ TAMAMLANDI!"
echo -e "====================================================================${NC}"
echo -e "Ağınıza hemen katılmak ve Web3 NEXUS Portalını açmak için:"
echo -e "\n   ${GREEN}myc-node start${NC}\n"
echo -e "veya doğrudan:"
echo -e "   ${GREEN}$BIN_DIR/myc-node start${NC}\n"
echo -e "Web Portalı : ${CYAN}http://localhost:4040/nexus${NC}"
echo -e "P2P Mesh    : ${CYAN}Port 50346 (Auto mDNS + WAN Colony Discovery)${NC}"
echo -e "====================================================================\n"
