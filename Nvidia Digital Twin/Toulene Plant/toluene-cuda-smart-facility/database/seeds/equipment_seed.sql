-- equipment_seed.sql
-- Toluene disproportionation plant equipment (metadata from senior design OCR)

insert into toluene_equipment (
  part_number, equipment_tag, equipment_type, process_area,
  geometry_file, excel_sheet, excel_range, binary_status, cuda_tile_id,
  upstream, downstream, metadata
) values
(
  'TKOW-TOL-TNK-TOLUENE-101-A', 'T101', 'tank', 'STORAGE',
  null, 'Equipment', 'Equipment!A10:M10', '00000001', 'CUDA_TILE_T101',
  '[]'::jsonb, '["P101"]'::jsonb,
  '{"design_source":"Disproportionation of Toluene senior design PDF","feed_rate_lb_hr":10000,"molar_flow_lbmol_hr":108.5,"suction_pressure_psi":14.69}'::jsonb
),
(
  'TKOW-TOL-PMP-FEED-101-A', 'P101', 'pump', 'FEED',
  'P101.glb', 'Equipment', 'Equipment!A7:M7', '00000100', 'CUDA_TILE_P101',
  '["T101"]'::jsonb, '["H101"]'::jsonb,
  '{"pump_type":"centrifugal","discharge_pressure_psi":270,"reactor_delivery_psi":215,"motor_power_kw":4.3,"hydraulic_power_w":2557}'::jsonb
),
(
  'TKOW-TOL-HTX-HEATER-101-A', 'H101', 'heater', 'HEAT',
  'H101.glb', 'Equipment', 'Equipment!A8:M8', '00001100', 'CUDA_TILE_H101',
  '["P101"]'::jsonb, '["R101"]'::jsonb,
  '{"duty_w":3848817,"furnace_outlet_temp_f":1000,"heat_transfer_area_m2":30,"tube_count":78}'::jsonb
),
(
  'TKOW-TOL-RXN-REACTOR-101-A', 'R101', 'reactor', 'RXN',
  'R101.glb', 'Equipment', 'Equipment!A6:M6', '00001000', 'CUDA_TILE_R101',
  '["H101"]'::jsonb, '["C101"]'::jsonb,
  '{"reactor_type":"plug_flow","conversion_pct":30,"feed_rate_lb_hr":10000,"feed_pressure_psia":215,"operating_temp_f":1000,"h2_flow_lbmol_hr":1780}'::jsonb
),
(
  'TKOW-TOL-COL-COLUMN-101-A', 'C101', 'column', 'SEP',
  'C101.glb', 'Equipment', 'Equipment!A9:M9', '00000110', 'CUDA_TILE_C101',
  '["R101"]'::jsonb, '[]'::jsonb,
  '{"column_type":"tray_column_side_distillation","diameter_m":5.29,"height_m":42.31,"tray_count":69,"reflux_ratio":5.0,"reboiler_duty_w":1196790}'::jsonb
)
on conflict (part_number) do update set
  equipment_type = excluded.equipment_type,
  process_area = excluded.process_area,
  geometry_file = excluded.geometry_file,
  excel_range = excluded.excel_range,
  binary_status = excluded.binary_status,
  cuda_tile_id = excluded.cuda_tile_id,
  upstream = excluded.upstream,
  downstream = excluded.downstream,
  metadata = excluded.metadata;
