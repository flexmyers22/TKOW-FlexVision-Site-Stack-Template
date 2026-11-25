import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { get, put } from '@vercel/blob'
import { ADMIN_EMAIL } from '@/lib/server/admin-access'
import {
  PROFILE_ENTRY_CSV_HEADER,
  SIGNUP_ENTRY_CSV_HEADER,
  createEntryUuid,
  type ProfileEntry,
  type SignupEntry,
} from '@/lib/profile-entry'
import { buildWorkbook } from '@/lib/server/xlsx'

const ROOT = path.join(process.cwd(), '.data', 'profile')
const BLOB_PREFIX = 'profile/'
const PROFILE_JSON = 'profile_entry.json'
const PROFILE_CSV = 'profile_entry.csv'
const SIGNUP_JSON = 'signup_entry.json'
const SIGNUP_CSV = 'signup_entry.csv'
const WORKBOOK = 'profile_entries.xlsx'
const RESET_JSON = 'reset_tokens.json'
const RESET_TTL_MS = 30 * 60_000
const RESET_GAP_MS = 2 * 60_000
const MAX_ENTRIES = 500
const HASH_PREFIX = 'scrypt$'
const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>

export class ProfileEntryError extends Error {
  constructor(readonly code: 'not_found' | 'mismatch' | 'exists' | 'admin_email' | 'storage_unavailable' | 'input_invalid' | 'full' | 'reset_invalid', message: string) {
    super(message)
  }
}

const STORAGE_MESSAGE = 'Profile accounts are not connected on this site yet. Try again later.'
const RESET_MESSAGE = 'This reset link has expired or was already used. Request a new one.'

type ResetToken = { hash: string; EMAIL: string; created_at_utc: string; expires_at_utc: string }

let writeQueue: Promise<unknown> = Promise.resolve()

export async function signInProfile(email: string, password: string) {
  const EMAIL = cleanEmail(email)
  const Password = cleanPassword(password)
  if (EMAIL === ADMIN_EMAIL) throw new ProfileEntryError('admin_email', 'This email signs in through the admin portal.')
  return enqueue(async () => {
    const entries = await readProfiles()
    const current = entries.filter((entry) => entry.EMAIL === EMAIL).at(-1)
    if (!current) throw new ProfileEntryError('not_found', 'No account uses that email. Choose Create account to sign up.')
    if (!await passwordMatches(Password, current.Password)) {
      throw new ProfileEntryError('mismatch', 'That password does not match this account.')
    }
    if (!current.Password.startsWith(HASH_PREFIX)) {
      current.Password = await hashPassword(Password)
      await saveAll(entries, await readSignups()).catch(() => undefined)
    }
    return { email: EMAIL }
  })
}

export async function signUpProfile(email: string, password: string) {
  const EMAIL = cleanEmail(email)
  const Password = cleanPassword(password)
  if (EMAIL === ADMIN_EMAIL) throw new ProfileEntryError('admin_email', 'This email signs in through the admin portal.')
  return enqueue(async () => {
    const entries = await readProfiles()
    if (entries.some((entry) => entry.EMAIL === EMAIL)) {
      throw new ProfileEntryError('exists', 'An account already uses that email. Choose Sign in.')
    }
    if (entries.length >= MAX_ENTRIES) throw new ProfileEntryError('full', 'The profile entry file has reached its row limit.')
    const signups = await readSignups()
    const created_at_utc = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    const UUID = createEntryUuid(new Set([...entries, ...signups].map((item) => item.UUID)))
    entries.push({ UUID, EMAIL, Password: await hashPassword(Password), created_at_utc })
    signups.push({ UUID, EMAIL, created_at_utc })
    await saveAll(entries, signups)
    return { email: EMAIL }
  })
}

export async function createProfileReset(email: string) {
  const EMAIL = cleanEmail(email)
  if (EMAIL === ADMIN_EMAIL) return null
  return enqueue(async () => {
    const entries = await readProfiles()
    if (!entries.some((entry) => entry.EMAIL === EMAIL)) return null
    const now = Date.now()
    const tokens = await readResetTokens(now)
    if (tokens.some((item) => item.EMAIL === EMAIL && now - Date.parse(item.created_at_utc) < RESET_GAP_MS)) return null
    const token = randomBytes(32).toString('base64url')
    tokens.push({ hash: tokenHash(token), EMAIL, created_at_utc: utc(now), expires_at_utc: utc(now + RESET_TTL_MS) })
    await saveResetTokens(tokens)
    return { email: EMAIL, token }
  })
}

export async function resetProfilePassword(token: string, password: string) {
  const Password = cleanPassword(password)
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ProfileEntryError('reset_invalid', RESET_MESSAGE)
  return enqueue(async () => {
    const tokens = await readResetTokens(Date.now())
    const hash = tokenHash(token)
    const match = tokens.find((item) => item.hash === hash)
    if (!match) throw new ProfileEntryError('reset_invalid', RESET_MESSAGE)
    const entries = await readProfiles()
    const current = entries.filter((entry) => entry.EMAIL === match.EMAIL).at(-1)
    if (!current) throw new ProfileEntryError('reset_invalid', RESET_MESSAGE)
    current.Password = await hashPassword(Password)
    await saveAll(entries, await readSignups())
    await saveResetTokens(tokens.filter((item) => item.EMAIL !== match.EMAIL))
    return { email: match.EMAIL }
  })
}

async function readResetTokens(now: number) {
  const stored = await readStored(RESET_JSON)
  return (stored === null ? [] : parseList(stored, isResetToken)).filter((item) => Date.parse(item.expires_at_utc) > now)
}

async function saveResetTokens(tokens: ResetToken[]) {
  const body = `${JSON.stringify(tokens, null, 2)}\n`
  if (!blobEnabled()) {
    await mkdir(ROOT, { recursive: true })
    await writeLocal(RESET_JSON, body)
    return
  }
  try {
    await put(`${BLOB_PREFIX}${RESET_JSON}`, body, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' })
  } catch (error) {
    console.error('[profile] blob write failed:', error instanceof Error ? error.message : error)
    throw new ProfileEntryError('storage_unavailable', STORAGE_MESSAGE)
  }
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function utc(ms: number) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)
}

function onComputer() {
  return !process.env.VERCEL
}

async function readProfiles() {
  const stored = await readStored(PROFILE_JSON)
  if (stored !== null) return parseList(stored, isProfileEntry)
  if (!blobEnabled()) return []
  const local = onComputer() ? await readLocal(PROFILE_JSON) : null
  if (local === null) return []
  const entries = parseList(local, isProfileEntry)
  for (const entry of entries) {
    if (!entry.Password.startsWith(HASH_PREFIX)) entry.Password = await hashPassword(entry.Password)
  }
  const signups = parseList(await readLocal(SIGNUP_JSON) ?? '[]', isSignupEntry)
  await saveAll(entries, signups)
  return entries
}

async function readSignups() {
  const stored = await readStored(SIGNUP_JSON)
  return stored === null ? [] : parseList(stored, isSignupEntry)
}

async function readStored(name: string) {
  if (!blobEnabled()) {
    if (!onComputer()) throw new ProfileEntryError('storage_unavailable', STORAGE_MESSAGE)
    return readLocal(name)
  }
  try {
    const result = await get(`${BLOB_PREFIX}${name}`, { access: 'private', useCache: false })
    if (!result || result.statusCode !== 200) return null
    return await new Response(result.stream).text()
  } catch (error) {
    console.error('[profile] blob read failed:', error instanceof Error ? error.message : error)
    throw new ProfileEntryError('storage_unavailable', STORAGE_MESSAGE)
  }
}

async function readLocal(name: string) {
  try {
    return await readFile(path.join(ROOT, name), 'utf8')
  } catch {
    return null
  }
}

export async function listProfileEmails() {
  return enqueue(async () => (await readProfiles()).map((entry) => entry.EMAIL))
}

export async function pullProfileFiles() {
  if (!blobEnabled() || !onComputer()) return null
  return enqueue(async () => {
    const entries = await readProfiles()
    const signups = await readSignups()
    const files = profileFiles(entries, signups)
    const current = await Promise.all(files.filter(([name]) => name !== WORKBOOK).map(async ([name, body]) => await readLocal(name) === body))
    const changed = current.includes(false) || await readLocal(WORKBOOK) === null
    if (changed) {
      await mkdir(ROOT, { recursive: true })
      for (const [name, body] of files) await writeLocal(name, body)
    }
    return { profiles: entries.length, signups: signups.length, changed }
  })
}

function profileFiles(entries: ProfileEntry[], signups: SignupEntry[]): [string, string | Buffer, string][] {
  return [
    [PROFILE_JSON, `${JSON.stringify(entries, null, 2)}\n`, 'application/json'],
    [PROFILE_CSV, csv(PROFILE_ENTRY_CSV_HEADER, entries.map((entry) => [entry.UUID, entry.EMAIL, entry.Password, entry.created_at_utc])), 'text/csv'],
    [SIGNUP_JSON, `${JSON.stringify(signups, null, 2)}\n`, 'application/json'],
    [SIGNUP_CSV, csv(SIGNUP_ENTRY_CSV_HEADER, signups.map((entry) => [entry.UUID, entry.EMAIL, entry.created_at_utc])), 'text/csv'],
    [WORKBOOK, workbook(entries, signups), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ]
}

async function saveAll(entries: ProfileEntry[], signups: SignupEntry[]) {
  const files = profileFiles(entries, signups)
  if (blobEnabled()) {
    try {
      for (const [name, body, contentType] of files) {
        await put(`${BLOB_PREFIX}${name}`, body, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType })
      }
    } catch (error) {
      console.error('[profile] blob write failed:', error instanceof Error ? error.message : error)
      throw new ProfileEntryError('storage_unavailable', STORAGE_MESSAGE)
    }
  }
  if (onComputer()) {
    await mkdir(ROOT, { recursive: true })
    for (const [name, body] of files) await writeLocal(name, body)
  }
}

async function writeLocal(name: string, body: string | Buffer) {
  const file = path.join(ROOT, name)
  try {
    if (name === WORKBOOK) {
      await writeFile(file, body)
      return
    }
    await writeFile(`${file}.tmp`, body)
    await rename(`${file}.tmp`, file)
  } catch (error) {
    await rm(`${file}.tmp`, { force: true }).catch(() => undefined)
    const code = (error as NodeJS.ErrnoException).code
    if (name === WORKBOOK && (code === 'EBUSY' || code === 'EPERM')) return
    if (blobEnabled()) {
      const locked = code === 'EBUSY' || code === 'EPERM'
      console.error(`[profile] local copy of ${name} not updated${locked ? ' (close it in Excel; the next pull retries)' : ''}:`, error instanceof Error ? error.message : error)
      return
    }
    throw error
  }
}

function workbook(entries: ProfileEntry[], signups: SignupEntry[]) {
  const signedUp = new Set(signups.map((entry) => entry.UUID))
  return buildWorkbook([
    {
      name: 'Profiles',
      rows: [
        ['UUID', 'EMAIL', 'Created (UTC)', 'Source', 'Password'],
        ...entries.map((entry) => [
          entry.UUID,
          entry.EMAIL,
          entry.created_at_utc,
          signedUp.has(entry.UUID) ? 'Create account' : 'Earlier profile entry',
          entry.Password.startsWith(HASH_PREFIX) ? 'Hashed' : 'Plain text, hashed at next sign-in',
        ]),
      ],
    },
    {
      name: 'Signups',
      rows: [['UUID', 'EMAIL', 'Created (UTC)'], ...signups.map((entry) => [entry.UUID, entry.EMAIL, entry.created_at_utc])],
    },
  ])
}

async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, 32)
  return `${HASH_PREFIX}${salt.toString('base64url')}$${hash.toString('base64url')}`
}

async function passwordMatches(password: string, stored: string) {
  if (stored.startsWith(HASH_PREFIX)) {
    const [salt, hash] = stored.slice(HASH_PREFIX.length).split('$')
    if (!salt || !hash) return false
    const expected = Buffer.from(hash, 'base64url')
    const actual = await scryptAsync(password, Buffer.from(salt, 'base64url'), expected.length)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  }
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(password), digest(stored))
}

function parseList<T>(raw: string, guard: (value: unknown) => value is T): T[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter(guard) : []
  } catch {
    return []
  }
}

function csv(header: string, rows: string[][]) {
  const lines = rows.map((row) => row.map(csvCell).join(','))
  return `${header}\n${lines.join('\n')}${lines.length ? '\n' : ''}`
}

function isProfileEntry(value: unknown): value is ProfileEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return validUuid(entry.UUID)
    && typeof entry.EMAIL === 'string'
    && entry.EMAIL.includes('@')
    && typeof entry.Password === 'string'
    && entry.Password.length >= 8
    && typeof entry.created_at_utc === 'string'
}

function isSignupEntry(value: unknown): value is SignupEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return validUuid(entry.UUID) && typeof entry.EMAIL === 'string' && typeof entry.created_at_utc === 'string'
}

function isResetToken(value: unknown): value is ResetToken {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return typeof item.hash === 'string'
    && typeof item.EMAIL === 'string'
    && typeof item.created_at_utc === 'string'
    && typeof item.expires_at_utc === 'string'
}

function validUuid(value: unknown) {
  return typeof value === 'string' && /^[A-Za-z0-9]{7}$/.test(value) && /[A-Za-z]/.test(value) && /[0-9]/.test(value)
}

function cleanPassword(value: string) {
  const password = value.trim()
  if (password.length < 8 || password.length > 200 || /[\r\n]/.test(password)) {
    throw new ProfileEntryError('input_invalid', 'Enter a password of at least 8 characters.')
  }
  return password
}

export function cleanEmail(value: string) {
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ProfileEntryError('input_invalid', 'Enter a full email address.')
  }
  return email
}

function csvCell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`
  return safe
}

function enqueue<T>(task: () => Promise<T>) {
  const run = writeQueue.then(task, task)
  writeQueue = run.then(() => undefined, () => undefined)
  return run
}
