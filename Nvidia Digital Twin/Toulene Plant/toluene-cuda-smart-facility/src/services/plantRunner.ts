import type { BinarySignalCode } from '../types/binary.js';
import { decodeBinaryStatus, encodeBinaryStatus } from '../types/binary.js';

export interface EquipmentRow {
  equipment_tag: string;
  equipment_type: string;
  process_area: string | null;
  binary_status: string | null;
  cuda_tile_id: string | null;
  upstream: string[];
  downstream: string[];
  metadata: Record<string, unknown>;
}

export interface CudaTileRow {
  tile_id: string;
  equipment_tag: string;
  kernel_name: string;
  memory_block: string;
  update_rate_ms: number;
  binary_word: string | null;
}

export interface UnitSimulation {
  equipment_tag: string;
  kernel_name: string;
  inputs: Record<string, number | string>;
  outputs: Record<string, number | string>;
  binary_in: string;
  binary_out: string;
  decoded_out: Record<BinarySignalCode, boolean>;
  status: 'ok' | 'alarm';
  message: string;
}

export interface PlantRunResult {
  run_id: string;
  started_at: string;
  completed_at: string;
  flow_order: string[];
  units: UnitSimulation[];
  summary: {
    total_units: number;
    alarms: number;
    feed_rate_lb_hr: number;
    reactor_conversion_pct: number;
  };
}

export interface PlantRunOptions {
  tankLevelPct?: number;
}

const FLOW_ORDER = ['T101', 'P101', 'H101', 'R101', 'C101'];

function num(meta: Record<string, unknown>, key: string, fallback = 0): number {
  const v = meta[key];
  return typeof v === 'number' ? v : fallback;
}

function simulateUnit(
  equipment: EquipmentRow,
  tile: CudaTileRow | undefined,
  context: Record<string, number>,
  options: PlantRunOptions = {}
): UnitSimulation {
  const tag = equipment.equipment_tag;
  const meta = equipment.metadata ?? {};
  const binaryIn = equipment.binary_status ?? '00000000';
  const kernel = tile?.kernel_name ?? 'unknown';
  const outputs: Record<string, number | string> = {};
  let flags: Partial<Record<BinarySignalCode, boolean>> = {
    AUTO: true,
    RUN: true,
    ALM: false,
    MAINT: false,
  };
  let message = 'Operating normally';
  let status: 'ok' | 'alarm' = 'ok';

  switch (tag) {
    case 'T101': {
      const level = options.tankLevelPct ?? 72;
      outputs.level_pct = level;
      outputs.inventory_lb_hr = num(meta, 'feed_rate_lb_hr', 10000);
      flags.LEVEL = level > 20;
      flags.FLOW = level > 20;
      context.feed_lb_hr = outputs.inventory_lb_hr as number;
      message = `Tank level ${level}% — feed available`;
      break;
    }
    case 'P101': {
      const flow = context.feed_lb_hr ?? 10000;
      const discharge = num(meta, 'discharge_pressure_psi', 270);
      const delivery = num(meta, 'reactor_delivery_psi', 215);
      outputs.flow_lb_hr = flow;
      outputs.discharge_psi = discharge;
      outputs.motor_kw = num(meta, 'motor_power_kw', 4.3);
      flags.FLOW = discharge > delivery;
      flags.PRES = delivery >= 215;
      context.pressure_psi = delivery;
      message = `Pump delivering ${flow} lb/hr at ${delivery} psi`;
      break;
    }
    case 'H101': {
      const inletF = 80;
      const outletF = num(meta, 'furnace_outlet_temp_f', 1000);
      const dutyKw = num(meta, 'duty_w', 3848817) / 1000;
      outputs.inlet_temp_f = inletF;
      outputs.outlet_temp_f = outletF;
      outputs.duty_kw = dutyKw;
      flags.HEAT = outletF >= 900;
      flags.PRES = (context.pressure_psi ?? 215) >= 200;
      context.reactor_temp_f = outletF;
      message = `Heater outlet ${outletF}°F, duty ${dutyKw.toFixed(0)} kW`;
      break;
    }
    case 'R101': {
      const conversion = num(meta, 'conversion_pct', 30);
      const feed = num(meta, 'feed_rate_lb_hr', 10000);
      const benzene = feed * (conversion / 100) * 0.42;
      const xylene = feed * (conversion / 100) * 0.48;
      outputs.feed_lb_hr = feed;
      outputs.conversion_pct = conversion;
      outputs.benzene_lb_hr = Math.round(benzene);
      outputs.xylene_lb_hr = Math.round(xylene);
      outputs.reactor_temp_f = num(meta, 'operating_temp_f', 1000);
      flags.HEAT = true;
      flags.PRES = num(meta, 'feed_pressure_psia', 215) >= 200;
      flags.FLOW = true;
      context.products_lb_hr = benzene + xylene;
      message = `Reactor at ${conversion}% conversion — Bz ${outputs.benzene_lb_hr} / Xyl ${outputs.xylene_lb_hr} lb/hr`;
      break;
    }
    case 'C101': {
      const feed = context.products_lb_hr ?? 3000;
      const diameter = num(meta, 'diameter_m', 5.29);
      const trays = num(meta, 'tray_count', 69);
      const reflux = num(meta, 'reflux_ratio', 5);
      outputs.feed_lb_hr = Math.round(feed);
      outputs.column_diameter_m = diameter;
      outputs.tray_count = trays;
      outputs.reflux_ratio = reflux;
      outputs.overhead_recovery_pct = 95;
      flags.FLOW = true;
      flags.PRES = true;
      message = `Column separating ${Math.round(feed)} lb/hr — reflux ${reflux}`;
      break;
    }
    default:
      message = 'Unknown equipment tag';
      status = 'alarm';
      flags.ALM = true;
  }

  if (flags.ALM) status = 'alarm';
  const binaryOut = encodeBinaryStatus(flags);

  return {
    equipment_tag: tag,
    kernel_name: kernel,
    inputs: { ...context },
    outputs,
    binary_in: binaryIn,
    binary_out: binaryOut,
    decoded_out: decodeBinaryStatus(binaryOut),
    status,
    message,
  };
}

export function runPlantSimulation(
  equipment: EquipmentRow[],
  tiles: CudaTileRow[],
  options: PlantRunOptions = {}
): PlantRunResult {
  const startedAt = new Date();
  const runId = `RUN-${startedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
  const byTag = new Map(equipment.map((e) => [e.equipment_tag, e]));
  const tileByTag = new Map(tiles.map((t) => [t.equipment_tag, t]));
  const context: Record<string, number> = {};
  const units: UnitSimulation[] = [];

  for (const tag of FLOW_ORDER) {
    const row = byTag.get(tag);
    if (!row) continue;
    units.push(simulateUnit(row, tileByTag.get(tag), context, options));
  }

  const completedAt = new Date();
  const alarms = units.filter((u) => u.status === 'alarm').length;
  const r101 = units.find((u) => u.equipment_tag === 'R101');

  return {
    run_id: runId,
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    flow_order: FLOW_ORDER,
    units,
    summary: {
      total_units: units.length,
      alarms,
      feed_rate_lb_hr: num(byTag.get('T101')?.metadata ?? {}, 'feed_rate_lb_hr', 10000),
      reactor_conversion_pct: num(r101?.outputs ?? {}, 'conversion_pct', 30),
    },
  };
}
