import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  OSCILLATION_CLASSES,
  classifyOscillation,
  severityForClass,
  setsWarnBit,
  type OscillationEvent,
} from '../src/types/oscillation.js';
import { decodeBessBinary, encodeBessBinary } from '../src/types/bess.js';

async function main() {
  const demos: OscillationEvent[] = [
    {
      timestamp: new Date().toISOString(),
      asset_id: 'PCS-001',
      class_id: classifyOscillation({ frequency_hz: 60 }),
      severity: 'normal',
      frequency_hz: 60,
      notes: 'Steady 60 Hz waveform',
    },
    {
      timestamp: new Date().toISOString(),
      asset_id: 'PCS-001',
      class_id: classifyOscillation({
        after_load_change: true,
        decaying: true,
        duration_s: 0.4,
      }),
      severity: 'normal',
      duration_s: 0.4,
      decaying: true,
      notes: 'Load step on LOAD-AI-001',
    },
    {
      timestamp: new Date().toISOString(),
      asset_id: 'PCS-001',
      class_id: classifyOscillation({ decaying: true, duration_s: 0.08 }),
      severity: 'watch',
      duration_s: 0.08,
      decaying: true,
      notes: 'Ringing after breaker close',
    },
    {
      timestamp: new Date().toISOString(),
      asset_id: 'PCS-001',
      class_id: classifyOscillation({ decaying: false, duration_s: 5 }),
      severity: 'alarm',
      duration_s: 5,
      decaying: false,
      notes: 'Undamped power oscillation',
    },
    {
      timestamp: new Date().toISOString(),
      asset_id: 'CTRL-001',
      class_id: classifyOscillation({ mode_changes_per_s: 3 }),
      severity: 'alarm',
      control_mode: 'grid_following↔islanded',
      notes: 'Mode chatter',
    },
    {
      timestamp: new Date().toISOString(),
      asset_id: 'P101',
      class_id: classifyOscillation({ mechanical_sensor: true }),
      severity: 'watch',
      notes: 'Pump bearing vibration',
    },
  ].map((e) => ({
    ...e,
    severity: severityForClass(e.class_id),
    binary_status: setsWarnBit(e.class_id)
      ? encodeBessBinary({ ...decodeBessBinary('00000011'), WARN: true })
      : '00000011',
  }));

  const outDir = join(process.cwd(), 'electrical/diagnostics');
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, 'oscillation_events_demo.json');
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        taxonomy: OSCILLATION_CLASSES,
        events: demos,
      },
      null,
      2
    )
  );

  console.log('=== Oscillation Taxonomy ===\n');
  for (const c of OSCILLATION_CLASSES) {
    console.log(`${c.class_id.padEnd(24)} ${c.severity.padEnd(6)}  ${c.name}`);
    console.log(`  ${c.description}`);
  }
  console.log(`\nDemo events: ${demos.length} → ${outPath}`);
  for (const e of demos) {
    console.log(`  ${e.class_id.padEnd(24)} ${e.asset_id}  binary=${e.binary_status}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
