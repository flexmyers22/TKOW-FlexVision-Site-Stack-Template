import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { resolveCredentialFile } from '@/lib/server/credential-base'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ baseId: string; fileId: string }> }) {
  const { baseId, fileId } = await context.params
  const file = await resolveCredentialFile(baseId, fileId)
  if (!file) {
    return Response.json({ error: { code: 'file_not_found', message: 'That attachment is not in this library base.' } }, { status: 404 })
  }
  const stream = Readable.toWeb(createReadStream(file.fullPath)) as ReadableStream
  return new Response(stream, {
    headers: {
      'Content-Type': file.content_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file.filename.replace(/["\r\n]/g, '')}"`,
    },
  })
}
