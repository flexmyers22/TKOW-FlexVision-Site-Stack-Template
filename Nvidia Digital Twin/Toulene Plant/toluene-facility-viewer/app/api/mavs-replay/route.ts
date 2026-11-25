import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { validateRun, type RunManifest } from '@/lib/mavs-contract'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RUN_DIR = path.join(process.cwd(), 'fixtures', 'plant-perimeter-rover', 'RUN-SYNTH-PERIMETER-001')

async function readRun() {
  const manifest = JSON.parse(await readFile(path.join(RUN_DIR, 'manifest.json'), 'utf8')) as RunManifest
  const files: Record<string, Buffer> = {}
  for (const item of manifest.inputs) {
    files[item.path] = await readFile(path.join(RUN_DIR, item.path))
  }
  return validateRun({ manifest, files })
}

export async function GET(request: Request) {
  const frame = new URL(request.url).searchParams.get('frame')
  try {
    const run = await readRun()
    if (!frame) return Response.json(run)
    const listed = run.frames.some((item) => item.frame_path === frame)
    if (!listed) return Response.json({ error: 'That frame is not in this run.' }, { status: 404 })
    const bytes = await readFile(path.join(RUN_DIR, frame))
    return new Response(bytes, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The simulation run could not be read.'
    return Response.json({ error: message }, { status: 400 })
  }
}
