import { runMonthlyProfilePull } from '@/lib/server/newsletter-mail'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const header = request.headers.get('authorization') ?? ''
  if (!secret || header !== `Bearer ${secret}`) {
    return Response.json({ error: { message: 'The monthly profile-address check is not authorized.' } }, { status: 401 })
  }
  try {
    return Response.json(await runMonthlyProfilePull(request))
  } catch (error) {
    return Response.json({ error: { message: error instanceof Error ? error.message : 'The monthly check failed.' } }, { status: 400 })
  }
}
