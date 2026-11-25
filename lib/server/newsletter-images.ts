import { copyFile, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'

export const NEWSLETTER_IMAGE_DIR = process.env.NEWSLETTER_IMAGE_DIR?.trim()
  || path.resolve(process.cwd(), '..', 'Newsletter', 'Comic images')
const PUBLIC_DIR = path.join(process.cwd(), 'public', 'newsletter', 'images')
const PUBLIC_URL = '/newsletter/images'
const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}
const MAX_BYTES = 8 * 1024 * 1024

export type NewsletterImage = { src: string; alt: string; source_file: string }
export type FolderImage = { file: string; size: number; modified_utc: string }

export async function listFolderImages(): Promise<FolderImage[]> {
  let names: string[]
  try {
    names = await readdir(NEWSLETTER_IMAGE_DIR)
  } catch {
    return []
  }
  const images = await Promise.all(names.filter((name) => TYPES[path.extname(name).toLowerCase()]).map(async (file) => {
    const info = await stat(path.join(NEWSLETTER_IMAGE_DIR, file)).catch(() => null)
    if (!info?.isFile()) return null
    return { file, size: info.size, modified_utc: info.mtime.toISOString().replace(/\.\d{3}Z$/, 'Z') }
  }))
  return images.filter((image): image is FolderImage => image !== null)
    .sort((left, right) => right.modified_utc.localeCompare(left.modified_utc))
}

export async function readFolderImage(file: string) {
  const source = await folderPath(file)
  return { bytes: await readFile(source), contentType: TYPES[path.extname(source).toLowerCase()] }
}

export async function placeFolderImage(editionId: string, file: string, alt: string): Promise<NewsletterImage> {
  const source = await folderPath(file)
  const info = await stat(source)
  if (info.size > MAX_BYTES) throw new Error('That image is over 8 MB. Save a smaller copy in the folder first.')
  const name = `${editionId}-${slug(path.parse(file).name)}${path.extname(file).toLowerCase()}`
  await mkdir(PUBLIC_DIR, { recursive: true })
  await copyFile(source, path.join(PUBLIC_DIR, name))
  return { src: `${PUBLIC_URL}/${name}`, alt: alt.trim().replace(/\s+/g, ' ').slice(0, 200), source_file: file }
}

export async function removePlacedImage(image: NewsletterImage | undefined) {
  if (!image?.src.startsWith(`${PUBLIC_URL}/`)) return
  await rm(path.join(PUBLIC_DIR, path.basename(image.src)), { force: true })
}

async function folderPath(file: string) {
  const listed = await listFolderImages()
  if (!listed.some((image) => image.file === file)) throw new Error('That image is no longer in the newsletter image folder.')
  return path.join(NEWSLETTER_IMAGE_DIR, file)
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'image'
}
