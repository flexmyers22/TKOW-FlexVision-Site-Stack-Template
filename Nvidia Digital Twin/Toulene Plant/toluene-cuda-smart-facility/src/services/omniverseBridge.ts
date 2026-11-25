import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PlantRunResult, UnitSimulation } from './plantRunner.js';
import type { EquipmentRow } from './plantRunner.js';
import { decodeBinaryStatus } from '../types/binary.js';

export interface TwinEquipmentState {
  tag: string;
  cuda_tile: string;
  binary_word: string;
  decoded: Record<string, boolean>;
  shell_prim: string;
  usd_prim: string;
  sensors: Record<string, number>;
  alarms: string[];
}

export interface TwinRuntimeState {
  generated_at: string;
  run_id?: string;
  site_prim: string;
  usd_scene: string;
  equipment: TwinEquipmentState[];
  active_alarms: string[];
}

export const SHELL_PRIM: Record<string, string> = {
  T101: 'TankShell',
  P101: 'PumpCasing',
  H101: 'HeaterShell',
  R101: 'ReactorShell',
  D101: 'DrumShell',
  C101: 'ColumnShell',
  C102: 'ColumnShell',
  C103: 'ColumnShell',
};

export const USD_PRIM: Record<string, string> = {
  T101: '/Site/ProcessAreaA/ReactorArea/T101/TankShell',
  P101: '/Site/ProcessAreaA/ReactorArea/P101/PumpCasing',
  H101: '/Site/ProcessAreaA/ReactorArea/H101/HeaterShell',
  R101: '/Site/ProcessAreaA/ReactorArea/R101/ReactorShell',
  D101: '/Site/ProcessAreaA/ReactorArea/D101/DrumShell',
  C101: '/Site/ProcessAreaA/SeparationTrain/C101/ColumnShell',
  C102: '/Site/ProcessAreaA/SeparationTrain/C102/ColumnShell',
  C103: '/Site/ProcessAreaA/SeparationTrain/C103/ColumnShell',
};

export const ALARM_PANEL_PRIM = '/Site/ControlRoom/AlarmPanel';
export const TEMP_ALARM_F = 450;

export function sensorsFromUnitOutputs(
  equipmentTag: string,
  outputs: Record<string, number | string>
): Record<string, number> {
  const sensors: Record<string, number> = {};
  for (const [key, val] of Object.entries(outputs)) {
    if (typeof val === 'number') {
      sensors[`${equipmentTag}_${key}`] = val;
    }
  }
  return sensors;
}

export function evaluateAlarms(
  tag: string,
  decoded: Record<string, boolean>,
  sensors: Record<string, number>
): string[] {
  const alarms: string[] = [];
  if (decoded.ALM) alarms.push('ALM');

  for (const [key, val] of Object.entries(sensors)) {
    if (
      (key.includes('temp') || key.includes('outlet_temp') || key.includes('reactor_temp')) &&
      val > TEMP_ALARM_F
    ) {
      alarms.push(`HIGH_TEMP:${val}`);
    }
  }

  if (tag === 'R101' && !alarms.some((a) => a.startsWith('HIGH_TEMP'))) {
    const temp = sensors.R101_reactor_temp_f ?? sensors.R101_outlet_temp_f;
    if (temp != null && temp > TEMP_ALARM_F) alarms.push(`HIGH_TEMP:${temp}`);
  }

  return alarms;
}

export function buildEquipmentState(
  tag: string,
  binaryWord: string,
  cudaTile: string,
  sensors: Record<string, number>
): TwinEquipmentState {
  const decoded = decodeBinaryStatus(binaryWord);
  const alarms = evaluateAlarms(tag, decoded, sensors);
  return {
    tag,
    cuda_tile: cudaTile,
    binary_word: binaryWord,
    decoded,
    shell_prim: SHELL_PRIM[tag] ?? 'Shell',
    usd_prim: USD_PRIM[tag] ?? `/Site/${tag}`,
    sensors,
    alarms,
  };
}

export function buildTwinStateFromRun(
  result: PlantRunResult,
  equipment: EquipmentRow[]
): TwinRuntimeState {
  const tileByTag = new Map(equipment.map((e) => [e.equipment_tag, e.cuda_tile_id ?? '']));

  const twinEquipment = result.units.map((unit: UnitSimulation) =>
    buildEquipmentState(
      unit.equipment_tag,
      unit.binary_out,
      tileByTag.get(unit.equipment_tag) ?? '',
      sensorsFromUnitOutputs(unit.equipment_tag, unit.outputs)
    )
  );

  const activeAlarms = twinEquipment.flatMap((eq) =>
    eq.alarms.map((a) => `${eq.tag}: ${a}`)
  );

  return {
    generated_at: result.completed_at,
    run_id: result.run_id,
    site_prim: '/Site',
    usd_scene: 'plant/usd/Site.usd',
    equipment: twinEquipment,
    active_alarms: activeAlarms,
  };
}

export function buildTwinStateFromDb(
  equipment: { equipment_tag: string; binary_status: string | null; cuda_tile_id: string | null }[],
  history: { equipment_tag: string; sensor_tag: string; value: number }[]
): TwinRuntimeState {
  const latestSensors = new Map<string, Record<string, number>>();
  for (const row of history) {
    if (!latestSensors.has(row.equipment_tag)) latestSensors.set(row.equipment_tag, {});
    const sensors = latestSensors.get(row.equipment_tag)!;
    if (!(row.sensor_tag in sensors)) sensors[row.sensor_tag] = Number(row.value);
  }

  const twinEquipment = equipment.map((eq) =>
    buildEquipmentState(
      eq.equipment_tag,
      eq.binary_status ?? '00000000',
      eq.cuda_tile_id ?? '',
      latestSensors.get(eq.equipment_tag) ?? {}
    )
  );

  return {
    generated_at: new Date().toISOString(),
    site_prim: '/Site',
    usd_scene: 'plant/usd/Site.usd',
    equipment: twinEquipment,
    active_alarms: twinEquipment.flatMap((eq) => eq.alarms.map((a) => `${eq.tag}: ${a}`)),
  };
}

export async function writeTwinState(
  state: TwinRuntimeState,
  rootDir = process.cwd()
): Promise<string> {
  const outDir = join(rootDir, 'omniverse/runtime');
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, 'twin_state.json');
  await writeFile(outPath, JSON.stringify(state, null, 2));
  return outPath;
}

export function formatTwinSummary(state: TwinRuntimeState): string[] {
  return state.equipment.map((eq) => {
    const alarmStr = eq.alarms.length ? `  alarms: ${eq.alarms.join(', ')}` : '';
    return `  ${eq.tag}  binary=${eq.binary_word}  prim=${eq.usd_prim}${alarmStr}`;
  });
}
