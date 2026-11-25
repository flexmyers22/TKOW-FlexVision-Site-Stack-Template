"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Activity, ChevronDown, CircuitBoard, FileSpreadsheet, Layers, LoaderCircle, Play, Zap } from "lucide-react"
import {
  PLANT_EQUIPMENT,
  type PlantRunResult,
  activeFaults,
  applyPlantRun,
} from "@/lib/plant-data"
import { EquipmentList } from "@/components/equipment-list"
import { EquipmentDetail } from "@/components/equipment-detail"
import { RoverReplay } from "@/components/rover-replay"
import type { NormalizedRun } from "@/lib/mavs-replay"
import { TRANSFORMER_RATING, TRANSFORMER_RATING_LINES } from "@/lib/electrical-rating"
import { BASE_LAYOUT, ROOM_ZONES, assetsInZone, roomZoneById } from "@/lib/room-zones"

const PlantScene = dynamic(
  () => import("@/components/scene/plant-scene").then((m) => m.PlantScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        Loading 3D facility…
      </div>
    ),
  },
)

interface RunResponse {
  run?: PlantRunResult
  csvPath?: string | null
  error?: string
}

export function FacilityDashboard() {
  const [selectedTag, setSelectedTag] = useState<string | null>("R101")
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [areaId, setAreaId] = useState<string | null>(null)
  const [leftView, setLeftView] = useState("facility")
  const [run, setRun] = useState<PlantRunResult | null>(null)
  const [csvPath, setCsvPath] = useState<string | null>(null)
  const [tankLevel, setTankLevel] = useState(72)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replay, setReplay] = useState<NormalizedRun | null>(null)
  const [roverPose, setRoverPose] = useState<{ x_m: number; y_m: number } | null>(null)

  const equipment = useMemo(
    () => (run ? applyPlantRun(PLANT_EQUIPMENT, run) : PLANT_EQUIPMENT),
    [run],
  )

  const handleResponse = useCallback(async (res: Response) => {
    const data = (await res.json()) as RunResponse
    if (!res.ok || !data.run) throw new Error(data.error ?? `Plant run failed (${res.status})`)
    setRun(data.run)
    setCsvPath(data.csvPath ?? null)
    setError(null)
  }, [])

  useEffect(() => {
    fetch("/api/plant-run")
      .then(handleResponse)
      .catch((e: Error) => setError(e.message))
  }, [handleResponse])

  useEffect(() => {
    fetch("/api/mavs-replay")
      .then(async (response) => {
        const body = (await response.json()) as NormalizedRun & { error?: string }
        if (!response.ok) throw new Error(body.error ?? "The rover replay could not be loaded.")
        setReplay(body)
      })
      .catch(() => setReplay(null))
  }, [])

  const runPlantFlow = useCallback(async () => {
    setRunning(true)
    try {
      await handleResponse(
        await fetch("/api/plant-run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tankLevelPct: tankLevel }),
        }),
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRunning(false)
    }
  }, [handleResponse, tankLevel])

  const selectUnit = useCallback((tag: string) => {
    setSelectedTag(tag)
    setAreaId(null)
    setInspectorOpen(true)
  }, [])

  const selectTransformer = useCallback(() => {
    setSelectedTag(null)
    setAreaId("XFMR")
    setInspectorOpen(true)
  }, [])

  const selected = useMemo(
    () => equipment.find((e) => e.tag === selectedTag) ?? null,
    [equipment, selectedTag],
  )

  const kpis = useMemo(() => {
    const running = equipment.filter((e) => e.status === "running").length
    const alarms = equipment.reduce((n, e) => n + activeFaults(e).length, 0)
    const power = equipment.reduce((n, e) => n + e.energy.powerKw, 0)
    return { running, alarms, power }
  }, [equipment])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <header className="z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <CircuitBoard className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-sm font-semibold leading-tight text-balance">
              Toluene Production Floor
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Kpi icon={<Activity className="h-3.5 w-3.5" />} label="Running" value={`${kpis.running}/${equipment.length}`} />
          <Kpi icon={<Zap className="h-3.5 w-3.5" />} label="Load" value={`${(kpis.power / 1000).toFixed(2)} MW`} />
          <Kpi
            icon={<Zap className="h-3.5 w-3.5" />}
            label="Alarms"
            value={String(kpis.alarms)}
            danger={kpis.alarms > 0}
          />
        </div>
      </header>

      {/* Main viewport with floating HUD panels */}
      <main className="relative flex-1">
        <div className="absolute inset-0">
          <PlantScene equipment={equipment} selectedTag={selectedTag} onSelect={selectUnit} areaId={areaId} onSelectArea={setAreaId} rover={roverPose} roverPath={replay?.poses} />
        </div>

        {/* Overlay layer */}
        <div className="pointer-events-none absolute inset-0 p-3">
          <div className="pointer-events-auto flex w-64 max-h-full flex-col gap-3 self-start overflow-y-auto">
            <section className="rounded-lg border border-border bg-card/90 p-3 backdrop-blur-md">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="left-view">
                View
              </label>
              <select
                id="left-view"
                aria-label="Left side panels"
                className="mt-2 w-full rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground"
                value={leftView}
                onChange={(event) => setLeftView(event.target.value)}
              >
                <option value="facility">Facility view</option>
                <option value="flow">Plant flow</option>
                <option value="legend">Status</option>
                <option value="rover">Plant rover</option>
              </select>
              <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="room-area">
                Areas
              </label>
              <AreaSelect
                areaId={areaId}
                onSelect={(id) => {
                  if (id === "XFMR") {
                    selectTransformer()
                    return
                  }
                  setAreaId(id)
                }}
              />
            </section>
            <section className="overflow-hidden rounded-lg border border-border bg-card/90 backdrop-blur-md">
              <button
                type="button"
                aria-expanded={inspectorOpen}
                onClick={() => setInspectorOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Equipment Inspector
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-foreground">
                    {selected?.tag ?? (areaId === "XFMR" ? "XFMR" : "None")}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${inspectorOpen ? "rotate-180" : ""}`} />
                </span>
              </button>
              {inspectorOpen && (
                <div className="max-h-[min(70vh,40rem)] overflow-y-auto border-t border-border">
                  <div className="border-b border-border p-3">
                    <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Layers className="h-3.5 w-3.5" />
                      Plant Units
                    </h2>
                    <EquipmentList equipment={equipment} selectedTag={selectedTag} onSelect={selectUnit} />
                    <TransformerUnit selected={areaId === "XFMR"} onSelect={selectTransformer} />
                  </div>
                  {selected ? (
                    <EquipmentDetail equipment={selected} />
                  ) : areaId === "XFMR" ? (
                    <TransformerNotes />
                  ) : (
                    <p className="px-4 py-3 text-xs text-muted-foreground">Select a plant unit to inspect.</p>
                  )}
                </div>
              )}
            </section>
            {leftView === "flow" && (
              <RunPanel
                run={run}
                csvPath={csvPath}
                tankLevel={tankLevel}
                onTankLevel={setTankLevel}
                running={running}
                error={error}
                onRun={runPlantFlow}
              />
            )}
            {leftView === "legend" && <Legend />}
            {replay && (
              <div className={leftView === "rover" ? "" : "hidden"}>
                <RoverReplay run={replay} onPose={setRoverPose} />
              </div>
            )}
          </div>
        </div>

        {/*
          Button explainer, hidden from the page:
          Drag to orbit · scroll to zoom · click a unit to inspect
        */}
      </main>
    </div>
  )
}

function AreaSelect({ areaId, onSelect }: { areaId: string | null; onSelect: (id: string | null) => void }) {
  return (
    <select
      id="room-area"
      aria-label="Areas in the environment"
      className="mt-2 w-full rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground"
      value={areaId ?? "overview"}
      onChange={(event) => onSelect(event.target.value === "overview" ? null : event.target.value)}
    >
      <option value="overview">Plant overview</option>
      <optgroup label="North row">
        {ROOM_ZONES.filter((item) => item.marker[1] < 0 && !item.exterior).map((item) => (
          <option key={item.id} value={item.id}>{item.id} · {item.name}</option>
        ))}
      </optgroup>
      <optgroup label="Production line">
        <option value="LINE">Toluene Production Line</option>
      </optgroup>
      <optgroup label="South row">
        {ROOM_ZONES.filter((item) => item.marker[1] > 2 && !item.exterior && item.id !== "ROVER").map((item) => (
          <option key={item.id} value={item.id}>{`${item.id} · ${item.name}`}</option>
        ))}
      </optgroup>
      <optgroup label="Rover">
        {ROOM_ZONES.filter((item) => item.id === "ROVER").map((item) => (
          <option key={item.id} value={item.id}>Rover parking</option>
        ))}
      </optgroup>
      <optgroup label="Outside">
        {ROOM_ZONES.filter((item) => item.exterior).map((item) => (
          <option key={item.id} value={item.id}>{item.id === "VEHICLE" ? "Vehicle parking" : `${item.id} · ${item.name}`}</option>
        ))}
      </optgroup>
    </select>
  )
}

function TransformerUnit({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="mt-2 flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left"
      style={{
        borderColor: selected ? "var(--primary)" : "var(--border)",
        background: selected ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "var(--card)",
      }}
    >
      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[#aeb4bf]" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-semibold text-foreground">XFMR</span>
          <span className="font-mono text-[10px] uppercase text-muted-foreground">Proposed</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">Power transformer</span>
        <span className="block truncate font-mono text-[10px] text-foreground">
          {TRANSFORMER_RATING.voltageV} V · {TRANSFORMER_RATING.phases} phase · {TRANSFORMER_RATING.amperageA} A
        </span>
      </span>
    </button>
  )
}

function TransformerNotes() {
  const zone = roomZoneById("XFMR")
  return (
    <div className="space-y-3 px-4 py-4">
      <div>
        <p className="font-mono text-lg font-bold text-primary">XFMR</p>
        <h2 className="mt-1 text-sm font-medium text-foreground">{zone?.name ?? "Power transformer"}</h2>
        <p className="mt-2 text-pretty text-xs leading-relaxed text-muted-foreground">{zone?.description}</p>
      </div>
      <TransformerRating />
      <p className="font-mono text-[10px] text-muted-foreground">
        {zone?.status} · {zone?.provenance} · {BASE_LAYOUT.id} · {assetsInZone("XFMR").length} recorded assets
      </p>
    </div>
  )
}

function TransformerRating() {
  return (
    <div className="space-y-1">
      <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[10px] text-foreground">
        {TRANSFORMER_RATING_LINES.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[10px] text-muted-foreground">
        Recorded on the {TRANSFORMER_RATING.source}. The commercial and residential figures have no unit named on that sheet.
      </p>
    </div>
  )
}

function Kpi({
  icon,
  label,
  value,
  danger,
}: {
  icon: React.ReactNode
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-2.5 py-1.5"
      style={{
        borderColor: danger ? "var(--status-fault)" : "var(--border)",
        background: danger ? "color-mix(in oklch, var(--status-fault) 12%, transparent)" : "var(--secondary)",
      }}
    >
      <span style={{ color: danger ? "var(--status-fault)" : "var(--primary)" }}>{icon}</span>
      <div className="leading-none">
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div
          className="font-mono text-sm font-semibold"
          style={{ color: danger ? "var(--status-fault)" : "var(--foreground)" }}
        >
          {value}
        </div>
      </div>
    </div>
  )
}

function RunPanel({
  run,
  csvPath,
  tankLevel,
  onTankLevel,
  running,
  error,
  onRun,
}: {
  run: PlantRunResult | null
  csvPath: string | null
  tankLevel: number
  onTankLevel: (v: number) => void
  running: boolean
  error: string | null
  onRun: () => void
}) {
  const reactor = run?.units.find((u) => u.equipment_tag === "R101")?.outputs
  const pass = run ? run.summary.alarms === 0 : null
  return (
    <div className="rounded-lg border border-border bg-card/85 p-3 backdrop-blur-md">
      <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Play className="h-3.5 w-3.5" />
        Plant Flow Run
      </h2>
      <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        Tank level
        <span className="font-mono text-foreground">{tankLevel}%</span>
      </label>
      <input
        type="range"
        min={0}
        max={100}
        value={tankLevel}
        onChange={(e) => onTankLevel(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--primary)]"
        aria-label="Tank level percent"
      />
      <button
        type="button"
        onClick={onRun}
        disabled={running}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity disabled:opacity-60"
      >
        {running ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        {running ? "Running plant flow…" : "Run Plant Flow"}
      </button>

      {run && (
        <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[11px]">
          <dt className="text-muted-foreground">Run</dt>
          <dd className="truncate text-right text-foreground" title={run.run_id}>
            {run.run_id.replace("RUN-", "")}
          </dd>
          <dt className="text-muted-foreground">Feed</dt>
          <dd className="text-right text-foreground">{run.summary.feed_rate_lb_hr.toLocaleString()} lb/hr</dd>
          <dt className="text-muted-foreground">Conversion</dt>
          <dd className="text-right text-foreground">{run.summary.reactor_conversion_pct}%</dd>
          {reactor && (
            <>
              <dt className="text-muted-foreground">Benzene</dt>
              <dd className="text-right text-foreground">{Number(reactor.benzene_lb_hr).toLocaleString()} lb/hr</dd>
              <dt className="text-muted-foreground">Xylene</dt>
              <dd className="text-right text-foreground">{Number(reactor.xylene_lb_hr).toLocaleString()} lb/hr</dd>
            </>
          )}
          <dt className="text-muted-foreground">Result</dt>
          <dd
            className="text-right font-semibold"
            style={{ color: pass ? "var(--status-run)" : "var(--status-fault)" }}
          >
            {pass ? "PASS" : "FAIL"}
          </dd>
        </dl>
      )}
      {csvPath && (
        <p
          className="mt-2 flex items-center gap-1.5 truncate text-[10px] text-muted-foreground"
          title={csvPath}
        >
          <FileSpreadsheet className="h-3 w-3 shrink-0" />
          {csvPath.split(/[\\/]/).slice(-2).join("/")}
        </p>
      )}
      {error && <p className="mt-2 text-[11px] text-[var(--status-fault)]">{error}</p>}
    </div>
  )
}

function Legend() {
  const items = [
    { label: "Running", token: "var(--status-run)" },
    { label: "Standby", token: "var(--status-standby)" },
    { label: "Fault", token: "var(--status-fault)" },
    { label: "Idle", token: "var(--status-idle)" },
  ]
  return (
    <div className="rounded-lg border border-border bg-card/85 p-3 backdrop-blur-md">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Status Legend
      </h2>
      <ul className="grid grid-cols-2 gap-1.5">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-2 text-xs text-foreground">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: i.token, boxShadow: `0 0 6px ${i.token}` }}
            />
            {i.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
