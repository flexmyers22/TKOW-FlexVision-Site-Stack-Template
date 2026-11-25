import { ADMIN_ACCESS_LOCKED } from '@/lib/server/admin-access'
import { replaceAdminPassword } from '@/lib/server/admin-entry'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (ADMIN_ACCESS_LOCKED) {
    return Response.json({ updated: false, error: { code: 'admin_locked', message: 'Admin access is locked.' } }, { status: 403 })
  }
  const body = await request.json().catch(() => null) as { EMAIL?: unknown; Password?: unknown; Confirm?: unknown } | null
  if (!body || typeof body.EMAIL !== 'string' || typeof body.Password !== 'string' || typeof body.Confirm !== 'string') {
    return Response.json({ updated: false, error: { message: 'Enter the admin email, a new password, and the confirmation.' } }, { status: 400 })
  }
  try {
    await replaceAdminPassword(body.EMAIL, body.Password, body.Confirm)
    return Response.json({ updated: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The admin password was not replaced.'
    return Response.json({ updated: false, error: { message } }, { status: 400 })
  }
}
