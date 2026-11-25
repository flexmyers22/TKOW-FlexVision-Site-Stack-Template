import { ProfileEntryError, resetProfilePassword } from '@/lib/server/profile-entry'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: unknown; Password?: unknown; Confirm?: unknown } | null
  if (!body || typeof body.token !== 'string' || typeof body.Password !== 'string' || typeof body.Confirm !== 'string') {
    return Response.json({ updated: false, error: { code: 'input_invalid', message: 'Enter the new password twice.' } }, { status: 400 })
  }
  if (body.Password !== body.Confirm) {
    return Response.json({ updated: false, error: { code: 'input_invalid', message: 'The two passwords do not match.' } }, { status: 400 })
  }
  try {
    await resetProfilePassword(body.token, body.Password)
    return Response.json({ updated: true })
  } catch (error) {
    if (error instanceof ProfileEntryError) {
      const status = error.code === 'storage_unavailable' ? 503 : 400
      return Response.json({ updated: false, error: { code: error.code, message: error.message } }, { status })
    }
    console.error('[profile] reset failed:', error instanceof Error ? error.message : error)
    return Response.json({ updated: false, error: { code: 'reset_failed', message: 'The password could not be reset. Try again.' } }, { status: 500 })
  }
}
