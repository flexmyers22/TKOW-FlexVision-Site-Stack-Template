-- 011_site_power_system.sql
-- Site power topology: Utility/Generator → Switchgear → AC Bus → Loads + BESS/PCS

create table if not exists site_power_nodes (
  id uuid primary key default uuid_generate_v4(),
  node_tag text not null unique,
  node_type text not null,
  -- utility | generator | switchgear | ac_bus | breaker | pcs | bess | bms | load
  name text,
  voltage_v numeric,
  power_kw numeric,
  cuda_tile text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists site_power_connections (
  id uuid primary key default uuid_generate_v4(),
  source_tag text not null,
  target_tag text not null,
  connection_type text not null,
  -- ac_feed | bus_tap | dc_link | breaker_path | load_feed
  flow_direction text default 'forward',
  stream_id text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  unique (source_tag, target_tag, stream_id)
);

create index if not exists idx_site_power_nodes_type on site_power_nodes(node_type);
create index if not exists idx_site_power_connections_source on site_power_connections(source_tag);
create index if not exists idx_site_power_connections_target on site_power_connections(target_tag);

-- Extend electrical_assets with power-system role (safe if column exists)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'electrical_assets' and column_name = 'power_node_tag'
  ) then
    alter table electrical_assets add column power_node_tag text;
  end if;
end $$;
