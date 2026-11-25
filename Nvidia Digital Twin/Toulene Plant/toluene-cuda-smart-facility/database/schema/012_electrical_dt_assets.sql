-- 012_electrical_dt_assets.sql
-- BESS + site power digital-twin asset registry and communication channels

create table if not exists electrical_dt_assets (
  id uuid primary key default uuid_generate_v4(),
  asset_id text not null unique,
  asset_type text not null,
  primary_function text,
  parent_asset_id text,
  voltage_v numeric,
  power_kw numeric,
  energy_kwh numeric,
  cuda_tile text,
  usd_prim text,
  protocol text,
  endpoint text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists electrical_comm_channels (
  id uuid primary key default uuid_generate_v4(),
  channel_id text not null unique,
  source_asset_id text not null,
  target_asset_id text not null,
  protocol text not null,
  signals jsonb default '[]',
  commands jsonb default '[]',
  update_ms integer default 1000,
  priority text default 'normal',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_electrical_dt_assets_type on electrical_dt_assets(asset_type);
create index if not exists idx_electrical_dt_assets_parent on electrical_dt_assets(parent_asset_id);
create index if not exists idx_electrical_comm_source on electrical_comm_channels(source_asset_id);
create index if not exists idx_electrical_comm_target on electrical_comm_channels(target_asset_id);
