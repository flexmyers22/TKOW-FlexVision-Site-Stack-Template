import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isWorkflowPage, type WorkflowPage } from '@/lib/credential-pages'

const ROOT = path.join(process.cwd(), '.data', 'credential-bases')
const INDEX_PATH = path.join(ROOT, 'index.json')
const MAX_FILES = 40
const MAX_BYTES = 25 * 1024 * 1024
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type CredentialAttachment = {
  file_id: string
  base_id: string
  filename: string
  content_type: string
  size: number
  created_at: string
  page: WorkflowPage | null
}

type CredentialBase = {
  base_id: string
  created_at: string
  files: CredentialAttachment[]
}

let writeQueue: Promise<unknown> = Promise.resolve()

export function createCredentialBase() {
  return rememberBase({
    base_id: randomUUID(),
    created_at: new Date().toISOString(),
    files: [],
  })
}

export async function listCredentialBase(baseId: string) {
  const store = await readStore()
  return store.bases.find((base) => base.base_id === baseId) ?? null
}

export async function addCredentialFile(baseId: string, file: { filename: string; contentType: string; bytes: Uint8Array }) {
  if (!isUuid(baseId)) throw new Error('The library base UUID is not valid.')
  if (file.bytes.byteLength === 0) throw new Error('Choose a file to attach.')
  if (file.bytes.byteLength > MAX_BYTES) throw new Error('Attachments must be 25 MB or smaller.')
  return enqueue(async () => {
    const store = await readStore()
    const base = store.bases.find((item) => item.base_id === baseId)
    if (!base) throw new Error('That credential library base was not found.')
    if (base.files.length >= MAX_FILES) throw new Error(`This base already has ${MAX_FILES} attachments.`)
    const fileId = randomUUID()
    const attachment: CredentialAttachment = {
      file_id: fileId,
      base_id: baseId,
      filename: safeFilename(file.filename),
      content_type: file.contentType || 'application/octet-stream',
      size: file.bytes.byteLength,
      created_at: new Date().toISOString(),
      page: null,
    }
    await mkdir(fileDirectory(baseId), { recursive: true })
    await writeFile(filePath(baseId, fileId), file.bytes)
    base.files.push(attachment)
    await writeStore(store)
    return attachment
  })
}

export async function moveCredentialFile(baseId: string, fileId: string, direction: 'earlier' | 'later') {
  return enqueue(async () => {
    const store = await readStore()
    const base = requireBase(store, baseId)
    const index = base.files.findIndex((file) => file.file_id === fileId)
    if (index < 0) throw new Error('That attachment is not in this library base.')
    const next = direction === 'earlier' ? index - 1 : index + 1
    if (next < 0 || next >= base.files.length) return base.files
    const [file] = base.files.splice(index, 1)
    base.files.splice(next, 0, file)
    await writeStore(store)
    return base.files
  })
}

export async function workflowCredentialFile(baseId: string, fileId: string, page: WorkflowPage | null) {
  return enqueue(async () => {
    const store = await readStore()
    const base = requireBase(store, baseId)
    const file = base.files.find((item) => item.file_id === fileId)
    if (!file) throw new Error('That attachment is not in this library base.')
    file.page = page
    await writeStore(store)
    return file
  })
}

export async function listWorkflowFiles(page: WorkflowPage) {
  const store = await readStore()
  return store.bases.flatMap((base) => base.files.filter((file) => file.page === page))
}

export async function resolveCredentialFile(baseId: string, fileId: string) {
  if (!isUuid(baseId) || !isUuid(fileId)) return null
  const base = await listCredentialBase(baseId)
  const file = base?.files.find((item) => item.file_id === fileId)
  if (!file) return null
  return { ...file, fullPath: filePath(baseId, fileId) }
}

async function rememberBase(base: CredentialBase) {
  return enqueue(async () => {
    const store = await readStore()
    store.bases.push(base)
    await writeStore(store)
    return base
  })
}

function requireBase(store: Store, baseId: string) {
  if (!isUuid(baseId)) throw new Error('The library base UUID is not valid.')
  const base = store.bases.find((item) => item.base_id === baseId)
  if (!base) throw new Error('That credential library base was not found.')
  return base
}

type Store = { bases: CredentialBase[] }

async function readStore(): Promise<Store> {
  try {
    const raw = await readFile(INDEX_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Store
    return { bases: Array.isArray(parsed.bases) ? parsed.bases : [] }
  } catch {
    return { bases: [] }
  }
}

async function writeStore(store: Store) {
  await mkdir(ROOT, { recursive: true })
  const temporary = `${INDEX_PATH}.tmp`
  await writeFile(temporary, JSON.stringify(store))
  await rename(temporary, INDEX_PATH)
}

function enqueue<T>(task: () => Promise<T>) {
  const run = writeQueue.then(task, task)
  writeQueue = run.then(() => undefined, () => undefined)
  return run
}

function fileDirectory(baseId: string) {
  return path.join(ROOT, baseId)
}

function filePath(baseId: string, fileId: string) {
  const full = path.resolve(fileDirectory(baseId), fileId)
  const root = path.resolve(fileDirectory(baseId))
  if (!full.startsWith(`${root}${path.sep}`)) throw new Error('The attachment path is not inside this library base.')
  return full
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value)
}

function safeFilename(filename: string) {
  const base = path.basename(filename).replace(/["\r\n]/g, '').trim()
  return base.slice(0, 180) || 'attachment'
}

export function workflowPageFrom(value: unknown) {
  if (value === null) return null
  if (typeof value === 'string' && isWorkflowPage(value)) return value
  throw new Error('Choose a workspace page for this file.')
}
