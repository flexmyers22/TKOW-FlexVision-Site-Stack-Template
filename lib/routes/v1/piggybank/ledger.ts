import { addKeypadEntry, readPiggybankLedger, savingsEntriesDocument } from '@/lib/server/piggybank-ledger'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get('format')
  if (format === 'csv' || format === 'json') {
    const document = await savingsEntriesDocument(format)
    return new Response(document.body, {
      headers: {
        'Content-Type': document.contentType,
        'Content-Disposition': `attachment; filename="${document.filename}"`,
      },
    })
  }
  return Response.json(await readPiggybankLedger())
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { amount_cents?: unknown; idempotency_key?: unknown } | null
  if (!body || typeof body.idempotency_key !== 'string') {
    return Response.json({ error: { code: 'input_invalid', message: 'The keypad amount could not be read.' } }, { status: 400 })
  }
  try {
    const ledger = await addKeypadEntry(Number(body.amount_cents), body.idempotency_key)
    return Response.json(ledger, { status: ledger.duplicate ? 200 : 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The keypad amount was not recorded.'
    return Response.json({ error: { code: 'entry_rejected', message } }, { status: 400 })
  }
}
