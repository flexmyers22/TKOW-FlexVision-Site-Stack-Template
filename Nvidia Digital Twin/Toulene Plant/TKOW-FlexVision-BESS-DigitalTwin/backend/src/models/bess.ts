/** BESS 8-bit status word — LSB = bit 0 (rightmost in string) */
export const BESS_BINARY_SIGNALS = [
  { bit: 0, code: 'TELEM', mask: '00000001', label: 'Telemetry active' },
  { bit: 1, code: 'GRID', mask: '00000010', label: 'Grid connected' },
  { bit: 2, code: 'CHARGE', mask: '00000100', label: 'Battery charging' },
  { bit: 3, code: 'DISCHARGE', mask: '00001000', label: 'Battery discharging' },
  { bit: 4, code: 'I_LIMIT', mask: '00010000', label: 'Current limit active' },
  { bit: 5, code: 'ISLAND', mask: '00100000', label: 'Island mode active' },
  { bit: 6, code: 'WARN', mask: '01000000', label: 'Warning present' },
  { bit: 7, code: 'TRIP', mask: '10000000', label: 'Trip or emergency shutdown' },
] as const;

export type BessBinaryCode = (typeof BESS_BINARY_SIGNALS)[number]['code'];

export type BessOperatingMode =
  | 'standby'
  | 'charge'
  | 'discharge'
  | 'idle'
  | 'islanded'
  | 'black_start'
  | 'fault';

export type BessTelemetryStatus =
  | 'not_connected'
  | 'connected'
  | 'degraded'
  | 'fault';

export interface BessAssetState {
  asset_id: 'BESS-001' | string;
  project_id: string;
  asset_type: 'battery_energy_storage_system';
  qualification_boundary: 'ac_terminals_pcs_inclusive' | string;
  operating_mode: BessOperatingMode;
  rated_power_mw: number | null;
  rated_energy_mwh: number | null;
  ac_voltage_v: number | null;
  frequency_hz: number;
  state_of_charge_pct: number | null;
  active_power_mw: number;
  reactive_power_mvar: number;
  current_a: number;
  current_limit_active: boolean;
  grid_connected: boolean;
  island_capable: boolean;
  black_start_capable: boolean;
  telemetry_status: BessTelemetryStatus;
  binary_status: string;
}

export function decodeBessBinary(status: string): Record<BessBinaryCode, boolean> {
  const padded = status.padStart(8, '0').slice(-8);
  const decoded = {} as Record<BessBinaryCode, boolean>;
  for (const signal of BESS_BINARY_SIGNALS) {
    // bit 0 = rightmost char (index 7); bit 7 = leftmost (index 0)
    decoded[signal.code] = padded[7 - signal.bit] === '1';
  }
  return decoded;
}

export function encodeBessBinary(flags: Partial<Record<BessBinaryCode, boolean>>): string {
  const bits = Array(8).fill('0');
  for (const signal of BESS_BINARY_SIGNALS) {
    if (flags[signal.code]) bits[7 - signal.bit] = '1';
  }
  return bits.join('');
}

/** Derive binary word from live BESS telemetry fields */
export function binaryFromBessState(
  state: Pick<
    BessAssetState,
    | 'operating_mode'
    | 'grid_connected'
    | 'current_limit_active'
    | 'telemetry_status'
    | 'active_power_mw'
  >
): string {
  const telem =
    state.telemetry_status === 'connected' || state.telemetry_status === 'degraded';
  const charging =
    state.operating_mode === 'charge' || state.active_power_mw < -0.001;
  const discharging =
    state.operating_mode === 'discharge' || state.active_power_mw > 0.001;

  return encodeBessBinary({
    TELEM: telem,
    GRID: state.grid_connected,
    CHARGE: charging,
    DISCHARGE: discharging,
    I_LIMIT: state.current_limit_active,
    ISLAND: state.operating_mode === 'islanded' || state.operating_mode === 'black_start',
    WARN: state.telemetry_status === 'degraded',
    TRIP: state.telemetry_status === 'fault' || state.operating_mode === 'fault',
  });
}

export const BESS_001_DEFAULT: BessAssetState = {
  asset_id: 'BESS-001',
  project_id: 'TKOW-FV-BESS-DT-001',
  asset_type: 'battery_energy_storage_system',
  qualification_boundary: 'ac_terminals_pcs_inclusive',
  operating_mode: 'standby',
  rated_power_mw: null,
  rated_energy_mwh: null,
  ac_voltage_v: null,
  frequency_hz: 60,
  state_of_charge_pct: null,
  active_power_mw: 0,
  reactive_power_mvar: 0,
  current_a: 0,
  current_limit_active: false,
  grid_connected: true,
  island_capable: true,
  black_start_capable: true,
  telemetry_status: 'not_connected',
  binary_status: '00000000',
};
