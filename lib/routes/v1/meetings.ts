import { firefliesConfigured, firefliesStatus } from '@/lib/server/fireflies'

export const runtime = 'nodejs'

export async function GET() {
  if (!firefliesConfigured()) {
    return Response.json(
      {
        error: {
          code: 'fireflies_not_configured',
          message: 'Set FIREFLIES_API_KEY on the server when the meeting key is ready. Meeting audio is separate from the chat model.',
          retryable: false,
        },
      },
      { status: 503 },
    )
  }
  return Response.json(firefliesStatus())
}
