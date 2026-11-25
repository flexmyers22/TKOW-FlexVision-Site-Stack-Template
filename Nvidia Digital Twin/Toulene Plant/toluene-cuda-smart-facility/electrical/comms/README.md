# Electrical communication layer

Protocols and signal paths for the site power + BESS digital twin.

## Source of truth

`communication_map.json` — channels, update rates, modes.

## Modes (CTRL-001)

| Mode | Active path |
|------|-------------|
| `grid_following` | GRID → XFMR → SWGR → BUS (+ BESS optional) |
| `islanded` | GEN + BESS → BUS → loads |
| `bess_peak_shave` | MTR + LOAD-AI demand → PCS charge/discharge |
| `ai_buffer` | LOAD-AI ramp → PCS/BMS buffer |

## Safety path

```
RELAY-001 (IEC61850 GOOSE, 4 ms)
        ↓ trip
SWGR-001 isolation
        ↓
CTRL-001 fault flag → CUDA_TILE_SAFETY
```
