# Safety boundary

- **RELAY-001** trip / ESD is independent of CTRL-001 dispatch (IEC61850 GOOSE).
- Binary **TRIP** (bit 7) forces PCS to safe state; UI cannot clear without reset procedure.
- **WARN** (bit 6) from HUNTING / UNSTABLE oscillation — freeze aggressive dispatch.
- Island and black-start only when interlocking permits (SWGR status + BMS contactor).
- Do not bypass current limit for AI load buffer scenarios.
