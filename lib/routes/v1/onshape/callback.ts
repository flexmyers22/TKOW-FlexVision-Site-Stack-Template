import { finishOnshapeSignIn } from '@/lib/server/onshape-oauth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  if (url.searchParams.get('error') || !code) {
    return Response.redirect(new URL('/?onshape=error', request.url))
  }

  try {
    await finishOnshapeSignIn(
      new URL('/v1/onshape/callback', request.url),
      code,
      url.searchParams.get('state') ?? undefined,
      url.searchParams.get('iss') ?? undefined,
    )
    return Response.redirect(new URL('/?onshape=connected', request.url))
  } catch (error) {
    console.error('Onshape callback failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.redirect(new URL('/?onshape=error', request.url))
  }
}
