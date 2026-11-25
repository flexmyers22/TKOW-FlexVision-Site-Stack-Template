# Electrical Digital Twin — BESS Architecture + Communication

Site power, battery storage, and plant MCC loads as digital-twin assets with a live communication map.

## Asset registry

| Asset ID | Asset type | Primary function |
|----------|------------|------------------|
| `GRID-001` | Utility grid | External voltage and frequency source |
| `XFMR-001` | Site transformer | Voltage transformation |
| `SWGR-001` | Main switchgear | Isolation and protection |
| `BUS-001` | Site AC bus | Common electrical connection |
| `BESS-001` | Battery-energy-storage system | Complete storage asset |
| `PCS-001` | Power-conversion system | Bidirectional AC/DC control |
| `BAT-RACK-001` | Battery rack | Energy storage |
| `BMS-001` | Battery-management system | Battery monitoring and protection |
| `MTR-001` | Electrical meter | Independent measurement |
| `GEN-001` | Generator | Onsite generation |
| `LOAD-AI-001` | AI compute load | Rapid transient electrical demand |
| `RELAY-001` | Protection relay | Fault detection and trip logic |
| `CTRL-001` | Site controller | Supervisory dispatch and mode control |

Plus `LOAD-PROCESS` → MCC-1/MCC-2 → toluene equipment (P101…C103).

## Power topology

```
GRID-001 ──► XFMR-001 ──► SWGR-001 ──► BUS-001 ──┬── LOAD-AI-001
GEN-001 ─────────────────────┘          │
                                        ├── LOAD-PROCESS (MCC)
                                        ├── MTR-001
                                        └── BESS-001
                                              ├── PCS-001  (AC↔DC)
                                              ├── BAT-RACK-001
                                              └── BMS-001

RELAY-001 ──trip──► SWGR-001
CTRL-001 ──dispatch──► PCS-001 / GEN-001 / BESS-001
```

## BESS-001 runtime (project `TKOW-FV-BESS-DT-001`)

Qualification boundary: **AC terminals, PCS-inclusive**.

| Field | Current |
|-------|---------|
| `operating_mode` | `standby` |
| `telemetry_status` | `not_connected` |
| `binary_status` | `00000000` |
| `frequency_hz` | 60 |
| `active_power_mw` | 0 |
| `grid_connected` | true |
| `island_capable` / `black_start_capable` | true |
| Ratings / SOC / `ac_voltage_v` | null (pending nameplate + BMS) |

```bash
npm run bess:sync
```

Binary bits (LSB = bit 0):

| Bit | Mask | Code | Meaning |
|-----|------|------|---------|
| 0 | `00000001` | TELEM | Telemetry active |
| 1 | `00000010` | GRID | Grid connected |
| 2 | `00000100` | CHARGE | Battery charging |
| 3 | `00001000` | DISCHARGE | Battery discharging |
| 4 | `00010000` | I_LIMIT | Current limit active |
| 5 | `00100000` | ISLAND | Island mode active |
| 6 | `01000000` | WARN | Warning present |
| 7 | `10000000` | TRIP | Trip or emergency shutdown |

See `src/types/bess.ts`.

## PCS-001 telemetry (sample `2026-07-27T10:00:00-04:00`)

| Field | Value |
|-------|--------|
| `control_mode` | `grid_following` |
| `operating_state` | `standby` |
| `voltage_v` | 480 |
| `P / Q / I` | 0 / 0 / 0 |
| `soc_pct` | 50 |
| `binary_status` | `00000011` (TELEM + GRID) |

```bash
npm run pcs:sync
```

## Communication layer

See `comms/communication_map.json`.

| Bus | Protocol | Assets |
|-----|----------|--------|
| SCADA `10.20.1.0/24` | DNP3 / IEC61850 | GRID, XFMR, SWGR, RELAY, MTR, GEN |
| BESS `10.20.2.0/24` | ModbusTCP + CAN | BESS, PCS, BAT-RACK, BMS |
| AI load `10.20.3.0/24` | ModbusTCP | LOAD-AI-001 |
| Dispatch | MQTT | CTRL-001 → setpoints |

### Pipeline

```
Field asset (Modbus / IEC61850 / CAN / DNP3)
        ↓
CTRL-001 site controller
        ↓
electrical_dt_assets + electrical_comm_channels
        ↓
CUDA_TILE_ELECTRICAL / ENERGY / SAFETY
        ↓
USD ElectricalSubstation
        ↓
Omniverse digital twin
```

## Oscillation / transient classes

| Class | Description | Severity |
|-------|-------------|----------|
| Normal electrical oscillation | 60 Hz voltage/current waveform | normal |
| Normal transient | Brief, decaying response after a load change | normal |
| Ringing | Short oscillation that decreases with time | watch |
| Sustained oscillation | Oscillation that does not decay | alarm → WARN |
| Control hunting | Repeated switching between control modes | alarm → WARN |
| Mechanical vibration | Fans, pumps, bearings, or motors | watch |

See `electrical/diagnostics/` and `src/types/oscillation.ts`.

```bash
npm run oscillation:demo
npm run oscillation:analyze   # P,Q,V,I,f pipeline → STABLE|RINGING|HUNTING|UNSTABLE
```

## Database

| Schema | Tables |
|--------|--------|
| `011_site_power_system.sql` | `site_power_nodes`, `site_power_connections` |
| `012_electrical_dt_assets.sql` | `electrical_dt_assets`, `electrical_comm_channels` |
| `010_electrical_assets.sql` | MCC breakers (`power_node_tag` → LOAD-PROCESS) |

Seeds: `database/seeds/electrical_dt_assets_seed.sql`

## Files

```
electrical/
├── README.md
├── topology.json                 # asset registry + power graph
├── site_power_state.json         # runtime snapshot (generated)
├── assets/                       # per-asset twin JSON (generated)
├── diagnostics/
│   ├── oscillation_taxonomy.json
│   └── README.md
├── comms/
│   └── communication_map.json    # protocols, signals, modes
└── usd/
    ├── ElectricalSubstation.usd
    ├── BESS.usd
    └── PCS.usd
```

## Commands

```bash
npm run electrical:sync   # full site power + assets
npm run bess:sync         # BESS-001 runtime snapshot
npm run pcs:sync          # PCS-001 telemetry snapshot
```

Writes `site_power_state.json`, `bess_runtime_state.json`, `pcs_runtime_state.json`, and `electrical/assets/<ASSET-ID>.json`.
