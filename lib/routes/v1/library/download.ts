import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { resolveLibraryDownload } from '@/lib/server/evidence-library'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const documentId = new URL(request.url).searchParams.get('document_id')?.trim() ?? ''
  if (!documentId) {
    return Response.json({ error: { code: 'document_required', message: 'A document_id is required.' } }, { status: 400 })
  }
  const file = await resolveLibraryDownload(documentId)
  if (!file) {
    return Response.json({ error: { code: 'document_not_found', message: 'That library file is not available for download.' } }, { status: 404 })
  }
  const filename = file.filename.replace(/["\r\n]/g, '')
  const stream = Readable.toWeb(createReadStream(file.fullPath)) as ReadableStream
  return new Response(stream, {
    headers: {
      'Content-Type': file.zip ? 'application/zip' : 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
