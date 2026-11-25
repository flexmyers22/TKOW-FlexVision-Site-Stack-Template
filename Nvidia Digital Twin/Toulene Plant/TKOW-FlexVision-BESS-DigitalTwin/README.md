# TKOW FlexVision BESS Digital Twin

Project ID: **TKOW-FV-BESS-DT-001**

Battery energy storage digital twin with PCS control, site power topology, oscillation diagnostics, and qualification testing.

Qualification boundary: **AC terminals, PCS-inclusive**.

## Database

Canonical schema: **`supabase/migrations/202607270001_initial_bess_schema.sql`**

```
Organizations → Projects → Assets/Connections → Telemetry/State
→ Commands/Alarms/Events → Oscillation → Qualification + Evidence
```

(with enums, RLS, and `auth.users` membership)

Legacy draft: `database/schema.sql` (simpler, no auth RLS).

## Stack

| Layer | Path |
|-------|------|
| Frontend | `frontend/` — ops UI (Overview, Power Flow, Battery, PCS, Oscillation, Tests, Alarms) |
| Backend | `backend/` — telemetry, controls, oscillation, alarms API |
| Database | `database/` — schema, migrations, seed, RLS policies |
| Digital twin | `digital_twin/` — assets, topology, electrical & control models |
| Protocols | `protocols/` — Modbus, MQTT, OPC UA adapters |
| Simulation | `simulation/` — grid / island / black-start / AI load / current limit |

## Quick start

```bash
cp .env.example .env
npm install
npm run dev          # backend + frontend (workspace)
```

```bash
npm run analyze      # oscillation pipeline → STABLE|RINGING|HUNTING|UNSTABLE
```

## Power path

```
GRID-001 → XFMR-001 → SWGR-001 → BUS-001 → BESS-001
                                           ├── PCS-001
                                           ├── BAT-RACK-001
                                           └── BMS-001
CTRL-001 (dispatch)    RELAY-001 (protection)
```

## Binary status (BESS / PCS)

| Bit | Mask | Meaning |
|-----|------|---------|
| 0 | `00000001` | Telemetry active |
| 1 | `00000010` | Grid connected |
| 2 | `00000100` | Charging |
| 3 | `00001000` | Discharging |
| 4 | `00010000` | Current limit |
| 5 | `00100000` | Island mode |
| 6 | `01000000` | Warning |
| 7 | `10000000` | Trip / ESD |

## Related

Sister plant digital twin: `../toluene-cuda-smart-facility` (process + CUDA tiles + Omniverse).
