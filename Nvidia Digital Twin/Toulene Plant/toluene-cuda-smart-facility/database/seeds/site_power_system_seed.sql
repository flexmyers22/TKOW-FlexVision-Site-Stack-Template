-- site_power_system_seed.sql
-- Legacy helper — prefer electrical_dt_assets_seed.sql for full BESS DT registry.
-- Kept for 011-only environments; IDs match GRID-001…CTRL-001.

insert into site_power_nodes (node_tag, node_type, name, voltage_v, power_kw, cuda_tile) values
  ('GRID-001', 'utility', 'Utility Grid', 13800, null, 'CUDA_TILE_ELECTRICAL'),
  ('XFMR-001', 'transformer', 'Site Transformer', 480, null, 'CUDA_TILE_ELECTRICAL'),
  ('SWGR-001', 'switchgear', 'Main Switchgear', 480, null, 'CUDA_TILE_ELECTRICAL'),
  ('BUS-001', 'ac_bus', 'Site AC Bus', 480, null, 'CUDA_TILE_ELECTRICAL'),
  ('BESS-001', 'bess', 'Battery Energy Storage', 800, 1000, 'CUDA_TILE_ENERGY'),
  ('PCS-001', 'pcs', 'Power Conversion System', 480, 1500, 'CUDA_TILE_ENERGY'),
  ('BAT-RACK-001', 'battery_rack', 'Battery Rack', 800, null, 'CUDA_TILE_ENERGY'),
  ('BMS-001', 'bms', 'Battery Management System', null, null, 'CUDA_TILE_ENERGY'),
  ('MTR-001', 'meter', 'Electrical Meter', 480, null, 'CUDA_TILE_ELECTRICAL'),
  ('GEN-001', 'generator', 'Site Generator', 480, 2000, 'CUDA_TILE_ELECTRICAL'),
  ('LOAD-AI-001', 'load', 'AI Compute Load', 480, 800, 'CUDA_TILE_ENERGY'),
  ('LOAD-PROCESS', 'load', 'Process Loads', 480, 500, 'CUDA_TILE_ELECTRICAL'),
  ('RELAY-001', 'relay', 'Protection Relay', null, null, 'CUDA_TILE_SAFETY'),
  ('CTRL-001', 'controller', 'Site Controller', null, null, 'CUDA_TILE_ELECTRICAL')
on conflict (node_tag) do nothing;
