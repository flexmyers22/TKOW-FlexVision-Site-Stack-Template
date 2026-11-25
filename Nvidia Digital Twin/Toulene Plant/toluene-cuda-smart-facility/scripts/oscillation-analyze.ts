import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  analyzeElectricalWindow,
  synthesizeWindow,
  type StabilityVerdict,
} from '../src/services/oscillationAnalyzer.js';

async function main() {
  const kinds: StabilityVerdict[] = ['STABLE', 'RINGING', 'HUNTING', 'UNSTABLE'];
  const results = kinds.map((kind) => {
    const samples = synthesizeWindow({ kind });
    return analyzeElectricalWindow('PCS-001', samples);
  });

  // Also classify current PCS standby snapshot as a trivial stable window
  const pcsStandby = analyzeElectricalWindow(
    'PCS-001',
    Array.from({ length: 600 }, (_, i) => ({
      t_s: i / 1200,
      v_v: 480 * Math.sin((2 * Math.PI * 60 * i) / 1200),
      i_a: 0,
      p_kw: 0,
      q_kvar: 0,
      frequency_hz: 60,
      control_mode: 'grid_following',
    }))
  );

  const outDir = join(process.cwd(), 'electrical/diagnostics');
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, 'analysis_pipeline_demo.json');
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        pipeline: results[0].pipeline,
        pcs_standby_480v_60hz: pcsStandby,
        synthetic: results,
      },
      null,
      2
    )
  );

  console.log('=== Oscillation Analysis Pipeline ===\n');
  for (const step of results[0].pipeline) {
    console.log(`  ↓  ${step}`);
  }
  console.log('');
  console.log('PCS standby (480 V / 60 Hz):', pcsStandby.verdict, pcsStandby.detail_class);
  console.log('');
  for (const r of results) {
    console.log(
      `${r.verdict.padEnd(10)} residual_rms=${r.metrics.residual_rms.toFixed(4)}  ` +
        `decay=${r.metrics.decaying}  modes=${r.metrics.mode_transition_count}  ` +
        `WARN=${r.set_warn_bit}  → ${r.detail_class}`
    );
  }
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
