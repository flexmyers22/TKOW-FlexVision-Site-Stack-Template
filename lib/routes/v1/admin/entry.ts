import { ADMIN_ACCESS_LOCKED, ADMIN_EMAIL } from '@/lib/server/admin-access'
import { adminCredentialsMatch } from '@/lib/server/admin-entry'
import { grantAdminAccess, oauthStepRequired, rememberPasswordStep } from '@/lib/server/oauth-step'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (ADMIN_ACCESS_LOCKED) {
    return Response.json({ access: false, error: { code: 'admin_locked', message: 'Admin access is locked.' } }, { status: 403 })
  }
  const body = await request.json().catch(() => null) as { EMAIL?: unknown; Password?: unknown } | null
  if (!body || typeof body.EMAIL !== 'string' || typeof body.Password !== 'string') {
    return Response.json({ access: false, error: { code: 'input_invalid', message: 'Enter the admin email and password.' } }, { status: 400 })
  }
  try {
    if (!await adminCredentialsMatch(body.EMAIL, body.Password)) {
      return Response.json({ access: false, error: { code: 'entry_rejected', message: 'That email and password do not match the admin entry.' } }, { status: 401 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The admin entry could not be checked.'
    return Response.json({ access: false, error: { code: 'entry_unavailable', message } }, { status: 500 })
  }
  if (oauthStepRequired()) {
    await rememberPasswordStep('admin', ADMIN_EMAIL)
    return Response.json({ access: false, step: 'oauth' })
  }
  await grantAdminAccess()
  return Response.json({ access: true })
}
