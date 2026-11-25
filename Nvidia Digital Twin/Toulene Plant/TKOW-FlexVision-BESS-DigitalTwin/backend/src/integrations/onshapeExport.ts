import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  exportPartStudioGltf,
  exportPartStudioStl,
  getCadTargetFromEnv,
  listDocumentElements,
} from './onshapeClient.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT_DIR = join(ROOT, 'digital_twin', 'cad', 'onshape');

async function main() {
  const formats = (process.env.ONSHAPE_EXPORT_FORMATS ?? 'gltf,stl')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const target = getCadTargetFromEnv();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = (target.label ?? 'partstudio').replace(/[^\w.-]+/g, '_');

  await mkdir(OUT_DIR, { recursive: true });

  const elements = await listDocumentElements(target.documentId, target.workspaceId);
  const elementMeta = elements.find((e) => e.id === target.elementId);
  const elementType = String(elementMeta?.elementType ?? elementMeta?.type ?? 'unknown');
  const elementName = String(elementMeta?.name ?? target.label ?? target.elementId);

  console.log(
    JSON.stringify(
      {
        documentId: target.documentId,
        workspaceId: target.workspaceId,
        elementId: target.elementId,
        elementName,
        elementType,
        formats,
        outDir: OUT_DIR,
      },
      null,
      2
    )
  );

  const written: string[] = [];
  const errors: Array<{ format: string; error: string }> = [];
  const manifest: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    source: {
      documentId: target.documentId,
      workspaceId: target.workspaceId,
      elementId: target.elementId,
      elementName,
      elementType,
    },
    files: [] as Array<{ format: string; path: string; bytes: number }>,
    errors: [] as Array<{ format: string; error: string }>,
  };

  if (formats.includes('stl')) {
    try {
      const stl = await exportPartStudioStl(target);
      const rel = `${baseName}_${stamp}.stl`;
      const abs = join(OUT_DIR, rel);
      await writeFile(abs, stl);
      written.push(abs);
      (manifest.files as Array<Record<string, unknown>>).push({
        format: 'stl',
        path: `digital_twin/cad/onshape/${rel}`,
        bytes: stl.length,
      });
      console.log(`Wrote STL (${stl.length} bytes) → ${abs}`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      errors.push({ format: 'stl', error });
      console.error(`STL export failed: ${error}`);
    }
  }

  if (formats.includes('gltf') || formats.includes('glb')) {
    try {
      const gltf = await exportPartStudioGltf(target);
      const isGlb = gltf.length >= 4 && gltf.subarray(0, 4).toString('ascii') === 'glTF';
      const ext = isGlb ? 'glb' : 'gltf';
      const rel = `${baseName}_${stamp}.${ext}`;
      const abs = join(OUT_DIR, rel);
      await writeFile(abs, gltf);
      written.push(abs);
      (manifest.files as Array<Record<string, unknown>>).push({
        format: ext,
        path: `digital_twin/cad/onshape/${rel}`,
        bytes: gltf.length,
      });
      console.log(`Wrote ${ext.toUpperCase()} (${gltf.length} bytes) → ${abs}`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      errors.push({ format: 'gltf', error });
      console.error(`GLTF export failed: ${error}`);
    }
  }

  manifest.errors = errors;
  const manifestPath = join(OUT_DIR, `${baseName}_${stamp}.manifest.json`);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  written.push(manifestPath);
  console.log(`Manifest → ${manifestPath}`);
  console.log(JSON.stringify({ ok: errors.length === 0, written, errors }, null, 2));
  if (written.length <= 1) process.exitCode = 1;
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
