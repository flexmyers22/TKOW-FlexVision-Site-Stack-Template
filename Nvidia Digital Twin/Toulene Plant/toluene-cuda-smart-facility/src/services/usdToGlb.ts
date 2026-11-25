import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { boxMesh, cylinderMesh, writeGlb, type GlbMaterial } from '../lib/glbWriter.js';

export interface EquipmentGlbSpec {
  tag: string;
  usdPath: string;
  glbFile: string;
  shellPrim: string;
  equipmentType: string;
}

export const EQUIPMENT_GLB_SPECS: EquipmentGlbSpec[] = [
  { tag: 'T101', usdPath: 'plant/usd/Equipment/T101.usd', glbFile: 'T101.glb', shellPrim: 'TankShell', equipmentType: 'tank' },
  { tag: 'P101', usdPath: 'plant/usd/Equipment/P101.usd', glbFile: 'P101.glb', shellPrim: 'PumpCasing', equipmentType: 'pump' },
  { tag: 'H101', usdPath: 'plant/usd/Equipment/H101.usd', glbFile: 'H101.glb', shellPrim: 'HeaterShell', equipmentType: 'heater' },
  { tag: 'R101', usdPath: 'plant/usd/Equipment/R101.usd', glbFile: 'R101.glb', shellPrim: 'ReactorShell', equipmentType: 'reactor' },
  { tag: 'D101', usdPath: 'plant/usd/Equipment/D101.usd', glbFile: 'D101.glb', shellPrim: 'DrumShell', equipmentType: 'drum' },
  { tag: 'C101', usdPath: 'plant/usd/Equipment/C101.usd', glbFile: 'C101.glb', shellPrim: 'ColumnShell', equipmentType: 'column' },
  { tag: 'C102', usdPath: 'plant/usd/Equipment/C102.usd', glbFile: 'C102.glb', shellPrim: 'ColumnShell', equipmentType: 'column' },
  { tag: 'C103', usdPath: 'plant/usd/Equipment/C103.usd', glbFile: 'C103.glb', shellPrim: 'ColumnShell', equipmentType: 'column' },
];

const MATERIALS: Record<string, GlbMaterial> = {
  tank: { name: 'TankSteel', baseColor: [0.55, 0.58, 0.62, 1], metallic: 0.7, roughness: 0.4 },
  pump: { name: 'PumpGreen', baseColor: [0.2, 0.55, 0.3, 1], metallic: 0.5, roughness: 0.5 },
  heater: { name: 'HeaterOrange', baseColor: [0.75, 0.35, 0.1, 1], metallic: 0.4, roughness: 0.55 },
  reactor: { name: 'ReactorSteel', baseColor: [0.45, 0.48, 0.52, 1], metallic: 0.65, roughness: 0.45 },
  drum: { name: 'DrumSteel', baseColor: [0.5, 0.52, 0.56, 1], metallic: 0.6, roughness: 0.5 },
  column: { name: 'ColumnSilver', baseColor: [0.6, 0.62, 0.66, 1], metallic: 0.75, roughness: 0.35 },
};

function meshForType(type: string, metadata?: Record<string, unknown>) {
  switch (type) {
    case 'tank':
      return cylinderMesh(4, 10, 32);
    case 'pump':
      return boxMesh(2.5, 1.8, 1.5);
    case 'heater':
      return boxMesh(12, 3, 3);
    case 'reactor': {
      const lengthFt = Number(metadata?.reactor_length_ft ?? 62);
      const lengthM = lengthFt * 0.3048;
      return cylinderMesh(1.5, lengthM, 32);
    }
    case 'drum':
      return cylinderMesh(2, 6, 28);
    case 'column': {
      const diameter = Number(metadata?.diameter_m ?? 4);
      const height = Number(metadata?.height_m ?? 30);
      return cylinderMesh(diameter / 2, height, 36);
    }
    default:
      return boxMesh(2, 2, 2);
  }
}

export async function loadEquipmentMetadata(
  rootDir: string,
  tag: string
): Promise<Record<string, unknown> | undefined> {
  const files = [
    `plant/equipment/${tag}_toluene_tank.json`,
    `plant/equipment/${tag}_feed_pump.json`,
    `plant/equipment/${tag}_heater.json`,
    `plant/equipment/${tag}_reactor.json`,
    `plant/equipment/${tag}_column.json`,
    `plant/equipment/${tag}_drum.json`,
  ];
  for (const rel of files) {
    try {
      const raw = await readFile(join(rootDir, rel), 'utf8');
      const parsed = JSON.parse(raw) as { equipment_tag?: string; metadata?: Record<string, unknown> };
      if (parsed.equipment_tag === tag) return parsed.metadata;
    } catch {
      // try next filename pattern
    }
  }
  return undefined;
}

export async function exportEquipmentGlb(
  rootDir: string,
  spec: EquipmentGlbSpec
): Promise<{ glbPath: string; bytes: number }> {
  const metadata = await loadEquipmentMetadata(rootDir, spec.tag);
  const mesh = meshForType(spec.equipmentType, metadata);
  const material = MATERIALS[spec.equipmentType] ?? MATERIALS.reactor;
  const buffer = writeGlb(mesh, material, spec.tag);
  const glbPath = join(rootDir, 'plant/glb', spec.glbFile);
  return { glbPath, bytes: buffer.length };
}

export function buildGlbBuffer(spec: EquipmentGlbSpec, metadata?: Record<string, unknown>): Buffer {
  const mesh = meshForType(spec.equipmentType, metadata);
  const material = MATERIALS[spec.equipmentType] ?? MATERIALS.reactor;
  return writeGlb(mesh, material, spec.tag);
}
