-- 006_equipment_connections.sql
-- Process topology graph for digital twin

create table equipment_connections (
  id uuid primary key default uuid_generate_v4(),
  source_tag text not null,
  target_tag text not null,
  connection_type text not null,
  stream_id text,
  flow_direction text default 'forward',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  unique (source_tag, target_tag, stream_id)
);

create index idx_equipment_connections_source on equipment_connections(source_tag);
create index idx_equipment_connections_target on equipment_connections(target_tag);
create index idx_equipment_connections_stream on equipment_connections(stream_id);
