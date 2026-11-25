import { readBlenderPackage, saveBlenderPackage, summarizePackage } from '@/lib/server/blender'

export const runtime = 'nodejs'

export async function GET() {
  return Response.json({ package: summarizePackage(await readBlenderPackage()) })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: { message: 'Send the product workspace JSON.' } }, { status: 400 })
  try {
    const summary = await saveBlenderPackage(body)
    return Response.json(summary, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The product record was not stored.'
    const status = /computer running the site/.test(message) ? 404 : 400
    return Response.json({ error: { message } }, { status })
  }
}
