"use client"

import { type Equipment, activeFaults, statusColor } from "@/lib/plant-data"

interface EquipmentListProps {
  equipment: Equipment[]
  selectedTag: string | null
  onSelect: (tag: string) => void
}

export function EquipmentList({ equipment, selectedTag, onSelect }: EquipmentListProps) {
  return (
    <ul className="space-y-1.5">
      {equipment.map((eq) => {
        const color = statusColor(eq.status)
        const faults = activeFaults(eq).length
        const active = selectedTag === eq.tag
        return (
          <li key={eq.tag}>
            <button
              type="button"
              onClick={() => onSelect(eq.tag)}
              aria-pressed={active}
              className="flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors"
              style={{
                borderColor: active ? "var(--primary)" : "var(--border)",
                background: active ? "color-mix(in oklch, var(--primary) 12%, transparent)" : "var(--card)",
              }}
            >
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: color, boxShadow: `0 0 8px ${color}` }}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-foreground">{eq.tag}</span>
                  <span className="font-mono text-[10px] uppercase" style={{ color }}>
                    {eq.status}
                  </span>
                </span>
                <span className="block truncate text-xs text-muted-foreground">{eq.name}</span>
              </span>
              {faults > 0 && (
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold"
                  style={{
                    color: "var(--status-fault)",
                    background: "color-mix(in oklch, var(--status-fault) 18%, transparent)",
                  }}
                >
                  {faults}
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
