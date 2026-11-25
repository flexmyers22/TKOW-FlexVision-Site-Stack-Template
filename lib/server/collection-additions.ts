import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const FILE = path.join(process.cwd(), 'data', 'collection-additions.json')
const REMOVED = path.join(process.cwd(), 'data', 'lookbook-removed.json')
const LOOKBOOK = path.join(process.cwd(), 'public', 'lookbook')
export const CATEGORIES = ['Emblem', 'Apparel', 'Flex-Print', 'Accessory', 'Wearable', 'Watch', 'Cast', 'Mold', 'Furniture', 'Printed part', 'Industrial'] as const
const TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
}
const MAX_BYTES = 8_000_000

export type CollectionAddition = {
  title: string
  category: (typeof CATEGORIES)[number]
  image: string
  fit: 'contain'
  garmentId?: string
  colorway?: string
  status?: 'Proposed'
  source?: 'garment-registry'
}

export async function readRemovedLookbookIds(): Promise<Set<string>> {
  try {
    const parsed = JSON.parse(await readFile(REMOVED, 'utf8')) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 80))
  } catch {
    return new Set()
  }
}

async function syncGarmentWorkbook() {
  const [{ readGarmentRecords }, { writeGarmentWorkbook }] = await Promise.all([
    import('@/lib/server/mm-lookbook'),
    import('@/lib/server/garment-workbook'),
  ])
  await writeGarmentWorkbook(await readGarmentRecords())
}

export async function removeLookbookRow(key: string) {
  const id = key.trim()
  if (!id || id.length > 80 || /[\r\n]/.test(id)) throw new Error('Choose a lookbook row to delete.')
  const { readLookbook } = await import('@/lib/server/mm-lookbook')
  const slide = (await readLookbook()).slides.find((item) => item.id === id || item.garmentId === id)
  if (!slide) throw new Error('That lookbook row is already gone.')
  if (slide.origin === 'registry') {
    const additions = (await readCollectionAdditions()).filter((item) => item.garmentId !== slide.garmentId)
    await mkdir(path.dirname(FILE), { recursive: true })
    await writeFile(FILE, `${JSON.stringify(additions, null, 2)}\n`)
    const image = slide.images[0]?.src ?? ''
    const filename = image.startsWith('/lookbook/') ? path.basename(image) : ''
    if (filename && filename === image.slice('/lookbook/'.length) && !additions.some((item) => item.image === image)) {
      await unlink(path.join(LOOKBOOK, filename)).catch(() => undefined)
    }
  } else {
    const removed = await readRemovedLookbookIds()
    removed.add(slide.id)
    if (slide.garmentId) removed.add(slide.garmentId)
    await mkdir(path.dirname(REMOVED), { recursive: true })
    await writeFile(REMOVED, `${JSON.stringify([...removed], null, 2)}\n`)
  }
  await syncGarmentWorkbook()
}

export async function readCollectionAdditions(): Promise<CollectionAddition[]> {
  try {
    const parsed = JSON.parse(await readFile(FILE, 'utf8')) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isAddition)
  } catch {
    return []
  }
}

function isAddition(value: unknown): value is CollectionAddition {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.title === 'string'
    && CATEGORIES.includes(item.category as (typeof CATEGORIES)[number])
    && typeof item.image === 'string'
    && item.image.startsWith('/lookbook/')
    && !item.image.includes('..')
    && item.fit === 'contain'
}

export async function saveCollectionImage(input: { title: string; category: string; colorway?: string; bytes: Buffer; contentType: string }) {
  const title = input.title.trim().replace(/\s+/g, ' ')
  const colorway = (input.colorway ?? '').trim().replace(/\s+/g, ' ') || 'Unknown'
  if (!title || title.length > 120) throw new Error('Add a title of 120 characters or less.')
  if (colorway.length > 80) throw new Error('Keep the colorway to 80 characters or less.')
  if (!CATEGORIES.includes(input.category as (typeof CATEGORIES)[number])) throw new Error('Choose a collection category.')
  const extension = TYPES[input.contentType]
  if (!extension) throw new Error('Use a PNG, JPEG, WebP, or GIF image.')
  if (!input.bytes.length || input.bytes.length > MAX_BYTES) throw new Error('Use an image under 8 MB.')
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'look'
  const filename = `${slug}-${Date.now().toString(36)}${extension}`
  await mkdir(LOOKBOOK, { recursive: true })
  await writeFile(path.join(LOOKBOOK, filename), input.bytes)
  const addition: CollectionAddition = {
    title,
    category: input.category as CollectionAddition['category'],
    image: `/lookbook/${filename}`,
    fit: 'contain',
    garmentId: `REG-${Date.now().toString(36).toUpperCase()}`,
    colorway,
    status: 'Proposed',
    source: 'garment-registry',
  }
  const additions = [...await readCollectionAdditions(), addition]
  await mkdir(path.dirname(FILE), { recursive: true })
  await writeFile(FILE, `${JSON.stringify(additions, null, 2)}\n`)
  await syncGarmentWorkbook()
  return addition
}
