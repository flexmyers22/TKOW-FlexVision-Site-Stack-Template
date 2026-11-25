import { isChatModel, type ChatModelId } from '@/lib/chat-models'

const bridgeSlugs: Record<ChatModelId, string> = {
  'spacexai/grok-4.7': 'xai_grok_4_7',
  'openai/gpt-6.1-sol': 'openai_gpt_6_1_sol',
  'anthropic/claude-sonnet-5.5': 'anthropic_claude_sonnet_5_5',
  'deepseek/deepseek-v4-pro': 'deepseek_v4_pro',
}

export function bridgeConfigured() {
  return Boolean(process.env.TKOW_BRIDGE_URL?.trim() && process.env.TKOW_BRIDGE_TOKEN?.trim())
}

export function bridgeSlug(model: string) {
  if (!isChatModel(model)) return model
  return bridgeSlugs[model]
}

export async function askModelBridge(model: string, messages: { role: 'system' | 'user' | 'assistant'; content: string }[]) {
  const base = process.env.TKOW_BRIDGE_URL?.trim().replace(/\/+$/, '')
  const token = process.env.TKOW_BRIDGE_TOKEN?.trim()
  if (!base || !token) {
    throw new Error('Set TKOW_BRIDGE_URL and TKOW_BRIDGE_TOKEN before using the model bridge.')
  }
  const response = await fetch(`${base}/chat`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: bridgeSlug(model), messages }),
  })
  const payload = await response.json().catch(() => ({})) as { answer?: string; error?: string }
  if (!response.ok || !payload.answer) {
    throw new Error(payload.error || `The model bridge returned HTTP ${response.status}.`)
  }
  return payload.answer
}
