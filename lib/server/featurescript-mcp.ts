import { createMCPClient } from '@ai-sdk/mcp'
import type { ToolSet } from 'ai'
import {
  FEATURESCRIPT_MCP_URL,
  hasOnshapeTokens,
  onshapeSessionProvider,
  storedOnshapeRedirectUrl,
} from '@/lib/server/onshape-oauth'

const blockedTools = new Set(['logout', 'set_api_allocation', 'mcp_auth'])

export type FeatureScriptSession = {
  connected: boolean
  tools: ToolSet
  close: () => Promise<void>
}

export async function openFeatureScriptSession(): Promise<FeatureScriptSession> {
  if (!(await hasOnshapeTokens())) {
    return { connected: false, tools: {}, close: async () => undefined }
  }

  const client = await createMCPClient({
    clientName: 'TKOW Engineering AI Chat',
    transport: {
      type: 'http',
      url: FEATURESCRIPT_MCP_URL,
      authProvider: onshapeSessionProvider(await storedOnshapeRedirectUrl()),
    },
  })

  try {
    const discovered = await client.tools()
    const tools: ToolSet = {}
    for (const [name, tool] of Object.entries(discovered)) {
      if (!blockedTools.has(name)) tools[name] = tool
    }
    return {
      connected: true,
      tools,
      close: () => client.close(),
    }
  } catch (error) {
    await client.close()
    throw error
  }
}
