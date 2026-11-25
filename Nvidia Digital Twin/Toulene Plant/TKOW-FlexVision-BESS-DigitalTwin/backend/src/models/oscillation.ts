/**
 * Electrical / BESS oscillation & transient classes for digital-twin diagnostics.
 * Source: electrical/diagnostics/oscillation_taxonomy.json
 */

export const OSCILLATION_CLASSES = [
  {
    class_id: 'NORMAL_WAVEFORM',
    name: 'Normal electrical oscillation',
    description: '60 Hz voltage/current waveform',
    severity: 'normal',
    expected: true,
    decay: null,
  },
  {
    class_id: 'NORMAL_TRANSIENT',
    name: 'Normal transient',
    description: 'Brief, decaying response after a load change',
    severity: 'normal',
    expected: true,
    decay: 'decaying',
  },
  {
    class_id: 'RINGING',
    name: 'Ringing',
    description: 'Short oscillation that decreases with time',
    severity: 'watch',
    expected: true,
    decay: 'decaying',
  },
  {
    class_id: 'SUSTAINED_OSCILLATION',
    name: 'Sustained oscillation',
    description: 'Oscillation that does not decay',
    severity: 'alarm',
    expected: false,
    decay: 'none',
  },
  {
    class_id: 'CONTROL_HUNTING',
    name: 'Control hunting',
    description: 'Repeated switching between control modes',
    severity: 'alarm',
    expected: false,
    decay: 'none',
  },
  {
    class_id: 'MECHANICAL_VIBRATION',
    name: 'Mechanical vibration',
    description: 'Physical oscillation from fans, pumps, bearings, or motors',
    severity: 'watch',
    expected: false,
    decay: 'variable',
  },
] as const;

export type OscillationClassId = (typeof OSCILLATION_CLASSES)[number]['class_id'];
export type OscillationSeverity = 'normal' | 'watch' | 'alarm';
export type StabilityVerdict = 'STABLE' | 'RINGING' | 'HUNTING' | 'UNSTABLE';

export const VERDICT_MAP: Record<StabilityVerdict, OscillationClassId[]> = {
  STABLE: ['NORMAL_WAVEFORM', 'NORMAL_TRANSIENT'],
  RINGING: ['RINGING', 'MECHANICAL_VIBRATION'],
  HUNTING: ['CONTROL_HUNTING'],
  UNSTABLE: ['SUSTAINED_OSCILLATION'],
};

export interface OscillationEvent {
  timestamp: string;
  asset_id: string;
  class_id: OscillationClassId;
  severity: OscillationSeverity;
  frequency_hz?: number | null;
  duration_s?: number | null;
  decaying?: boolean | null;
  control_mode?: string | null;
  notes?: string;
  binary_status?: string;
}

export function getOscillationClass(classId: OscillationClassId) {
  return OSCILLATION_CLASSES.find((c) => c.class_id === classId)!;
}

/** Heuristic classifier from simple envelope / mode features (CUDA tile can replace later). */
export function classifyOscillation(input: {
  frequency_hz?: number | null;
  duration_s?: number | null;
  decaying?: boolean | null;
  mode_changes_per_s?: number | null;
  mechanical_sensor?: boolean;
  after_load_change?: boolean;
}): OscillationClassId {
  if (input.mechanical_sensor) return 'MECHANICAL_VIBRATION';
  if ((input.mode_changes_per_s ?? 0) >= 2) return 'CONTROL_HUNTING';

  const f = input.frequency_hz ?? 60;
  const near60 = f >= 59.5 && f <= 60.5;
  const duration = input.duration_s ?? 0;
  const decaying = input.decaying === true;

  if (near60 && duration < 0.05 && input.decaying == null && !input.after_load_change) {
    return 'NORMAL_WAVEFORM';
  }
  if (input.after_load_change && decaying && duration <= 2) return 'NORMAL_TRANSIENT';
  if (decaying && duration <= 1) return 'RINGING';
  if (input.decaying === false && duration >= 2) return 'SUSTAINED_OSCILLATION';
  if (near60) return 'NORMAL_WAVEFORM';
  return 'RINGING';
}

export function severityForClass(classId: OscillationClassId): OscillationSeverity {
  return getOscillationClass(classId).severity as OscillationSeverity;
}

/** Whether WARN bit (bit 6) should assert for this class */
export function setsWarnBit(classId: OscillationClassId): boolean {
  return severityForClass(classId) === 'alarm';
}

export function verdictForClass(classId: OscillationClassId): StabilityVerdict {
  for (const [verdict, ids] of Object.entries(VERDICT_MAP) as [StabilityVerdict, OscillationClassId[]][]) {
    if (ids.includes(classId)) return verdict;
  }
  return 'STABLE';
}
