import { buildBlenderTwin } from '@/lib/server/blender'

export const runtime = 'nodejs'

export async function POST() {
  try {
    return Response.json(await buildBlenderTwin())
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Blender did not build the envelopes.'
    const missing = /not accepting|did not answer|stays on this computer|running the site|before building/.test(message)
    return Response.json({ error: { message } }, { status: missing ? 503 : 500 })
  }
}
