import { createCredentialBase } from '@/lib/server/credential-base'
import { createCredentialKey, CREDENTIAL_KEY_LENGTH } from '@/lib/server/credential-key'

export const runtime = 'nodejs'

const MAX_INPUT = 500

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { input?: unknown }
  if (body.input !== undefined && typeof body.input !== 'string') {
    return Response.json({ error: { code: 'input_invalid', message: 'Random input must be text.' } }, { status: 400 })
  }
  const input = typeof body.input === 'string' ? body.input : ''
  if (input.length > MAX_INPUT) {
    return Response.json({ error: { code: 'input_too_long', message: `Random input is limited to ${MAX_INPUT} characters.` } }, { status: 400 })
  }
  const key = createCredentialKey(input)
  const base = await createCredentialBase()
  return Response.json({ key, length: CREDENTIAL_KEY_LENGTH, base_id: base.base_id })
}
