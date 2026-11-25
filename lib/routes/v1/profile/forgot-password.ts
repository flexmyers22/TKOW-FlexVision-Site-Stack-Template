import { after } from 'next/server'
import { cleanEmail, createProfileReset } from '@/lib/server/profile-entry'
import { resetEmailReady, sendResetEmail, siteOrigin } from '@/lib/server/reset-email'

export const runtime = 'nodejs'

const SENT = 'If an account uses that email, a reset link is on its way. Check your inbox and spam folder; the link expires in 30 minutes.'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { EMAIL?: unknown } | null
  let email: string
  try {
    email = cleanEmail(typeof body?.EMAIL === 'string' ? body.EMAIL : '')
  } catch {
    return Response.json({ sent: false, error: { code: 'input_invalid', message: 'Enter a full email address.' } }, { status: 400 })
  }
  if (!resetEmailReady()) {
    return Response.json({ sent: false, error: { code: 'email_unavailable', message: 'Password recovery email is not set up on this site yet.' } }, { status: 503 })
  }
  const origin = siteOrigin(request)
  after(async () => {
    try {
      const reset = await createProfileReset(email)
      if (reset) await sendResetEmail(reset.email, `${origin}/reset-password?token=${reset.token}`)
    } catch (error) {
      console.error('[profile] reset email failed:', error instanceof Error ? error.message : error)
    }
  })
  return Response.json({ sent: true, message: SENT })
}
