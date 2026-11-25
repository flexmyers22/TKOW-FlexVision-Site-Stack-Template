import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../digital_twin');

/** Load latest PCS / BESS JSON twin assets (file-backed telemetry for now). */
export async function readPcsTelemetry() {
  return JSON.parse(await readFile(join(ROOT, 'assets/PCS-001.json'), 'utf8'));
}

export async function readBessState() {
  return JSON.parse(await readFile(join(ROOT, 'assets/BESS-001.json'), 'utf8'));
}
