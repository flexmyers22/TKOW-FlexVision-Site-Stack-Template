import { access } from 'node:fs/promises'
import path from 'node:path'
import { CATEGORIES, readCollectionAdditions, readRemovedLookbookIds, type CollectionAddition } from '@/lib/server/collection-additions'

const WORKSPACE = path.join(process.cwd(), 'Sites', 'MM_Collection_Lookbook_Site_Workspace_RevA')
export const LOOKBOOK_ASSETS = path.join(WORKSPACE, 'assets')
const REGISTRY = path.join(WORKSPACE, 'records', 'garment-registry.csv')

const REMOVED_PAGES = new Set([2, 3, 8, 9, 11])

/** Rev A spread sequence from the lookbook workspace `index.html`. */
const SPREADS: Array<[string, string, string[], string]> = [
  ['Cover', 'Establish the collection', ['Earth Tone Taichi Ball Collection(1).png', 'Flex-print colorway collection design.png'], 'MM Collection — edition / season TBD'],
  ['Collection statement', 'Set the design language', ['Earth Tone Taichi Ball Collection(1).png', 'Earth-tone angular shard textile pattern-2.png'], 'Approved statement: TBD; keep pattern families distinct'],
  ['Lineup overview', 'Show collection breadth', ['Flex-print colorway collection design.png', 'Flex-print golf shirt colorways grid.png', 'Flexprint Inverted Camo Collection(1).png'], 'Garment roster and titles: TBD / Proposed'],
  ['Hero look 01', 'Introduce lead style', ['FLEX-PRINT golf shirt design mockup.png', 'Flex-print golf shirt colorways grid.png'], 'Golf shirt concept; fit and construction Unknown'],
  ['Hero look 02', 'Show a second key look', ['Cropped hoodie design mockup with details.png', 'ChatGPT Image Oct 24, 2026, 01_59_13 PM.png'], 'Hoodie concept; image attribution Pending'],
  ['Detail study', 'Show visible graphic / details', ['Cropped hoodie design mockup with details.png', 'Flex-Print Shorts Technical Spec Board (1).png', 'Distressed Geometric Tech Emblem-2(1).png'], 'Describe visible detail only; construction Proposed'],
  ['Colorway and material story', 'Document palette and surfaces', ['Flex-print colorway collection design.png', 'Flex-print golf shirt colorways grid.png', 'Embedded_Crystal_Circuit_Colorway_Reference.jpeg'], 'Textile swatches Pending; crystal palette is a separate provisional reference'],
  ['Styling and placement', 'Show editable outfit combinations', ['Earth Tone Taichi Ball Collection(1).png', 'Flexprint Inverted Camo Collection(1).png', 'Elegant onyx and diamond necklace.png'], 'Editorial styling concept; no product claim implied'],
  ['Product passports', 'Make proposed styles traceable', ['FLEX-PRINT golf shirt design mockup.png', 'Cropped hoodie design mockup with details.png', 'Athletic shorts in muted tones (1).png'], 'Populate from Excel garment registry; claims remain TBD until evidenced'],
  ['Collection status and next actions', 'Prepare handoff', ['Flex-Print Shorts Technical Spec Board (1).png', 'Embedded_Crystal_Circuit_Colorway_Reference.jpeg'], 'Release gate Pending; measurement evidence required'],
  ['Closing', 'End on the development state', ['Earth Tone Taichi Ball Collection(1).png', 'Flex-print colorway collection design.png'], 'Development / sampling / approval state: Proposed'],
]

export type LookbookFrame = { src: string; alt: string; file: string }

export type LookbookSlide = {
  id: string
  title: string
  purpose: string
  copy: string
  images: LookbookFrame[]
  origin: 'workspace' | 'registry'
  status: string
  category?: string
  garmentId?: string
  colorway?: string
}

type RegistryRow = {
  id: string
  name: string
  category: string
  colorway: string
  status: string
  front: string
}

function assetUrl(file: string) {
  return `/v1/collection/asset?file=${encodeURIComponent(file)}`
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

async function readRegistry() {
  try {
    const { readFile } = await import('node:fs/promises')
    const table = parseCsv(await readFile(REGISTRY, 'utf8'))
    const [header, ...body] = table
    if (!header) return []
    const column = (name: string) => header.indexOf(name)
    return body.map((cells): RegistryRow => ({
      id: cells[column('id')] ?? '',
      name: cells[column('name')] ?? '',
      category: cells[column('category')] ?? '',
      colorway: cells[column('colorway')] ?? '',
      status: cells[column('status')] ?? 'Proposed',
      front: cells[column('front')] ?? '',
    })).filter((row) => row.id && row.front && row.front !== 'Unknown')
  } catch {
    return []
  }
}

async function framesFor(files: string[], title: string) {
  const frames: LookbookFrame[] = []
  for (const file of files) {
    try {
      await access(path.join(LOOKBOOK_ASSETS, file))
      frames.push({ src: assetUrl(file), alt: `${title}. Concept reference.`, file })
    } catch {
      /* Skip a workspace image that is not in the asset folder. */
    }
  }
  return frames
}

function registrySlide(addition: CollectionAddition, order: number): LookbookSlide {
  return {
    id: addition.garmentId || `registry-${order}`,
    title: addition.title,
    purpose: 'Garment registry upload',
    copy: 'Added from the admin garment registry. Status remains Proposed until evidence is attached.',
    images: [{ src: addition.image, alt: `${addition.title}. Concept reference.`, file: addition.image }],
    origin: 'registry',
    status: addition.status || 'Proposed',
    category: addition.category,
    garmentId: addition.garmentId,
    colorway: addition.colorway || 'Unknown',
  }
}

export async function readLookbook() {
  const [registry, additions] = await Promise.all([readRegistry(), readCollectionAdditions()])
  const slides: LookbookSlide[] = []
  const usedGarments = new Set<string>()
  for (let index = 0; index < SPREADS.length; index += 1) {
    const page = index + 1
    if (REMOVED_PAGES.has(page)) continue
    const [title, purpose, files, copy] = SPREADS[index]
    const images = await framesFor(files, title)
    if (!images.length) continue
    const match = registry.find((row) => row.front === images[0]?.file && !usedGarments.has(row.id))
    if (match) usedGarments.add(match.id)
    slides.push({
      id: `spread-${page}`,
      title,
      purpose,
      copy,
      images,
      origin: 'workspace',
      status: match?.status || 'Proposed',
      category: match?.category,
      garmentId: match?.id,
      colorway: match?.colorway,
    })
  }
  additions.forEach((addition, index) => {
    slides.push(registrySlide(addition, index + 1))
  })
  const removed = await readRemovedLookbookIds()
  return {
    collection: {
      name: 'MM Collection',
      revision: 'Rev A',
      parentBrand: 'TKOW • FLEX-VISION / Platinum Slang',
    },
    slides: slides.filter((slide) => !removed.has(slide.id) && !(slide.garmentId && removed.has(slide.garmentId))),
  }
}

export async function readGarmentRecords() {
  const { slides } = await readLookbook()
  return slides.map((slide) => ({
    title: slide.title,
    category: registryCategory(slide.category),
    image: slide.images[0]?.src ?? '',
    fit: 'contain' as const,
    garmentId: slide.garmentId || slide.id,
    colorway: slide.colorway || 'Unknown',
    status: (slide.status || 'Proposed') as 'Proposed',
    source: slide.origin === 'registry' ? 'garment-registry' as const : 'lookbook' as const,
  }))
}

function registryCategory(value: string | undefined) {
  if (value && (CATEGORIES as readonly string[]).includes(value)) return value as (typeof CATEGORIES)[number]
  if (value && /accessor/i.test(value)) return 'Accessory' as const
  if (value && /print/i.test(value)) return 'Flex-Print' as const
  if (value && /emblem/i.test(value)) return 'Emblem' as const
  return 'Apparel' as const
}

export function lookbookAssetPath(file: string) {
  if (!file || file !== path.basename(file)) return null
  if (file.includes('..') || /[\\/\0]/.test(file)) return null
  if (!/\.(png|jpe?g|webp|gif)$/i.test(file)) return null
  return path.join(LOOKBOOK_ASSETS, file)
}
