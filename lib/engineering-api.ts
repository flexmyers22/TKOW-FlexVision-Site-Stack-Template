export type LibraryDocument = {
  document_id: string
  revision_id: string
  title: string
  path: string
  source_hash: string
  searchable: boolean
}

export type Citation = {
  document_id: string
  revision_id: string
  chunk_id: string
  locator: {
    page?: number | null
    section?: string | null
    sheet?: string | null
    range?: string | null
  }
  source_hash: string
}

export type ChatResponse = {
  answer: string
  citations: Citation[]
  assumptions: string[]
  unresolved: string[]
  trace_id: string
  conversation_id?: string
}

export type UploadInitiateResponse = {
  document_id: string
  revision_id: string
  upload_url: string
  expires_at: string
  required_headers: Record<string, string>
}

export type DocumentStatus = {
  status?: string
  state?: string
  progress?: number
  error?: string
}

export type GenerationJob = {
  job_id: string
  state: string
  stage?: string
  progress?: number
  artifact_ids?: string[]
  retryable?: boolean
  error_code?: string
  version?: number
  missing_inputs?: string[]
}

export type JobStatus = Pick<GenerationJob, 'state'> & Partial<Omit<GenerationJob, 'state'>>

export type ArtifactDownload = {
  download_url: string
  expires_at: string
}

type ContractError = {
  error?: {
    code?: string
    message?: string
    trace_id?: string
  }
}

export class EngineeringApiError extends Error {
  code?: string
  traceId?: string

  constructor(message: string, code?: string, traceId?: string) {
    super(message)
    this.name = 'EngineeringApiError'
    this.code = code
    this.traceId = traceId
  }
}

export function getApiConfiguration() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
  return {
    baseUrl: configuredUrl ? configuredUrl.replace(/\/+$/, '') : '',
    projectId: process.env.NEXT_PUBLIC_PROJECT_ID?.trim() || 'flexvision-pilot',
    localChat: !configuredUrl,
  }
}

function idempotencyKey() {
  return globalThis.crypto.randomUUID()
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiConfiguration().baseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    let payload: ContractError = {}
    try {
      payload = (await response.json()) as ContractError
    } catch {
      // Some gateways return an empty or non-JSON error body.
    }

    const statusMessage = response.status === 401
      ? 'Sign in is required to use the engineering API.'
      : response.status === 403
        ? 'You do not have access to this project or resource.'
        : response.status === 413
          ? 'The file exceeds the server upload limit.'
          : response.status === 415
            ? 'The server does not support this file type.'
            : payload.error?.message || `The engineering API returned HTTP ${response.status}.`

    throw new EngineeringApiError(statusMessage, payload.error?.code, payload.error?.trace_id)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export function listLibrary() {
  return request<{ library: string; documents: LibraryDocument[] }>('/v1/library')
}

export function sendChat(
  projectId: string,
  text: string,
  sourceRevisionIds: string[],
  conversationId?: string,
  model?: string,
) {
  return request<ChatResponse>('/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify({
      project_id: projectId,
      ...(conversationId ? { conversation_id: conversationId } : {}),
      text,
      ...(sourceRevisionIds.length ? { source_revision_ids: sourceRevisionIds } : {}),
      ...(model ? { model } : {}),
    }),
  })
}

export async function uploadDocument(file: File, projectId: string, category: string) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const initiated = await request<UploadInitiateResponse>('/v1/uploads/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify({
      project_id: projectId,
      filename: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      sha256,
      category,
    }),
  })

  const uploadResponse = await fetch(initiated.upload_url, {
    method: 'PUT',
    headers: initiated.required_headers,
    body: file,
  })
  if (!uploadResponse.ok) {
    throw new EngineeringApiError(`Secure file upload failed with HTTP ${uploadResponse.status}.`)
  }

  await request(`/v1/documents/${encodeURIComponent(initiated.document_id)}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify({ revision_id: initiated.revision_id, sha256 }),
  })

  return { document_id: initiated.document_id, revision_id: initiated.revision_id }
}

export function getDocumentStatus(documentId: string) {
  return request<DocumentStatus>(`/v1/documents/${encodeURIComponent(documentId)}`)
}

export function createGeneration(
  projectId: string,
  kind: 'bom' | 'code' | 'cad',
  specification: string,
  sourceRevisionIds: string[],
  outputFormats: string[],
) {
  return request<GenerationJob>('/v1/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify({
      project_id: projectId,
      kind,
      specification,
      source_revision_ids: sourceRevisionIds,
      output_formats: outputFormats,
    }),
  })
}

export function getJob(jobId: string) {
  return request<JobStatus>(`/v1/jobs/${encodeURIComponent(jobId)}`)
}

export function cancelJob(jobId: string, expectedVersion?: number) {
  return request<JobStatus>(`/v1/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify({ expected_version: expectedVersion }),
  })
}

export function retryJob(jobId: string, expectedVersion?: number) {
  return request<GenerationJob>(`/v1/jobs/${encodeURIComponent(jobId)}/retry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify({ expected_version: expectedVersion }),
  })
}

export function getArtifactDownload(artifactId: string) {
  return request<ArtifactDownload>(`/v1/artifacts/${encodeURIComponent(artifactId)}/download`)
}
