import { blenderStatus } from '@/lib/server/blender'

export const runtime = 'nodejs'

export async function GET() {
  return Response.json(await blenderStatus())
}
