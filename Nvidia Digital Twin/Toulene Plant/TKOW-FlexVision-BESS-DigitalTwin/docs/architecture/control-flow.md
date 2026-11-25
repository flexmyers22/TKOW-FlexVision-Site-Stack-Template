# Control flow

```
Sensors / PCS / BMS
        ↓
CTRL-001 (site controller)
        ↓ MQTT dispatch
PCS-001 / GEN-001 / BESS-001 / SWGR-001
        ↓
Binary status + operating modes
        ↓
Alarms (WARN / TRIP) + UI
```

Modes: `grid_following` · `islanded` · `black_start` · `bess_peak_shave` · `ai_buffer`

RELAY-001 GOOSE trip → SWGR-001 (safety path, not blocked by CTRL).
