import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { inflateRawSync } from 'node:zlib'
import type { Citation } from '@/lib/engineering-api'

const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.csv', '.json'])
const ZIP_TEXT_EXTENSIONS = new Set(['.md', '.txt', '.csv', '.json', '.html'])
const SITES_PREFIX = 'Sites/'
const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__'])
const MAX_FILE_BYTES = 1_500_000
const MAX_ZIP_BYTES = 8_000_000
const MAX_TEXT_CHARS = 40_000
const MAX_DOCUMENTS = 500
const CHUNK_CHARS = 1400
const MAX_CHUNKS_PER_DOCUMENT = 8
const TOP_CHUNKS = 6
const CACHE_MS = 60_000

export type LibraryDocument = {
  document_id: string
  revision_id: string
  title: string
  path: string
  source_hash: string
  searchable: boolean
}

export type LibraryChunk = LibraryDocument & {
  chunk_id: string
  section: string
  text: string
}

type LibraryIndex = {
  builtAt: number
  documents: LibraryDocument[]
  chunks: LibraryChunk[]
}

let cache: LibraryIndex | null = null

export function engineeringLibraryRoot() {
  const configured = process.env.ENGINEERING_LIBRARY_DIR?.trim()
  return configured || path.join(process.cwd(), 'Engineering Docs - Copy')
}

function sitesLibraryRoot() {
  return path.join(process.cwd(), 'Sites')
}

export async function listLibraryDocuments() {
  const index = await loadLibrary()
  return index.documents
}

export async function resolveLibraryDownload(documentId: string) {
  const document = (await listLibraryDocuments()).find((item) => item.document_id === documentId)
  if (!document) return null
  const stored = document.path.replaceAll('\\', '/')
  const sitesFile = stored.startsWith(SITES_PREFIX)
  const root = path.resolve(sitesFile ? sitesLibraryRoot() : engineeringLibraryRoot())
  let relativePath = sitesFile ? stored.slice(SITES_PREFIX.length) : stored
  const zipMarker = relativePath.toLowerCase().indexOf('.zip/')
  if (zipMarker >= 0) relativePath = relativePath.slice(0, zipMarker + 4)
  const full = path.resolve(root, relativePath)
  const relative = path.relative(root, full)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null
  return {
    fullPath: full,
    filename: path.basename(relativePath),
    zip: relativePath.toLowerCase().endsWith('.zip'),
  }
}

export async function searchLibrary(query: string, revisionIds: string[]) {
  const index = await loadLibrary()
  const allowed = new Set(revisionIds)
  const scoped = revisionIds.length
    ? index.chunks.filter((chunk) => allowed.has(chunk.revision_id))
    : index.chunks
  const terms = queryTerms(query)
  const ranked = scoped
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, terms) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.chunk.path.localeCompare(right.chunk.path))
    .slice(0, TOP_CHUNKS)
  return ranked.map((item) => item.chunk)
}

export function citationsForChunks(chunks: LibraryChunk[], citedChunkIds: string[]): Citation[] {
  const allowed = new Set(citedChunkIds)
  return chunks
    .filter((chunk) => allowed.has(chunk.chunk_id))
    .map((chunk) => ({
      document_id: chunk.document_id,
      revision_id: chunk.revision_id,
      chunk_id: chunk.chunk_id,
      locator: { section: `${chunk.path} · ${chunk.section}`, page: null, sheet: null, range: null },
      source_hash: chunk.source_hash,
    }))
}

async function loadLibrary(): Promise<LibraryIndex> {
  if (cache && Date.now() - cache.builtAt < CACHE_MS) return cache
  const documents: LibraryDocument[] = []
  const chunks: LibraryChunk[] = []
  await indexLibraryRoot(sitesLibraryRoot(), SITES_PREFIX, documents, chunks, true)
  await indexLibraryRoot(engineeringLibraryRoot(), '', documents, chunks, false)
  cache = { builtAt: Date.now(), documents, chunks }
  return cache
}

async function indexLibraryRoot(root: string, prefix: string, documents: LibraryDocument[], chunks: LibraryChunk[], readZipText: boolean) {
  const files = await collectFiles(root, '', new Set([...TEXT_EXTENSIONS, '.docx', '.xlsx']))
  files.sort((left, right) => extensionRank(left) - extensionRank(right) || left.localeCompare(right))
  for (const relativePath of files) {
    if (documents.length >= MAX_DOCUMENTS) return
    const text = await readDocument(path.join(root, relativePath), path.extname(relativePath).toLowerCase())
    if (!text) continue
    const document = describeDocument(libraryIdentity(prefix, relativePath), createHash('sha256').update(text).digest('hex'), true)
    documents.push(document)
    chunks.push(...chunkDocument(document, text))
  }
  const zipFiles = (await collectFiles(root, '', new Set(['.zip']))).sort((left, right) => left.localeCompare(right))
  for (const relativePath of zipFiles) {
    const fullPath = path.join(root, relativePath)
    const info = await stat(fullPath).catch(() => null)
    if (!info?.isFile()) continue
    const identity = libraryIdentity(prefix, relativePath)
    const sourceHash = createHash('sha256').update(`${identity}:${info.size}:${info.mtimeMs}`).digest('hex')
    documents.push(describeDocument(identity, sourceHash, false))
    if (readZipText) await indexZipText(fullPath, identity, documents, chunks)
  }
}

function libraryIdentity(prefix: string, relativePath: string) {
  return `${prefix}${relativePath.replaceAll('\\', '/')}`
}

async function indexZipText(filePath: string, zipIdentity: string, documents: LibraryDocument[], chunks: LibraryChunk[]) {
  const info = await stat(filePath).catch(() => null)
  if (!info?.isFile() || info.size > MAX_ZIP_BYTES) return
  const buffer = await readFile(filePath)
  for (const name of listZipNames(buffer)) {
    if (documents.length >= MAX_DOCUMENTS) return
    if (!name || name.endsWith('/')) continue
    const normalized = name.replaceAll('\\', '/')
    if (skippedZipEntry(normalized)) continue
    const extension = path.extname(normalized).toLowerCase()
    if (!ZIP_TEXT_EXTENSIONS.has(extension)) continue
    const raw = unzipEntry(buffer, name).replace(/\u0000/g, '')
    if (extension === '.html') {
      const records = portfolioRecords(raw)
      if (records.length) {
        for (const record of records) {
          if (documents.length >= MAX_DOCUMENTS) return
          const text = portfolioRecordText(record)
          if (text.length < 40) continue
          const recordId = typeof record.id === 'string' && record.id ? record.id : `record-${documents.length}`
          const document = describeDocument(`${zipIdentity}/${normalized}#${recordId}`, createHash('sha256').update(text).digest('hex'), true)
          documents.push(document)
          chunks.push(...chunkDocument(document, text))
        }
        continue
      }
    }
    const text = (extension === '.html' ? stripTags(raw) : raw).slice(0, MAX_TEXT_CHARS).trim()
    if (!text) continue
    const document = describeDocument(`${zipIdentity}/${normalized}`, createHash('sha256').update(text).digest('hex'), true)
    documents.push(document)
    chunks.push(...chunkDocument(document, text))
  }
}

function skippedZipEntry(relativePath: string) {
  const lower = relativePath.toLowerCase()
  return skippedPath(relativePath)
    || lower.includes('api_key_vault')
    || lower.endsWith('tkow_n8n_multi_llm_workflow.json')
    || lower.split('/').includes('.openai')
    || lower.split('/').includes('node_modules')
}

function portfolioRecords(html: string) {
  const arrayText = extractJsonArray(html, 'const seed=')
  if (!arrayText) return []
  try {
    const parsed = JSON.parse(quoteObjectKeys(arrayText)) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
  } catch {
    return []
  }
}

function quoteObjectKeys(source: string) {
  let out = ''
  let quote = ''
  let escaped = false
  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (quote) {
      out += char
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      index += 1
      continue
    }
    if (char === '"') {
      quote = char
      out += char
      index += 1
      continue
    }
    if (char === '{' || char === ',') {
      out += char
      index += 1
      while (index < source.length && /\s/.test(source[index])) {
        out += source[index]
        index += 1
      }
      const match = /^[A-Za-z_][\w]*/.exec(source.slice(index))
      if (match && /^\s*:/.test(source.slice(index + match[0].length))) {
        out += `"${match[0]}"`
        index += match[0].length
        continue
      }
      continue
    }
    out += char
    index += 1
  }
  return out
}

function extractJsonArray(source: string, marker: string) {
  const markerAt = source.indexOf(marker)
  if (markerAt < 0) return ''
  const start = source.indexOf('[', markerAt)
  if (start < 0) return ''
  let depth = 0
  let quote = ''
  let escaped = false
  for (let index = start; index < source.length; index += 1) {
    const char = source[index]
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }
    if (char === '"') {
      quote = char
      continue
    }
    if (char === '[') depth += 1
    else if (char === ']') {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
  }
  return ''
}

function portfolioRecordText(record: Record<string, unknown>) {
  const fileLine = (item: unknown) => {
    if (!item || typeof item !== 'object') return `- ${String(item)}`
    const file = item as Record<string, unknown>
    const url = typeof file.url === 'string' && file.url ? ` · ${file.url}` : ''
    return `- ${file.name || 'Unnamed file'} · ${file.kind || 'File'} · ${file.storage || 'Storage not verified'}${url}`
  }
  const line = (label: string, value: unknown) => {
    if (value == null || value === '') return ''
    if (Array.isArray(value)) {
      if (!value.length) return ''
      if (value.every((item) => typeof item === 'string')) return `${label}: ${value.join('; ')}`
      return `${label}:\n${value.map((item) => fileLine(item)).join('\n')}`
    }
    return `${label}: ${String(value)}`
  }
  const history = Array.isArray(record.history)
    ? record.history.map((item) => {
      if (!item || typeof item !== 'object') return ''
      const entry = item as Record<string, unknown>
      return `- ${entry.at || 'Unknown time'}: ${entry.text || ''}`
    }).filter(Boolean).join('\n')
    : ''
  return [
    'Flex-Vision Sites Portfolio record. This is a browser-local registry entry. Verification, milestones, and package storage are only as written here.',
    line('Name', record.name),
    line('Area', record.area),
    line('Tags', record.tags),
    line('Status', record.status),
    line('Verification', record.confidence),
    line('Milestone', record.milestone),
    line('Updated UTC', record.updated),
    line('Site URL', record.site),
    line('Site status', record.siteStatus),
    line('Next action', record.next),
    line('Description', record.description),
    line('Packages', record.packages),
    line('Documentation', record.docs),
    line('Images', record.images),
    line('Sources', record.sources),
    history ? `Revision history:\n${history}` : '',
  ].filter(Boolean).join('\n')
}

function stripTags(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ ]{2,}/g, ' ')
}

function describeDocument(relativePath: string, sourceHash: string, searchable: boolean): LibraryDocument {
  const identity = relativePath.replaceAll('\\', '/')
  return {
    document_id: `doc-${createHash('sha256').update(identity).digest('hex').slice(0, 16)}`,
    revision_id: `rev-${createHash('sha256').update(`${identity}\n${sourceHash}`).digest('hex').slice(0, 16)}`,
    title: path.basename(relativePath),
    path: identity,
    source_hash: sourceHash,
    searchable,
  }
}

async function collectFiles(root: string, relative: string, extensions: Set<string>): Promise<string[]> {
  let entries
  try {
    entries = await readdir(path.join(root, relative), { withFileTypes: true })
  } catch {
    return []
  }
  const files: string[] = []
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
    const relativePath = path.join(relative, entry.name)
    if (skippedPath(relativePath)) continue
    if (entry.isDirectory()) {
      files.push(...await collectFiles(root, relativePath, extensions))
      continue
    }
    if (extensions.has(path.extname(entry.name).toLowerCase())) files.push(relativePath)
  }
  return files
}

function extensionRank(file: string) {
  const extension = path.extname(file).toLowerCase()
  if (extension === '.md') return 0
  if (extension === '.docx' || extension === '.xlsx') return 1
  if (extension === '.txt') return 2
  if (extension === '.json') return 3
  return 4
}

function skippedPath(relativePath: string) {
  const lower = relativePath.toLowerCase()
  return lower.includes('credential') || lower.includes('secret') || path.basename(lower).startsWith('.env')
}

async function readDocument(filePath: string, extension: string) {
  const info = await stat(filePath).catch(() => null)
  if (!info || !info.isFile() || info.size > MAX_FILE_BYTES) return ''
  if (extension === '.docx') return extractDocx(await readFile(filePath))
  if (extension === '.xlsx') return extractXlsx(await readFile(filePath))
  const text = await readFile(filePath, 'utf8').catch(() => '')
  return text.replace(/\u0000/g, '').slice(0, MAX_TEXT_CHARS).trim()
}

function extractXlsx(buffer: Buffer) {
  const parts = [taggedText(unzipEntry(buffer, 'xl/sharedStrings.xml'), 't')]
  for (const name of listZipNames(buffer)) {
    if (name.startsWith('xl/worksheets/sheet')) parts.push(taggedText(unzipEntry(buffer, name), 'v'))
  }
  return parts.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').slice(0, MAX_TEXT_CHARS).trim()
}

function taggedText(xml: string, tag: string) {
  if (!xml) return ''
  const values: string[] = []
  for (const match of xml.matchAll(new RegExp(`<(?:[A-Za-z0-9]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9]+:)?${tag}>`, 'g'))) {
    const value = match[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
      .trim()
    if (value) values.push(value)
  }
  return values.join('\n')
}

function listZipNames(buffer: Buffer) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (eocd < 0) return []
  const count = buffer.readUInt16LE(eocd + 10)
  let offset = buffer.readUInt32LE(eocd + 16)
  const names: string[] = []
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) break
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    names.push(buffer.toString('utf8', offset + 46, offset + 46 + nameLength))
    offset += 46 + nameLength + extraLength + commentLength
  }
  return names
}

function extractDocx(buffer: Buffer) {
  const xml = unzipEntry(buffer, 'word/document.xml')
  if (!xml) return ''
  return xml
    .replace(/<w:p[^>]*>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, value: string) => String.fromCodePoint(Number(value)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, MAX_TEXT_CHARS)
    .trim()
}

function unzipEntry(buffer: Buffer, entryName: string) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (eocd < 0) return ''
  const count = buffer.readUInt16LE(eocd + 10)
  let offset = buffer.readUInt32LE(eocd + 16)
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) return ''
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    offset += 46 + nameLength + extraLength + commentLength
    if (name !== entryName || compressedSize === 0xffffffff) continue
    if (localOffset + 30 > buffer.length) return ''
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const data = buffer.subarray(dataStart, dataStart + compressedSize)
    if (method === 0) return data.toString('utf8')
    if (method === 8) return inflateRawSync(data).toString('utf8')
    return ''
  }
  return ''
}

function chunkDocument(document: LibraryDocument, text: string): LibraryChunk[] {
  const sections = text.split(/\n(?=#{1,3} )/).map((part) => part.trim()).filter(Boolean)
  const pieces = sections.length ? sections : [text]
  const chunks: LibraryChunk[] = []
  for (const piece of pieces) {
    const heading = piece.match(/^#{1,3} +(.+)$/m)?.[1]?.trim()
      || piece.split('\n').map((line) => line.trim()).find(Boolean)?.slice(0, 120)
      || 'Document'
    for (let start = 0; start < piece.length && chunks.length < MAX_CHUNKS_PER_DOCUMENT; start += CHUNK_CHARS) {
      const slice = piece.slice(start, start + CHUNK_CHARS).trim()
      if (slice.length < 40) continue
      chunks.push({
        ...document,
        chunk_id: `${document.revision_id}#${String(chunks.length).padStart(3, '0')}`,
        section: heading.slice(0, 120),
        text: slice,
      })
    }
  }
  return chunks
}

function queryTerms(query: string) {
  const stop = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'what', 'when', 'where', 'which', 'into', 'about', 'your', 'have', 'does', 'before'])
  return [...new Set(query.toLowerCase().match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? [])].filter((term) => !stop.has(term))
}

function scoreChunk(chunk: LibraryChunk, terms: string[]) {
  if (!terms.length) return 0
  const haystack = `${chunk.title}\n${chunk.path}\n${chunk.section}\n${chunk.text}`.toLowerCase()
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0)
}
