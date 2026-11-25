import { matlabAnalyze } from '@/lib/server/matlab'

export const runtime = 'nodejs'

type Body = { image_base64?: unknown }

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body
    if (typeof body.image_base64 !== 'string') {
      return error(400, 'image_required', 'Send a picture as image_base64.')
    }
    return Response.json(await matlabAnalyze(body.image_base64, 'picture'))
  } catch (problem) {
    return unavailable(problem)
  }
}

function unavailable(problem: unknown) {
  const message = problem instanceof Error ? problem.message : 'MATLAB could not analyze the picture.'
  const missing = /fetch failed|ECONNREFUSED|timeout|aborted/i.test(message)
  return error(missing ? 503 : 502, missing ? 'matlab_not_connected' : 'matlab_failed', missing
    ? 'MATLAB is not connected. Start tkowVisionServer before measuring area.'
    : message)
}

function error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status })
}
