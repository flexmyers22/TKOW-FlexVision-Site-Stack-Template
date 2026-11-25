import type { BessBinaryCode } from './bess.js';
import { decodeBessBinary } from './bess.js';

export type PcsControlMode =
  | 'grid_following'
  | 'grid_forming'
  | 'islanded'
  | 'black_start'
  | 'manual';

export type PcsOperatingState =
  | 'standby'
  | 'charge'
  | 'discharge'
  | 'idle'
  | 'fault'
  | 'offline';

export interface PcsTelemetrySample {
  timestamp: string;
  asset_id: 'PCS-001' | string;
  voltage_v: number;
  current_a: number;
  active_power_kw: number;
  reactive_power_kvar: number;
  frequency_hz: number;
  soc_pct: number | null;
  pcs_temperature_c: number | null;
  current_limit: boolean;
  control_mode: PcsControlMode;
  operating_state: PcsOperatingState;
  alarm_code: string | null;
  binary_status: string;
}

export interface PcsAssetState extends PcsTelemetrySample {
  project_id: string;
  asset_type: 'power_conversion_system';
  primary_function: string;
  parent: 'BESS-001' | string;
  cuda_tile: string;
  usd_prim: string;
}

export const PCS_001_SAMPLE: PcsTelemetrySample = {
  timestamp: '2026-07-27T10:00:00.000-04:00',
  asset_id: 'PCS-001',
  voltage_v: 480.0,
  current_a: 0.0,
  active_power_kw: 0.0,
  reactive_power_kvar: 0.0,
  frequency_hz: 60.0,
  soc_pct: 50.0,
  pcs_temperature_c: null,
  current_limit: false,
  control_mode: 'grid_following',
  operating_state: 'standby',
  alarm_code: null,
  binary_status: '00000011',
};

/** Same bit map as BESS: 00000011 = TELEM + GRID */
export function decodePcsBinary(status: string): Record<BessBinaryCode, boolean> {
  return decodeBessBinary(status);
}

export function summarizePcsBinary(status: string): string {
  const d = decodePcsBinary(status);
  return Object.entries(d)
    .filter(([, on]) => on)
    .map(([k]) => k)
    .join(', ') || 'none';
}
