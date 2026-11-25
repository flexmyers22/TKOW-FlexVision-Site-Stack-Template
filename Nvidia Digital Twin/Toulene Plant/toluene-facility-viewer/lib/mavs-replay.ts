export const FRAME_AGE_LIMIT_NS = 100_000_000

export type RunKind = 'synthetic_fixture' | 'mavs'

export type PoseSample = {
  sim_time_ns: number
  x_m: number
  y_m: number
  z_m: number
  qw: number
  qx: number
  qy: number
  qz: number
}

export type FrameSample = {
  sim_time_ns: number
  sensor_id: string
  frame_path: string
}

export type CheckpointSample = {
  sim_time_ns: number
  checkpoint_id: string
  event_type: string
}

export type NormalizedRun = {
  run_id: string
  scenario_id: string
  source_kind: RunKind
  reference_commit: string
  executed_commit: string
  scene_ref: string
  vehicle_ref: string
  sensor_set: string[]
  coordinate_frame: string
  units: string
  route: string
  assumptions: string[]
  revision: string
  label: string
  duration_ns: number
  poses: PoseSample[]
  frames: FrameSample[]
  checkpoints: CheckpointSample[]
  counts: { poses: number; frames: number; checkpoints: number }
  evidence_sha256: string
}

export type ReplayState = {
  sim_time_ns: number
  pose: PoseSample | null
  frame: FrameSample | null
  frame_state: 'frame' | 'Frame unavailable'
  checkpoints: CheckpointSample[]
}

export function replayAt(run: NormalizedRun, simTimeNs: number, ageLimitNs = FRAME_AGE_LIMIT_NS): ReplayState {
  if (!Number.isInteger(simTimeNs) || simTimeNs < 0) throw new Error('Replay time must be a non-negative integer nanosecond count.')
  const pose = latestAtOrBefore(run.poses, simTimeNs)
  const frame = latestAtOrBefore(run.frames, simTimeNs)
  const fresh = frame !== null && simTimeNs - frame.sim_time_ns <= ageLimitNs
  return {
    sim_time_ns: simTimeNs,
    pose,
    frame: fresh ? frame : null,
    frame_state: fresh ? 'frame' : 'Frame unavailable',
    checkpoints: run.checkpoints.filter((item) => item.sim_time_ns <= simTimeNs),
  }
}

function latestAtOrBefore<T extends { sim_time_ns: number }>(samples: T[], simTimeNs: number) {
  let match: T | null = null
  for (const sample of samples) {
    if (sample.sim_time_ns > simTimeNs) break
    match = sample
  }
  return match
}
