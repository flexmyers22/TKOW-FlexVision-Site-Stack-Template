-- electrical_dt_assets_seed.sql
-- Digital-twin assets: GRID-001 … CTRL-001

insert into electrical_dt_assets (
  asset_id, asset_type, primary_function, parent_asset_id,
  voltage_v, power_kw, energy_kwh, cuda_tile, usd_prim, protocol, endpoint, metadata
) values
  ('GRID-001', 'utility_grid', 'External voltage and frequency source', null,
   13800, null, null, 'CUDA_TILE_ELECTRICAL', '/Site/ElectricalSubstation/GRID_001', 'DNP3', 'grid.scada.local:20000', '{}'::jsonb),
  ('XFMR-001', 'site_transformer', 'Voltage transformation', null,
   480, null, null, 'CUDA_TILE_ELECTRICAL', '/Site/ElectricalSubstation/XFMR_001', 'ModbusTCP', '10.20.1.10:502',
   '{"voltage_primary_v":13800,"power_kva":2500}'::jsonb),
  ('SWGR-001', 'main_switchgear', 'Isolation and protection', null,
   480, null, null, 'CUDA_TILE_ELECTRICAL', '/Site/ElectricalSubstation/SWGR_001', 'IEC61850', '10.20.1.20', '{}'::jsonb),
  ('BUS-001', 'site_ac_bus', 'Common electrical connection', null,
   480, null, null, 'CUDA_TILE_ELECTRICAL', '/Site/ElectricalSubstation/BUS_001', 'internal', null, '{}'::jsonb),
  ('BESS-001', 'battery_energy_storage_system', 'Complete storage asset', null,
   800, 1000, 2000, 'CUDA_TILE_ENERGY', '/Site/ElectricalSubstation/BESS_001', 'ModbusTCP', '10.20.2.1:502', '{}'::jsonb),
  ('PCS-001', 'power_conversion_system', 'Bidirectional AC/DC control', 'BESS-001',
   480, 1500, null, 'CUDA_TILE_ENERGY', '/Site/ElectricalSubstation/BESS_001/PCS_001', 'ModbusTCP', '10.20.2.2:502', '{}'::jsonb),
  ('BAT-RACK-001', 'battery_rack', 'Energy storage', 'BESS-001',
   800, null, 2000, 'CUDA_TILE_ENERGY', '/Site/ElectricalSubstation/BESS_001/BAT_RACK_001', 'CAN', 'can0', '{}'::jsonb),
  ('BMS-001', 'battery_management_system', 'Battery monitoring and protection', 'BESS-001',
   null, null, null, 'CUDA_TILE_ENERGY', '/Site/ElectricalSubstation/BESS_001/BMS_001', 'CAN', 'can0', '{}'::jsonb),
  ('MTR-001', 'electrical_meter', 'Independent measurement', null,
   480, null, null, 'CUDA_TILE_ELECTRICAL', '/Site/ElectricalSubstation/MTR_001', 'ModbusTCP', '10.20.1.30:502', '{}'::jsonb),
  ('GEN-001', 'generator', 'Onsite generation', null,
   480, 2000, null, 'CUDA_TILE_ELECTRICAL', '/Site/ElectricalSubstation/GEN_001', 'ModbusTCP', '10.20.1.40:502', '{}'::jsonb),
  ('LOAD-AI-001', 'ai_compute_load', 'Rapid transient electrical demand', null,
   480, 800, null, 'CUDA_TILE_ENERGY', '/Site/ElectricalSubstation/LOAD_AI_001', 'ModbusTCP', '10.20.3.1:502', '{}'::jsonb),
  ('LOAD-PROCESS', 'process_load', 'Process MCC loads (toluene plant)', null,
   480, 500, null, 'CUDA_TILE_ELECTRICAL', '/Site/ElectricalSubstation/LOAD_PROCESS', 'internal', null,
   '{"feeds":["MCC-1","MCC-2"]}'::jsonb),
  ('RELAY-001', 'protection_relay', 'Fault detection and trip logic', null,
   null, null, null, 'CUDA_TILE_SAFETY', '/Site/ElectricalSubstation/RELAY_001', 'IEC61850', '10.20.1.50',
   '{"protects":["SWGR-001","BUS-001","BESS-001"],"goose":true}'::jsonb),
  ('CTRL-001', 'site_controller', 'Supervisory dispatch and mode control', null,
   null, null, null, 'CUDA_TILE_ELECTRICAL', '/Site/ElectricalSubstation/CTRL_001', 'MQTT', 'mqtt://10.20.0.1:1883',
   '{"modes":["grid_following","islanded","bess_peak_shave","ai_buffer"]}'::jsonb)
on conflict (asset_id) do update set
  asset_type = excluded.asset_type,
  primary_function = excluded.primary_function,
  parent_asset_id = excluded.parent_asset_id,
  voltage_v = excluded.voltage_v,
  power_kw = excluded.power_kw,
  energy_kwh = excluded.energy_kwh,
  cuda_tile = excluded.cuda_tile,
  usd_prim = excluded.usd_prim,
  protocol = excluded.protocol,
  endpoint = excluded.endpoint,
  metadata = excluded.metadata;

insert into electrical_comm_channels (channel_id, source_asset_id, target_asset_id, protocol, signals, commands, update_ms, priority) values
  ('CH-GRID', 'GRID-001', 'CTRL-001', 'DNP3', '["V_ll","f_hz","P_import_kw","Q_kvar"]'::jsonb, '[]'::jsonb, 1000, 'normal'),
  ('CH-XFMR', 'XFMR-001', 'CTRL-001', 'ModbusTCP', '["V_pri","V_sec","I_sec","temp_c","tap"]'::jsonb, '[]'::jsonb, 500, 'normal'),
  ('CH-SWGR', 'SWGR-001', 'CTRL-001', 'IEC61850', '["breaker_status","isolator_status","fault_flag"]'::jsonb, '[]'::jsonb, 100, 'normal'),
  ('CH-RELAY', 'RELAY-001', 'CTRL-001', 'IEC61850-GOOSE', '["trip","pickup","fault_type"]'::jsonb, '[]'::jsonb, 4, 'safety'),
  ('CH-MTR', 'MTR-001', 'CTRL-001', 'ModbusTCP', '["V","I","P_kw","Q_kvar","PF","energy_kwh"]'::jsonb, '[]'::jsonb, 200, 'normal'),
  ('CH-GEN', 'GEN-001', 'CTRL-001', 'ModbusTCP', '["run","P_kw","f_hz","V","fuel_pct"]'::jsonb, '["start","stop","set_kw"]'::jsonb, 250, 'normal'),
  ('CH-PCS', 'PCS-001', 'CTRL-001', 'ModbusTCP', '["mode","P_ac_kw","Q_ac_kvar","V_dc","I_dc","fault"]'::jsonb, '["charge","discharge","idle","set_kw"]'::jsonb, 50, 'normal'),
  ('CH-BMS', 'BMS-001', 'CTRL-001', 'CAN', '["soc_pct","soh_pct","cell_v_min","cell_v_max","temp_max_c","contactor"]'::jsonb, '[]'::jsonb, 100, 'normal'),
  ('CH-RACK', 'BAT-RACK-001', 'BMS-001', 'CAN', '["module_voltages","module_temps","balance_status"]'::jsonb, '[]'::jsonb, 200, 'normal'),
  ('CH-AI', 'LOAD-AI-001', 'CTRL-001', 'ModbusTCP', '["P_kw","ramp_kw_s","demand_forecast_kw"]'::jsonb, '[]'::jsonb, 100, 'normal'),
  ('CH-BESS-AGG', 'BESS-001', 'CTRL-001', 'ModbusTCP', '["available_kw","soc_pct","state"]'::jsonb, '[]'::jsonb, 100, 'normal'),
  ('CH-DISPATCH-PCS', 'CTRL-001', 'PCS-001', 'MQTT', '[]'::jsonb, '["mode","setpoints"]'::jsonb, 100, 'normal'),
  ('CH-DISPATCH-GEN', 'CTRL-001', 'GEN-001', 'MQTT', '[]'::jsonb, '["mode","setpoints"]'::jsonb, 100, 'normal'),
  ('CH-DISPATCH-BESS', 'CTRL-001', 'BESS-001', 'MQTT', '[]'::jsonb, '["mode","setpoints"]'::jsonb, 100, 'normal')
on conflict (channel_id) do nothing;

-- Power graph nodes aligned to new asset IDs
insert into site_power_nodes (node_tag, node_type, name, voltage_v, power_kw, cuda_tile, metadata) values
  ('GRID-001', 'utility', 'Utility Grid', 13800, null, 'CUDA_TILE_ELECTRICAL', '{}'::jsonb),
  ('XFMR-001', 'transformer', 'Site Transformer', 480, null, 'CUDA_TILE_ELECTRICAL', '{"primary_v":13800}'::jsonb),
  ('SWGR-001', 'switchgear', 'Main Switchgear', 480, null, 'CUDA_TILE_ELECTRICAL', '{}'::jsonb),
  ('BUS-001', 'ac_bus', 'Site AC Bus', 480, null, 'CUDA_TILE_ELECTRICAL', '{}'::jsonb),
  ('BESS-001', 'bess', 'Battery Energy Storage', 800, 1000, 'CUDA_TILE_ENERGY', '{"energy_kwh":2000}'::jsonb),
  ('PCS-001', 'pcs', 'Power Conversion System', 480, 1500, 'CUDA_TILE_ENERGY', '{}'::jsonb),
  ('BAT-RACK-001', 'battery_rack', 'Battery Rack', 800, null, 'CUDA_TILE_ENERGY', '{"energy_kwh":2000}'::jsonb),
  ('BMS-001', 'bms', 'Battery Management System', null, null, 'CUDA_TILE_ENERGY', '{}'::jsonb),
  ('MTR-001', 'meter', 'Electrical Meter', 480, null, 'CUDA_TILE_ELECTRICAL', '{}'::jsonb),
  ('GEN-001', 'generator', 'Site Generator', 480, 2000, 'CUDA_TILE_ELECTRICAL', '{}'::jsonb),
  ('LOAD-AI-001', 'load', 'AI Compute Load', 480, 800, 'CUDA_TILE_ENERGY', '{}'::jsonb),
  ('LOAD-PROCESS', 'load', 'Process / Other Loads', 480, 500, 'CUDA_TILE_ELECTRICAL', '{}'::jsonb),
  ('RELAY-001', 'relay', 'Protection Relay', null, null, 'CUDA_TILE_SAFETY', '{}'::jsonb),
  ('CTRL-001', 'controller', 'Site Controller', null, null, 'CUDA_TILE_ELECTRICAL', '{}'::jsonb)
on conflict (node_tag) do nothing;

insert into site_power_connections (source_tag, target_tag, connection_type, stream_id, flow_direction) values
  ('GRID-001', 'XFMR-001', 'ac_feed', 'GRID_HV', 'forward'),
  ('XFMR-001', 'SWGR-001', 'ac_feed', 'XFMR_LV', 'forward'),
  ('GEN-001', 'SWGR-001', 'ac_feed', 'GEN_IN', 'forward'),
  ('SWGR-001', 'BUS-001', 'ac_feed', 'SWGR_TO_BUS', 'forward'),
  ('BUS-001', 'MTR-001', 'meter_tap', 'BUS_METER', 'forward'),
  ('BUS-001', 'LOAD-AI-001', 'load_feed', 'AI_LOAD', 'forward'),
  ('BUS-001', 'LOAD-PROCESS', 'load_feed', 'PROCESS_LOAD', 'forward'),
  ('BUS-001', 'BESS-001', 'breaker_path', 'BESS_AC', 'bidirectional'),
  ('BESS-001', 'PCS-001', 'ac_dc', 'PCS_LINK', 'bidirectional'),
  ('PCS-001', 'BAT-RACK-001', 'dc_link', 'DC_RACK', 'bidirectional'),
  ('BAT-RACK-001', 'BMS-001', 'sense', 'BMS_SENSE', 'forward'),
  ('RELAY-001', 'SWGR-001', 'trip', 'RELAY_TRIP', 'forward'),
  ('CTRL-001', 'PCS-001', 'dispatch', 'CTRL_PCS', 'forward'),
  ('CTRL-001', 'GEN-001', 'dispatch', 'CTRL_GEN', 'forward'),
  ('CTRL-001', 'BESS-001', 'dispatch', 'CTRL_BESS', 'forward')
on conflict (source_tag, target_tag, stream_id) do nothing;

update electrical_assets
set power_node_tag = 'LOAD-PROCESS'
where asset_tag in ('BRK-P101','BRK-H101','BRK-R101','BRK-C101','BRK-C102','BRK-C103');
