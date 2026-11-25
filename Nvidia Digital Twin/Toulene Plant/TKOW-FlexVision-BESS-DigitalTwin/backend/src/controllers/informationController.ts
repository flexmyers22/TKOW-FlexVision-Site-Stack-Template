import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_ORG,
  DEFAULT_PROJECT,
  INFORMATION_LAYERS,
} from '../models/informationModel.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');

export async function getInformationTree() {
  const topology = JSON.parse(
    await readFile(join(ROOT, 'digital_twin/topology/site-power-topology.json'), 'utf8')
  );
  const hierarchy = JSON.parse(
    await readFile(join(ROOT, 'digital_twin/topology/information-hierarchy.json'), 'utf8')
  );
  const bess = JSON.parse(
    await readFile(join(ROOT, 'digital_twin/assets/BESS-001.json'), 'utf8')
  );
  const pcs = JSON.parse(
    await readFile(join(ROOT, 'digital_twin/assets/PCS-001.json'), 'utf8')
  );

  return {
    layers: INFORMATION_LAYERS,
    organization: DEFAULT_ORG,
    project: DEFAULT_PROJECT,
    assets: topology.assets ?? [],
    connections: topology.power_graph ?? [],
    telemetry_and_states: {
      bess: {
        operating_mode: bess.operating_mode,
        telemetry_status: bess.telemetry_status,
        binary_status: bess.binary_status,
        state_of_charge_pct: bess.state_of_charge_pct,
      },
      pcs: {
        control_mode: pcs.control_mode,
        operating_state: pcs.operating_state,
        binary_status: pcs.binary_status,
        voltage_v: pcs.voltage_v,
        active_power_kw: pcs.active_power_kw,
        frequency_hz: pcs.frequency_hz,
        soc_pct: pcs.soc_pct,
      },
    },
    commands_alarms_events: {
      note: 'Live rows in commands / alarms / events tables when DB connected',
    },
    qualification: {
      tests: [
        'QT-GC-01',
        'QT-IS-01',
        'QT-BS-01',
        'QT-AI-01',
        'QT-CL-01',
        'QT-OSC-01',
      ],
      evidence_path: 'data/test_results/',
    },
    hierarchy_doc: hierarchy,
  };
}
