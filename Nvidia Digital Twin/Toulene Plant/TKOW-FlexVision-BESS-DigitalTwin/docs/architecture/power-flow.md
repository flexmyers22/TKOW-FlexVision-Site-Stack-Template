# Power flow

```
GRID-001 ──► XFMR-001 ──► SWGR-001 ──► BUS-001 ──┬── LOAD-AI-001
GEN-001 ──────────────────┘            │
                                       ├── MTR-001
                                       ├── LOAD-PROCESS
                                       └── BESS-001 ◄──► PCS-001 ◄──► BAT-RACK-001
                                                                    └── BMS-001
```

Bidirectional path: BUS ↔ PCS (charge / discharge).  
Island: GEN + BESS form BUS when grid open.
