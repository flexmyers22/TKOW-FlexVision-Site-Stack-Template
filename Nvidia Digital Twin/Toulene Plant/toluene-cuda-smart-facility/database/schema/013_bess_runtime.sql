-- 013_bess_runtime.sql
-- BESS digital-twin runtime (qualification boundary: AC terminals, PCS-inclusive)

create table if not exists bess_runtime (
  id uuid primary key default uuid_generate_v4(),
  asset_id text not null unique default 'BESS-001',
  project_id text not null default 'TKOW-FV-BESS-DT-001',
  asset_type text not null default 'battery_energy_storage_system',
  qualification_boundary text not null default 'ac_terminals_pcs_inclusive',
  operating_mode text not null default 'standby',
  rated_power_mw numeric,
  rated_energy_mwh numeric,
  ac_voltage_v numeric,
  frequency_hz numeric default 60,
  state_of_charge_pct numeric,
  active_power_mw numeric default 0,
  reactive_power_mvar numeric default 0,
  current_a numeric default 0,
  current_limit_active boolean default false,
  grid_connected boolean default true,
  island_capable boolean default true,
  black_start_capable boolean default true,
  telemetry_status text default 'not_connected',
  binary_status text default '00000000',
  cuda_tile text default 'CUDA_TILE_ENERGY',
  metadata jsonb default '{}',
  updated_at timestamptz default now()
);

create index if not exists idx_bess_runtime_mode on bess_runtime(operating_mode);
create index if not exists idx_bess_runtime_telemetry on bess_runtime(telemetry_status);
