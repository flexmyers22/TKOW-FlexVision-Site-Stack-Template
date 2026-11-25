# Omniverse Action Graph — Binary → USD

Connects CUDA tile binary output to Omniverse material and visibility updates.

**Primary deployment:** Blackwell GPU server — see [BLACKWELL_SETUP.md](../BLACKWELL_SETUP.md)

## Pipeline

```
Supabase (binary_status, process_history)
        ↓
omniverse-plant.sh / npm run omniverse:plant
        ↓
omniverse/runtime/twin_state.json
        ↓
launch-kit.sh --refresh  OR  twin_refresh_extension.py
        ↓
apply_binary_state.py  →  USD prim material + AlarmPanel
```

## Blackwell (Option B)

```bash
./scripts/blackwell/omniverse-plant.sh
./scripts/blackwell/launch-kit.sh --refresh
./scripts/blackwell/install-extension.sh    # auto-poll every 2s
```

Connect via **NICE DCV** or **Parsec** to view the Omniverse viewport.

## Local / Windows fallback

```bash
npm run omniverse:plant
```

Open `plant/usd/Site.usd` in Kit, Script Editor:

```python
exec(open(r"<project-root>/omniverse/action_graph/run_twin_refresh.py").read())
```

## Alarm chain

| Step | Action |
|------|--------|
| R101 temp > 450°F | `process_history` sample |
| `omniverse:plant` | Sets `alarms: ["HIGH_TEMP:1000"]` on R101 |
| `apply_binary_state` | Red material on `R101/ReactorShell` |
| Alarm panel | `/Site/ControlRoom/AlarmPanel.activeAlarms` |

## Config

| File | Purpose |
|------|---------|
| `binary_mapping.json` | Bit → prim → material rules |
| `run_twin_refresh.py` | One-shot refresh (respects `TKOW_PROJECT_ROOT`) |
| `extension.toml` | Kit auto-poll extension |
| `../runtime/twin_state.json` | Live equipment + alarm state |

## Material states

| State | Color | Trigger |
|-------|-------|---------|
| normal | Steel gray | RUN=true, no alarms |
| alarm | Red | ALM bit or HIGH_TEMP |
| thermal | Orange emissive | HEAT bit or R101 > 450°F |
| offline | Dark gray | RUN=false |
