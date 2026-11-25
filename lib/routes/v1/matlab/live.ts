import { matlabAnalyze } from '@/lib/server/matlab'

export const runtime = 'nodejs'

type Body = { image_base64?: unknown; session_id?: unknown }

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body
    if (typeof body.image_base64 !== 'string') {
      return Response.json({ error: { code: 'image_required', message: 'Send a live frame as image_base64.' } }, { status: 400 })
    }
    const sessionId = typeof body.session_id === 'string' && body.session_id.trim() ? body.session_id.trim() : 'live'
    return Response.json(await matlabAnalyze(body.image_base64, 'live', sessionId))
  } catch (problem) {
    const message = problem instanceof Error ? problem.message : 'MATLAB could not track the live frame.'
    const missing = /fetch failed|ECONNREFUSED|timeout|aborted/i.test(message)
    return Response.json({
      error: {
        code: missing ? 'matlab_not_connected' : 'matlab_failed',
        message: missing ? 'MATLAB is not connected. Start tkowVisionServer before live tracking.' : message,
      },
    }, { status: missing ? 503 : 502 })
  }
}
