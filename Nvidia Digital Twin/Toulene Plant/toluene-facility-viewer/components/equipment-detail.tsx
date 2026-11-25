"use client"

import { Activity, Cpu, Gauge, Thermometer, Waves, Zap } from "lucide-react"
import {
  type Equipment,
  activeFaults,
  statusColor,
} from "@/lib/plant-data"
import { BinaryRegister } from "@/components/binary-register"

export function EquipmentDetail({ equipment }: { equipment: Equipment }) {
  const faults = activeFaults(equipment)
  const color = statusColor(equipment.status)

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold text-primary">{equipment.tag}</span>
              <span
                className="rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{
                  color,
                  background: "color-mix(in oklch, " + "var(--card)" + " 60%, transparent)",
                  border: `1px solid ${color}`,
                }}
              >
                {equipment.status}
              </span>
            </div>
            <h2 className="mt-1 text-sm font-medium text-foreground">{equipment.name}</h2>
          </div>
          <span className="rounded-md border border-border bg-secondary px-2 py-1 font-mono text-[11px] text-muted-foreground">
            {equipment.type}
          </span>
        </div>
        <p className="mt-2 text-pretty text-xs leading-relaxed text-muted-foreground">
          {equipment.description}
        </p>
        {faults.length > 0 && (
          <div
            className="mt-3 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs"
            style={{
              color: "var(--status-fault)",
              background: "color-mix(in oklch, var(--status-fault) 14%, transparent)",
              border: "1px solid color-mix(in oklch, var(--status-fault) 45%, transparent)",
            }}
          >
            <Zap className="h-3.5 w-3.5" />
            {faults.length} active alarm{faults.length > 1 ? "s" : ""}: {faults.map((f) => f.label).join(", ")}
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div className="space-y-5 px-4 py-4">
        {/* Live metrics */}
        <section className="grid grid-cols-2 gap-2">
          <MetricGauge
            icon={<Thermometer className="h-3.5 w-3.5" />}
            label="Temperature"
            value={`${equipment.thermal.temperatureC}°C`}
            sub={`set ${equipment.thermal.setpointC}°C`}
            fraction={equipment.thermal.dutyFraction}
          />
          <MetricGauge
            icon={<Waves className="h-3.5 w-3.5" />}
            label="Mass Flow"
            value={`${equipment.flow.massFlowKgH} kg/h`}
            sub={`${equipment.flow.pressureBar} bar`}
            fraction={equipment.flow.massFlowKgH / equipment.flow.designFlowKgH}
          />
          <MetricGauge
            icon={<Zap className="h-3.5 w-3.5" />}
            label="Power Draw"
            value={`${equipment.energy.powerKw} kW`}
            sub={`${(equipment.energy.cumulativeKwh / 1000).toFixed(1)} MWh total`}
            fraction={Math.min(equipment.energy.powerKw / 1000, 1)}
          />
          <MetricGauge
            icon={<Cpu className="h-3.5 w-3.5" />}
            label={`CUDA Tile #${equipment.energy.cudaTileId}`}
            value={`${Math.round(equipment.energy.kernelUtilization * 100)}%`}
            sub="kernel util"
            fraction={equipment.energy.kernelUtilization}
          />
        </section>

        {equipment.run && (
          <section>
            <SectionTitle icon={<Activity className="h-3.5 w-3.5" />}>Plant Run Output</SectionTitle>
            <p className="mt-2 text-xs text-foreground">{equipment.run.message}</p>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{equipment.run.kernel}</p>
            <ul className="mt-2 divide-y divide-border rounded-md border border-border">
              {Object.entries(equipment.run.outputs).map(([key, value]) => (
                <li key={key} className="flex items-center justify-between px-3 py-1.5 text-xs">
                  <span className="font-mono text-muted-foreground">{key}</span>
                  <span className="font-mono text-foreground">
                    {typeof value === "number" ? value.toLocaleString() : value}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Component overlay list */}
        <section>
          <SectionTitle icon={<Gauge className="h-3.5 w-3.5" />}>Components</SectionTitle>
          <ul className="mt-2 space-y-1.5">
            {equipment.components.map((c) => {
              const flag = equipment.binary.find((f) => f.key === c.boundFlag)
              const on = flag?.value === 1
              const healthy = flag ? (flag.activeIsHealthy ? on : !on) : true
              const dot = healthy ? "var(--status-run)" : "var(--status-fault)"
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2 text-xs"
                >
                  <span className="flex items-center gap-2 text-foreground">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: dot, boxShadow: `0 0 6px ${dot}` }}
                    />
                    {c.label}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">{c.boundFlag}</span>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Binary register overlay */}
        <section>
          <SectionTitle icon={<Cpu className="h-3.5 w-3.5" />}>Binary State Register</SectionTitle>
          <div className="mt-2">
            <BinaryRegister equipment={equipment} />
          </div>
        </section>
      </div>
    </div>
  )
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      {children}
    </h3>
  )
}

function MetricGauge({
  icon,
  label,
  value,
  sub,
  fraction,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  fraction: number
}) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100
  const barColor = pct > 90 ? "var(--status-fault)" : pct > 70 ? "var(--status-standby)" : "var(--primary)"
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 font-mono text-sm font-semibold text-foreground">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  )
}
