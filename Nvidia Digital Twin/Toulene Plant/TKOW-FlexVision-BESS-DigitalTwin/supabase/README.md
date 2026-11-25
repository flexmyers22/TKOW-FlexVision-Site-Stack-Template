# Supabase

Canonical migrations live in `migrations/`. Bootstrap data lives in `seed/`.

## Apply schema

```bash
supabase db push
# or paste migrations/202607270001_initial_bess_schema.sql in SQL Editor
```

## Bootstrap seed

1. Create an Auth user in the Supabase Dashboard.
2. Copy that user's UUID.
3. In `seed/202607270002_bootstrap_flex_vision.sql`, replace `REPLACE-WITH-AUTH-USER-UUID`.
4. Run the seed in SQL Editor (or `psql`).

Creates:

- Profile: Jaylin Myers / Flex-Vision LLC
- Org: `flex-vision` (owner membership)
- Project: `TKOW-FV-BESS-DT-001`
- Assets: GRID → XFMR → SWGR → BUS → PCS / AI load; BESS → PCS + BAT-RACK → BMS; MTR
- Connections: AC power chain, DC link, BMS control, meter telemetry

Then run `seed/202607270003_qualification_test_definitions.sql` for BESS-TEST-01 … 12.

## Source of truth

`migrations/202607270001_initial_bess_schema.sql` — organizations → projects → assets → telemetry → commands/alarms/events → qualification + RLS.

The older `database/schema.sql` is a simplified draft; prefer this Supabase migration for production.
