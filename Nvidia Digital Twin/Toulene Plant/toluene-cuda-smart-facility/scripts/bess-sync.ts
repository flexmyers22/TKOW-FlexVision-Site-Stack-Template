import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import '../src/loadEnv.js';
import {
  BESS_001_DEFAULT,
  binaryFromBessState,
  decodeBessBinary,
  type BessAssetState,
} from '../src/types/bess.js';

async function loadBessFile(root: string): Promise<BessAssetState> {
  const path = join(root, 'electrical/assets/BESS-001.json');
  const raw = JSON.parse(await readFile(path, 'utf8'));
  return { ...BESS_001_DEFAULT, ...raw } as BessAssetState;
}

async function main() {
  const root = process.cwd();
  let state = await loadBessFile(root);

  // Optional: merge live row from Supabase
  try {
    const { getAdminClient } = await import('../src/db/supabaseServer.js');
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('bess_runtime')
      .select('*')
      .eq('asset_id', 'BESS-001')
      .maybeSingle();
    if (!error && data) {
      state = { ...state, ...data } as BessAssetState;
    }
  } catch {
    // offline — file only
  }

  // Keep binary consistent with flags when telemetry is connected
  if (state.telemetry_status !== 'not_connected') {
    state.binary_status = binaryFromBessState(state);
  }

  const decoded = decodeBessBinary(state.binary_status);

  const outDir = join(root, 'electrical');
  await mkdir(join(outDir, 'assets'), { recursive: true });
  await writeFile(join(outDir, 'assets/BESS-001.json'), JSON.stringify(state, null, 2));

  const runtimeSnapshot = {
    generated_at: new Date().toISOString(),
    project_id: state.project_id,
    asset: state,
    decoded_binary: decoded,
    cuda_tile: 'CUDA_TILE_ENERGY',
    usd_prim: '/Site/ElectricalSubstation/BESS_001',
    qualification_boundary: state.qualification_boundary,
  };
  await writeFile(join(outDir, 'bess_runtime_state.json'), JSON.stringify(runtimeSnapshot, null, 2));

  console.log('=== BESS-001 Digital Twin ===\n');
  console.log(`Project:   ${state.project_id}`);
  console.log(`Mode:      ${state.operating_mode}`);
  console.log(`Telemetry: ${state.telemetry_status}`);
  console.log(`Binary:    ${state.binary_status}`);
  console.log(`Boundary:  ${state.qualification_boundary}`);
  console.log(`Grid:      ${state.grid_connected}  |  Island: ${state.island_capable}  |  Black-start: ${state.black_start_capable}`);
  console.log(`P/Q/I:     ${state.active_power_mw} MW / ${state.reactive_power_mvar} Mvar / ${state.current_a} A`);
  console.log(`SOC:       ${state.state_of_charge_pct ?? 'null'}%`);
  console.log(`\nWrote electrical/assets/BESS-001.json`);
  console.log(`Wrote electrical/bess_runtime_state.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
