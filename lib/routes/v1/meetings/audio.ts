import { firefliesConfigured, uploadMicrophoneAudio } from '@/lib/server/fireflies'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!firefliesConfigured()) {
    return error(503, 'fireflies_not_configured', 'Set FIREFLIES_API_KEY on the server before sending microphone audio.')
  }
  const form = await request.formData().catch(() => null)
  const audio = form?.get('audio')
  if (!(audio instanceof File)) {
    return error(400, 'audio_required', 'Send the microphone recording in the audio field.')
  }
  try {
    const bytes = new Uint8Array(await audio.arrayBuffer())
    return Response.json(await uploadMicrophoneAudio(bytes, audio.type || 'audio/webm'))
  } catch (problem) {
    const message = problem instanceof Error ? problem.message : 'Fireflies did not accept the microphone recording.'
    return error(502, 'fireflies_upload_failed', message)
  }
}

function error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message, retryable: status === 502 } }, { status })
}
