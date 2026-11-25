import { readLookbook } from '@/lib/server/mm-lookbook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(await readLookbook())
}
