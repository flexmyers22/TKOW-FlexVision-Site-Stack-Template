'use client'

import { useEffect, useMemo, useState } from 'react'
import { replayAt, type NormalizedRun, type PoseSample } from '@/lib/mavs-replay'

const STEPS = 300

export function RoverReplay({ run, onPose }: { run: NormalizedRun; onPose?: (pose: { x_m: number; y_m: number } | null) => void }) {
  const [step, setStep] = useState(0)
  const simTimeNs = Math.round((step / STEPS) * run.duration_ns)
  const state = useMemo(() => replayAt(run, simTimeNs), [run, simTimeNs])
  const pose = useMemo(() => poseAlong(run.poses, simTimeNs), [run.poses, simTimeNs])
  useEffect(() => { onPose?.(pose) }, [onPose, pose])
  const map = useMemo(() => routeMap(run, pose), [run, pose])

  function goTo(simTime: number) {
    setStep(Math.round((simTime / run.duration_ns) * STEPS))
  }

  return (
    <section className="rounded-lg border border-border bg-card/85 p-3 backdrop-blur-md">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Plant rover</p>
        <h2 className="text-sm font-semibold text-foreground">{run.vehicle_ref}</h2>
        <p className="mt-1 text-[11px] text-muted-foreground">{run.route}</p>
        <p className="text-[10px] text-muted-foreground">{run.label}. Executed MAVS commit {run.executed_commit}.</p>
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="mb-2 flex flex-wrap gap-1">
          {run.checkpoints.map((checkpoint) => (
            <button
              key={checkpoint.checkpoint_id}
              type="button"
              onClick={() => goTo(checkpoint.sim_time_ns)}
              className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground"
              aria-pressed={state.checkpoints.at(-1)?.checkpoint_id === checkpoint.checkpoint_id && state.sim_time_ns === checkpoint.sim_time_ns}
            >
              {checkpoint.checkpoint_id}
            </button>
          ))}
        </div>
        <label className="text-[10px] text-muted-foreground" htmlFor="rover-scrub">
          Simulation time {(simTimeNs / 1_000_000).toFixed(0)} ms
        </label>
        <input
          id="rover-scrub"
          type="range"
          min={0}
          max={STEPS}
          value={step}
          onChange={(event) => setStep(Number(event.target.value))}
          className="mt-1 w-full"
          aria-label="Rover replay time"
        />
        <p className="mt-1 font-mono text-[11px] text-foreground">
          {pose ? `Pose ${meters(pose.x_m)} m east, ${meters(pose.y_m)} m north, ${meters(pose.z_m)} m up` : 'No pose at this time'}
        </p>
        <p className="text-[11px] font-semibold text-foreground">{state.frame_state === 'frame' ? 'Camera frame' : 'Frame unavailable'}</p>
        <p className="text-[11px] text-muted-foreground">Quaternion is stored and not converted. OpenUSD alignment is pending.</p>
      </div>
      <div className="min-w-0">
        {state.frame ? (
          <img
            src={`/api/mavs-replay?frame=${encodeURIComponent(state.frame.frame_path)}`}
            alt={`${state.frame.sensor_id} at ${state.frame.sim_time_ns} ns`}
            className="h-24 w-full rounded border border-border object-cover"
          />
        ) : (
          <div className="flex h-24 items-center justify-center rounded border border-dashed border-border text-xs font-semibold text-foreground">
            Frame unavailable
          </div>
        )}
        <svg viewBox={map.view} className="mt-2 h-16 w-full" role="img" aria-label="Top-down rover route">
          <polyline points={map.line} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
          <circle cx={map.dot.x} cy={map.dot.y} r="3" className="fill-primary" />
        </svg>
      </div>
    </section>
  )
}

function meters(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function poseAlong(poses: PoseSample[], simTimeNs: number): PoseSample | null {
  if (poses.length === 0) return null
  if (simTimeNs <= poses[0].sim_time_ns) return poses[0]
  for (let index = 1; index < poses.length; index += 1) {
    const previous = poses[index - 1]
    const next = poses[index]
    if (simTimeNs > next.sim_time_ns) continue
    const span = next.sim_time_ns - previous.sim_time_ns
    const t = span === 0 ? 1 : (simTimeNs - previous.sim_time_ns) / span
    return {
      ...previous,
      x_m: previous.x_m + (next.x_m - previous.x_m) * t,
      y_m: previous.y_m + (next.y_m - previous.y_m) * t,
      z_m: previous.z_m + (next.z_m - previous.z_m) * t,
    }
  }
  return poses[poses.length - 1]
}

function routeMap(run: NormalizedRun, pose: { x_m: number; y_m: number } | null) {
  const xs = run.poses.map((item) => item.x_m)
  const ys = run.poses.map((item) => item.y_m)
  const minX = Math.min(...xs) - 2
  const maxX = Math.max(...xs) + 2
  const minY = Math.min(...ys) - 2
  const maxY = Math.max(...ys) + 2
  const width = maxX - minX
  const height = maxY - minY
  const project = (x: number, y: number) => `${((x - minX) / width) * 100},${((maxY - y) / height) * 100}`
  return {
    view: '0 0 100 100',
    line: run.poses.map((item) => project(item.x_m, item.y_m)).join(' '),
    dot: pose
      ? { x: ((pose.x_m - minX) / width) * 100, y: ((maxY - pose.y_m) / height) * 100 }
      : { x: 0, y: 0 },
  }
}
