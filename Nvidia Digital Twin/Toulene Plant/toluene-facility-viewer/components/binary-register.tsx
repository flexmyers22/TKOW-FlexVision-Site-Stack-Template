"use client"

import { type Equipment, registerBits, registerValue } from "@/lib/plant-data"

export function BinaryRegister({ equipment }: { equipment: Equipment }) {
  const bits = registerBits(equipment)
  const value = registerValue(equipment)
  const hex = value.toString(16).toUpperCase().padStart(2, "0")

  // Ordered high bit -> low bit for the visual byte row.
  const ordered = [...equipment.binary].sort((a, b) => b.bit - a.bit)

  return (
    <div className="space-y-3">
      {/* Register byte */}
      <div className="flex items-center gap-1 font-mono">
        {ordered.map((f) => {
          const on = f.value === 1
          const healthy = f.activeIsHealthy ? on : !on
          return (
            <div key={f.bit} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="flex h-9 w-full items-center justify-center rounded-md border text-sm font-semibold"
                style={{
                  borderColor: on
                    ? healthy
                      ? "var(--status-run)"
                      : "var(--status-fault)"
                    : "var(--border)",
                  background: on
                    ? healthy
                      ? "color-mix(in oklch, var(--status-run) 22%, transparent)"
                      : "color-mix(in oklch, var(--status-fault) 24%, transparent)"
                    : "var(--secondary)",
                  color: on
                    ? healthy
                      ? "var(--status-run)"
                      : "var(--status-fault)"
                    : "var(--muted-foreground)",
                }}
                title={f.label}
              >
                {f.value}
              </div>
              <span className="text-[10px] text-muted-foreground">b{f.bit}</span>
            </div>
          )
        })}
      </div>

      {/* Encoded value readout */}
      <div className="grid grid-cols-3 gap-2 font-mono text-xs">
        <Readout label="BIN" value={bits} />
        <Readout label="HEX" value={`0x${hex}`} />
        <Readout label="DEC" value={String(value)} />
      </div>

      {/* Per-flag legend */}
      <ul className="divide-y divide-border rounded-md border border-border">
        {equipment.binary.map((f) => {
          const on = f.value === 1
          const healthy = f.activeIsHealthy ? on : !on
          return (
            <li key={f.bit} className="flex items-center justify-between px-3 py-1.5 text-xs">
              <span className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground">b{f.bit}</span>
                <span className="text-foreground">{f.label}</span>
              </span>
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase"
                style={{
                  color: healthy ? "var(--status-run)" : "var(--status-fault)",
                  background: healthy
                    ? "color-mix(in oklch, var(--status-run) 16%, transparent)"
                    : "color-mix(in oklch, var(--status-fault) 18%, transparent)",
                }}
              >
                {on ? "SET" : "CLR"}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary px-2 py-1.5 text-center">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-foreground">{value}</div>
    </div>
  )
}
