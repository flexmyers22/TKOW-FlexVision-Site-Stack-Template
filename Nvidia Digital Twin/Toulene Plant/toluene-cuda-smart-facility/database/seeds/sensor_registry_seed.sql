-- sensor_registry_seed.sql

insert into sensor_registry (equipment_tag, sensor_tag, sensor_type, engineering_units, plc_address, cuda_tile) values
  ('T101', 'LT101', 'level', '%', 'PLC1.DB10.LT101', 'CUDA_TILE_T101'),
  ('T101', 'TT101', 'temperature', 'degF', 'PLC1.DB10.TT101', 'CUDA_TILE_T101'),
  ('P101', 'FT101', 'flow', 'lb/hr', 'PLC1.DB11.FT101', 'CUDA_TILE_P101'),
  ('P101', 'PT101', 'pressure', 'psi', 'PLC1.DB11.PT101', 'CUDA_TILE_P101'),
  ('P101', 'IT101', 'motor_current', 'A', 'PLC1.DB11.IT101', 'CUDA_TILE_P101'),
  ('H101', 'TT102', 'temperature', 'degF', 'PLC1.DB12.TT102', 'CUDA_TILE_H101'),
  ('H101', 'DT101', 'duty', 'kW', 'PLC1.DB12.DT101', 'CUDA_TILE_H101'),
  ('R101', 'TT103', 'temperature', 'degF', 'PLC1.DB13.TT103', 'CUDA_TILE_R101'),
  ('R101', 'PT102', 'pressure', 'psia', 'PLC1.DB13.PT102', 'CUDA_TILE_R101'),
  ('R101', 'AT101', 'conversion', '%', 'PLC1.DB13.AT101', 'CUDA_TILE_R101'),
  ('D101', 'PT103', 'pressure', 'psi', 'PLC1.DB14.PT103', 'CUDA_TILE_C101'),
  ('C101', 'FT102', 'flow', 'lb/hr', 'PLC1.DB15.FT102', 'CUDA_TILE_C101'),
  ('C101', 'LT102', 'level', '%', 'PLC1.DB15.LT102', 'CUDA_TILE_C101'),
  ('C102', 'FT103', 'flow', 'lb/hr', 'PLC1.DB16.FT103', 'CUDA_TILE_C102'),
  ('C103', 'FT104', 'flow', 'lb/hr', 'PLC1.DB17.FT104', 'CUDA_TILE_C103')
on conflict (sensor_tag) do nothing;
