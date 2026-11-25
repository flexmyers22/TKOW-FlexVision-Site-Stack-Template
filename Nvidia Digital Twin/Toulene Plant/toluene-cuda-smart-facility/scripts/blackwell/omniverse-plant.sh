#!/usr/bin/env bash
# Run full Omniverse plant pipeline on Blackwell (Linux)
# Usage: ./scripts/blackwell/omniverse-plant.sh [--tank-level N]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export TKOW_PROJECT_ROOT="${TKOW_PROJECT_ROOT:-$ROOT}"

echo ""
echo "=== TKOW Omniverse Plant (Blackwell) ==="
echo "Project: $TKOW_PROJECT_ROOT"
echo ""

ARGS=()
if [[ "${1:-}" == "--tank-level" && -n "${2:-}" ]]; then
  ARGS=(-- --tank-level "$2")
fi

npm run omniverse:plant "${ARGS[@]}"

TWIN="$TKOW_PROJECT_ROOT/omniverse/runtime/twin_state.json"
SITE="$TKOW_PROJECT_ROOT/plant/usd/Site.usd"

echo ""
echo "--- Omniverse (Option B) ---"
echo "Twin state: $TWIN"
echo "USD scene:  $SITE"
echo ""
echo "Connect via DCV/Parsec, then run:"
echo "  $TKOW_PROJECT_ROOT/scripts/blackwell/launch-kit.sh --refresh"
echo ""
