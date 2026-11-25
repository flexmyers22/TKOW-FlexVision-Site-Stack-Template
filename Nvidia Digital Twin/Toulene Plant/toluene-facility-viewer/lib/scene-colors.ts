import type { OperationalStatus } from "@/lib/plant-data"

// Hex equivalents of the CSS status tokens for use inside the WebGL canvas.
export const STATUS_HEX: Record<OperationalStatus, string> = {
  running: "#3fcf8e",
  standby: "#e6c04a",
  fault: "#e5484d",
  idle: "#8b8f98",
}

export const EQUIPMENT_BASE = "#aeb4bf"
export const EQUIPMENT_DARK = "#6d7380"
export const PIPE_COLOR = "#8b919c"
export const FLOOR_COLOR = "#111318"
export const TERRAIN_COLOR = "#2a261f"
export const GRID_COLOR = "#2c3038"
export const ACCENT_HEX = "#d7d9dd"
