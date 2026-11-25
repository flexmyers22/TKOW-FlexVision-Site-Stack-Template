import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  auth,
  type OAuthAuthorizationServerInformation,
  type OAuthClientInformation,
  type OAuthClientMetadata,
  type OAuthClientProvider,
  type OAuthTokens,
} from '@ai-sdk/mcp'

export const FEATURESCRIPT_MCP_URL = process.env.FEATURESCRIPT_MCP_URL?.trim() || 'https://fs-mcp.labs.onshape.app/mcp'
export const ONSHAPE_SCOPES = 'OAuth2Read OAuth2Write OAuth2Delete'

const ALLOWED_AUTHORIZATION_SERVER = 'https://mcp-auth.labs.onshape.app'
const storePath = path.join(process.cwd(), '.data', 'onshape-mcp-oauth.json')

type OAuthStore = {
  redirectUrl?: string
  tokens?: OAuthTokens
  codeVerifier?: string
  state?: string
  clientInformation?: OAuthClientInformation
  authorizationServerInformation?: OAuthAuthorizationServerInformation
  dynamicallyRegistered?: boolean
}

let writeQueue: Promise<void> = Promise.resolve()

async function readStore(): Promise<OAuthStore> {
  try {
    return JSON.parse(await readFile(storePath, 'utf8')) as OAuthStore
  } catch (error) {
    if (isMissingFile(error)) return {}
    throw error
  }
}

async function updateStore(change: (store: OAuthStore) => void) {
  const run = writeQueue.then(async () => {
    const store = await readStore()
    change(store)
    await mkdir(path.dirname(storePath), { recursive: true })
    await writeFile(storePath, JSON.stringify(store), { encoding: 'utf8', mode: 0o600 })
  })
  writeQueue = run.then(() => undefined, () => undefined)
  await run
}

export async function hasOnshapeTokens() {
  const store = await readStore()
  return Boolean(store.tokens?.access_token)
}

export async function storedOnshapeRedirectUrl() {
  const redirectUrl = (await readStore()).redirectUrl
  return redirectUrl ? new URL(redirectUrl) : new URL('http://127.0.0.1/v1/onshape/callback')
}

export class OnshapeOAuthProvider implements OAuthClientProvider {
  authorizationUrl?: URL
  private readonly redirectTarget: URL

  constructor(redirectTarget: URL, private readonly interactive: boolean) {
    this.redirectTarget = redirectTarget
  }

  get redirectUrl() {
    return this.redirectTarget
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'TKOW Engineering AI Chat',
      redirect_uris: [this.redirectTarget.toString()],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: ONSHAPE_SCOPES,
      application_type: 'web',
    }
  }

  async tokens() {
    return (await readStore()).tokens
  }

  async saveTokens(tokens: OAuthTokens) {
    await updateStore((store) => {
      store.tokens = tokens
      store.redirectUrl = this.redirectTarget.toString()
    })
  }

  async redirectToAuthorization(authorizationUrl: URL) {
    if (!this.interactive) {
      throw new Error('Onshape FeatureScript sign-in expired. Use Connect Onshape and try again.')
    }
    this.authorizationUrl = authorizationUrl
  }

  async saveCodeVerifier(codeVerifier: string) {
    await updateStore((store) => {
      store.codeVerifier = codeVerifier
    })
  }

  async codeVerifier() {
    const verifier = (await readStore()).codeVerifier
    if (!verifier) throw new Error('The Onshape sign-in session is missing its code verifier. Start Connect Onshape again.')
    return verifier
  }

  async clientInformation() {
    return (await readStore()).clientInformation
  }

  async isClientInformationDynamicallyRegistered() {
    return (await readStore()).dynamicallyRegistered === true
  }

  async saveClientInformation(clientInformation: OAuthClientInformation) {
    await updateStore((store) => {
      store.clientInformation = clientInformation
      store.dynamicallyRegistered = true
    })
  }

  async authorizationServerInformation() {
    return (await readStore()).authorizationServerInformation
  }

  async saveAuthorizationServerInformation(authorizationServerInformation: OAuthAuthorizationServerInformation) {
    await updateStore((store) => {
      store.authorizationServerInformation = authorizationServerInformation
    })
  }

  validateAuthorizationServerURL(_serverUrl: string | URL, authorizationServerUrl: string | URL) {
    const origin = new URL(authorizationServerUrl).origin
    if (origin !== ALLOWED_AUTHORIZATION_SERVER) {
      throw new Error(`Refusing Onshape authorization server ${origin}.`)
    }
  }

  state() {
    return randomUUID()
  }

  async saveState(state: string) {
    await updateStore((store) => {
      store.state = state
    })
  }

  async storedState() {
    return (await readStore()).state
  }

  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier') {
    await updateStore((store) => {
      if (scope === 'all' || scope === 'tokens') store.tokens = undefined
      if (scope === 'all' || scope === 'verifier') store.codeVerifier = undefined
      if (scope === 'all' || scope === 'client') {
        store.clientInformation = undefined
        store.dynamicallyRegistered = false
      }
      if (scope === 'all') store.state = undefined
    })
  }
}

export async function beginOnshapeSignIn(redirectTarget: URL) {
  const provider = new OnshapeOAuthProvider(redirectTarget, true)
  const result = await auth(provider, {
    serverUrl: FEATURESCRIPT_MCP_URL,
    scope: ONSHAPE_SCOPES,
  })
  return { result, authorizationUrl: provider.authorizationUrl }
}

export async function finishOnshapeSignIn(redirectTarget: URL, authorizationCode: string, callbackState?: string, callbackIssuer?: string) {
  const provider = new OnshapeOAuthProvider(redirectTarget, true)
  return auth(provider, {
    serverUrl: FEATURESCRIPT_MCP_URL,
    authorizationCode,
    callbackState,
    callbackIssuer,
    scope: ONSHAPE_SCOPES,
  })
}

export function onshapeSessionProvider(redirectTarget: URL) {
  return new OnshapeOAuthProvider(redirectTarget, false)
}

function isMissingFile(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}
