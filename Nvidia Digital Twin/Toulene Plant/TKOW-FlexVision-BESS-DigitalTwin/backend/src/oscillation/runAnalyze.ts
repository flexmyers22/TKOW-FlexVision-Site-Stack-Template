import {
  analyzeElectricalWindow,
  synthesizeWindow,
  type StabilityVerdict,
} from './oscillationAnalyzer.js';

const kinds: StabilityVerdict[] = ['STABLE', 'RINGING', 'HUNTING', 'UNSTABLE'];
for (const kind of kinds) {
  const r = analyzeElectricalWindow('PCS-001', synthesizeWindow({ kind }));
  console.log(
    `${r.verdict.padEnd(10)} WARN=${r.set_warn_bit}  ${r.detail_class}  residual=${r.metrics.residual_rms}`
  );
}
