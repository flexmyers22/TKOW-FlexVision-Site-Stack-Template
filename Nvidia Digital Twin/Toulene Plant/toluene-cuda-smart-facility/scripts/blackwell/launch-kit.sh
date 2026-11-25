#!/usr/bin/env bash
# Launch Omniverse Kit with Site.usd on Blackwell (Linux)
# Usage:
#   ./scripts/blackwell/launch-kit.sh              # open Site.usd
#   ./scripts/blackwell/launch-kit.sh --refresh    # open + apply twin_state materials
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export TKOW_PROJECT_ROOT="${TKOW_PROJECT_ROOT:-$ROOT}"

SITE_USD="$TKOW_PROJECT_ROOT/plant/usd/Site.usd"
REFRESH_PY="$TKOW_PROJECT_ROOT/omniverse/action_graph/run_twin_refresh.py"
TWIN_STATE="$TKOW_PROJECT_ROOT/omniverse/runtime/twin_state.json"

REFRESH=false
if [[ "${1:-}" == "--refresh" ]]; then
  REFRESH=true
fi

if [[ ! -f "$SITE_USD" ]]; then
  echo "Missing $SITE_USD"
  exit 1
fi

if $REFRESH && [[ ! -f "$TWIN_STATE" ]]; then
  echo "Missing $TWIN_STATE — run omniverse-plant.sh first"
  exit 1
fi

# Resolve Kit binary
find_kit() {
  if [[ -n "${TKOW_KIT_PATH:-}" && -x "$TKOW_KIT_PATH" ]]; then
    echo "$TKOW_KIT_PATH"
    return
  fi
  local found
  found=$(find "$HOME/.local/share/ov/pkg" -name kit -type f 2>/dev/null | sort -V | tail -1 || true)
  if [[ -n "$found" ]]; then
    echo "$found"
    return
  fi
  if command -v kit >/dev/null 2>&1; then
    command -v kit
    return
  fi
  return 1
}

KIT=$(find_kit) || {
  echo "Omniverse Kit not found."
  echo "Install USD Composer via Omniverse Launcher, or set:"
  echo "  export TKOW_KIT_PATH=/path/to/kit"
  exit 1
}

KIT_DIR="$(dirname "$KIT")"
echo "Kit:      $KIT"
echo "Scene:    $SITE_USD"

# USD Composer / Create app kit file
APP_KIT=""
for candidate in \
  "$KIT_DIR/apps/omni.create.kit" \
  "$KIT_DIR/apps/omni.app.editor.base.kit" \
  "$KIT_DIR/apps/omni.usd_composer.kit"; do
  if [[ -f "$candidate" ]]; then
    APP_KIT="$candidate"
    break
  fi
done

if [[ -z "$APP_KIT" ]]; then
  # Fallback: pass .usd directly (Launcher association)
  echo "Opening Site.usd via Kit..."
  exec "$KIT" "$SITE_USD"
fi

echo "App:      $APP_KIT"

if $REFRESH; then
  EXEC_SNIPPET="exec(open('${REFRESH_PY}').read())"
  echo "Refresh:  twin_state.json → USD materials"
  exec "$KIT" "$APP_KIT" \
    "--/app/file/open=${SITE_USD}" \
    "--exec" "$EXEC_SNIPPET"
else
  exec "$KIT" "$APP_KIT" "--/app/file/open=${SITE_USD}"
fi
