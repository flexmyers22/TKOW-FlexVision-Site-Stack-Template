import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import '../src/loadEnv.js';
import { decodePcsBinary, PCS_001_SAMPLE, summarizePcsBinary } from '../src/types/pcs.js';

async function main() {
  const root = process.cwd();
  const assetPath = join(root, 'electrical/assets/PCS-001.json');
  let sample = { ...PCS_001_SAMPLE };

  try {
    const existing = JSON.parse(await readFile(assetPath, 'utf8'));
    sample = {
      ...PCS_001_SAMPLE,
      timestamp: existing.timestamp ?? PCS_001_SAMPLE.timestamp,
      voltage_v: existing.voltage_v ?? PCS_001_SAMPLE.voltage_v,
      current_a: existing.current_a ?? PCS_001_SAMPLE.current_a,
      active_power_kw: existing.active_power_kw ?? PCS_001_SAMPLE.active_power_kw,
      reactive_power_kvar: existing.reactive_power_kvar ?? PCS_001_SAMPLE.reactive_power_kvar,
      frequency_hz: existing.frequency_hz ?? PCS_001_SAMPLE.frequency_hz,
      soc_pct: existing.soc_pct ?? PCS_001_SAMPLE.soc_pct,
      pcs_temperature_c: existing.pcs_temperature_c ?? null,
      current_limit: existing.current_limit ?? false,
      control_mode: existing.control_mode ?? 'grid_following',
      operating_state: existing.operating_state ?? 'standby',
      alarm_code: existing.alarm_code ?? null,
      binary_status: existing.binary_status ?? '00000011',
    };
  } catch {
    // use default sample
  }

  const decoded = decodePcsBinary(sample.binary_status);

  const asset = {
    ...sample,
    project_id: 'TKOW-FV-BESS-DT-001',
    asset_type: 'power_conversion_system',
    primary_function: 'Bidirectional AC/DC control',
    parent: 'BESS-001',
    binary_decoded: decoded,
    cuda_tile: 'CUDA_TILE_ENERGY',
    usd_prim: '/Site/ElectricalSubstation/BESS_001/PCS_001',
    comms: {
      protocol: 'ModbusTCP',
      role: 'inverter',
      endpoint: '10.20.2.2:502',
      unit_id: 11,
    },
  };

  const outDir = join(root, 'electrical');
  await mkdir(join(outDir, 'assets'), { recursive: true });
  await writeFile(assetPath, JSON.stringify(asset, null, 2));

  const runtime = {
    generated_at: new Date().toISOString(),
    sample_timestamp: sample.timestamp,
    project_id: 'TKOW-FV-BESS-DT-001',
    parent: 'BESS-001',
    asset,
    decoded_binary: decoded,
    active_bits: summarizePcsBinary(sample.binary_status),
    note: 'binary 00000011 = TELEM + GRID (standby, grid_following)',
  };
  await writeFile(join(outDir, 'pcs_runtime_state.json'), JSON.stringify(runtime, null, 2));

  // Roll SOC into BESS-001 if present
  try {
    const bessPath = join(outDir, 'assets/BESS-001.json');
    const bess = JSON.parse(await readFile(bessPath, 'utf8'));
    bess.state_of_charge_pct = sample.soc_pct;
    if (sample.binary_status === '00000011' && bess.telemetry_status === 'not_connected') {
      // PCS has telem+grid; surface SOC only — leave BESS binary until BESS telem links
    }
    await writeFile(bessPath, JSON.stringify(bess, null, 2));
  } catch {
    // optional
  }

  console.log('=== PCS-001 Telemetry ===\n');
  console.log(`Timestamp:  ${sample.timestamp}`);
  console.log(`Mode:       ${sample.control_mode} / ${sample.operating_state}`);
  console.log(`V/I/f:      ${sample.voltage_v} V / ${sample.current_a} A / ${sample.frequency_hz} Hz`);
  console.log(`P/Q:        ${sample.active_power_kw} kW / ${sample.reactive_power_kvar} kvar`);
  console.log(`SOC:        ${sample.soc_pct}%`);
  console.log(`Binary:     ${sample.binary_status}  (${summarizePcsBinary(sample.binary_status)})`);
  console.log(`\nWrote electrical/assets/PCS-001.json`);
  console.log(`Wrote electrical/pcs_runtime_state.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
