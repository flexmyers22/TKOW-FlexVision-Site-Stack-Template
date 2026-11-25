"""
One-shot twin refresh for Omniverse Script Editor.

Usage (with plant/usd/Site.usd open):
    exec(open(r"<project-root>/omniverse/action_graph/run_twin_refresh.py").read())
"""

from pathlib import Path

import os

import carb

ACTION_GRAPH_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = Path(os.environ.get("TKOW_PROJECT_ROOT", ACTION_GRAPH_DIR.parents[1]))
SITE_USD = PROJECT_ROOT / "plant" / "usd" / "Site.usd"
STATE_FILE = PROJECT_ROOT / "omniverse" / "runtime" / "twin_state.json"


def _ensure_site_loaded():
    import omni.usd
    ctx = omni.usd.get_context()
    stage = ctx.get_stage()
    if stage is None:
        carb.log_warn(f"[twin_refresh] opening {SITE_USD}")
        ctx.open_stage(str(SITE_USD))
        return omni.usd.get_context().get_stage()
    return stage


def run():
    import sys
    if str(ACTION_GRAPH_DIR) not in sys.path:
        sys.path.insert(0, str(ACTION_GRAPH_DIR))

    from apply_binary_state import apply_twin_state

    stage = _ensure_site_loaded()
    if stage is None:
        raise RuntimeError("Could not open USD stage")

    if not STATE_FILE.exists():
        raise FileNotFoundError(
            f"Missing {STATE_FILE}\nRun: npm run omniverse:plant"
        )

    count = apply_twin_state(STATE_FILE)
    carb.log_info(f"[twin_refresh] refreshed {count} equipment prims from {STATE_FILE.name}")
    return count


if __name__ == "__main__":
    run()
