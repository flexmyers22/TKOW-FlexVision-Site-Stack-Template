import { ADMIN_ACCESS_COOKIE, hasAdminAccessCookie } from '@/lib/server/admin-access'
import { removeLookbookRow, saveCollectionImage } from '@/lib/server/collection-additions'
import { readGarmentRecords } from '@/lib/server/mm-lookbook'

export const runtime = 'nodejs'

function hostnameOf(request: Request) {
  const host = request.headers.get('host') ?? ''
  if (host.startsWith('[')) {
    const end = host.indexOf(']')
    return end === -1 ? '' : host.slice(1, end).toLowerCase()
  }
  return host.split(':')[0].toLowerCase()
}

function privateLan(hostname: string) {
  const parts = hostname.split('.')
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part))) return false
  const [a, b, c, d] = parts.map(Number)
  if ([a, b, c, d].some(octet => octet > 255)) return false
  if (a === 10) return true
  if (a === 192 && b === 168) return true
  return a === 172 && b >= 16 && b <= 31
}

function computerRequest(request: Request) {
  const hostname = hostnameOf(request)
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true
  return process.env.NODE_ENV !== 'production' && privateLan(hostname)
}

function adminCookie(request: Request) {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === ADMIN_ACCESS_COOKIE) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

export async function GET() {
  return Response.json({ additions: await readGarmentRecords() })
}

export async function POST(request: Request) {
  if (!computerRequest(request)) {
    return Response.json({ error: { message: 'This upload saves on the computer running the site.' } }, { status: 404 })
  }
  if (!hasAdminAccessCookie(adminCookie(request))) {
    return Response.json({ error: { message: 'Sign in on this address before adding a product.' } }, { status: 401 })
  }
  const form = await request.formData()
  const file = form.get('image')
  if (!(file instanceof File)) {
    return Response.json({ error: { message: 'Choose an image.' } }, { status: 400 })
  }
  try {
    const addition = await saveCollectionImage({
      title: String(form.get('title') ?? ''),
      category: String(form.get('category') ?? ''),
      colorway: String(form.get('colorway') ?? ''),
      bytes: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
    })
    return Response.json({ addition }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The image was not saved.'
    return Response.json({ error: { message } }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  if (!computerRequest(request)) {
    return Response.json({ error: { message: 'This row is removed on the computer running the site.' } }, { status: 404 })
  }
  if (!hasAdminAccessCookie(adminCookie(request))) {
    return Response.json({ error: { message: 'Sign in on this address before deleting a product.' } }, { status: 401 })
  }
  const body = await request.json().catch(() => null) as { garmentId?: unknown } | null
  if (!body || typeof body.garmentId !== 'string') {
    return Response.json({ error: { message: 'Choose a lookbook row to delete.' } }, { status: 400 })
  }
  try {
    await removeLookbookRow(body.garmentId)
    return Response.json({ removed: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The lookbook row was not deleted.'
    return Response.json({ error: { message } }, { status: 400 })
  }
}
