import { beginOnshapeSignIn } from '@/lib/server/onshape-oauth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const redirectTarget = new URL('/v1/onshape/callback', request.url)
  try {
    const { result, authorizationUrl } = await beginOnshapeSignIn(redirectTarget)
    if (result === 'REDIRECT' && authorizationUrl) return Response.redirect(authorizationUrl)
    return Response.redirect(new URL('/?onshape=connected', request.url))
  } catch (error) {
    console.error('Onshape connect failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.redirect(new URL('/?onshape=error', request.url))
  }
}
