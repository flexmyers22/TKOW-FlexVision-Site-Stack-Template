import { createHmac, timingSafeEqual } from 'node:crypto'

export const PROFILE_ACCESS_COOKIE = 'fv_profile_access'
export const PENDING_STEP_COOKIE = 'fv_auth_step'
export const OAUTH_TXN_COOKIE = 'fv_oauth_txn'

const SESSION_SECRET = 'u8uOyGrOeMlQfgB2Kjki2hzv8PS4OsxAM4MuEFnDHf4'
const PROFILE_SECONDS = 60 * 60 * 12

export function seal(payload: string) {
  const signature = createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function openSeal(token: string) {
  const index = token.lastIndexOf('.')
  if (index <= 0) return null
  const payload = token.slice(0, index)
  const signature = token.slice(index + 1)
  const expected = createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url')
  const actual = Buffer.from(signature)
  const wanted = Buffer.from(expected)
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return null
  return payload
}

export function profileAccessToken(now = Date.now()) {
  const exp = Math.floor(now / 1000) + PROFILE_SECONDS
  return seal(`profile.${exp}`)
}

export function hasProfileAccessCookie(value: string | undefined, now = Date.now()) {
  if (!value) return false
  const payload = openSeal(value)
  if (!payload?.startsWith('profile.')) return false
  const exp = Number(payload.slice('profile.'.length))
  return Number.isFinite(exp) && exp * 1000 > now
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge,
  }
}
