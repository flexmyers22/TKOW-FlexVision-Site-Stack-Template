-- Information model schema
-- Organizations → Projects → Assets/Connections → Telemetry/States → Commands/Alarms/Events → Qualification

create extension if not exists "uuid-ossp";

-- 1. Organizations
create table if not exists organizations (
  org_id text primary key,
  name text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- 2. Projects
create table if not exists projects (
  project_id text primary key,
  org_id text not null references organizations(org_id),
  name text not null,
  qualification_boundary text default 'ac_terminals_pcs_inclusive',
  status text default 'active',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- 3. Assets and electrical connections
create table if not exists assets (
  asset_id text primary key,
  project_id text not null references projects(project_id),
  asset_type text not null,
  primary_function text,
  parent_asset_id text references assets(asset_id),
  cuda_tile text,
  usd_prim text,
  protocol text,
  endpoint text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists asset_connections (
  id uuid primary key default uuid_generate_v4(),
  project_id text not null references projects(project_id),
  source_asset_id text not null references assets(asset_id),
  target_asset_id text not null references assets(asset_id),
  connection_type text not null,
  stream_id text,
  flow_direction text default 'forward',
  metadata jsonb default '{}',
  unique (source_asset_id, target_asset_id, stream_id)
);

-- 4. Telemetry and operating states
create table if not exists telemetry_samples (
  id bigint generated always as identity primary key,
  timestamp timestamptz not null default now(),
  project_id text not null references projects(project_id),
  asset_id text not null references assets(asset_id),
  voltage_v numeric,
  current_a numeric,
  active_power_kw numeric,
  reactive_power_kvar numeric,
  frequency_hz numeric,
  soc_pct numeric,
  temperature_c numeric,
  binary_status text,
  payload jsonb default '{}'
);

create index if not exists idx_telemetry_asset_ts on telemetry_samples(asset_id, timestamp desc);

create table if not exists operating_states (
  asset_id text primary key references assets(asset_id),
  project_id text not null references projects(project_id),
  control_mode text,
  operating_state text,
  telemetry_status text,
  grid_connected boolean,
  current_limit_active boolean,
  binary_status text,
  updated_at timestamptz default now(),
  metadata jsonb default '{}'
);

-- Convenience: BESS / PCS latest (compatible with earlier drafts)
create table if not exists bess_runtime (
  asset_id text primary key default 'BESS-001' references assets(asset_id),
  project_id text not null default 'TKOW-FV-BESS-DT-001' references projects(project_id),
  qualification_boundary text default 'ac_terminals_pcs_inclusive',
  operating_mode text default 'standby',
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
  updated_at timestamptz default now()
);

create table if not exists pcs_runtime (
  id bigint generated always as identity primary key,
  timestamp timestamptz not null default now(),
  asset_id text not null default 'PCS-001' references assets(asset_id),
  project_id text default 'TKOW-FV-BESS-DT-001' references projects(project_id),
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
  binary_status text
);

-- 5. Commands, alarms, and events
create table if not exists commands (
  id uuid primary key default uuid_generate_v4(),
  timestamp timestamptz not null default now(),
  project_id text not null references projects(project_id),
  source_asset_id text references assets(asset_id),
  target_asset_id text not null references assets(asset_id),
  command text not null,
  payload jsonb default '{}',
  status text default 'issued',
  issued_by text
);

create table if not exists alarms (
  id uuid primary key default uuid_generate_v4(),
  timestamp timestamptz not null default now(),
  project_id text not null references projects(project_id),
  asset_id text references assets(asset_id),
  alarm_code text not null,
  severity text not null default 'warn',
  message text,
  active boolean default true,
  cleared_at timestamptz,
  metadata jsonb default '{}'
);

create table if not exists events (
  id bigint generated always as identity primary key,
  timestamp timestamptz not null default now(),
  project_id text not null references projects(project_id),
  asset_id text references assets(asset_id),
  event_type text not null,
  summary text,
  payload jsonb default '{}'
);

create table if not exists electrical_oscillation_events (
  id bigint generated always as identity primary key,
  timestamp timestamptz not null default now(),
  project_id text default 'TKOW-FV-BESS-DT-001' references projects(project_id),
  asset_id text not null references assets(asset_id),
  class_id text not null,
  verdict text,
  severity text,
  frequency_hz numeric,
  duration_s numeric,
  decaying boolean,
  binary_status text,
  notes text
);

-- 6. Qualification tests and evidence
create table if not exists qualification_tests (
  test_id text primary key,
  project_id text not null references projects(project_id),
  scenario text not null,
  simulation_path text,
  pass_criteria text,
  metadata jsonb default '{}'
);

create table if not exists qualification_evidence (
  id uuid primary key default uuid_generate_v4(),
  test_id text not null references qualification_tests(test_id),
  project_id text not null references projects(project_id),
  ran_at timestamptz default now(),
  passed boolean,
  evidence_uri text,
  details jsonb default '{}'
);

create table if not exists qualification_test_results (
  id uuid primary key default uuid_generate_v4(),
  test_id text not null,
  scenario text not null,
  passed boolean,
  details jsonb default '{}',
  ran_at timestamptz default now()
);
