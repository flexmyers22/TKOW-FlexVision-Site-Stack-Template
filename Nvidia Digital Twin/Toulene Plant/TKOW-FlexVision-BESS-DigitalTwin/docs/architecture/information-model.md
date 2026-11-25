# Information model

Canonical data hierarchy for the FlexVision BESS digital twin.

```
Organizations
    ↓
Projects
    ↓
Assets and electrical connections
    ↓
Telemetry and operating states
    ↓
Commands, alarms, and events
    ↓
Qualification tests and evidence
```

## Layer 1 — Organizations

| Field | Example |
|-------|---------|
| `org_id` | `ORG-TKOW` |
| `name` | The Tech King of Wakanada / Flex-Vision |

Owns one or more projects.

## Layer 2 — Projects

| Field | Example |
|-------|---------|
| `project_id` | `TKOW-FV-BESS-DT-001` |
| `org_id` | `ORG-TKOW` |
| `qualification_boundary` | `ac_terminals_pcs_inclusive` |

A project scopes assets, telemetry, alarms, and tests.

## Layer 3 — Assets and electrical connections

**Assets:** GRID-001, XFMR-001, SWGR-001, BUS-001, BESS-001, PCS-001, BAT-RACK-001, BMS-001, MTR-001, GEN-001, LOAD-AI-001, RELAY-001, CTRL-001

**Connections:** directed power / control edges (`ac_feed`, `dc_link`, `dispatch`, `trip`, …)

Stored in `assets`, `asset_connections` (see `database/schema.sql`).

## Layer 4 — Telemetry and operating states

Time-series and latest snapshots: P, Q, V, I, f, SOC, `binary_status`, `control_mode`, `operating_state`.

Tables: `telemetry_samples`, `operating_states` (+ `bess_runtime` / `pcs_runtime` convenience views).

## Layer 5 — Commands, alarms, and events

| Kind | Examples |
|------|----------|
| Commands | charge, discharge, island, set_kw (CTRL → PCS/GEN/BESS) |
| Alarms | WARN, TRIP, oscillation HUNTING/UNSTABLE |
| Events | mode change, breaker open, oscillation class |

Tables: `commands`, `alarms`, `events` (+ `electrical_oscillation_events`).

## Layer 6 — Qualification tests and evidence

Mapped scenarios under `simulation/` → results in `qualification_tests` / `qualification_evidence` → files in `data/test_results/`.

See `docs/requirements/qualification-test-map.md`.
