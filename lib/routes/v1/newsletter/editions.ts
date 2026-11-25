import { refuseNewsletterRequest as refuse } from '@/lib/server/newsletter-admin'
import { deleteEdition, generateEdition, newsletterModelsReady, readEditions, setEditionImage, setEditionStatus } from '@/lib/server/newsletter'

export const runtime = 'nodejs'

function failure(error: unknown, fallback: string) {
  return Response.json({ error: { message: error instanceof Error ? error.message : fallback } }, { status: 400 })
}

export async function GET(request: Request) {
  const refused = refuse(request)
  if (refused) return refused
  return Response.json({ editions: await readEditions(), models: newsletterModelsReady() })
}

export async function POST(request: Request) {
  const refused = refuse(request)
  if (refused) return refused
  const body = await request.json().catch(() => null) as { topic?: unknown; model?: unknown; image?: unknown; alt?: unknown } | null
  try {
    const edition = await generateEdition({
      topic: String(body?.topic ?? ''),
      model: String(body?.model ?? 'chatgpt'),
      image: typeof body?.image === 'string' && body.image ? body.image : undefined,
      alt: typeof body?.alt === 'string' ? body.alt : undefined,
    })
    return Response.json({ edition }, { status: 201 })
  } catch (error) {
    return failure(error, 'The edition was not generated.')
  }
}

export async function PATCH(request: Request) {
  const refused = refuse(request)
  if (refused) return refused
  const body = await request.json().catch(() => null) as { id?: unknown; status?: unknown; image?: unknown; alt?: unknown } | null
  if (typeof body?.id !== 'string') return Response.json({ error: { message: 'Choose an edition.' } }, { status: 400 })
  if (body.image !== undefined) {
    if (body.image !== null && typeof body.image !== 'string') {
      return Response.json({ error: { message: 'Choose an image from the folder or remove the image.' } }, { status: 400 })
    }
    try {
      return Response.json({ edition: await setEditionImage(body.id, body.image || null, typeof body.alt === 'string' ? body.alt : '') })
    } catch (error) {
      return failure(error, 'The edition image was not changed.')
    }
  }
  if (body.status !== 'Draft' && body.status !== 'Published') {
    return Response.json({ error: { message: 'Choose an edition and a status.' } }, { status: 400 })
  }
  try {
    return Response.json({ edition: await setEditionStatus(body.id, body.status) })
  } catch (error) {
    return failure(error, 'The edition status was not changed.')
  }
}

export async function DELETE(request: Request) {
  const refused = refuse(request)
  if (refused) return refused
  const body = await request.json().catch(() => null) as { id?: unknown } | null
  if (typeof body?.id !== 'string') return Response.json({ error: { message: 'Choose an edition to delete.' } }, { status: 400 })
  try {
    await deleteEdition(body.id)
    return Response.json({ removed: true })
  } catch (error) {
    return failure(error, 'The edition was not deleted.')
  }
}
