import { listLibraryDocuments } from '@/lib/server/evidence-library'

export const runtime = 'nodejs'

export async function GET() {
  const documents = await listLibraryDocuments()
  return Response.json({
    library: 'engineering-docs',
    documents,
  })
}
