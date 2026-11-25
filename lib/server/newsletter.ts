import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { askDirectModel, directModelReady, type DirectModelId } from '@/lib/server/direct-model'
import { searchLibrary, type LibraryChunk } from '@/lib/server/evidence-library'
import { placeFolderImage, removePlacedImage, type NewsletterImage } from '@/lib/server/newsletter-images'

const FILE = path.join(process.cwd(), 'data', 'newsletter-editions.json')
const MAX_EDITIONS = 200
export const NEWSLETTER_CATEGORIES = ['Research brief', 'Design reference', 'Engineering note', 'Product update'] as const
export const NEWSLETTER_HEADER = { src: '/marketing/newsletter-header.png', alt: 'Flex-Vision mark on a black field' }
export const NEWSLETTER_MODELS = {
  chatgpt: { id: 'openai/gpt-6.1-sol', label: 'ChatGPT' },
  grok: { id: 'spacexai/grok-4.7', label: 'Grok' },
  gemini: { id: 'google/gemini', label: 'Gemini' },
} as const satisfies Record<string, { id: DirectModelId; label: string }>
const MODEL_KEYS: Record<string, string> = { chatgpt: 'OPENAI_API_KEY', grok: 'XAI_API_KEY', gemini: 'GEMINI_API_KEY' }

export type NewsletterCitation = { chunk_id: string; path: string; section: string }

export type NewsletterEdition = {
  id: string
  status: 'Draft' | 'Published'
  date: string
  category: string
  title: string
  lead: string
  summary: string
  description: string
  quote?: { text: string; cite: string }
  image?: NewsletterImage
  citations: NewsletterCitation[]
  topic: string
  model: string
  created_at_utc: string
  published_at_utc?: string
}

const draftSchema = z.object({
  title: z.string().trim().min(4).max(120),
  category: z.string().trim().max(40),
  lead: z.string().trim().min(20).max(600),
  summary: z.string().trim().min(10).max(240),
  description: z.string().trim().min(20).max(600),
  quote: z.string().trim().max(280).optional().default(''),
  cited_chunk_ids: z.array(z.string()).max(12),
})

const instructions = `You write one Flex-Vision newsletter edition from engineering-library passages.
Use only facts stated in the supplied passages. Keep values, units, revisions, and status words exactly as written. Leave anything Proposed or unverified marked that way, and do not claim a test, measurement, or approval the passages do not state.
Write plain, direct sentences for engineers and customers. No hype.
Respond with one JSON object and no markdown, with these fields:
- title: the headline, under 90 characters
- category: one of ${NEWSLETTER_CATEGORIES.join(', ')}
- lead: two or three sentences for the lead story
- summary: one sentence for the issue list
- description: two sentences for the newsletter log
- quote: one sentence quoted or closely paraphrased from a passage, or an empty string
- cited_chunk_ids: the bracketed ids of every passage you used`

let writeQueue: Promise<unknown> = Promise.resolve()

export async function readEditions(): Promise<NewsletterEdition[]> {
  try {
    const parsed = JSON.parse(await readFile(FILE, 'utf8')) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isEdition)
  } catch {
    return []
  }
}

export async function publishedEditions() {
  return (await readEditions())
    .filter((edition) => edition.status === 'Published')
    .sort((left, right) => right.date.localeCompare(left.date) || right.created_at_utc.localeCompare(left.created_at_utc))
}

export function newsletterModelsReady() {
  return Object.fromEntries(Object.entries(NEWSLETTER_MODELS).map(([key, model]) => [key, directModelReady(model.id)]))
}

export async function generateEdition(input: { topic: string; model: string; image?: string; alt?: string }) {
  const topic = input.topic.trim().replace(/\s+/g, ' ')
  if (topic.length < 3 || topic.length > 200) throw new Error('Enter a topic between 3 and 200 characters.')
  const choice = NEWSLETTER_MODELS[input.model as keyof typeof NEWSLETTER_MODELS]
  if (!choice) throw new Error('Choose ChatGPT, Grok, or Gemini.')
  if (!directModelReady(choice.id)) {
    throw new Error(`${choice.label} has no key on this computer. Add ${MODEL_KEYS[input.model]} to .env.local and restart the site.`)
  }
  const passages = await searchLibrary(topic, [])
  if (!passages.length) throw new Error('No engineering-library passage matched that topic. Try words that appear in the documents.')

  const reply = await askDirectModel(choice.id, [
    { role: 'system', content: instructions },
    { role: 'user', content: `Topic: ${topic}\n\nEngineering library passages:\n${formatPassages(passages)}` },
  ])
  const draft = parseDraft(reply.answer)
  const citations = citationsFor(passages, draft.cited_chunk_ids)
  if (!citations.length) throw new Error(`${choice.label} did not cite a library passage, so the draft was not saved. Try again or narrow the topic.`)

  const now = new Date()
  const edition: NewsletterEdition = {
    id: `ed-${randomUUID().slice(0, 8)}`,
    status: 'Draft',
    date: localDate(now),
    category: (NEWSLETTER_CATEGORIES as readonly string[]).includes(draft.category) ? draft.category : 'Engineering note',
    title: draft.title,
    lead: draft.lead,
    summary: draft.summary,
    description: draft.description,
    ...(draft.quote ? { quote: { text: draft.quote, cite: citations[0].path.split('/').at(-1) ?? citations[0].path } } : {}),
    citations,
    topic,
    model: `${reply.provider} ${reply.model}`,
    created_at_utc: utc(now),
  }
  if (input.image) edition.image = await placeFolderImage(edition.id, input.image, input.alt || imageAlt(edition))
  return enqueue(async () => {
    const editions = await readEditions()
    if (editions.length >= MAX_EDITIONS) throw new Error('The newsletter file has reached its edition limit. Delete old drafts first.')
    await writeEditions([...editions, edition])
    return edition
  })
}

export async function setEditionImage(id: string, file: string | null, alt = '') {
  return enqueue(async () => {
    const editions = await readEditions()
    const edition = editions.find((item) => item.id === id)
    if (!edition) throw new Error('That edition is already gone.')
    const previous = edition.image
    if (file) edition.image = await placeFolderImage(edition.id, file, alt || imageAlt(edition))
    else delete edition.image
    await writeEditions(editions)
    if (previous && previous.src !== edition.image?.src) await removePlacedImage(previous)
    return edition
  })
}

function imageAlt(edition: NewsletterEdition) {
  return `Comic illustration for ${edition.title}`
}

export async function setEditionStatus(id: string, status: NewsletterEdition['status']) {
  return enqueue(async () => {
    const editions = await readEditions()
    const edition = editions.find((item) => item.id === id)
    if (!edition) throw new Error('That edition is already gone.')
    edition.status = status
    if (status === 'Published' && !edition.published_at_utc) {
      const now = new Date()
      edition.date = localDate(now)
      edition.published_at_utc = utc(now)
    }
    await writeEditions(editions)
    return edition
  })
}

export async function deleteEdition(id: string) {
  return enqueue(async () => {
    const editions = await readEditions()
    const removed = editions.find((item) => item.id === id)
    if (!removed) throw new Error('That edition is already gone.')
    await writeEditions(editions.filter((item) => item.id !== id))
    await removePlacedImage(removed.image)
  })
}

function parseDraft(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('The model replied in prose instead of the edition JSON. Try again.')
  }
  const result = draftSchema.safeParse(parsed)
  if (!result.success) throw new Error('The model reply was missing edition fields. Try again.')
  return result.data
}

function citationsFor(passages: LibraryChunk[], ids: string[]): NewsletterCitation[] {
  const cited = new Set(ids)
  return passages
    .filter((chunk) => cited.has(chunk.chunk_id))
    .map((chunk) => ({ chunk_id: chunk.chunk_id, path: chunk.path, section: chunk.section }))
}

function formatPassages(chunks: LibraryChunk[]) {
  return chunks.map((chunk) => `[${chunk.chunk_id}] ${chunk.path} · ${chunk.section}\n${chunk.text}`).join('\n\n')
}

function isEdition(value: unknown): value is NewsletterEdition {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string'
    && (item.status === 'Draft' || item.status === 'Published')
    && typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
    && typeof item.title === 'string'
    && typeof item.lead === 'string'
    && typeof item.summary === 'string'
    && typeof item.description === 'string'
    && typeof item.category === 'string'
    && Array.isArray(item.citations)
}

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function utc(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

async function writeEditions(editions: NewsletterEdition[]) {
  await mkdir(path.dirname(FILE), { recursive: true })
  const temporary = `${FILE}.tmp`
  await writeFile(temporary, `${JSON.stringify(editions, null, 2)}\n`)
  await rename(temporary, FILE)
}

function enqueue<T>(task: () => Promise<T>) {
  const run = writeQueue.then(task, task)
  writeQueue = run.then(() => undefined, () => undefined)
  return run
}
