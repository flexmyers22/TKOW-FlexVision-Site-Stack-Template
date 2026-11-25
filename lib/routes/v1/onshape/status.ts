import { hasOnshapeTokens } from '@/lib/server/onshape-oauth'

export const runtime = 'nodejs'

export async function GET() {
  return Response.json({ connected: await hasOnshapeTokens() })
}
