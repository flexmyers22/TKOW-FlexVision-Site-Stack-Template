import { grantProfileAccess, oauthStepRequired, rememberPasswordStep } from '@/lib/server/oauth-step'
import { ProfileEntryError, signInProfile, signUpProfile } from '@/lib/server/profile-entry'

export const runtime = 'nodejs'

const STATUS: Record<ProfileEntryError['code'], number> = {
  input_invalid: 400,
  not_found: 401,
  mismatch: 401,
  admin_email: 403,
  exists: 409,
  full: 507,
  storage_unavailable: 503,
  reset_invalid: 400,
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { mode?: unknown; EMAIL?: unknown; Password?: unknown; Confirm?: unknown } | null
  if (!body || typeof body.EMAIL !== 'string' || typeof body.Password !== 'string') {
    return Response.json({ access: false, error: { code: 'input_invalid', message: 'Enter the email and password.' } }, { status: 400 })
  }
  const signUp = body.mode === 'sign-up'
  if (signUp && body.Confirm !== body.Password) {
    return Response.json({ access: false, error: { code: 'input_invalid', message: 'The two passwords do not match.' } }, { status: 400 })
  }
  try {
    const { email } = signUp
      ? await signUpProfile(body.EMAIL, body.Password)
      : await signInProfile(body.EMAIL, body.Password)
    if (oauthStepRequired()) {
      await rememberPasswordStep('profile', email)
      return Response.json({ access: false, step: 'oauth', created: signUp })
    }
    await grantProfileAccess()
    return Response.json({ access: true, created: signUp }, { status: signUp ? 201 : 200 })
  } catch (error) {
    if (error instanceof ProfileEntryError) {
      return Response.json({ access: false, error: { code: error.code, message: error.message } }, { status: STATUS[error.code] })
    }
    console.error('[profile] entry failed:', error instanceof Error ? error.message : error)
    return Response.json({ access: false, error: { code: 'entry_failed', message: 'The profile could not be checked. Try again.' } }, { status: 500 })
  }
}
