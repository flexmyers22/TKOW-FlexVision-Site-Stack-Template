import { createHash, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ADMIN_ACCESS_LOCKED, ADMIN_EMAIL } from '@/lib/server/admin-access'
import { PROFILE_ENTRY_CSV_HEADER, type ProfileEntry } from '@/lib/profile-entry'

const BASE_CSV = path.join(process.cwd(), '.data', 'admin_entry.csv')
const FOLDER = path.join(process.cwd(), '.data', 'admin-profile')
const FOLDER_CSV = path.join(FOLDER, 'admin_entry.csv')
const FOLDER_JSON = path.join(FOLDER, 'admin_entry.json')

let writeQueue: Promise<unknown> = Promise.resolve()

export async function readAdminEntry() {
  return enqueue(async () => {
    const stored = await readStored()
    if (!stored) throw new Error('The admin entry CSV is missing.')
    return stored
  })
}

export async function adminCredentialsMatch(email: string, password: string) {
  if (ADMIN_ACCESS_LOCKED) return false
  const entry = await readAdminEntry()
  const normalized = email.trim().toLowerCase()
  if (normalized.length !== entry.EMAIL.length) return false
  const emailMatch = timingSafeEqual(Buffer.from(normalized), Buffer.from(entry.EMAIL))
  const digest = createHash('sha256').update(password, 'utf8').digest()
  const expected = createHash('sha256').update(entry.Password, 'utf8').digest()
  return emailMatch && timingSafeEqual(digest, expected)
}

export async function replaceAdminPassword(email: string, password: string, confirm: string) {
  if (ADMIN_ACCESS_LOCKED) throw new Error('Admin access is locked.')
  const next = cleanPassword(password)
  if (next !== confirm) throw new Error('The new password and confirmation do not match.')
  return enqueue(async () => {
    const current = await readStored()
    if (!current) throw new Error('The admin entry CSV is missing.')
    const normalized = email.trim().toLowerCase()
    if (normalized !== current.EMAIL) throw new Error('That email does not match the admin entry.')
    const updated: ProfileEntry = { ...current, Password: next }
    await writeStored(updated)
    return updated
  })
}

async function readStored() {
  const json = await readJson(FOLDER_JSON)
  if (json) return json
  return await readCsv(FOLDER_CSV) ?? await readCsv(BASE_CSV)
}

async function writeStored(entry: ProfileEntry) {
  const csv = `${PROFILE_ENTRY_CSV_HEADER}\n${[entry.UUID, entry.EMAIL, entry.Password, entry.created_at_utc].map(csvCell).join(',')}\n`
  await mkdir(path.dirname(BASE_CSV), { recursive: true })
  await mkdir(FOLDER, { recursive: true })
  await replaceFile(FOLDER_JSON, `${JSON.stringify(entry, null, 2)}\n`)
  await replaceFile(FOLDER_CSV, csv)
  await replaceFile(BASE_CSV, csv)
}

async function readJson(file: string) {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as unknown
    return isEntry(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function readCsv(file: string) {
  try {
    const rows = parseCsv(await readFile(file, 'utf8'))
    const [header, cells] = rows
    if (!header || !cells) return null
    const column = (name: string) => header.indexOf(name)
    const entry = {
      UUID: cells[column('UUID')] ?? '',
      EMAIL: cells[column('EMAIL')] ?? '',
      Password: cells[column('Password')] ?? '',
      created_at_utc: cells[column('created_at_utc')] ?? '',
    }
    return isEntry(entry) ? entry : null
  } catch {
    return null
  }
}

function isEntry(value: unknown): value is ProfileEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return typeof entry.UUID === 'string'
    && /^[A-Za-z0-9]{7}$/.test(entry.UUID)
    && /[A-Za-z]/.test(entry.UUID)
    && /[0-9]/.test(entry.UUID)
    && typeof entry.EMAIL === 'string'
    && entry.EMAIL === ADMIN_EMAIL
    && typeof entry.Password === 'string'
    && entry.Password.length >= 8
    && typeof entry.created_at_utc === 'string'
}

function cleanPassword(value: string) {
  const password = value.trim()
  if (password.length < 8 || password.length > 200 || /[\r\n]/.test(password)) {
    throw new Error('Enter a password of at least 8 characters.')
  }
  return password
}

function csvCell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`
  return safe
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index += 1
        } else quoted = false
      } else cell += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') cell += char
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((item) => item.some((value) => value.length > 0))
}

async function replaceFile(filePath: string, body: string) {
  const temporary = `${filePath}.tmp`
  await writeFile(temporary, body)
  await rename(temporary, filePath)
}

function enqueue<T>(task: () => Promise<T>) {
  const run = writeQueue.then(task, task)
  writeQueue = run.then(() => undefined, () => undefined)
  return run
}
