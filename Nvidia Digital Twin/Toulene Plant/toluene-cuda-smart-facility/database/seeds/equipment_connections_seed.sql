-- equipment_connections_seed.sql
-- Process topology: T101 → P101 → H101 → R101 → D101 → C101 → C102 → C103

insert into equipment_connections (source_tag, target_tag, connection_type, stream_id, flow_direction) values
  ('T101', 'P101', 'process', 'TOLUENE_FEED', 'forward'),
  ('P101', 'H101', 'process', 'REACTOR_FEED', 'forward'),
  ('H101', 'R101', 'process', 'HEATED_FEED', 'forward'),
  ('R101', 'D101', 'process', 'REACTOR_EFFLUENT', 'forward'),
  ('D101', 'C101', 'process', 'SIDE_DRAW', 'forward'),
  ('C101', 'C102', 'process', 'BENZENE_CUT', 'forward'),
  ('C102', 'C103', 'process', 'XYLENE_CUT', 'forward'),
  ('C103', 'T101', 'recycle', 'TOLUENE_RECYCLE', 'forward')
on conflict (source_tag, target_tag, stream_id) do nothing;
