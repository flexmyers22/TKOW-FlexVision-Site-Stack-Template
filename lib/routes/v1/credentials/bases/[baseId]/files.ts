import { addCredentialFile } from '@/lib/server/credential-base'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ baseId: string }> }) {
  const { baseId } = await context.params
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: { code: 'file_required', message: 'Choose a file to attach to this library base.' } }, { status: 400 })
  }
  try {
    const attachment = await addCredentialFile(baseId, {
      filename: file.name,
      contentType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })
    return Response.json(attachment, { status: 201 })
  } catch (problem) {
    const message = problem instanceof Error ? problem.message : 'The file could not be attached.'
    const missing = message.includes('not found')
    return Response.json({ error: { code: missing ? 'base_not_found' : 'file_rejected', message } }, { status: missing ? 404 : 400 })
  }
}
