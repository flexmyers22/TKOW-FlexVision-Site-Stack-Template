import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const ADMIN_ACCESS_COOKIE = 'fv_admin_access'
export const ADMIN_EMAIL = 'jaylinmyers@flexvisionllc.com'
export const ADMIN_UUID = 'wf6HApz'
export const ADMIN_ACCESS_LOCKED = false

const TOKEN_SECRET = 'GA7aJ2Wjl2S9cAItArlXXjH7IP7diwfV8T24-Ng0ywo'

export function adminAccessToken() {
  const payload = ADMIN_UUID
  const signature = createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function hasAdminAccessCookie(value: string | undefined) {
  if (ADMIN_ACCESS_LOCKED || !value) return false
  const expected = Buffer.from(adminAccessToken())
  const actual = Buffer.from(value)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function newsletterSealKey() {
  return createHash('sha256').update(TOKEN_SECRET).digest()
}

export function sealNewsletterRecipient(email: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', newsletterSealKey(), iv)
  const encrypted = Buffer.concat([cipher.update(email, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
}

export function openNewsletterRecipient(token: string) {
  try {
    const raw = Buffer.from(token, 'base64url')
    if (raw.length < 29) return null
    const decipher = createDecipheriv('aes-256-gcm', newsletterSealKey(), raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    const email = decipher.update(raw.subarray(28), undefined, 'utf8') + decipher.final('utf8')
    return email.includes('@') ? email : null
  } catch {
    return null
  }
}

