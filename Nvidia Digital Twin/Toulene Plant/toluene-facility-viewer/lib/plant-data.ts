// Data model for the toluene disproportionation smart facility.
// Mirrors src/types/{equipment,binary,cuda,metrics}.ts and plant/equipment/*.json

export type EquipmentType = "reactor" | "pump" | "heater" | "column" | "tank"

export type OperationalStatus = "running" | "standby" | "idle" | "fault"

// A single addressable binary flag in an equipment's state register.
export interface BinaryFlag {
  bit: number
  key: string
  label: string
  value: 0 | 1
  // Whether a 1 in this bit is a healthy/expected condition.
  activeIsHealthy: boolean
}

export interface ThermalState {
  temperatureC: number
  setpointC: number
  // 0..1 fraction of thermal design duty currently used.
  dutyFraction: number
}

export interface FlowState {
  massFlowKgH: number
  designFlowKgH: number
  pressureBar: number
}

export interface EnergyMetrics {
  powerKw: number
  cumulativeKwh: number
  // GPU tile the equipment's kernels are pinned to.
  cudaTileId: number
  // Kernel throughput reported by the CUDA layer.
  kernelUtilization: number
}

export interface EquipmentComponent {
  id: string
  label: string
  // Reference to the binary flag key that gates this component.
  boundFlag: string
}

export interface UnitRunOutput {
  kernel: string
  message: string
  outputs: Record<string, number | string>
}

export interface Equipment {
  tag: string // e.g. "R101"
  name: string
  type: EquipmentType
  status: OperationalStatus
  // World-space position on the plant floor [x, y, z].
  position: [number, number, number]
  description: string
  components: EquipmentComponent[]
  // Design-state register from plant/data/plant_input.csv; deviations from it raise alarms.
  designBinary: string
  binary: BinaryFlag[]
  thermal: ThermalState
  flow: FlowState
  energy: EnergyMetrics
  run?: UnitRunOutput
}

// Shape of runs/RUN-*.json written by scripts/plant-run-csv.ts.
export interface PlantRunUnit {
  equipment_tag: string
  kernel_name: string
  outputs: Record<string, number | string>
  binary_in: string
  binary_out: string
  status: "ok" | "alarm"
  message: string
}

export interface PlantRunResult {
  run_id: string
  started_at: string
  completed_at: string
  flow_order: string[]
  units: PlantRunUnit[]
  summary: {
    total_units: number
    alarms: number
    feed_rate_lb_hr: number
    reactor_conversion_pct: number
  }
}

// Connections between units (feed path through the plant).
export interface PipeLink {
  from: string
  to: string
}

function flag(
  bit: number,
  key: string,
  label: string,
  value: 0 | 1,
  activeIsHealthy = true,
): BinaryFlag {
  return { bit, key, label, value, activeIsHealthy }
}

// Bit layout matches toluene-cuda-smart-facility/src/types/binary.ts.
const SIGNALS = [
  { bit: 7, key: "RUN", label: "Run", health: "on" },
  { bit: 6, key: "ALM", label: "Alarm", health: "off" },
  { bit: 5, key: "MAINT", label: "Maintenance", health: "off" },
  { bit: 4, key: "AUTO", label: "Auto Mode", health: "on" },
  { bit: 3, key: "HEAT", label: "Heat", health: "design" },
  { bit: 2, key: "FLOW", label: "Flow", health: "design" },
  { bit: 1, key: "PRES", label: "Pressure", health: "design" },
  { bit: 0, key: "LEVEL", label: "Level", health: "design" },
] as const

function bitAt(register: string, bit: number): 0 | 1 {
  return register.padStart(8, "0").slice(-8)[7 - bit] === "1" ? 1 : 0
}

export function signalFlags(design: string, actual = design): BinaryFlag[] {
  return SIGNALS.map((s) =>
    flag(
      s.bit,
      s.key,
      s.label,
      bitAt(actual, s.bit),
      s.health === "on" ? true : s.health === "off" ? false : bitAt(design, s.bit) === 1,
    ),
  )
}

const T101_DESIGN = "10010101"
const P101_DESIGN = "10010110"
const H101_DESIGN = "10011010"
const R101_DESIGN = "10011110"
const C101_DESIGN = "10010110"

export const PLANT_EQUIPMENT: Equipment[] = [
  {
    tag: "T101",
    name: "Toluene Feed Tank",
    type: "tank",
    status: "running",
    position: [-9, 0, 2],
    description: "Bulk toluene storage feeding the disproportionation loop.",
    components: [
      { id: "t101-shell", label: "Storage Shell", boundFlag: "LEVEL" },
      { id: "t101-outlet", label: "Outlet Valve", boundFlag: "FLOW" },
      { id: "t101-vent", label: "N2 Blanket Vent", boundFlag: "AUTO" },
    ],
    designBinary: T101_DESIGN,
    binary: signalFlags(T101_DESIGN),
    thermal: { temperatureC: 27, setpointC: 25, dutyFraction: 0.08 },
    flow: { massFlowKgH: 4536, designFlowKgH: 5200, pressureBar: 1.0 },
    energy: { powerKw: 6, cumulativeKwh: 14820, cudaTileId: 0, kernelUtilization: 0.12 },
  },
  {
    tag: "P101",
    name: "Feed Pump",
    type: "pump",
    status: "running",
    position: [-5, 0, 2],
    description: "Centrifugal pump raising toluene feed to reactor pressure.",
    components: [
      { id: "p101-motor", label: "Drive Motor", boundFlag: "RUN" },
      { id: "p101-seal", label: "Discharge Pressure", boundFlag: "PRES" },
      { id: "p101-vfd", label: "VFD Drive", boundFlag: "AUTO" },
    ],
    designBinary: P101_DESIGN,
    binary: signalFlags(P101_DESIGN),
    thermal: { temperatureC: 46, setpointC: 45, dutyFraction: 0.33 },
    flow: { massFlowKgH: 4536, designFlowKgH: 5200, pressureBar: 18.6 },
    energy: { powerKw: 4.3, cumulativeKwh: 132400, cudaTileId: 1, kernelUtilization: 0.41 },
  },
  {
    tag: "H101",
    name: "Feed Preheater",
    type: "heater",
    status: "running",
    position: [-1, 0, 2],
    description: "Fired heater bringing feed to reaction temperature.",
    components: [
      { id: "h101-burner", label: "Burner", boundFlag: "HEAT" },
      { id: "h101-coil", label: "Process Coil", boundFlag: "PRES" },
      { id: "h101-stack", label: "Stack Damper", boundFlag: "AUTO" },
    ],
    designBinary: H101_DESIGN,
    binary: signalFlags(H101_DESIGN),
    thermal: { temperatureC: 538, setpointC: 538, dutyFraction: 0.52 },
    flow: { massFlowKgH: 4536, designFlowKgH: 5200, pressureBar: 14.8 },
    energy: { powerKw: 3848.8, cumulativeKwh: 2140000, cudaTileId: 2, kernelUtilization: 0.58 },
  },
  {
    tag: "R101",
    name: "Disproportionation Reactor",
    type: "reactor",
    status: "running",
    position: [3, 0, 2],
    description: "Fixed-bed reactor converting toluene to benzene and xylene.",
    components: [
      { id: "r101-bed", label: "Catalyst Bed", boundFlag: "HEAT" },
      { id: "r101-jacket", label: "Feed Flow", boundFlag: "FLOW" },
      { id: "r101-inlet", label: "Inlet Pressure", boundFlag: "PRES" },
      { id: "r101-relief", label: "Relief / Alarm", boundFlag: "ALM" },
    ],
    designBinary: R101_DESIGN,
    binary: signalFlags(R101_DESIGN),
    thermal: { temperatureC: 538, setpointC: 538, dutyFraction: 0.81 },
    flow: { massFlowKgH: 4536, designFlowKgH: 5200, pressureBar: 14.8 },
    energy: { powerKw: 120, cumulativeKwh: 402000, cudaTileId: 3, kernelUtilization: 0.86 },
  },
  {
    tag: "C101",
    name: "Product Column",
    type: "column",
    status: "running",
    position: [8, 0, 2],
    description: "Distillation column separating benzene, toluene and xylene.",
    components: [
      { id: "c101-reboiler", label: "Reboiler", boundFlag: "RUN" },
      { id: "c101-condenser", label: "Column Pressure", boundFlag: "PRES" },
      { id: "c101-reflux", label: "Reflux Flow", boundFlag: "FLOW" },
      { id: "c101-trays", label: "Tray Section", boundFlag: "ALM" },
    ],
    designBinary: C101_DESIGN,
    binary: signalFlags(C101_DESIGN),
    thermal: { temperatureC: 145, setpointC: 145, dutyFraction: 0.74 },
    flow: { massFlowKgH: 1225, designFlowKgH: 5200, pressureBar: 2.1 },
    energy: { powerKw: 1196.8, cumulativeKwh: 1580000, cudaTileId: 4, kernelUtilization: 0.73 },
  },
]

export const PLANT_PIPES: PipeLink[] = [
  { from: "T101", to: "P101" },
  { from: "P101", to: "H101" },
  { from: "H101", to: "R101" },
  { from: "R101", to: "C101" },
]

const LB_TO_KG = 0.45359237
const PSI_TO_BAR = 0.0689476

function fToC(f: number): number {
  return Math.round(((f - 32) * 5) / 9)
}

// Overlay a plant-run result (runs/RUN-*.json) onto the base equipment model.
export function applyPlantRun(base: Equipment[], run: PlantRunResult): Equipment[] {
  return base.map((eq) => {
    const unit = run.units.find((u) => u.equipment_tag === eq.tag)
    if (!unit) return eq

    const o = unit.outputs
    const n = (key: string) => (typeof o[key] === "number" ? (o[key] as number) : undefined)
    const binary = signalFlags(eq.designBinary, unit.binary_out)
    const running = binary.find((f) => f.key === "RUN")?.value === 1
    const status: OperationalStatus =
      unit.status === "alarm" ? "fault" : running ? "running" : "standby"

    const tempF = n("outlet_temp_f") ?? n("reactor_temp_f")
    const flowLb = n("flow_lb_hr") ?? n("inventory_lb_hr") ?? n("feed_lb_hr")
    const psi = n("discharge_psi")
    const kw = n("duty_kw") ?? n("motor_kw")
    const massFlowKgH = flowLb != null ? Math.round(flowLb * LB_TO_KG) : eq.flow.massFlowKgH

    return {
      ...eq,
      status,
      binary,
      thermal: tempF != null ? { ...eq.thermal, temperatureC: fToC(tempF) } : eq.thermal,
      flow: {
        ...eq.flow,
        massFlowKgH,
        designFlowKgH: Math.max(eq.flow.designFlowKgH, massFlowKgH),
        pressureBar: psi != null ? Number((psi * PSI_TO_BAR).toFixed(1)) : eq.flow.pressureBar,
      },
      energy: kw != null ? { ...eq.energy, powerKw: Math.round(kw * 10) / 10 } : eq.energy,
      run: { kernel: unit.kernel_name, message: unit.message, outputs: o },
    }
  })
}

// Compose the 8-bit binary state register as an integer + string.
export function registerValue(eq: Equipment): number {
  return eq.binary.reduce((acc, f) => acc | (f.value << f.bit), 0)
}

export function registerBits(eq: Equipment): string {
  const val = registerValue(eq)
  return val.toString(2).padStart(8, "0")
}

export function statusColor(status: OperationalStatus): string {
  switch (status) {
    case "running":
      return "var(--status-run)"
    case "standby":
      return "var(--status-standby)"
    case "fault":
      return "var(--status-fault)"
    default:
      return "var(--status-idle)"
  }
}

// Flags currently in an unhealthy state (used for the alarm rollup).
// An "activeIsHealthy" flag is faulted when low; an alarm flag is faulted when high.
export function activeFaults(eq: Equipment): BinaryFlag[] {
  return eq.binary.filter((f) => (f.activeIsHealthy ? f.value === 0 : f.value === 1))
}
