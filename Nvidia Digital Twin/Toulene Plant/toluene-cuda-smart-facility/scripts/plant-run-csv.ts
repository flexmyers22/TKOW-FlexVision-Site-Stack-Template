import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  buildTwinStateFromRun,
  formatTwinSummary,
  writeTwinState,
} from '../src/services/omniverseBridge.js';
import {
  runPlantSimulation,
  type CudaTileRow,
  type EquipmentRow,
  type PlantRunOptions,
} from '../src/services/plantRunner.js';

const TEXT_COLUMNS = new Set([
  'equipment_tag',
  'equipment_type',
  'process_area',
  'binary_status',
  'kernel_name',
  'upstream',
  'downstream',
]);

function parseOptions(): PlantRunOptions & { file: string; skipOmniverse?: boolean } {
  const arg = (name: string) => {
    const idx = process.argv.indexOf(name);
    return idx !== -1 ? process.argv[idx + 1] : undefined;
  };
  const tankLevel = arg('--tank-level');
  return {
    file: resolve(arg('--file') ?? join('plant', 'data', 'plant_input.csv')),
    tankLevelPct: tankLevel != null ? Number(tankLevel) : undefined,
    skipOmniverse: process.argv.includes('--no-omniverse'),
  };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

function loadCsv(text: string): { equipment: EquipmentRow[]; tiles: CudaTileRow[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  const headers = parseCsvLine(lines[0]);
  const equipment: EquipmentRow[] = [];
  const tiles: CudaTileRow[] = [];

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
    const tag = row.equipment_tag;
    if (!tag) continue;

    const metadata: Record<string, unknown> = {};
    for (const h of headers) {
      if (TEXT_COLUMNS.has(h) || row[h] === '') continue;
      const n = Number(row[h]);
      metadata[h] = Number.isFinite(n) ? n : row[h];
    }

    const tileId = `CUDA_TILE_${tag}`;
    equipment.push({
      equipment_tag: tag,
      equipment_type: row.equipment_type,
      process_area: row.process_area || null,
      binary_status: row.binary_status || null,
      cuda_tile_id: tileId,
      upstream: splitList(row.upstream),
      downstream: splitList(row.downstream),
      metadata,
    });
    tiles.push({
      tile_id: tileId,
      equipment_tag: tag,
      kernel_name: row.kernel_name || 'unknown',
      memory_block: `${tag}_BLOCK`,
      update_rate_ms: 100,
      binary_word: row.binary_status || null,
    });
  }
  return { equipment, tiles };
}

function csvCell(value: unknown): string {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const options = parseOptions();
  const { equipment, tiles } = loadCsv(await readFile(options.file, 'utf8'));
  if (!equipment.length) throw new Error(`No equipment rows found in ${options.file}`);

  console.log('\n=== Toluene Plant Run (CSV, offline) ===\n');
  console.log(`Input: ${options.file}`);
  if (options.tankLevelPct != null) console.log(`Tank level override: ${options.tankLevelPct}%`);
  console.log(`Loaded ${equipment.length} equipment rows\n`);

  const result = runPlantSimulation(equipment, tiles, options);

  for (const unit of result.units) {
    const icon = unit.status === 'ok' ? '✓' : '✗';
    console.log(`${icon} ${unit.equipment_tag} [${unit.kernel_name}]`);
    console.log(`   ${unit.message}`);
    console.log(`   binary: ${unit.binary_in} → ${unit.binary_out}`);
    console.log(`   outputs: ${JSON.stringify(unit.outputs)}\n`);
  }

  const runsDir = join(process.cwd(), 'runs');
  await mkdir(runsDir, { recursive: true });
  const jsonPath = join(runsDir, `${result.run_id}.json`);
  const csvPath = join(runsDir, `${result.run_id}.csv`);
  await writeFile(jsonPath, JSON.stringify(result, null, 2));

  const csvRows = [
    ['run_id', 'equipment_tag', 'kernel_name', 'status', 'output', 'value', 'binary_out', 'message'],
    ...result.units.flatMap((u) =>
      Object.entries(u.outputs).map(([key, value]) => [
        result.run_id,
        u.equipment_tag,
        u.kernel_name,
        u.status,
        key,
        value,
        u.binary_out,
        u.message,
      ])
    ),
  ];
  await writeFile(csvPath, '\uFEFF' + csvRows.map((r) => r.map(csvCell).join(',')).join('\r\n'));

  console.log('=== Summary ===');
  console.log(`Run ID:     ${result.run_id}`);
  console.log(`Units:      ${result.summary.total_units}`);
  console.log(`Alarms:     ${result.summary.alarms}`);
  console.log(`Feed:       ${result.summary.feed_rate_lb_hr} lb/hr`);
  console.log(`Conversion: ${result.summary.reactor_conversion_pct}%`);
  console.log(`Report:     ${jsonPath}`);
  console.log(`Excel/CSV:  ${csvPath}`);
  console.log(`Status:     ${result.summary.alarms === 0 ? 'PASS' : 'FAIL'}\n`);

  if (!options.skipOmniverse) {
    const state = buildTwinStateFromRun(result, equipment);
    const twinPath = await writeTwinState(state);
    console.log('=== Omniverse Sync ===');
    console.log(`Twin state: ${twinPath}`);
    for (const line of formatTwinSummary(state)) console.log(line);
    console.log('');
  }
}

main().catch((err) => {
  console.error('Plant run failed:', err.message);
  process.exit(1);
});
