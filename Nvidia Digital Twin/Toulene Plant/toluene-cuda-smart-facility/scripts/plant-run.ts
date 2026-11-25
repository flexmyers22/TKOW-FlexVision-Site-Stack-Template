import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import '../src/loadEnv.js';
import { getAdminClient } from '../src/db/supabaseServer.js';
import { writeProcessHistory, samplesFromUnitOutputs } from '../src/services/historian.js';
import {
  buildTwinStateFromRun,
  formatTwinSummary,
  writeTwinState,
} from '../src/services/omniverseBridge.js';
import { runPlantSimulation, type PlantRunOptions } from '../src/services/plantRunner.js';

function parseOptions(): PlantRunOptions & { skipOmniverse?: boolean } {
  const opts: PlantRunOptions & { skipOmniverse?: boolean } = {};
  const idx = process.argv.indexOf('--tank-level');
  if (idx !== -1 && process.argv[idx + 1]) {
    opts.tankLevelPct = Number(process.argv[idx + 1]);
  }
  if (process.argv.includes('--no-omniverse')) opts.skipOmniverse = true;
  return opts;
}

async function main() {
  const options = parseOptions();
  const supabase = getAdminClient();

  const [{ data: equipment, error: eqErr }, { data: tiles, error: tileErr }] =
    await Promise.all([
      supabase
        .from('toluene_equipment')
        .select(
          'equipment_tag, equipment_type, process_area, binary_status, cuda_tile_id, upstream, downstream, metadata'
        )
        .order('equipment_tag'),
      supabase
        .from('cuda_tiles')
        .select('tile_id, equipment_tag, kernel_name, memory_block, update_rate_ms, binary_word')
        .order('equipment_tag'),
    ]);

  if (eqErr) throw eqErr;
  if (tileErr) throw tileErr;
  if (!equipment?.length) throw new Error('No equipment found — run seeds first');

  console.log('\n=== Toluene Plant Run ===\n');
  if (options.tankLevelPct != null) {
    console.log(`Tank level override: ${options.tankLevelPct}%\n`);
  }
  console.log(`Loaded ${equipment.length} equipment, ${tiles?.length ?? 0} CUDA tiles\n`);

  const result = runPlantSimulation(equipment, tiles ?? [], options);

  for (const unit of result.units) {
    const icon = unit.status === 'ok' ? '✓' : '✗';
    const signals = Object.entries(unit.decoded_out)
      .filter(([, on]) => on)
      .map(([k]) => k)
      .join(', ');
    console.log(`${icon} ${unit.equipment_tag} [${unit.kernel_name}]`);
    console.log(`   ${unit.message}`);
    console.log(`   binary: ${unit.binary_in} → ${unit.binary_out}  (${signals || 'none'})`);
    console.log(`   outputs: ${JSON.stringify(unit.outputs)}\n`);
  }

  for (const unit of result.units) {
    await supabase
      .from('toluene_equipment')
      .update({ binary_status: unit.binary_out })
      .eq('equipment_tag', unit.equipment_tag);

    if (unit.equipment_tag) {
      const tileId = equipment.find((e) => e.equipment_tag === unit.equipment_tag)?.cuda_tile_id;
      if (tileId) {
        await supabase
          .from('cuda_tiles')
          .update({ binary_word: unit.binary_out })
          .eq('tile_id', tileId);
      }
    }
  }

  const runtimeRows = result.units.map((unit) => ({
    Equipment: unit.equipment_tag,
    'Key output': unit.message,
  }));

  const { error: runtimeErr } = await supabase
    .from('Equipment Runtime Data')
    .insert(runtimeRows);

  if (runtimeErr) {
    console.warn('Warning: could not log runtime data:', runtimeErr.message);
  } else {
    console.log(`Logged ${runtimeRows.length} rows to Equipment Runtime Data`);
  }

  const historyRows = result.units.flatMap((unit) =>
    samplesFromUnitOutputs(unit.equipment_tag, unit.outputs)
  );

  if (historyRows.length > 0) {
    const { count, error: histErr } = await writeProcessHistory(supabase, historyRows);
    if (histErr) {
      console.warn('Warning: could not log process_history:', histErr);
    } else {
      console.log(`Logged ${count} samples to process_history\n`);
    }
  }

  const runsDir = join(process.cwd(), 'runs');
  await mkdir(runsDir, { recursive: true });
  const reportPath = join(runsDir, `${result.run_id}.json`);
  await writeFile(reportPath, JSON.stringify(result, null, 2));

  console.log('=== Summary ===');
  console.log(`Run ID:     ${result.run_id}`);
  console.log(`Units:      ${result.summary.total_units}`);
  console.log(`Alarms:     ${result.summary.alarms}`);
  console.log(`Feed:       ${result.summary.feed_rate_lb_hr} lb/hr`);
  console.log(`Conversion: ${result.summary.reactor_conversion_pct}%`);
  console.log(`Report:     ${reportPath}`);
  console.log(`Status:     ${result.summary.alarms === 0 ? 'PASS' : 'FAIL'}\n`);

  if (!options.skipOmniverse) {
    const state = buildTwinStateFromRun(result, equipment);
    const twinPath = await writeTwinState(state);
    console.log('=== Omniverse Sync ===');
    console.log(`Twin state: ${twinPath}`);
    for (const line of formatTwinSummary(state)) console.log(line);
    if (state.active_alarms.length) {
      console.log(`Alarms: ${state.active_alarms.join(', ')}`);
    }
    console.log('');
  }
}

main().catch((err) => {
  console.error('Plant run failed:', err.message);
  process.exit(1);
});
