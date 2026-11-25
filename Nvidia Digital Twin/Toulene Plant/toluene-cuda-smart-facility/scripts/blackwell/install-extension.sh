#!/usr/bin/env bash
# Install TKOW twin refresh extension into Omniverse Kit
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export TKOW_PROJECT_ROOT="${TKOW_PROJECT_ROOT:-$ROOT}"

SRC="$TKOW_PROJECT_ROOT/omniverse/action_graph"
EXT_NAME="toluene_twin_refresh"

# Common Kit extension paths (USD Composer / Create)
SEARCH_DIRS=(
  "$HOME/.local/share/ov/data/Kit/USD Composer"/*/exts
  "$HOME/.local/share/ov/data/Kit/Create"/*/exts
  "$HOME/.local/share/ov/data/Kit/kit"/*/exts
)

EXT_BASE=""
for pattern in "${SEARCH_DIRS[@]}"; do
  for dir in $pattern; do
    if [[ -d "$dir" ]]; then
      EXT_BASE="$dir"
      break 2
    fi
  done
done

if [[ -z "$EXT_BASE" ]]; then
  echo "Kit extensions directory not found."
  echo "Launch USD Composer once, then re-run this script."
  exit 1
fi

DEST="$EXT_BASE/$EXT_NAME"
mkdir -p "$DEST"

cp "$SRC/extension.toml" "$DEST/"
cp "$SRC/apply_binary_state.py" "$DEST/"
cp "$SRC/run_twin_refresh.py" "$DEST/"
cp "$SRC/twin_refresh_extension.py" "$DEST/"
cp "$SRC/binary_mapping.json" "$DEST/"

echo "Installed extension → $DEST"
echo ""
echo "In Omniverse: Window → Extensions → search 'TKOW Toluene Twin Refresh' → Enable"
echo "Extension polls: $TKOW_PROJECT_ROOT/omniverse/runtime/twin_state.json every 2s"
