export function firefliesConfigured() {
  return Boolean(process.env.FIREFLIES_API_KEY?.trim())
}

export function firefliesStatus() {
  return {
    provider: 'fireflies',
    connected: firefliesConfigured(),
    replaces: 'wispr',
    recording_store: 'fireflies',
    brief_delivery: 'email',
    local_copy: false,
  }
}

const AUDIO_TYPES = new Set(['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav', 'audio/x-wav'])
const MAX_AUDIO_BYTES = 10 * 1024 * 1024

export async function uploadMicrophoneAudio(bytes: Uint8Array, contentType: string) {
  const key = process.env.FIREFLIES_API_KEY?.trim()
  if (!key) throw new Error('Set FIREFLIES_API_KEY on the server before sending microphone audio.')
  const type = contentType.split(';')[0]?.trim().toLowerCase() || ''
  if (!AUDIO_TYPES.has(type)) throw new Error('Record webm, ogg, mp3, m4a, or wav audio for Fireflies.')
  if (bytes.byteLength < 1000) throw new Error('The microphone recording is too short to send.')
  if (bytes.byteLength > MAX_AUDIO_BYTES) throw new Error('The microphone recording must be 10 MB or smaller.')

  const created = await firefliesGraphql<{ createUploadUrl: { upload_url: string; meeting_id: string } }>(key, `
    mutation($input: CreateUploadUrlInput!) {
      createUploadUrl(input: $input) { upload_url meeting_id expires_at }
    }
  `, {
    input: {
      content_type: type,
      file_size: bytes.byteLength,
      title: `TKOW microphone ${new Date().toISOString()}`,
    },
  })
  const upload = created.createUploadUrl
  const stored = await fetch(upload.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': type },
    body: bytes,
  })
  if (!stored.ok) throw new Error(`Fireflies storage rejected the microphone audio with HTTP ${stored.status}.`)
  const confirmed = await firefliesGraphql<{ confirmUpload: { success: boolean; meeting_id: string; message: string } }>(key, `
    mutation($input: ConfirmUploadInput!) {
      confirmUpload(input: $input) { success meeting_id message }
    }
  `, { input: { meeting_id: upload.meeting_id } })
  if (!confirmed.confirmUpload?.success) {
    throw new Error(confirmed.confirmUpload?.message || 'Fireflies did not accept the microphone recording.')
  }
  return {
    ...firefliesStatus(),
    meeting_id: confirmed.confirmUpload.meeting_id,
    message: confirmed.confirmUpload.message || 'Fireflies has the recording. The brief will arrive by email.',
  }
}

async function firefliesGraphql<T>(key: string, query: string, variables: Record<string, unknown>) {
  const response = await fetch('https://api.fireflies.ai/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  const payload = await response.json().catch(() => ({})) as { data?: T; errors?: { message?: string }[] }
  const detail = payload.errors?.map((error) => error.message).filter(Boolean).join(' ')
  if (!response.ok || detail || !payload.data) {
    throw new Error((detail || `Fireflies returned HTTP ${response.status}.`).replaceAll(key, ''))
  }
  return payload.data
}
