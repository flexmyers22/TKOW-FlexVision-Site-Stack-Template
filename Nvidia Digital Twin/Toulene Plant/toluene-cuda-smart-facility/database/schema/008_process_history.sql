-- 008_process_history.sql
-- Time-series historian for digital twin

create table process_history (
  id bigint generated always as identity primary key,
  timestamp timestamptz not null default now(),
  equipment_tag text not null,
  sensor_tag text not null,
  value numeric not null
);

create index idx_process_history_timestamp on process_history(timestamp desc);
create index idx_process_history_equipment on process_history(equipment_tag);
create index idx_process_history_sensor on process_history(sensor_tag);
create index idx_process_history_equipment_time on process_history(equipment_tag, timestamp desc);
