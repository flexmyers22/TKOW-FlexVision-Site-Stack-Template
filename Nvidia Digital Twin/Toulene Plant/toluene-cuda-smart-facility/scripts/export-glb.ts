import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildGlbBuffer,
  EQUIPMENT_GLB_SPECS,
  loadEquipmentMetadata,
} from '../src/services/usdToGlb.js';

async function main() {
  const rootDir = process.cwd();
  const glbDir = join(rootDir, 'plant/glb');
  await mkdir(glbDir, { recursive: true });

  console.log('=== USD → GLB Export ===\n');

  const manifest = {
    version: '1.0',
    rule: 'USD is Omniverse master; GLB is web viewer derivative',
    generated_at: new Date().toISOString(),
    assets: [] as {
      equipment_tag: string;
      usd: string;
      glb: string;
      shell_prim: string;
      bytes: number;
    }[],
  };

  for (const spec of EQUIPMENT_GLB_SPECS) {
    const metadata = await loadEquipmentMetadata(rootDir, spec.tag);
    const buffer = buildGlbBuffer(spec, metadata);
    const outPath = join(glbDir, spec.glbFile);
    await writeFile(outPath, buffer);

    manifest.assets.push({
      equipment_tag: spec.tag,
      usd: spec.usdPath,
      glb: `plant/glb/${spec.glbFile}`,
      shell_prim: spec.shellPrim,
      bytes: buffer.length,
    });

    console.log(`✓ ${spec.tag}  ${spec.usdPath} → plant/glb/${spec.glbFile}  (${buffer.length} bytes)`);
  }

  const manifestPath = join(glbDir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest: plant/glb/manifest.json`);
  console.log(`Exported ${manifest.assets.length} GLB files`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
