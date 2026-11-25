# System boundary

**Project:** TKOW-FV-BESS-DT-001  
**Qualification boundary:** `ac_terminals_pcs_inclusive`

## Inside the twin

- GRID → XFMR → SWGR → BUS → BESS (PCS + rack + BMS)
- GEN, MTR, LOAD-AI, RELAY, CTRL
- Telemetry, binary status, oscillation classifier
- Dispatch modes and simulation scenarios

## Outside / interface

- Utility grid beyond GRID-001 POI
- Process MCC loads (referenced as LOAD-PROCESS; detailed in toluene plant twin)
- Omniverse rendering (optional consumer)

## PCS-inclusive

Performance and qualification measurements include the AC terminals of **PCS-001**.
