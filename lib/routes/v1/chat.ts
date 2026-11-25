import { answerEngineeringChat, ChatRouteError } from '@/lib/server/engineering-chat'

export const runtime = 'nodejs'
export const maxDuration = 60

type ChatBody = {
  project_id?: unknown
  conversation_id?: unknown
  text?: unknown
  source_revision_ids?: unknown
  model?: unknown
}

export async function POST(request: Request) {
  const traceId = crypto.randomUUID()
  try {
    const body = (await request.json()) as ChatBody
    const sourceRevisionIds = normalizeRevisionIds(body.source_revision_ids)
    const response = await answerEngineeringChat({
      projectId: typeof body.project_id === 'string' ? body.project_id : '',
      text: typeof body.text === 'string' ? body.text : '',
      conversationId: typeof body.conversation_id === 'string' ? body.conversation_id : undefined,
      sourceRevisionIds,
      model: typeof body.model === 'string' ? body.model : undefined,
      idempotencyKey: request.headers.get('Idempotency-Key') ?? undefined,
    })
    return Response.json(response)
  } catch (error) {
    if (error instanceof ChatRouteError) {
      return errorResponse(error.status, error.code, error.message, error.traceId)
    }
    if (error instanceof SyntaxError) {
      return errorResponse(400, 'invalid_json', 'The chat request body must be JSON.', traceId)
    }
    return errorResponse(500, 'chat_failed', 'The chat request could not be completed.', traceId)
  }
}

function normalizeRevisionIds(value: unknown) {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new ChatRouteError(400, 'invalid_sources', 'source_revision_ids must be an array of revision IDs.')
  }
  return value
}

function errorResponse(status: number, code: string, message: string, traceId: string) {
  return Response.json(
    { error: { code, message, trace_id: traceId, retryable: status === 429 || status >= 500 } },
    { status },
  )
}
