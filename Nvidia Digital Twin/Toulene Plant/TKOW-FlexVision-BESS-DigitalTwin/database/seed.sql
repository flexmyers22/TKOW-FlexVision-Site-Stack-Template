-- Seed information hierarchy for TKOW-FV-BESS-DT-001

insert into organizations (org_id, name, metadata) values
  ('ORG-TKOW', 'The Tech King of Wakanada / Flex-Vision', '{"program":"Nvidia Digital Twin"}'::jsonb)
on conflict (org_id) do nothing;

insert into projects (project_id, org_id, name, qualification_boundary, status) values
  ('TKOW-FV-BESS-DT-001', 'ORG-TKOW', 'FlexVision BESS Digital Twin', 'ac_terminals_pcs_inclusive', 'active')
on conflict (project_id) do nothing;

insert into assets (asset_id, project_id, asset_type, primary_function, parent_asset_id, protocol, endpoint) values
  ('GRID-001', 'TKOW-FV-BESS-DT-001', 'utility_grid', 'External voltage and frequency source', null, 'DNP3', 'grid.scada.local:20000'),
  ('XFMR-001', 'TKOW-FV-BESS-DT-001', 'site_transformer', 'Voltage transformation', null, 'ModbusTCP', '10.20.1.10:502'),
  ('SWGR-001', 'TKOW-FV-BESS-DT-001', 'main_switchgear', 'Isolation and protection', null, 'IEC61850', '10.20.1.20'),
  ('BUS-001', 'TKOW-FV-BESS-DT-001', 'site_ac_bus', 'Common electrical connection', null, 'internal', null),
  ('BESS-001', 'TKOW-FV-BESS-DT-001', 'battery_energy_storage_system', 'Complete storage asset', null, 'ModbusTCP', '10.20.2.1:502'),
  ('PCS-001', 'TKOW-FV-BESS-DT-001', 'power_conversion_system', 'Bidirectional AC/DC control', 'BESS-001', 'ModbusTCP', '10.20.2.2:502'),
  ('BAT-RACK-001', 'TKOW-FV-BESS-DT-001', 'battery_rack', 'Energy storage', 'BESS-001', 'CAN', 'can0'),
  ('BMS-001', 'TKOW-FV-BESS-DT-001', 'battery_management_system', 'Battery monitoring and protection', 'BESS-001', 'CAN', 'can0'),
  ('MTR-001', 'TKOW-FV-BESS-DT-001', 'electrical_meter', 'Independent measurement', null, 'ModbusTCP', '10.20.1.30:502'),
  ('GEN-001', 'TKOW-FV-BESS-DT-001', 'generator', 'Onsite generation', null, 'ModbusTCP', '10.20.1.40:502'),
  ('LOAD-AI-001', 'TKOW-FV-BESS-DT-001', 'ai_compute_load', 'Rapid transient electrical demand', null, 'ModbusTCP', '10.20.3.1:502'),
  ('RELAY-001', 'TKOW-FV-BESS-DT-001', 'protection_relay', 'Fault detection and trip logic', null, 'IEC61850', '10.20.1.50'),
  ('CTRL-001', 'TKOW-FV-BESS-DT-001', 'site_controller', 'Supervisory dispatch and mode control', null, 'MQTT', 'mqtt://10.20.0.1:1883')
on conflict (asset_id) do nothing;

insert into asset_connections (project_id, source_asset_id, target_asset_id, connection_type, stream_id, flow_direction) values
  ('TKOW-FV-BESS-DT-001', 'GRID-001', 'XFMR-001', 'ac_feed', 'GRID_HV', 'forward'),
  ('TKOW-FV-BESS-DT-001', 'XFMR-001', 'SWGR-001', 'ac_feed', 'XFMR_LV', 'forward'),
  ('TKOW-FV-BESS-DT-001', 'GEN-001', 'SWGR-001', 'ac_feed', 'GEN_IN', 'forward'),
  ('TKOW-FV-BESS-DT-001', 'SWGR-001', 'BUS-001', 'ac_feed', 'SWGR_TO_BUS', 'forward'),
  ('TKOW-FV-BESS-DT-001', 'BUS-001', 'BESS-001', 'breaker_path', 'BESS_AC', 'bidirectional'),
  ('TKOW-FV-BESS-DT-001', 'BESS-001', 'PCS-001', 'ac_dc', 'PCS_LINK', 'bidirectional'),
  ('TKOW-FV-BESS-DT-001', 'PCS-001', 'BAT-RACK-001', 'dc_link', 'DC_RACK', 'bidirectional'),
  ('TKOW-FV-BESS-DT-001', 'CTRL-001', 'PCS-001', 'dispatch', 'CTRL_PCS', 'forward'),
  ('TKOW-FV-BESS-DT-001', 'RELAY-001', 'SWGR-001', 'trip', 'RELAY_TRIP', 'forward')
on conflict (source_asset_id, target_asset_id, stream_id) do nothing;

insert into operating_states (asset_id, project_id, control_mode, operating_state, telemetry_status, grid_connected, current_limit_active, binary_status) values
  ('PCS-001', 'TKOW-FV-BESS-DT-001', 'grid_following', 'standby', 'connected', true, false, '00000011'),
  ('BESS-001', 'TKOW-FV-BESS-DT-001', null, 'standby', 'not_connected', true, false, '00000000')
on conflict (asset_id) do update set
  control_mode = excluded.control_mode,
  operating_state = excluded.operating_state,
  binary_status = excluded.binary_status,
  updated_at = now();

insert into bess_runtime (
  asset_id, project_id, operating_mode, frequency_hz, state_of_charge_pct,
  active_power_mw, grid_connected, island_capable, black_start_capable,
  telemetry_status, binary_status
) values (
  'BESS-001', 'TKOW-FV-BESS-DT-001', 'standby', 60, 50,
  0, true, true, true, 'not_connected', '00000000'
)
on conflict (asset_id) do nothing;

insert into pcs_runtime (
  timestamp, asset_id, project_id, voltage_v, current_a, active_power_kw, reactive_power_kvar,
  frequency_hz, soc_pct, current_limit, control_mode, operating_state, binary_status
) values (
  '2026-07-27T14:00:00Z', 'PCS-001', 'TKOW-FV-BESS-DT-001', 480, 0, 0, 0, 60, 50, false,
  'grid_following', 'standby', '00000011'
);

insert into telemetry_samples (
  timestamp, project_id, asset_id, voltage_v, current_a, active_power_kw, reactive_power_kvar,
  frequency_hz, soc_pct, binary_status
) values (
  '2026-07-27T14:00:00Z', 'TKOW-FV-BESS-DT-001', 'PCS-001', 480, 0, 0, 0, 60, 50, '00000011'
);

insert into qualification_tests (test_id, project_id, scenario, simulation_path, pass_criteria) values
  ('QT-GC-01', 'TKOW-FV-BESS-DT-001', 'grid_connected', 'simulation/grid_connected/', 'STABLE, binary TELEM+GRID'),
  ('QT-IS-01', 'TKOW-FV-BESS-DT-001', 'islanded', 'simulation/islanded/', 'ISLAND bit, frequency hold'),
  ('QT-BS-01', 'TKOW-FV-BESS-DT-001', 'black_start', 'simulation/black_start/', 'Form bus without grid'),
  ('QT-AI-01', 'TKOW-FV-BESS-DT-001', 'ai_load_ramps', 'simulation/ai_load_ramps/', 'Peak-shave, no TRIP'),
  ('QT-CL-01', 'TKOW-FV-BESS-DT-001', 'current_limit', 'simulation/current_limit/', 'I_LIMIT bit, P curtail'),
  ('QT-OSC-01', 'TKOW-FV-BESS-DT-001', 'oscillation', 'backend analyze', 'STABLE/RINGING/HUNTING/UNSTABLE correct')
on conflict (test_id) do nothing;
