import { createHash, randomUUID } from 'node:crypto'
import { APICallError, generateText, isStepCount, NoObjectGeneratedError, NoOutputGeneratedError, Output } from 'ai'
import { z } from 'zod'
import { DEFAULT_CHAT_MODEL, isChatModel, type ChatModelId } from '@/lib/chat-models'
import type { ChatResponse } from '@/lib/engineering-api'
import { askDirectModel, directModelReady } from '@/lib/server/direct-model'
import { citationsForChunks, searchLibrary, type LibraryChunk } from '@/lib/server/evidence-library'
import { blenderChatTools, packagePrompt, readBlenderPackage } from '@/lib/server/blender'
import { openFeatureScriptSession } from '@/lib/server/featurescript-mcp'
import { askModelBridge, bridgeConfigured } from '@/lib/server/model-bridge'

const MAX_INPUT_CHARACTERS = 8000
const MAX_HISTORY_MESSAGES = 12

const answerSchema = z.object({
  answer: z.string(),
  assumptions: z.array(z.string()),
  unresolved: z.array(z.string()),
  cited_chunk_ids: z.array(z.string()),
})

type StoredMessage = {
  role: 'user' | 'assistant'
  text: string
}

type Conversation = {
  projectId: string
  messages: StoredMessage[]
}

type IdempotentResult = {
  payloadHash: string
  response: ChatResponse
}

const conversations = new Map<string, Conversation>()
const idempotentResults = new Map<string, IdempotentResult>()

export class ChatRouteError extends Error {
  status: number
  code: string
  traceId: string

  constructor(status: number, code: string, message: string, traceId = randomUUID()) {
    super(message)
    this.name = 'ChatRouteError'
    this.status = status
    this.code = code
    this.traceId = traceId
  }
}

export type ChatRequest = {
  projectId: string
  text: string
  conversationId?: string
  sourceRevisionIds: string[]
  model?: string
  idempotencyKey?: string
}

const instructions = `You are the FlexVision engineering assistant for TKOW.
Help with electrical cabinets, sensors, robotic components, enclosures, bills of materials, and FeatureScript.
Do not invent dimensions, part numbers, voltages, tolerances, or source citations.
If a claim depends on a drawing, datasheet, or approved revision that was not supplied, put that gap in unresolved and keep the answer limited to what can be said without it.
The engineering library is the local document set, including documents added to that library and the site packages in the Sites folder. The Flex-Vision Sites Portfolio records are browser-local registry entries. Keep their status, milestones, package storage, and site URLs only as recorded, and leave Proposed / unverified records unverified. Do not treat OneDrive, SharePoint, Microsoft Graph, n8n, LLM APIs, Snowflake, Supabase, Pinecone, Onshape, Arena PLM, Cura, Cricut, Arduino, or ChatGPT Library as connected. When a portfolio record states the unit rule, consumer products use millimeters and industrial components use inches.
For garment and colorway questions, use the Platinum Slang Colorway Studio records when they are supplied. That colorway is a digital concept with physical approval pending. HEX values are visual references, not dye formulas or supplier-approved fabric matches. Do not invent cut measurements, fabric area, supplier, lot, finish, or chemical recipes. A visual percentage balance is not a cut pattern, bill of materials, or fabric-area measurement. Use only the supplied excerpts for document-backed claims. Return cited_chunk_ids for every excerpt you use, and no other chunk IDs. Pinecone, Snowflake, and ERP writes are not available in this request.
When Onshape FeatureScript tools are available, use them for FeatureScript work. Every tool call consumes the signed-in user's Onshape API allocation, so say that before the first call in a conversation.
Read the FeatureScript notes before writing code. Discover the live library version with test_featurescript before writing new code, and preserve the version already in an existing Feature Studio.
Test FeatureScript before presenting it. Call put_featurescript only when the user asks to save into a Feature Studio, and only once, with the finished source.
Use create_geometry only when the user asks to create geometry. Leave its cleanup enabled unless the user asks to keep the workspace.
Do not sign out and do not change which Onshape API allocation is consumed.
Generated drafts are proposals, not released manufacturing files.
A product-workspace package may be attached below. It is the local PLM collection record for the NVIDIA Omniverse digital twin. Use only the recorded part sizes. Missing sizes stay unresolved. Envelope blocks are not released CAD, and the admin digital twin workspace file is not uploaded yet.
When the Blender tool is available, call blender_build_digital_twin with confirm true only if the user asks to build or update the digital-twin envelopes in Blender. The tool writes one block per recorded part and exports omniverse-envelopes.glb. Do not claim Blender ran when that tool is absent.`

export async function answerEngineeringChat(request: ChatRequest): Promise<ChatResponse> {
  const projectId = request.projectId.trim()
  const text = request.text.trim()
  if (!projectId) {
    throw new ChatRouteError(400, 'project_required', 'A project_id is required.')
  }
  if (!text) {
    throw new ChatRouteError(400, 'text_required', 'A chat message is required.')
  }
  if (text.length > MAX_INPUT_CHARACTERS) {
    throw new ChatRouteError(400, 'text_too_long', `Chat input is limited to ${MAX_INPUT_CHARACTERS} characters.`)
  }

  const useBridge = bridgeConfigured() && !process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN
  const model = useBridge ? resolveBridgeModel(request.model) : resolveModel(request.model)
  const useDirect = !useBridge && !process.env.AI_GATEWAY_API_KEY?.trim() && directModelReady(model)
  const payloadHash = hashPayload({ projectId, text, conversationId: request.conversationId, sourceRevisionIds: request.sourceRevisionIds, model })
  if (request.idempotencyKey) {
    const previous = idempotentResults.get(request.idempotencyKey)
    if (previous) {
      if (previous.payloadHash !== payloadHash) {
        throw new ChatRouteError(409, 'idempotency_conflict', 'This Idempotency-Key was already used with a different chat payload.')
      }
      return previous.response
    }
  }

  const conversationId = request.conversationId?.trim() || randomUUID()
  const existing = conversations.get(conversationId)
  if (existing && existing.projectId !== projectId) {
    throw new ChatRouteError(403, 'conversation_project_mismatch', 'That conversation belongs to a different project.')
  }

  const history = existing?.messages.slice(-MAX_HISTORY_MESSAGES) ?? []
  const evidence = await searchLibrary(text, request.sourceRevisionIds)
  const evidenceNote = evidence.length
    ? `Engineering library excerpts:\n${formatEvidence(evidence)}`
    : request.sourceRevisionIds.length
      ? 'None of the selected revisions are in the engineering library, so no excerpt was read.'
      : 'The engineering library had no passage that matched this question.'

  const [featureScript, blender, productPackage] = await Promise.all([
    useBridge || useDirect
      ? Promise.resolve({ connected: false, tools: {}, close: async () => undefined })
      : openFeatureScriptSession(),
    useBridge || useDirect
      ? Promise.resolve({ connected: false, packageReady: false, tools: {} })
      : blenderChatTools(),
    readBlenderPackage(),
  ])
  const tools = { ...featureScript.tools, ...blender.tools }
  const toolsConnected = Object.keys(tools).length > 0
  let generated: z.infer<typeof answerSchema>
  try {
    if (useBridge) {
      const answer = await askModelBridge(model, [
        { role: 'system', content: instructions },
        ...history.map((message) => ({ role: message.role, content: message.text })),
        { role: 'user', content: `${text}\n\n${evidenceNote}\n${packagePrompt(productPackage)}` },
      ])
      generated = {
        answer,
        assumptions: [],
        unresolved: ['This answer came from the local model bridge. FeatureScript tools stay on the AI Gateway path.'],
        cited_chunk_ids: [],
      }
    } else if (useDirect) {
      const directMessages = [
        { role: 'system' as const, content: `${instructions}\nRespond with one JSON object and no markdown. Use the fields answer, assumptions, unresolved, and cited_chunk_ids.` },
        ...history.map((message) => ({ role: message.role, content: message.text })),
        { role: 'user' as const, content: `${text}\n\n${evidenceNote}\n${packagePrompt(productPackage)}` },
      ]
      const direct = await answerWithoutGateway(model, directMessages)
      generated = parseDirectAnswer(direct.answer)
      generated.unresolved.push(direct.note)
    } else {
    const featureScriptNote = featureScript.connected
      ? 'Onshape FeatureScript tools are connected for this request.'
      : 'Onshape FeatureScript is not signed in for this app. Do not claim that Onshape ran.'
    const blenderNote = blender.connected
      ? 'Blender MCP is connected for this request.'
      : 'Blender MCP is not connected. Do not claim that Blender ran.'
    const messages = [
      ...history.map((message) => ({ role: message.role, content: message.text })),
      { role: 'user' as const, content: `${text}\n\n${evidenceNote}\n${featureScriptNote}\n${blenderNote}\n${packagePrompt(productPackage)}` },
    ]
    const output = Output.object({
      name: 'EngineeringChatAnswer',
      description: 'A cited engineering answer with explicit assumptions and unresolved inputs.',
      schema: answerSchema,
    })
    try {
      const result = await generateText({
        model,
        instructions,
        ...(toolsConnected ? { tools, stopWhen: isStepCount(8) } : {}),
        output,
        messages,
      })
      generated = result.output
    } catch (error) {
      if (!toolsConnected) throw error
      console.error('[chat] retrying without FeatureScript tools:', modelFailureDetail(error))
      const result = await generateText({ model, instructions, output, messages })
      generated = result.output
    }
    }
  } catch (error) {
    if (useBridge) {
      throw new ChatRouteError(502, 'bridge_unavailable', error instanceof Error ? error.message : 'The model bridge could not complete the request.')
    }
    throw mapModelError(error)
  } finally {
    await featureScript.close()
  }

  const citations = citationsForChunks(evidence, generated.cited_chunk_ids)
  const unresolved = [`This request used ${model} only.`, ...generated.unresolved]
  if (!featureScript.connected) {
    unresolved.push('Onshape FeatureScript is not signed in. Use Connect Onshape before asking the chat to run or save FeatureScript.')
  }
  if (/blender|omniverse|digital twin|product workspace/i.test(text)) {
    if (!blender.connected) unresolved.push('Blender is not connected. Open Blender, enable the Blender MCP add-on, and start it on port 9876.')
    else if (!blender.packageReady) unresolved.push('No sized product-workspace package is stored. Send the collected record from the product workspace first.')
  }
  if (!evidence.length) {
    unresolved.push(request.sourceRevisionIds.length
      ? 'The selected revisions are not in the engineering library.'
      : 'No matching passage was found in the engineering library.')
  } else if (!citations.length) {
    unresolved.push('The answer did not cite a supplied engineering-library passage.')
  }

  const response: ChatResponse = {
    answer: generated.answer,
    citations,
    assumptions: generated.assumptions,
    unresolved: unique(unresolved),
    trace_id: randomUUID(),
    conversation_id: conversationId,
  }

  const messages: StoredMessage[] = [
    ...history,
    { role: 'user', text },
    { role: 'assistant', text: response.answer },
  ]
  conversations.set(conversationId, { projectId, messages: messages.slice(-MAX_HISTORY_MESSAGES) })
  if (request.idempotencyKey) {
    idempotentResults.set(request.idempotencyKey, { payloadHash, response })
  }
  return response
}

function resolveBridgeModel(requested: string | undefined): ChatModelId {
  if (!requested) return DEFAULT_CHAT_MODEL
  if (!isChatModel(requested)) {
    throw new ChatRouteError(400, 'model_not_allowed', 'Choose Grok, GPT, Claude, or DeepSeek.')
  }
  return requested
}

function resolveModel(requested: string | undefined): ChatModelId {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    throw new ChatRouteError(
      503,
      'model_not_configured',
      'Set AI_GATEWAY_API_KEY in .env.local, or set TKOW_BRIDGE_URL and TKOW_BRIDGE_TOKEN for the local model bridge. Keys stay on the server.',
    )
  }

  if (requested) {
    if (!isChatModel(requested)) {
      throw new ChatRouteError(400, 'model_not_allowed', 'Choose Grok, GPT, Claude, or DeepSeek.')
    }
    return requested
  }

  const configured = process.env.AI_GATEWAY_MODEL?.trim()
  if (!configured) return DEFAULT_CHAT_MODEL
  if (!isChatModel(configured)) {
    throw new ChatRouteError(500, 'model_not_allowed', 'AI_GATEWAY_MODEL must be one of the chat models enabled for this app.')
  }
  return configured
}

function mapModelError(error: unknown): ChatRouteError {
  if (error instanceof ChatRouteError) return error
  if (NoObjectGeneratedError.isInstance(error) || NoOutputGeneratedError.isInstance(error)) {
    return new ChatRouteError(502, 'model_output_invalid', 'The model did not return a valid engineering answer. Try the request again.')
  }
  if (APICallError.isInstance(error)) {
    const status = error.statusCode ?? 502
    if (status === 401 || status === 403) {
      return new ChatRouteError(503, 'model_auth', 'The AI Gateway rejected the server credential. Check AI_GATEWAY_API_KEY.')
    }
    if (status === 402) {
      return new ChatRouteError(503, 'model_billing', 'The AI Gateway account needs credits or a payment method before chat can run.')
    }
    if (status === 429) {
      return new ChatRouteError(429, 'model_rate_limited', 'The model provider is rate limiting requests. Wait a moment and try again.')
    }
    return new ChatRouteError(502, 'model_unavailable', modelUnavailableMessage(error))
  }
  return new ChatRouteError(502, 'model_unavailable', modelUnavailableMessage(error))
}

async function answerWithoutGateway(
  model: ChatModelId,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
) {
  const direct = await askDirectModel(model, messages)
  return { answer: direct.answer, note: `This answer came from ${direct.provider} model ${direct.model}.` }
}

function parseDirectAnswer(text: string): z.infer<typeof answerSchema> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  try {
    const parsed = answerSchema.safeParse(JSON.parse(cleaned))
    if (parsed.success) return parsed.data
  } catch {
    // The provider returned prose instead of the citation object.
  }
  return {
    answer: text,
    assumptions: [],
    unresolved: ['The direct model did not return citation JSON, so no library citation was accepted.'],
    cited_chunk_ids: [],
  }
}

function formatEvidence(chunks: LibraryChunk[]) {
  return chunks.map((chunk) => `[${chunk.chunk_id}] ${chunk.path} · ${chunk.section}\n${chunk.text}`).join('\n\n')
}

function modelUnavailableMessage(error: unknown) {
  const detail = modelFailureDetail(error)
  console.error('[chat] model_unavailable:', detail || 'no provider detail')
  return detail
    ? `The selected model could not complete the request. ${detail}`
    : 'The selected model could not complete the request.'
}

function modelFailureDetail(error: unknown) {
  if (!APICallError.isInstance(error)) return error instanceof Error ? sanitizeModelDetail(error.message) : ''
  const body = typeof error.responseBody === 'string' ? error.responseBody : JSON.stringify(error.responseBody ?? '')
  return sanitizeModelDetail(body || error.message)
}

function sanitizeModelDetail(value: string) {
  const compact = value.replace(/\s+/g, ' ').slice(0, 220)
  if (/bearer|token|api[_-]?key|sk-|oidc|authorization/i.test(compact)) return ''
  return compact
}

function hashPayload(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function unique(values: string[]) {
  return values.filter((value, index) => value.trim() && values.indexOf(value) === index)
}
