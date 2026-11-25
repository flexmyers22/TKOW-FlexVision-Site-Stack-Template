export const CHAT_MODELS = [
  { id: 'spacexai/grok-4.7', label: 'Grok 4.7' },
  { id: 'openai/gpt-6.1-sol', label: 'GPT' },
  { id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet' },
  { id: 'deepseek/deepseek-v4-pro', label: 'DeepSeek' },
] as const

export type ChatModelId = (typeof CHAT_MODELS)[number]['id']

export const DEFAULT_CHAT_MODEL: ChatModelId = CHAT_MODELS[0].id

export function isChatModel(value: string): value is ChatModelId {
  return CHAT_MODELS.some((model) => model.id === value)
}
