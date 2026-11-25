import { moveCredentialFile } from '@/lib/server/credential-base'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ baseId: string; fileId: string }> }) {
  const { baseId, fileId } = await context.params
  const body = await request.json().catch(() => ({})) as { direction?: unknown }
  if (body.direction !== 'earlier' && body.direction !== 'later') {
    return Response.json({ error: { code: 'direction_required', message: 'Move the file earlier or later in this base.' } }, { status: 400 })
  }
  try {
    const files = await moveCredentialFile(baseId, fileId, body.direction)
    return Response.json({ files })
  } catch (problem) {
    const message = problem instanceof Error ? problem.message : 'The file could not be moved.'
    return Response.json({ error: { code: 'move_failed', message } }, { status: message.includes('not found') || message.includes('not in') ? 404 : 400 })
  }
}
