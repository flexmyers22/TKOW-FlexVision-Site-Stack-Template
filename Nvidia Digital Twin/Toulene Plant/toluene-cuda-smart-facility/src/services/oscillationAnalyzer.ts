/**
 * Electrical oscillation analysis pipeline:
 *   Read P,Q,V,I,f → remove 60 Hz carrier → amplitude/freqs → decay → mode transitions
 *   → STABLE | RINGING | HUNTING | UNSTABLE
 */

import {
  OSCILLATION_CLASSES,
  type OscillationClassId,
  type OscillationSeverity,
} from '../types/oscillation.js';

export type StabilityVerdict = 'STABLE' | 'RINGING' | 'HUNTING' | 'UNSTABLE';

export interface ElectricalSample {
  t_s: number;
  p_kw: number;
  q_kvar: number;
  v_v: number;
  i_a: number;
  frequency_hz: number;
  control_mode?: string;
}

export interface AnalysisConfig {
  carrier_hz: number;
  carrier_band_hz: number;
  sample_rate_hz: number;
  hunting_mode_changes: number;
  hunting_window_s: number;
  ringing_max_duration_s: number;
  unstable_min_duration_s: number;
  residual_amp_stable: number;
  residual_amp_ringing: number;
}

export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  carrier_hz: 60,
  carrier_band_hz: 0.5,
  sample_rate_hz: 1200,
  hunting_mode_changes: 2,
  hunting_window_s: 2,
  ringing_max_duration_s: 1.0,
  unstable_min_duration_s: 2.0,
  residual_amp_stable: 0.02,
  residual_amp_ringing: 0.15,
};

export interface SpectrumPeak {
  frequency_hz: number;
  amplitude: number;
}

export interface OscillationAnalysisResult {
  asset_id: string;
  timestamp: string;
  verdict: StabilityVerdict;
  detail_class: OscillationClassId;
  severity: OscillationSeverity;
  metrics: {
    carrier_hz: number;
    residual_rms: number;
    peak_amplitude: number;
    dominant_frequencies_hz: number[];
    decaying: boolean | null;
    decay_ratio: number | null;
    mode_transition_count: number;
    window_s: number;
  };
  pipeline: string[];
  set_warn_bit: boolean;
}

/** Mean of array */
function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** RMS */
function rms(xs: number[]): number {
  if (xs.length === 0) return 0;
  return Math.sqrt(mean(xs.map((x) => x * x)));
}

/**
 * Remove expected 60 Hz carrier from a signal using single-bin DFT notch
 * (subtract fundamental phasor at carrier_hz).
 */
export function removeCarrier(
  signal: number[],
  sampleRateHz: number,
  carrierHz = 60
): number[] {
  const n = signal.length;
  if (n < 4) return signal.slice();
  const w = (2 * Math.PI * carrierHz) / sampleRateHz;
  let re = 0;
  let im = 0;
  for (let i = 0; i < n; i++) {
    re += signal[i] * Math.cos(w * i);
    im += signal[i] * Math.sin(w * i);
  }
  re = (2 * re) / n;
  im = (2 * im) / n;
  return signal.map((x, i) => x - re * Math.cos(w * i) - im * Math.sin(w * i));
}

/** Simple magnitude spectrum peaks (DFT), skip DC and near-carrier band if residual. */
export function dominantFrequencies(
  signal: number[],
  sampleRateHz: number,
  topN = 3,
  skipNearHz?: { hz: number; band: number }
): SpectrumPeak[] {
  const n = signal.length;
  if (n < 8) return [];
  const peaks: SpectrumPeak[] = [];
  const maxK = Math.floor(n / 2);
  for (let k = 1; k < maxK; k++) {
    const f = (k * sampleRateHz) / n;
    if (skipNearHz && Math.abs(f - skipNearHz.hz) <= skipNearHz.band) continue;
    let re = 0;
    let im = 0;
    const w = (2 * Math.PI * k) / n;
    for (let i = 0; i < n; i++) {
      re += signal[i] * Math.cos(w * i);
      im += signal[i] * Math.sin(w * i);
    }
    const amp = (2 * Math.hypot(re, im)) / n;
    peaks.push({ frequency_hz: f, amplitude: amp });
  }
  peaks.sort((a, b) => b.amplitude - a.amplitude);
  return peaks.slice(0, topN);
}

/** Envelope via |Hilbert-ish| sliding abs max; then early/late RMS ratio. */
export function measureDecay(
  residual: number[],
  sampleRateHz: number
): { decaying: boolean | null; decay_ratio: number | null; duration_s: number } {
  const n = residual.length;
  const duration_s = n / sampleRateHz;
  if (n < 16) return { decaying: null, decay_ratio: null, duration_s };

  const third = Math.floor(n / 3);
  const early = rms(residual.slice(0, third));
  const late = rms(residual.slice(n - third));
  if (early < 1e-9) return { decaying: null, decay_ratio: null, duration_s };

  const decay_ratio = late / early;
  // ratio << 1 → decaying; ≈1 → sustained; >1 → growing (treat as not decaying)
  const decaying = decay_ratio < 0.55;
  return { decaying, decay_ratio, duration_s };
}

/** Count control-mode transitions in sample window */
export function countModeTransitions(samples: ElectricalSample[]): number {
  let count = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1].control_mode;
    const b = samples[i].control_mode;
    if (a != null && b != null && a !== b) count++;
  }
  return count;
}

export function mapDetailToVerdict(classId: OscillationClassId): StabilityVerdict {
  switch (classId) {
    case 'CONTROL_HUNTING':
      return 'HUNTING';
    case 'RINGING':
      return 'RINGING';
    case 'SUSTAINED_OSCILLATION':
      return 'UNSTABLE';
    case 'NORMAL_WAVEFORM':
    case 'NORMAL_TRANSIENT':
      return 'STABLE';
    case 'MECHANICAL_VIBRATION':
      return 'RINGING';
    default:
      return 'STABLE';
  }
}

/**
 * Full pipeline on a window of electrical samples.
 * Prefers voltage residual for carrier removal; also checks P residual amplitude.
 */
export function analyzeElectricalWindow(
  assetId: string,
  samples: ElectricalSample[],
  config: AnalysisConfig = DEFAULT_ANALYSIS_CONFIG
): OscillationAnalysisResult {
  const pipeline = [
    'Read P, Q, V, I and frequency',
    'Remove expected 60 Hz carrier where appropriate',
    'Measure amplitude and dominant frequencies',
    'Determine whether oscillation is decaying',
    'Check control-mode transition count',
    'Classify: STABLE / RINGING / HUNTING / UNSTABLE',
  ];

  const fs = config.sample_rate_hz;
  const v = samples.map((s) => s.v_v);
  const p = samples.map((s) => s.p_kw);
  const i = samples.map((s) => s.i_a);

  // Step 2 — notch 60 Hz on V (and I); P is already envelope-scale so light demean
  const vResidual = removeCarrier(v, fs, config.carrier_hz);
  const iResidual = removeCarrier(i, fs, config.carrier_hz);
  const pMean = mean(p);
  const pResidual = p.map((x) => x - pMean);

  // Step 3 — amplitudes + dominant freqs on residual V
  const residual_rms = rms(vResidual);
  const peak_amplitude = Math.max(...vResidual.map(Math.abs), 0);
  const peaks = dominantFrequencies(vResidual, fs, 3, {
    hz: config.carrier_hz,
    band: config.carrier_band_hz,
  });
  const dominant_frequencies_hz = peaks.map((pk) => Number(pk.frequency_hz.toFixed(2)));

  // Step 4 — decay
  const { decaying, decay_ratio, duration_s } = measureDecay(vResidual, fs);

  // Step 5 — mode transitions
  const mode_transition_count = countModeTransitions(samples);
  const window_s =
    samples.length > 1
      ? samples[samples.length - 1].t_s - samples[0].t_s
      : duration_s;

  // Step 6 — classify
  let detail_class: OscillationClassId = 'NORMAL_WAVEFORM';
  let verdict: StabilityVerdict = 'STABLE';

  const hunting =
    mode_transition_count >= config.hunting_mode_changes &&
    window_s <= config.hunting_window_s + 0.5;

  if (hunting) {
    detail_class = 'CONTROL_HUNTING';
    verdict = 'HUNTING';
  } else if (
    residual_rms >= config.residual_amp_ringing &&
    decaying === false &&
    duration_s >= config.unstable_min_duration_s
  ) {
    detail_class = 'SUSTAINED_OSCILLATION';
    verdict = 'UNSTABLE';
  } else if (
    residual_rms >= config.residual_amp_stable &&
    decaying === true &&
    duration_s <= config.ringing_max_duration_s
  ) {
    detail_class = 'RINGING';
    verdict = 'RINGING';
  } else if (residual_rms >= config.residual_amp_stable && decaying === true) {
    detail_class = 'NORMAL_TRANSIENT';
    verdict = 'STABLE';
  } else if (residual_rms < config.residual_amp_stable) {
    detail_class = 'NORMAL_WAVEFORM';
    verdict = 'STABLE';
  } else if (decaying === false && residual_rms >= config.residual_amp_ringing) {
    detail_class = 'SUSTAINED_OSCILLATION';
    verdict = 'UNSTABLE';
  } else {
    detail_class = 'RINGING';
    verdict = 'RINGING';
  }

  const severity = OSCILLATION_CLASSES.find((c) => c.class_id === detail_class)!
    .severity as OscillationSeverity;

  return {
    asset_id: assetId,
    timestamp: new Date().toISOString(),
    verdict,
    detail_class,
    severity,
    metrics: {
      carrier_hz: config.carrier_hz,
      residual_rms: Number(residual_rms.toFixed(6)),
      peak_amplitude: Number(peak_amplitude.toFixed(6)),
      dominant_frequencies_hz,
      decaying,
      decay_ratio: decay_ratio != null ? Number(decay_ratio.toFixed(4)) : null,
      mode_transition_count,
      window_s: Number(window_s.toFixed(4)),
    },
    pipeline,
    set_warn_bit: verdict === 'HUNTING' || verdict === 'UNSTABLE',
    // expose unused residuals lightly for debugging consumers
    ...({ _debug: { i_rms: rms(iResidual), p_rms: rms(pResidual) } } as object),
  };
}

/** Synthesize a simple window for demos / CUDA tile tests */
export function synthesizeWindow(opts: {
  kind: StabilityVerdict;
  duration_s?: number;
  sample_rate_hz?: number;
}): ElectricalSample[] {
  const fs = opts.sample_rate_hz ?? 1200;
  const duration = opts.duration_s ?? (opts.kind === 'UNSTABLE' ? 3 : opts.kind === 'RINGING' ? 0.6 : 1);
  const n = Math.floor(duration * fs);
  const samples: ElectricalSample[] = [];
  let mode = 'grid_following';

  for (let i = 0; i < n; i++) {
    const t = i / fs;
    const carrier = 480 * Math.sin(2 * Math.PI * 60 * t);
    let residual = 0;
    if (opts.kind === 'RINGING') {
      residual = 40 * Math.exp(-6 * t) * Math.sin(2 * Math.PI * 12 * t);
    } else if (opts.kind === 'UNSTABLE') {
      residual = 25 * Math.sin(2 * Math.PI * 3.5 * t);
    } else if (opts.kind === 'HUNTING' && i > 0 && i % Math.floor(fs * 0.4) === 0) {
      mode = mode === 'grid_following' ? 'islanded' : 'grid_following';
    }
    const v = carrier + residual;
    samples.push({
      t_s: t,
      v_v: v,
      i_a: (v / 480) * 10,
      p_kw: opts.kind === 'STABLE' ? 0 : residual * 0.1,
      q_kvar: 0,
      frequency_hz: 60,
      control_mode: mode,
    });
  }

  // Force enough mode flips for hunting demo (≥ 2 transitions)
  if (opts.kind === 'HUNTING') {
    const segment = Math.max(1, Math.floor(fs * 0.25));
    for (let i = 0; i < samples.length; i++) {
      samples[i].control_mode = Math.floor(i / segment) % 2 === 0 ? 'grid_following' : 'islanded';
    }
  }

  return samples;
}
