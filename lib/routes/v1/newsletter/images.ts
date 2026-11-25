import { refuseNewsletterRequest } from '@/lib/server/newsletter-admin'
import { NEWSLETTER_IMAGE_DIR, listFolderImages, readFolderImage } from '@/lib/server/newsletter-images'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const refused = refuseNewsletterRequest(request)
  if (refused) return refused
  const file = new URL(request.url).searchParams.get('file')
  if (!file) return Response.json({ folder: NEWSLETTER_IMAGE_DIR, images: await listFolderImages() })
  try {
    const { bytes, contentType } = await readFolderImage(file)
    return new Response(new Uint8Array(bytes), { headers: { 'content-type': contentType, 'cache-control': 'no-store' } })
  } catch (error) {
    return Response.json({ error: { message: error instanceof Error ? error.message : 'That image was not found.' } }, { status: 404 })
  }
}
