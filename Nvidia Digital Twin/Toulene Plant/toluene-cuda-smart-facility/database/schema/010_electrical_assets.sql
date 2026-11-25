-- 010_electrical_assets.sql
-- Electrical digital twin — breaker to motor to process equipment

create table electrical_assets (
  id uuid primary key default uuid_generate_v4(),
  asset_tag text not null unique,
  breaker_number text,
  panel_name text,
  load_type text,
  voltage numeric,
  current numeric,
  equipment_tag text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_electrical_assets_equipment on electrical_assets(equipment_tag);
create index idx_electrical_assets_panel on electrical_assets(panel_name);

-- Facility GIS layer

create table facility_sites (
  id uuid primary key default uuid_generate_v4(),
  site_code text not null unique,
  site_name text not null,
  latitude numeric,
  longitude numeric,
  elevation_m numeric,
  areas jsonb default '[]',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
