import '../src/loadEnv.js';
import { getAdminClient } from '../src/db/supabaseServer.js';
import {
  buildTwinStateFromDb,
  formatTwinSummary,
  writeTwinState,
} from '../src/services/omniverseBridge.js';

async function main() {
  const supabase = getAdminClient();
  const [{ data: equipment }, { data: history }] = await Promise.all([
    supabase.from('toluene_equipment').select('equipment_tag, binary_status, cuda_tile_id'),
    supabase
      .from('process_history')
      .select('equipment_tag, sensor_tag, value, timestamp')
      .order('timestamp', { ascending: false })
      .limit(200),
  ]);

  const state = buildTwinStateFromDb(equipment ?? [], history ?? []);
  const outPath = await writeTwinState(state);

  console.log('=== Omniverse Sync ===\n');
  console.log(`Wrote ${state.equipment.length} equipment states → ${outPath}`);
  for (const line of formatTwinSummary(state)) console.log(line);
  if (state.active_alarms.length) {
    console.log(`\nActive alarms: ${state.active_alarms.join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
