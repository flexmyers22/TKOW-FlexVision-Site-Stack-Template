# Telemetry map

| Asset | Key signals | Rate |
|-------|-------------|------|
| PCS-001 | V, I, P, Q, f, SOC, temp, control_mode, binary | 50–200 ms |
| BESS-001 | available_kW, SOC, state, binary | 100 ms |
| BMS-001 | SOC, SOH, cell V, temp, contactor | 100 ms (CAN) |
| MTR-001 | V, I, P, Q, PF, energy | 200 ms |
| GRID-001 | V, f, P_import, Q | 1 s |
| LOAD-AI-001 | P, ramp, forecast | 100 ms |

Binary word shared BESS/PCS bit map — see `digital_twin/control_models/bess-binary-map.json`.
