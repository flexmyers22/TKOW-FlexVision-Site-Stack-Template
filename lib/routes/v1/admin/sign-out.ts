import { NextResponse } from 'next/server'
import { ADMIN_ACCESS_COOKIE } from '@/lib/server/admin-access'
import { cookieOptions } from '@/lib/server/session-gate'

export const runtime = 'nodejs'

export function POST(request: Request) {
  const response = NextResponse.redirect(new URL('/', request.url), 303)
  response.cookies.set(ADMIN_ACCESS_COOKIE, '', cookieOptions(0))
  return response
}
