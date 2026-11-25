-- 014_pcs_runtime.sql
-- PCS-001 telemetry / digital-twin runtime (parent: BESS-001)

create table if not exists pcs_runtime (
  id uuid primary key default uuid_generate_v4(),
  timestamp timestamptz not null default now(),
  asset_id text not null default 'PCS-001',
  project_id text default 'TKOW-FV-BESS-DT-001',
  voltage_v numeric,
  current_a numeric,
  active_power_kw numeric,
  reactive_power_kvar numeric,
  frequency_hz numeric,
  soc_pct numeric,
  pcs_temperature_c numeric,
  current_limit boolean default false,
  control_mode text,
  operating_state text,
  alarm_code text,
  binary_status text default '00000000',
  cuda_tile text default 'CUDA_TILE_ENERGY',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_pcs_runtime_asset_ts on pcs_runtime(asset_id, timestamp desc);
create index if not exists idx_pcs_runtime_state on pcs_runtime(operating_state);

-- Latest snapshot view helper (one row per asset)
create table if not exists pcs_runtime_latest (
  asset_id text primary key default 'PCS-001',
  timestamp timestamptz not null,
  voltage_v numeric,
  current_a numeric,
  active_power_kw numeric,
  reactive_power_kvar numeric,
  frequency_hz numeric,
  soc_pct numeric,
  pcs_temperature_c numeric,
  current_limit boolean default false,
  control_mode text,
  operating_state text,
  alarm_code text,
  binary_status text,
  updated_at timestamptz default now()
);
