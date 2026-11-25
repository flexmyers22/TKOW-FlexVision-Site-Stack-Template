import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_ACCESS_COOKIE, ADMIN_ACCESS_LOCKED, adminAccessToken } from '@/lib/server/admin-access'
import {
  OAUTH_TXN_COOKIE,
  PENDING_STEP_COOKIE,
  PROFILE_ACCESS_COOKIE,
  cookieOptions,
  openSeal,
  profileAccessToken,
  seal,
} from '@/lib/server/session-gate'

const STEP_SECONDS = 600

type ProviderName = 'google' | 'microsoft'
type AccessTarget = 'profile' | 'admin'
type PendingStep = { target: AccessTarget; email: string; exp: number }
type OAuthTxn = { provider: ProviderName; state: string; verifier: string; redirectUri: string; exp: number }

export function providerReady(provider: ProviderName) {
  if (provider === 'google') return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)
}

export function oauthStepRequired() {
  return providerReady('google') || providerReady('microsoft')
}

export async function rememberPasswordStep(target: AccessTarget, email: string) {
  const pending: PendingStep = { target, email, exp: Math.floor(Date.now() / 1000) + STEP_SECONDS }
  const jar = await cookies()
  jar.set(PENDING_STEP_COOKIE, seal(Buffer.from(JSON.stringify(pending)).toString('base64url')), cookieOptions(STEP_SECONDS))
}

export async function grantProfileAccess() {
  const jar = await cookies()
  jar.set(PROFILE_ACCESS_COOKIE, profileAccessToken(), cookieOptions(60 * 60 * 12))
}

export async function grantAdminAccess() {
  if (ADMIN_ACCESS_LOCKED) return
  const jar = await cookies()
  jar.set(ADMIN_ACCESS_COOKIE, adminAccessToken(), cookieOptions(60 * 60 * 12))
}

export function beginOAuth(request: NextRequest, provider: string) {
  const from = request.nextUrl.searchParams.get('from') === 'admin' ? 'admin' : 'profile'
  const back = signInUrl(request, from)
  if (from === 'admin' && ADMIN_ACCESS_LOCKED) return NextResponse.redirect(back)
  if (provider !== 'google' && provider !== 'microsoft') return NextResponse.redirect(withReason(back, 'failed'))
  if (!providerReady(provider)) return NextResponse.redirect(withReason(back, 'unconfigured'))
  const pending = readPending(request)
  if (!pending) return NextResponse.redirect(withReason(back, 'need-password'))
  const state = randomBytes(32).toString('base64url')
  const verifier = randomBytes(32).toString('base64url')
  const redirectUri = new URL('/v1/auth/oauth/callback', request.nextUrl.origin).toString()
  const txn: OAuthTxn = {
    provider,
    state,
    verifier,
    redirectUri,
    exp: Math.floor(Date.now() / 1000) + STEP_SECONDS,
  }
  const response = NextResponse.redirect(authorizeUrl(provider, { clientId: clientConfig(provider).clientId, redirectUri, state, verifier }))
  response.cookies.set(OAUTH_TXN_COOKIE, seal(Buffer.from(JSON.stringify(txn)).toString('base64url')), cookieOptions(STEP_SECONDS))
  return response
}

export async function completeOAuth(request: NextRequest) {
  const txn = readTxn(request)
  const pending = readPending(request)
  const back = signInUrl(request, pending?.target || 'profile')
  const providerError = request.nextUrl.searchParams.get('error')
  if (providerError) return finish(withReason(back, providerError === 'access_denied' ? 'denied' : 'failed'), true)
  if (!txn || !pending) return finish(withReason(back, 'need-password'), true)
  const state = request.nextUrl.searchParams.get('state') || ''
  const code = request.nextUrl.searchParams.get('code') || ''
  if (!code || !sameText(state, txn.state)) return finish(withReason(back, 'failed'), true)
  try {
    const email = await providerEmail(txn, code)
    if (!email || !sameText(email, pending.email)) return finish(withReason(back, 'mismatch'), true)
    const destination = new URL(pending.target === 'admin' ? '/admin' : '/', request.nextUrl.origin)
    const response = NextResponse.redirect(destination)
    response.cookies.set(PENDING_STEP_COOKIE, '', { ...cookieOptions(0), maxAge: 0 })
    response.cookies.set(OAUTH_TXN_COOKIE, '', { ...cookieOptions(0), maxAge: 0 })
    if (pending.target === 'admin') {
      if (ADMIN_ACCESS_LOCKED) return finish(withReason(back, 'failed'), true)
      response.cookies.set(ADMIN_ACCESS_COOKIE, adminAccessToken(), cookieOptions(60 * 60 * 12))
    }
    else response.cookies.set(PROFILE_ACCESS_COOKIE, profileAccessToken(), cookieOptions(60 * 60 * 12))
    return response
  } catch {
    return finish(withReason(back, 'failed'), true)
  }
}

function finish(url: URL, clearTxn: boolean) {
  const response = NextResponse.redirect(url)
  if (clearTxn) response.cookies.set(OAUTH_TXN_COOKIE, '', { ...cookieOptions(0), maxAge: 0 })
  return response
}

function authorizeUrl(provider: ProviderName, input: { clientId: string; redirectUri: string; state: string; verifier: string }) {
  const challenge = createHash('sha256').update(input.verifier).digest('base64url')
  const url = new URL(provider === 'google'
    ? 'https://accounts.google.com/o/oauth2/v2/auth'
    : `https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/authorize`)
  url.searchParams.set('client_id', input.clientId)
  url.searchParams.set('redirect_uri', input.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', input.state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('prompt', 'select_account')
  if (provider === 'microsoft') url.searchParams.set('response_mode', 'query')
  return url
}

async function providerEmail(txn: OAuthTxn, code: string) {
  const config = clientConfig(txn.provider)
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: txn.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: txn.verifier,
  })
  const tokenUrl = txn.provider === 'google'
    ? 'https://oauth2.googleapis.com/token'
    : `https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/token`
  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!tokenResponse.ok) throw new Error('token')
  const token = await tokenResponse.json() as { id_token?: string; access_token?: string }
  const issuer = txn.provider === 'google' ? 'https://accounts.google.com' : 'https://login.microsoftonline.com/'
  const email = token.id_token ? emailFromIdToken(token.id_token, config.clientId, issuer, txn.provider) : ''
  if (email) return email
  if (!token.access_token) return ''
  const userInfoUrl = txn.provider === 'google'
    ? 'https://openidconnect.googleapis.com/v1/userinfo'
    : 'https://graph.microsoft.com/oidc/userinfo'
  const userInfoResponse = await fetch(userInfoUrl, { headers: { Authorization: `Bearer ${token.access_token}` } })
  if (!userInfoResponse.ok) return ''
  const userInfo = await userInfoResponse.json() as { email?: string; preferred_username?: string; email_verified?: boolean }
  if (txn.provider === 'google' && userInfo.email_verified !== true) return ''
  const fallback = (userInfo.email || userInfo.preferred_username || '').trim().toLowerCase()
  return fallback.includes('@') ? fallback : ''
}

function emailFromIdToken(idToken: string, clientId: string, issuerPrefix: string, provider: ProviderName) {
  const payload = idToken.split('.')[1]
  if (!payload) return ''
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    aud?: string | string[]
    iss?: string
    email?: string
    preferred_username?: string
    email_verified?: boolean
  }
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!audience.includes(clientId) || !claims.iss?.startsWith(issuerPrefix)) return ''
  if (provider === 'google' && claims.email_verified !== true) return ''
  const email = (claims.email || claims.preferred_username || '').trim().toLowerCase()
  return email.includes('@') ? email : ''
}

function clientConfig(provider: ProviderName) {
  if (provider === 'google') {
    return { clientId: process.env.GOOGLE_CLIENT_ID || '', clientSecret: process.env.GOOGLE_CLIENT_SECRET || '' }
  }
  return { clientId: process.env.MICROSOFT_CLIENT_ID || '', clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '' }
}

function tenantId() {
  return process.env.MICROSOFT_TENANT_ID || 'common'
}

function readPending(request: NextRequest): PendingStep | null {
  return readJson(request.cookies.get(PENDING_STEP_COOKIE)?.value, isPending)
}

function readTxn(request: NextRequest): OAuthTxn | null {
  return readJson(request.cookies.get(OAUTH_TXN_COOKIE)?.value, isTxn)
}

function readJson<T>(value: string | undefined, check: (item: unknown) => item is T) {
  if (!value) return null
  const payload = openSeal(value)
  if (!payload) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as unknown
    return check(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isPending(value: unknown): value is PendingStep {
  if (!value || typeof value !== 'object') return false
  const item = value as PendingStep
  return (item.target === 'profile' || item.target === 'admin')
    && typeof item.email === 'string'
    && item.email.includes('@')
    && typeof item.exp === 'number'
    && item.exp * 1000 > Date.now()
}

function isTxn(value: unknown): value is OAuthTxn {
  if (!value || typeof value !== 'object') return false
  const item = value as OAuthTxn
  return (item.provider === 'google' || item.provider === 'microsoft')
    && typeof item.state === 'string'
    && typeof item.verifier === 'string'
    && typeof item.redirectUri === 'string'
    && item.redirectUri.endsWith('/v1/auth/oauth/callback')
    && typeof item.exp === 'number'
    && item.exp * 1000 > Date.now()
}

function signInUrl(request: NextRequest, target: AccessTarget) {
  return new URL(target === 'admin' ? '/admin/sign-in' : '/profile', request.nextUrl.origin)
}

function withReason(url: URL, reason: string) {
  url.searchParams.set('oauth', reason)
  return url
}

function sameText(left: string, right: string) {
  const actual = createHash('sha256').update(left).digest()
  const expected = createHash('sha256').update(right).digest()
  return timingSafeEqual(actual, expected)
}
