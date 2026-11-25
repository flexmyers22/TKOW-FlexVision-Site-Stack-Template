# Qualification test map

Boundary: **ac_terminals_pcs_inclusive**

| Test ID | Scenario | Folder | Pass criteria |
|---------|----------|--------|---------------|
| QT-GC-01 | Grid connected standby | `simulation/grid_connected/` | STABLE, binary TELEM+GRID |
| QT-IS-01 | Island transition | `simulation/islanded/` | ISLAND bit, frequency hold |
| QT-BS-01 | Black start | `simulation/black_start/` | Form bus without grid |
| QT-AI-01 | AI load ramp | `simulation/ai_load_ramps/` | Peak-shave, no TRIP |
| QT-CL-01 | Current limit | `simulation/current_limit/` | I_LIMIT bit, P curtail |
| QT-OSC-01 | Oscillation suite | `backend` analyze | STABLE/RINGING/HUNTING/UNSTABLE correct |

Results → `data/test_results/`.
