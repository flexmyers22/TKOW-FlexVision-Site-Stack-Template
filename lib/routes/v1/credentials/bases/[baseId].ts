import { listCredentialBase } from '@/lib/server/credential-base'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ baseId: string }> }) {
  const { baseId } = await context.params
  const base = await listCredentialBase(baseId)
  if (!base) {
    return Response.json({ error: { code: 'base_not_found', message: 'That credential library base was not found.' } }, { status: 404 })
  }
  return Response.json({ base_id: base.base_id, files: base.files })
}
