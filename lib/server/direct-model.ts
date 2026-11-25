import type { ChatModelId } from '@/lib/chat-models'

export type DirectModelId = ChatModelId | 'google/gemini'

const directModels: Partial<Record<DirectModelId, { env: string; url: string; model: string; label: string }>> = {
  'spacexai/grok-4.7': {
    env: 'XAI_API_KEY',
    url: 'https://api.x.ai/v1/chat/completions',
    model: 'grok-4.7',
    label: 'xAI',
  },
  'openai/gpt-6.1-sol': {
    env: 'OPENAI_API_KEY',
    url: 'https://api.openai.com/v1/chat/completions',
    model: process.env.OPENAI_MODEL?.trim() || 'gpt-6.1-sol',
    label: 'OpenAI',
  },
  'google/gemini': {
    env: 'GEMINI_API_KEY',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
    label: 'Google Gemini',
  },
}

export function directModelReady(model: DirectModelId) {
  const spec = directModels[model]
  return Boolean(spec && process.env[spec.env]?.trim())
}

export async function askDirectModel(
  model: DirectModelId,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
) {
  const spec = directModels[model]
  const key = spec ? process.env[spec.env]?.trim() : ''
  if (!spec || !key) {
    throw new Error('This model has no direct provider key. AI Gateway still requires a credit card before it can answer.')
  }
  const response = await fetch(spec.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: spec.model,
      messages,
    }),
  })
  const raw = await response.text()
  let payload: {
    choices?: { message?: { content?: string } }[]
    error?: { message?: string } | string
    message?: string
  } = {}
  try {
    payload = JSON.parse(raw || '{}') as typeof payload
  } catch {
    payload = { message: raw }
  }
  const answer = payload.choices?.[0]?.message?.content?.trim()
  if (!response.ok || !answer) {
    const providerMessage = typeof payload.error === 'string' ? payload.error : payload.error?.message || payload.message || raw
    const detail = providerMessage
      .replaceAll(key, '')
      .replace(/\b(?:sk|key|xai)[-_][A-Za-z0-9*_-]{4,}/g, '[key hidden]')
      .replace(/\s+/g, ' ')
      .slice(0, 180) || `HTTP ${response.status}`
    throw new Error(`${spec.label} could not answer. ${detail}`)
  }
  return { answer, provider: spec.label, model: spec.model }
}
