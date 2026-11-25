-- 007_sensor_registry.sql
-- Field sensor registry mapped to CUDA tiles

create table sensor_registry (
  id uuid primary key default uuid_generate_v4(),
  equipment_tag text not null,
  sensor_tag text not null unique,
  sensor_type text not null,
  engineering_units text,
  plc_address text,
  cuda_tile text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_sensor_registry_equipment on sensor_registry(equipment_tag);
create index idx_sensor_registry_cuda_tile on sensor_registry(cuda_tile);
create index idx_sensor_registry_type on sensor_registry(sensor_type);
