#!/usr/bin/env bash
# First-time bootstrap for Blackwell / Linux DGX
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== TKOW Blackwell Setup ==="
echo "Project: $ROOT"

# Node.js check
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install Node 20+ first:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  exit 1
fi

echo "Node: $(node -v)"
echo "npm:  $(npm -v)"

npm install

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo ""
  echo "Created .env — add your Supabase keys, then run:"
  echo "  npm run test:connection"
  echo "  ./scripts/blackwell/omniverse-plant.sh"
else
  echo ".env exists — running connection test..."
  npm run test:connection || true
fi

# Detect Omniverse Kit
KIT=$(find "$HOME/.local/share/ov/pkg" -name kit -type f 2>/dev/null | head -1 || true)
if [[ -n "$KIT" ]]; then
  echo ""
  echo "Found Omniverse Kit: $KIT"
  echo "Add to ~/.bashrc:"
  echo "  export TKOW_PROJECT_ROOT=\"$ROOT\""
  echo "  export TKOW_KIT_PATH=\"$KIT\""
else
  echo ""
  echo "Omniverse Kit not found yet."
  echo "Install USD Composer from Omniverse Launcher, then re-run this script."
fi

chmod +x "$ROOT/scripts/blackwell/"*.sh 2>/dev/null || true

echo ""
echo "Setup complete. Next:"
echo "  1. Connect via DCV/Parsec to Blackwell desktop"
echo "  2. ./scripts/blackwell/omniverse-plant.sh"
echo "  3. ./scripts/blackwell/launch-kit.sh --refresh"
