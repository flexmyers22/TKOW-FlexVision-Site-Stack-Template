import { completeOAuth } from '@/lib/server/oauth-step'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  return completeOAuth(request)
}
