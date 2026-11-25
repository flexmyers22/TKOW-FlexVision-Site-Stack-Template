-- bess_runtime_seed.sql

insert into bess_runtime (
  asset_id, project_id, asset_type, qualification_boundary, operating_mode,
  rated_power_mw, rated_energy_mwh, ac_voltage_v, frequency_hz,
  state_of_charge_pct, active_power_mw, reactive_power_mvar, current_a,
  current_limit_active, grid_connected, island_capable, black_start_capable,
  telemetry_status, binary_status, cuda_tile, metadata
) values (
  'BESS-001',
  'TKOW-FV-BESS-DT-001',
  'battery_energy_storage_system',
  'ac_terminals_pcs_inclusive',
  'standby',
  null, null, null, 60,
  null, 0, 0, 0,
  false, true, true, true,
  'not_connected',
  '00000000',
  'CUDA_TILE_ENERGY',
  '{"children":["PCS-001","BAT-RACK-001","BMS-001"],"usd_prim":"/Site/ElectricalSubstation/BESS_001"}'::jsonb
)
on conflict (asset_id) do update set
  project_id = excluded.project_id,
  qualification_boundary = excluded.qualification_boundary,
  operating_mode = excluded.operating_mode,
  frequency_hz = excluded.frequency_hz,
  active_power_mw = excluded.active_power_mw,
  reactive_power_mvar = excluded.reactive_power_mvar,
  current_a = excluded.current_a,
  current_limit_active = excluded.current_limit_active,
  grid_connected = excluded.grid_connected,
  island_capable = excluded.island_capable,
  black_start_capable = excluded.black_start_capable,
  telemetry_status = excluded.telemetry_status,
  binary_status = excluded.binary_status,
  updated_at = now();
