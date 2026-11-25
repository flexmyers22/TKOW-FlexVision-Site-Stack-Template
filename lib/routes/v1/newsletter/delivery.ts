import { requireNewsletterAdmin } from '@/lib/server/newsletter-admin'
import {
  newsletterDeliveryView,
  previewNewsletterEmail,
  sendNewsletterEdition,
  setNewsletterSchedulePaused,
} from '@/lib/server/newsletter-mail'

export const runtime = 'nodejs'

function adminOnly(request: Request) {
  return requireNewsletterAdmin(request)
}

function failure(error: unknown, fallback: string) {
  return Response.json({ error: { message: error instanceof Error ? error.message : fallback } }, { status: 400 })
}

export async function GET(request: Request) {
  const refused = adminOnly(request)
  if (refused) return refused
  const preview = new URL(request.url).searchParams.get('preview')
  if (preview) {
    try {
      return Response.json({ preview: await previewNewsletterEmail(preview, request) })
    } catch (error) {
      return failure(error, 'The email preview was not created.')
    }
  }
  return Response.json(await newsletterDeliveryView())
}

export async function POST(request: Request) {
  const refused = adminOnly(request)
  if (refused) return refused
  const body = await request.json().catch(() => null) as { id?: unknown; mode?: unknown; confirm?: unknown; subject?: unknown; paused?: unknown } | null
  if (typeof body?.paused === 'boolean') {
    return Response.json({ schedule: await setNewsletterSchedulePaused(body.paused) })
  }
  if (typeof body?.id !== 'string' || (body.mode !== 'preview' && body.mode !== 'test' && body.mode !== 'profile')) {
    return Response.json({ error: { message: 'Choose an edition and a delivery action.' } }, { status: 400 })
  }
  const subject = typeof body.subject === 'string' ? body.subject : undefined
  try {
    if (body.mode === 'preview') return Response.json({ preview: await previewNewsletterEmail(body.id, request, subject) })
    if (body.mode === 'profile' && body.confirm !== true) {
      return Response.json({ error: { message: 'Confirm the profile-address send before it is submitted.' } }, { status: 400 })
    }
    const result = await sendNewsletterEdition({ id: body.id, mode: body.mode, request, subject, actor: 'admin' })
    return Response.json({ result, delivery: await newsletterDeliveryView() })
  } catch (error) {
    return failure(error, 'The newsletter email was not sent.')
  }
}
