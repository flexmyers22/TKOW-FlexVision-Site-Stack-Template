export type MatlabRegion = {
  id: string
  area_px: number
  centroid_xy: number[]
  bbox_xywh: number[]
}

export type MatlabTrack = {
  track_id: string
  area_px: number
  centroid_xy: number[]
  bbox_xywh: number[]
  missed: number
}

export type MatlabVisionResult = {
  source: 'matlab'
  mode?: 'picture' | 'live'
  width: number
  height: number
  threshold: number
  regions: MatlabRegion[]
  tracks?: MatlabTrack[]
  session_id?: string
}

const MAX_IMAGE_CHARS = 6_000_000

export function matlabUrl() {
  return (process.env.MATLAB_URL?.trim() || 'http://127.0.0.1:8788').replace(/\/+$/, '')
}

export async function matlabStatus() {
  const url = matlabUrl()
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1500) })
    if (!response.ok) {
      return { connected: false, url, message: `MATLAB responded with HTTP ${response.status}.` }
    }
    return { connected: true, url, message: 'MATLAB vision service is accepting picture and live frames.' }
  } catch {
    return {
      connected: false,
      url,
      message: 'Start MATLAB from the matlab folder with tkowVisionServer. Area and tracks are not measured until it answers.',
    }
  }
}

export async function matlabAnalyze(imageBase64: string, mode: 'picture' | 'live', sessionId?: string) {
  if (!imageBase64.trim()) {
    throw new Error('A picture or live frame is required.')
  }
  if (imageBase64.length > MAX_IMAGE_CHARS) {
    throw new Error('The frame is too large. Use a smaller picture.')
  }
  const path = mode === 'live' ? '/live' : '/analyze'
  const response = await fetch(`${matlabUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_base64: imageBase64,
      ...(sessionId ? { session_id: sessionId } : {}),
    }),
    signal: AbortSignal.timeout(mode === 'live' ? 4000 : 20000),
  })
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) {
    throw new Error(payload.error || `MATLAB returned HTTP ${response.status}.`)
  }
  const result = payload as MatlabVisionResult
  result.regions = asList(result.regions)
  result.tracks = asList(result.tracks)
  return result
}

function asList<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}
