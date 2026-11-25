-- pcs_runtime_seed.sql — initial PCS-001 sample @ 2026-07-27T10:00:00-04:00

insert into pcs_runtime (
  timestamp, asset_id, project_id,
  voltage_v, current_a, active_power_kw, reactive_power_kvar, frequency_hz,
  soc_pct, pcs_temperature_c, current_limit, control_mode, operating_state,
  alarm_code, binary_status, cuda_tile
) values (
  '2026-07-27T14:00:00+00:00',
  'PCS-001',
  'TKOW-FV-BESS-DT-001',
  480.0, 0.0, 0.0, 0.0, 60.0,
  50.0, null, false, 'grid_following', 'standby',
  null, '00000011', 'CUDA_TILE_ENERGY'
);

insert into pcs_runtime_latest (
  asset_id, timestamp, voltage_v, current_a, active_power_kw, reactive_power_kvar,
  frequency_hz, soc_pct, pcs_temperature_c, current_limit, control_mode,
  operating_state, alarm_code, binary_status, updated_at
) values (
  'PCS-001',
  '2026-07-27T14:00:00+00:00',
  480.0, 0.0, 0.0, 0.0, 60.0, 50.0, null, false,
  'grid_following', 'standby', null, '00000011', now()
)
on conflict (asset_id) do update set
  timestamp = excluded.timestamp,
  voltage_v = excluded.voltage_v,
  current_a = excluded.current_a,
  active_power_kw = excluded.active_power_kw,
  reactive_power_kvar = excluded.reactive_power_kvar,
  frequency_hz = excluded.frequency_hz,
  soc_pct = excluded.soc_pct,
  pcs_temperature_c = excluded.pcs_temperature_c,
  current_limit = excluded.current_limit,
  control_mode = excluded.control_mode,
  operating_state = excluded.operating_state,
  alarm_code = excluded.alarm_code,
  binary_status = excluded.binary_status,
  updated_at = now();
