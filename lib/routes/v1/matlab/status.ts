import { matlabStatus } from '@/lib/server/matlab'

export const runtime = 'nodejs'

export async function GET() {
  return Response.json(await matlabStatus())
}
