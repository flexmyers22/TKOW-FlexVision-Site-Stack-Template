import { createHash } from 'node:crypto'
import type { CheckpointSample, FrameSample, NormalizedRun, PoseSample, RunKind } from './mavs-replay.ts'

export { FRAME_AGE_LIMIT_NS, replayAt } from './mavs-replay.ts'
export type { CheckpointSample, FrameSample, NormalizedRun, PoseSample, ReplayState, RunKind } from './mavs-replay.ts'

export const SCHEMA_VERSION = '1.0'
export const SYNTHETIC_RUN_ID = 'RUN-SYNTH-PERIMETER-001'

export type RunManifest = {
  record_type: 'simulation_run'
  schema_version: string
  run_id: string
  status: string
  source: {
    project: string
    repository: string
    branch: string
    reference_commit: string
    executed_commit: string
    kind: RunKind
  }
  scenario: {
    scenario_id: string
    config_refs: string[]
    scene_ref: string
    vehicle_ref: string
    sensor_set: string[]
    coordinate_frame: string
    units: string
    route: string
  }
  inputs: { path: string; sha256: string }[]
  provenance: { assumptions: string[]; revision: string }
}

export type RunFiles = {
  manifest: RunManifest
  files: Record<string, Buffer>
}

const imported = new Map<string, { evidence_sha256: string; record: NormalizedRun }>()

export function resetRunImports() {
  imported.clear()
}

export function sha256(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function validateRun(input: RunFiles): NormalizedRun {
  const manifest = input.manifest
  if (manifest.record_type !== 'simulation_run') throw new Error('Unsupported record type.')
  if (manifest.schema_version !== SCHEMA_VERSION) throw new Error(`Unsupported schema version ${manifest.schema_version}.`)
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,80}$/.test(manifest.run_id)) throw new Error('The run ID is not a stable identifier.')
  if (manifest.source.kind !== 'synthetic_fixture' && manifest.source.kind !== 'mavs') {
    throw new Error('The source kind must be synthetic_fixture or mavs.')
  }
  if (manifest.source.kind === 'synthetic_fixture' && manifest.source.executed_commit !== 'Unknown') {
    throw new Error('A synthetic fixture cannot claim an executed MAVS commit.')
  }
  if (!Array.isArray(manifest.inputs) || manifest.inputs.length === 0) throw new Error('The manifest has no input hashes.')

  for (const item of manifest.inputs) {
    assertSafeRelative(item.path)
    const bytes = input.files[item.path]
    if (!bytes) throw new Error(`Missing evidence file ${item.path}.`)
    const digest = sha256(bytes)
    if (digest !== item.sha256) throw new Error(`Hash mismatch for ${item.path}.`)
  }

  const poses = parsePoses(textFile(input, 'poses.csv'))
  const frames = parseFrames(textFile(input, 'frame_index.csv'))
  const checkpoints = parseCheckpoints(textFile(input, 'checkpoints.csv'))
  for (const frame of frames) {
    assertSafeRelative(frame.frame_path)
    if (!input.files[frame.frame_path]) throw new Error(`Missing frame ${frame.frame_path}.`)
    if (!manifest.inputs.some((item) => item.path === frame.frame_path)) {
      throw new Error(`Frame ${frame.frame_path} is not listed in the manifest.`)
    }
  }

  const evidence_sha256 = sha256(Buffer.from(manifest.inputs.map((item) => `${item.path}:${item.sha256}`).sort().join('\n')))
  return {
    run_id: manifest.run_id,
    scenario_id: manifest.scenario.scenario_id,
    source_kind: manifest.source.kind,
    reference_commit: manifest.source.reference_commit,
    executed_commit: manifest.source.executed_commit,
    scene_ref: manifest.scenario.scene_ref,
    vehicle_ref: manifest.scenario.vehicle_ref,
    sensor_set: manifest.scenario.sensor_set,
    coordinate_frame: manifest.scenario.coordinate_frame,
    units: manifest.scenario.units,
    route: manifest.scenario.route,
    assumptions: manifest.provenance.assumptions,
    revision: manifest.provenance.revision,
    label: manifest.source.kind === 'synthetic_fixture' ? 'Synthetic fixture' : 'MAVS run',
    duration_ns: poses[poses.length - 1].sim_time_ns,
    poses,
    frames,
    checkpoints,
    counts: { poses: poses.length, frames: frames.length, checkpoints: checkpoints.length },
    evidence_sha256,
  }
}

export function importRun(input: RunFiles): NormalizedRun {
  const record = validateRun(input)
  const prior = imported.get(record.run_id)
  if (prior) {
    if (prior.evidence_sha256 !== record.evidence_sha256) {
      throw new Error(`Run ${record.run_id} already exists with different evidence.`)
    }
    return prior.record
  }
  imported.set(record.run_id, { evidence_sha256: record.evidence_sha256, record })
  return record
}

function textFile(input: RunFiles, path: string) {
  const bytes = input.files[path]
  if (!bytes) throw new Error(`Missing evidence file ${path}.`)
  return bytes.toString('utf8')
}

function parsePoses(csv: string): PoseSample[] {
  const rows = table(csv, ['sim_time_ns', 'x_m', 'y_m', 'z_m', 'qw', 'qx', 'qy', 'qz'])
  const poses = rows.map((row) => ({
    sim_time_ns: integerNs(row.sim_time_ns),
    x_m: finite(row.x_m, 'x_m'),
    y_m: finite(row.y_m, 'y_m'),
    z_m: finite(row.z_m, 'z_m'),
    qw: finite(row.qw, 'qw'),
    qx: finite(row.qx, 'qx'),
    qy: finite(row.qy, 'qy'),
    qz: finite(row.qz, 'qz'),
  }))
  assertIncreasing(poses.map((pose) => pose.sim_time_ns), 'pose')
  return poses
}

function parseFrames(csv: string): FrameSample[] {
  const rows = table(csv, ['sim_time_ns', 'sensor_id', 'frame_path'])
  const frames = rows.map((row) => ({
    sim_time_ns: integerNs(row.sim_time_ns),
    sensor_id: token(row.sensor_id, 'sensor_id'),
    frame_path: row.frame_path.trim(),
  }))
  const seen = new Set<string>()
  for (const frame of frames) {
    const key = `${frame.sensor_id}@${frame.sim_time_ns}`
    if (seen.has(key)) throw new Error(`Duplicate frame timestamp for ${frame.sensor_id}.`)
    seen.add(key)
  }
  assertIncreasing(frames.map((frame) => frame.sim_time_ns), 'frame')
  return frames
}

function parseCheckpoints(csv: string): CheckpointSample[] {
  const rows = table(csv, ['sim_time_ns', 'checkpoint_id', 'event_type'])
  const checkpoints = rows.map((row) => ({
    sim_time_ns: integerNs(row.sim_time_ns),
    checkpoint_id: token(row.checkpoint_id, 'checkpoint_id'),
    event_type: token(row.event_type, 'event_type'),
  }))
  const ids = new Set<string>()
  for (const checkpoint of checkpoints) {
    if (ids.has(checkpoint.checkpoint_id)) throw new Error(`Duplicate checkpoint ${checkpoint.checkpoint_id}.`)
    ids.add(checkpoint.checkpoint_id)
  }
  return checkpoints.sort((a, b) => a.sim_time_ns - b.sim_time_ns)
}

function table(csv: string, header: string[]) {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) throw new Error('The evidence table has no rows.')
  const actual = lines[0].split(',').map((cell) => cell.trim())
  if (actual.join(',') !== header.join(',')) throw new Error(`Expected columns ${header.join(', ')}.`)
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((cell) => cell.trim())
    if (cells.length !== header.length) throw new Error('A table row has the wrong number of columns.')
    return Object.fromEntries(header.map((name, index) => [name, cells[index]]))
  })
}

function integerNs(value: string) {
  if (!/^(0|[1-9]\d*)$/.test(value)) throw new Error('Simulation time must be a non-negative integer nanosecond count.')
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) throw new Error('Simulation time is outside the supported range.')
  return parsed
}

function finite(value: string, name: string) {
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) throw new Error(`${name} is not a finite number.`)
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`${name} is not a finite number.`)
  return parsed
}

function token(value: string, name: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,40}$/.test(value)) throw new Error(`${name} contains unsupported characters.`)
  return value
}

function assertIncreasing(times: number[], label: string) {
  for (let index = 1; index < times.length; index += 1) {
    if (times[index] <= times[index - 1]) throw new Error(`Duplicate or backwards ${label} timestamp.`)
  }
}

function assertSafeRelative(file: string) {
  if (!file || file.includes('\\') || file.startsWith('/') || /^[A-Za-z]:/.test(file)) {
    throw new Error(`Path ${file || '(blank)'} is outside the run folder.`)
  }
  const parts = file.split('/')
  if (parts.some((part) => part === '' || part === '.' || part === '..')) {
    throw new Error(`Path ${file} is outside the run folder.`)
  }
}
