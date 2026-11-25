import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  FRAME_AGE_LIMIT_NS,
  importRun,
  replayAt,
  resetRunImports,
  sha256,
  type RunFiles,
  type RunManifest,
} from './mavs-contract.ts'

const runDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/plant-perimeter-rover/RUN-SYNTH-PERIMETER-001')

function loadFixture(): RunFiles {
  const manifest = JSON.parse(readFileSync(path.join(runDir, 'manifest.json'), 'utf8')) as RunManifest
  const files: Record<string, Buffer> = {}
  for (const item of manifest.inputs) files[item.path] = readFileSync(path.join(runDir, item.path))
  return { manifest, files }
}

describe('synthetic plant-perimeter import', () => {
  beforeEach(() => resetRunImports())

  it('imports the fixture counts and accepts the same bytes again', () => {
    const first = importRun(loadFixture())
    const second = importRun(loadFixture())
    assert.equal(first.run_id, 'RUN-SYNTH-PERIMETER-001')
    assert.equal(first.source_kind, 'synthetic_fixture')
    assert.equal(first.executed_commit, 'Unknown')
    assert.deepEqual(first.counts, { poses: 7, frames: 2, checkpoints: 3 })
    assert.equal(second, first)
  })

  it('rejects a conflicting reimport, a bad schema, and a path outside the run', () => {
    importRun(loadFixture())
    const changed = loadFixture()
    changed.files['poses.csv'] = Buffer.from(`${changed.files['poses.csv'].toString('utf8')}4000000000,1,1,0,1,0,0,0\n`)
    changed.manifest.inputs = changed.manifest.inputs.map((item) => item.path === 'poses.csv' ? { ...item, sha256: sha256(changed.files['poses.csv']) } : item)
    assert.throws(() => importRun(changed), /different evidence/)

    resetRunImports()
    const badSchema = loadFixture()
    badSchema.manifest.schema_version = '9'
    assert.throws(() => importRun(badSchema), /Unsupported schema version/)

    resetRunImports()
    const escaped = loadFixture()
    escaped.files['frame_index.csv'] = Buffer.from('sim_time_ns,sensor_id,frame_path\n0,cam-front,../secret.svg\n')
    escaped.manifest.inputs = escaped.manifest.inputs.map((item) => item.path === 'frame_index.csv' ? { ...item, sha256: sha256(escaped.files['frame_index.csv']) } : item)
    assert.throws(() => importRun(escaped), /outside the run folder/)
  })

  it('aligns pose, checkpoint, and frame age without using a future frame', () => {
    const run = importRun(loadFixture())
    const start = replayAt(run, 0)
    assert.equal(start.pose?.x_m, 16)
    assert.equal(start.pose?.y_m, 8)
    assert.equal(start.frame?.frame_path, 'frames/cam-front-000.svg')
    assert.deepEqual(start.checkpoints.map((item) => item.checkpoint_id), ['CP-START'])

    const gate = replayAt(run, 1_500_000_000)
    assert.equal(gate.pose?.x_m, -21)
    assert.equal(gate.pose?.y_m, -16)
    assert.equal(gate.frame_state, 'Frame unavailable')
    assert.equal(gate.checkpoints.at(-1)?.checkpoint_id, 'CP-GATE')

    const west = replayAt(run, 2_000_000_000)
    assert.equal(west.frame?.frame_path, 'frames/cam-front-200.svg')

    const atLimit = replayAt(run, 2_000_000_000 + FRAME_AGE_LIMIT_NS)
    assert.equal(atLimit.frame_state, 'frame')

    const stale = replayAt(run, 2_000_000_000 + FRAME_AGE_LIMIT_NS + 1)
    assert.equal(stale.frame_state, 'Frame unavailable')

    const beforeWest = replayAt(run, 1_999_999_999)
    assert.equal(beforeWest.frame, null)
    assert.notEqual(beforeWest.frame_state, 'frame')
  })
})
