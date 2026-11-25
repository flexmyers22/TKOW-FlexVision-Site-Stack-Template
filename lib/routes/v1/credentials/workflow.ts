import { isWorkflowPage } from '@/lib/credential-pages'
import { listWorkflowFiles } from '@/lib/server/credential-base'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const page = new URL(request.url).searchParams.get('page')?.trim() ?? ''
  if (!isWorkflowPage(page)) {
    return Response.json({ error: { code: 'page_required', message: 'Choose a workspace page.' } }, { status: 400 })
  }
  return Response.json({ page, files: await listWorkflowFiles(page) })
}
