"""
Omniverse Kit extension — polls twin_state.json and refreshes USD materials.

Install: copy omniverse/ into your Kit extension search path, or run apply_binary_state.py
from Script Editor after `npm run omniverse:sync`.
"""

import asyncio
import carb
import omni.ext
import omni.kit.app
from pathlib import Path

from .apply_binary_state import STATE_PATH, apply_twin_state


class TwinRefreshExtension(omni.ext.IExt):
    def on_startup(self, ext_id: str):
        self._sub = None
        self._poll_seconds = 2.0
        carb.log_info("[twin_refresh] extension started")
        asyncio.ensure_future(self._poll_loop())

    def on_shutdown(self):
        carb.log_info("[twin_refresh] extension stopped")

    async def _poll_loop(self):
        app = omni.kit.app.get_app()
        last_mtime = 0.0
        while True:
            await app.next_update_async()
            if STATE_PATH.exists():
                mtime = STATE_PATH.stat().st_mtime
                if mtime > last_mtime:
                    last_mtime = mtime
                    try:
                        apply_twin_state()
                    except Exception as exc:
                        carb.log_error(f"[twin_refresh] {exc}")
            await asyncio.sleep(self._poll_seconds)


def manual_refresh():
    """Call from Omniverse Script Editor."""
    return apply_twin_state()
