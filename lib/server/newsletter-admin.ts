import { ADMIN_ACCESS_COOKIE, hasAdminAccessCookie } from '@/lib/server/admin-access'

function hostnameOf(request: Request) {
  const host = request.headers.get('host') ?? ''
  if (host.startsWith('[')) {
    const end = host.indexOf(']')
    return end === -1 ? '' : host.slice(1, end).toLowerCase()
  }
  return host.split(':')[0].toLowerCase()
}

function adminCookie(request: Request) {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === ADMIN_ACCESS_COOKIE) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

export function requireNewsletterAdmin(request: Request) {
  if (!hasAdminAccessCookie(adminCookie(request))) {
    return Response.json({ error: { message: 'Sign in to the admin portal first.' } }, { status: 401 })
  }
  return null
}

export function refuseNewsletterRequest(request: Request) {
  const hostname = hostnameOf(request)
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') {
    return Response.json({ error: { message: 'Newsletter editions are generated on the computer running the site.' } }, { status: 404 })
  }
  return requireNewsletterAdmin(request)
}
