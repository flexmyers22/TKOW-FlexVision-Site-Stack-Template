import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Response | Promise<Response>
type RouteModule = Partial<Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', Handler>>

const exact: Record<string, () => Promise<RouteModule>> = {
  chat: () => import('@/lib/routes/v1/chat'),
  library: () => import('@/lib/routes/v1/library'),
  'library/download': () => import('@/lib/routes/v1/library/download'),
  meetings: () => import('@/lib/routes/v1/meetings'),
  'meetings/audio': () => import('@/lib/routes/v1/meetings/audio'),
  'admin/entry': () => import('@/lib/routes/v1/admin/entry'),
  'admin/forgot-password': () => import('@/lib/routes/v1/admin/forgot-password'),
  'admin/sign-out': () => import('@/lib/routes/v1/admin/sign-out'),
  'auth/oauth/callback': () => import('@/lib/routes/v1/auth/oauth/callback'),
  'blender/build': () => import('@/lib/routes/v1/blender/build'),
  'blender/package': () => import('@/lib/routes/v1/blender/package'),
  'blender/status': () => import('@/lib/routes/v1/blender/status'),
  'collection/asset': () => import('@/lib/routes/v1/collection/asset'),
  'collection/image': () => import('@/lib/routes/v1/collection/image'),
  'collection/lookbook': () => import('@/lib/routes/v1/collection/lookbook'),
  'credentials/key': () => import('@/lib/routes/v1/credentials/key'),
  'credentials/workflow': () => import('@/lib/routes/v1/credentials/workflow'),
  'matlab/analyze': () => import('@/lib/routes/v1/matlab/analyze'),
  'matlab/live': () => import('@/lib/routes/v1/matlab/live'),
  'matlab/status': () => import('@/lib/routes/v1/matlab/status'),
  'newsletter/editions': () => import('@/lib/routes/v1/newsletter/editions'),
  'newsletter/images': () => import('@/lib/routes/v1/newsletter/images'),
  'newsletter/delivery': () => import('@/lib/routes/v1/newsletter/delivery'),
  'newsletter/schedule': () => import('@/lib/routes/v1/newsletter/schedule'),
  'onshape/callback': () => import('@/lib/routes/v1/onshape/callback'),
  'onshape/connect': () => import('@/lib/routes/v1/onshape/connect'),
  'onshape/status': () => import('@/lib/routes/v1/onshape/status'),
  'piggybank/ledger': () => import('@/lib/routes/v1/piggybank/ledger'),
  'profile/entry': () => import('@/lib/routes/v1/profile/entry'),
  'profile/forgot-password': () => import('@/lib/routes/v1/profile/forgot-password'),
  'profile/reset-password': () => import('@/lib/routes/v1/profile/reset-password'),
}

const patterns: { match: RegExp; names: string[]; load: () => Promise<RouteModule> }[] = [
  {
    match: /^credentials\/bases\/([^/]+)\/files\/([^/]+)\/workflow$/,
    names: ['baseId', 'fileId'],
    load: () => import('@/lib/routes/v1/credentials/bases/[baseId]/files/[fileId]/workflow'),
  },
  {
    match: /^credentials\/bases\/([^/]+)\/files\/([^/]+)\/move$/,
    names: ['baseId', 'fileId'],
    load: () => import('@/lib/routes/v1/credentials/bases/[baseId]/files/[fileId]/move'),
  },
  {
    match: /^credentials\/bases\/([^/]+)\/files\/([^/]+)$/,
    names: ['baseId', 'fileId'],
    load: () => import('@/lib/routes/v1/credentials/bases/[baseId]/files/[fileId]'),
  },
  {
    match: /^credentials\/bases\/([^/]+)\/files$/,
    names: ['baseId'],
    load: () => import('@/lib/routes/v1/credentials/bases/[baseId]/files'),
  },
  {
    match: /^credentials\/bases\/([^/]+)$/,
    names: ['baseId'],
    load: () => import('@/lib/routes/v1/credentials/bases/[baseId]'),
  },
  {
    match: /^auth\/oauth\/([^/]+)$/,
    names: ['provider'],
    load: () => import('@/lib/routes/v1/auth/oauth/[provider]'),
  },
]

async function dispatch(request: NextRequest, context: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await context.params
  const path = slug.map((part) => decodeURIComponent(part)).join('/')
  let load = exact[path]
  const params: Record<string, string> = {}
  if (!load) {
    for (const pattern of patterns) {
      const found = pattern.match.exec(path)
      if (!found) continue
      load = pattern.load
      pattern.names.forEach((name, index) => {
        params[name] = found[index + 1]
      })
      break
    }
  }
  if (!load) return Response.json({ error: { code: 'not_found', message: 'That path is not available.' } }, { status: 404 })
  const mod = await load()
  const handler = mod[request.method as keyof RouteModule]
  if (!handler) {
    const allow = (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).filter((method) => mod[method])
    return new Response(null, { status: 405, headers: { Allow: allow.join(', ') } })
  }
  return handler(request, { params: Promise.resolve(params) })
}

export const GET = dispatch
export const POST = dispatch
export const PUT = dispatch
export const PATCH = dispatch
export const DELETE = dispatch
