import { workflowCredentialFile, workflowPageFrom } from '@/lib/server/credential-base'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ baseId: string; fileId: string }> }) {
  const { baseId, fileId } = await context.params
  const body = await request.json().catch(() => ({})) as { page?: unknown }
  try {
    const file = await workflowCredentialFile(baseId, fileId, workflowPageFrom(body.page))
    return Response.json(file)
  } catch (problem) {
    const message = problem instanceof Error ? problem.message : 'The file could not be sent to that page.'
    return Response.json({ error: { code: 'workflow_failed', message } }, { status: message.includes('not found') || message.includes('not in') ? 404 : 400 })
  }
}
