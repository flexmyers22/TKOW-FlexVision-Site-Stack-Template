import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import '../src/loadEnv.js';

interface TopologyV2 {
  version: string;
  facility: string;
  assets: Record<string, unknown>[];
  power_graph: Record<string, unknown>[];
  process_mcc: Record<string, unknown>[];
}

async function loadJson(path: string) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function main() {
  const root = process.cwd();
  const topology = (await loadJson(join(root, 'electrical/topology.json'))) as TopologyV2;
  const comms = await loadJson(join(root, 'electrical/comms/communication_map.json'));

  let dbAssets: unknown[] = [];
  let dbChannels: unknown[] = [];
  let dbNodes: unknown[] = [];
  let dbConnections: unknown[] = [];
  let source = 'topology+comms';

  try {
    const { getAdminClient } = await import('../src/db/supabaseServer.js');
    const supabase = getAdminClient();
    const [a, c, n, conn] = await Promise.all([
      supabase.from('electrical_dt_assets').select('*').order('asset_id'),
      supabase.from('electrical_comm_channels').select('*').order('channel_id'),
      supabase.from('site_power_nodes').select('*').order('node_tag'),
      supabase.from('site_power_connections').select('*'),
    ]);
    if (!a.error && a.data?.length) {
      dbAssets = a.data;
      dbChannels = c.data ?? [];
      dbNodes = n.data ?? [];
      dbConnections = conn.data ?? [];
      source = 'supabase+topology';
    }
  } catch {
    // offline — topology only
  }

  const state = {
    generated_at: new Date().toISOString(),
    facility: topology.facility,
    source,
    diagram: {
      path: 'GRID-001 → XFMR-001 → SWGR-001 → BUS-001 → [LOAD-AI-001 | LOAD-PROCESS | BESS-001]',
      bess: 'BESS-001 ⊃ PCS-001 + BAT-RACK-001 + BMS-001',
      protection: 'RELAY-001 → SWGR-001',
      supervisor: 'CTRL-001',
    },
    assets: dbAssets.length ? dbAssets : topology.assets,
    power_graph: dbConnections.length ? dbConnections : topology.power_graph,
    nodes: dbNodes,
    communication: {
      channels: dbChannels.length ? dbChannels : comms.channels,
      modes: comms.modes,
      buses: comms.buses,
      supervisor: comms.supervisor,
    },
    process_mcc: topology.process_mcc,
    usd_scene: 'electrical/usd/ElectricalSubstation.usd',
    site_usd_prim: '/Site/ElectricalSubstation',
  };

  const outDir = join(root, 'electrical');
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, 'site_power_state.json');
  await writeFile(outPath, JSON.stringify(state, null, 2));

  // Per-asset twin stubs for Omniverse / dashboards
  const assetsDir = join(outDir, 'assets');
  await mkdir(assetsDir, { recursive: true });
  for (const asset of topology.assets) {
    const id = asset.asset_id as string;
    // Preserve authoritative runtime files for BESS / PCS
    if (id === 'BESS-001' || id === 'PCS-001') {
      try {
        const existing = JSON.parse(
          await readFile(join(assetsDir, `${id}.json`), 'utf8')
        );
        await writeFile(
          join(assetsDir, `${id}.json`),
          JSON.stringify({ ...asset, ...existing, asset_id: id }, null, 2)
        );
        continue;
      } catch {
        // fall through
      }
    }
    await writeFile(join(assetsDir, `${id}.json`), JSON.stringify(asset, null, 2));
  }

  console.log('=== Electrical DT Sync (BESS Architecture) ===\n');
  console.log(`Wrote ${outPath}`);
  console.log(`Assets: ${topology.assets.length}  |  Comms channels: ${comms.channels.length}`);
  console.log(`Per-asset files: electrical/assets/*.json`);
  console.log('\nPower path:');
  console.log('  GRID-001 → XFMR-001 → SWGR-001 → BUS-001');
  console.log('                              ├── LOAD-AI-001');
  console.log('                              ├── LOAD-PROCESS (MCC)');
  console.log('                              ├── MTR-001');
  console.log('                              └── BESS-001');
  console.log('                                    ├── PCS-001');
  console.log('                                    ├── BAT-RACK-001');
  console.log('                                    └── BMS-001');
  console.log('\nSupervisor: CTRL-001   Protection: RELAY-001');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
