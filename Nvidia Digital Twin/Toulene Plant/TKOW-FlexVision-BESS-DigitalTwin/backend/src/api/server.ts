import cors from 'cors';
import { config as loadEnv } from 'dotenv';
import express from 'express';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeElectricalWindow, synthesizeWindow } from '../oscillation/oscillationAnalyzer.js';
import { listAlarms } from '../alarms/alarmService.js';
import { getInformationTree } from '../controllers/informationController.js';
import { listOnshapeDocuments } from '../integrations/onshapeClient.js';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../..');
loadEnv({ path: join(ROOT, '.env') });
const TWIN = join(ROOT, 'digital_twin');

async function loadAsset(name: string) {
  return JSON.parse(await readFile(join(TWIN, 'assets', name), 'utf8'));
}

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ?? true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, project_id: 'TKOW-FV-BESS-DT-001' }));

app.get('/api/information-model', async (_req, res) => {
  res.json(await getInformationTree());
});

app.get('/api/overview', async (_req, res) => {
  const [bess, pcs] = await Promise.all([loadAsset('BESS-001.json'), loadAsset('PCS-001.json')]);
  res.json({ project_id: 'TKOW-FV-BESS-DT-001', bess, pcs });
});

app.get('/api/bess', async (_req, res) => res.json(await loadAsset('BESS-001.json')));
app.get('/api/pcs', async (_req, res) => res.json(await loadAsset('PCS-001.json')));

app.get('/api/oscillation/latest', (_req, res) => {
  const samples = synthesizeWindow({ kind: 'STABLE' });
  const result = analyzeElectricalWindow('PCS-001', samples);
  res.json(result);
});

app.get('/api/oscillation/demo/:kind', (req, res) => {
  const kind = String(req.params.kind).toUpperCase() as 'STABLE' | 'RINGING' | 'HUNTING' | 'UNSTABLE';
  const samples = synthesizeWindow({ kind });
  res.json(analyzeElectricalWindow('PCS-001', samples));
});

app.get('/api/alarms', async (_req, res) => {
  const pcs = await loadAsset('PCS-001.json');
  res.json({ alarms: listAlarms(pcs) });
});

app.get('/api/topology', async (_req, res) => {
  const topo = JSON.parse(
    await readFile(join(TWIN, 'topology/site-power-topology.json'), 'utf8')
  );
  res.json(topo);
});

app.get('/api/onshape/documents', async (_req, res) => {
  try {
    const docs = await listOnshapeDocuments(20);
    res.json(docs);
  } catch (err) {
    res.status(503).json({
      error: err instanceof Error ? err.message : 'Onshape request failed',
    });
  }
});

app.post('/api/onshape/export', (_req, res) => {
  const child = spawn('npx', ['tsx', 'src/integrations/onshapeExport.ts'], {
    cwd: join(ROOT, 'backend'),
    shell: true,
    env: process.env,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => {
    stdout += String(d);
  });
  child.stderr.on('data', (d) => {
    stderr += String(d);
  });
  child.on('close', (code) => {
    if (code !== 0) {
      res.status(500).json({ ok: false, code, stdout, stderr });
      return;
    }
    res.json({ ok: true, stdout });
  });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`BESS DT API http://localhost:${port}`);
});
