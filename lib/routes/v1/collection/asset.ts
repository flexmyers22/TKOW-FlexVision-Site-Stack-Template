import { readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { LOOKBOOK_ASSETS, lookbookAssetPath } from '@/lib/server/mm-lookbook'

export const runtime = 'nodejs'

const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

export async function GET(request: Request) {
  const file = new URL(request.url).searchParams.get('file')
  const target = lookbookAssetPath(file ?? '')
  if (!target) return new Response('Not found', { status: 404 })
  try {
    const [root, resolved] = await Promise.all([realpath(LOOKBOOK_ASSETS), realpath(target)])
    if (resolved !== root && !resolved.startsWith(root + path.sep)) return new Response('Not found', { status: 404 })
    const bytes = await readFile(resolved)
    return new Response(bytes, {
      headers: {
        'Content-Type': TYPES[path.extname(resolved).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
