import { beginOAuth } from '@/lib/server/oauth-step'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params
  return beginOAuth(request, provider)
}
