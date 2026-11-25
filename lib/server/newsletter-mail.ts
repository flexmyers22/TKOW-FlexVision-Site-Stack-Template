import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { put, get } from '@vercel/blob'
import { ADMIN_EMAIL, openNewsletterRecipient, sealNewsletterRecipient } from '@/lib/server/admin-access'
import { NEWSLETTER_HEADER, publishedEditions, readEditions, type NewsletterEdition } from '@/lib/server/newsletter'
import { cleanEmail, listProfileEmails, ProfileEntryError } from '@/lib/server/profile-entry'
import { resetEmailReady, siteOrigin } from '@/lib/server/reset-email'

const LOCAL_FILE = path.join(process.cwd(), 'data', 'newsletter-delivery.json')
const BLOB_PATH = 'newsletter/delivery.json'
const NEWSLETTER_NAME = 'Flex-Vision Newsletter'
const PUSH_REASON = 'No push provider or opted-in devices are configured.'
const SEND_LOCK_MS = 10 * 60_000
const MAX_EVENTS = 80

export const NEWSLETTER_SCHEDULE = {
  cadence: 'monthly',
  timezone: 'America/New_York',
  day_of_month: 1,
  send_time: '13:00',
  action: 'Pull profile email addresses and email the latest published edition that has not been submitted.',
  cron: '0 18 * * *',
  cron_note: 'The host check runs at 18:00 UTC. That is 1:00 PM Eastern Standard Time and 2:00 PM Eastern Daylight Time.',
} as const

type BatchStatus = 'Sending' | 'Submitted' | 'Partially Failed' | 'Failed'
type DeliveryBatch = {
  status: BatchStatus
  provider: 'Resend'
  started_at_utc: string
  finished_at_utc?: string
  eligible: number
  accepted: number
  failed: number
  subject: string
  failure_reason?: string
  push: { status: 'Skipped'; reason: string }
}
type TestSend = { at_utc: string; result: 'Submitted' | 'Failed'; failure_reason?: string }
type AuditEvent = { at_utc: string; actor: 'admin' | 'schedule' | 'recipient'; action: string; result: string }
type DeliveryStore = {
  schedule_paused: boolean
  suppressions: string[]
  batches: Record<string, DeliveryBatch>
  tests: Record<string, TestSend>
  subjects: Record<string, string>
  events: AuditEvent[]
}

export type AudienceCounts = {
  source: 'profile entries'
  synced_at_utc: string
  total: number
  invalid: number
  duplicates: number
  unsubscribed: number
  eligible: number
}

let writeQueue: Promise<unknown> = Promise.resolve()

function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)
}

function onComputer() {
  return !process.env.VERCEL
}

function utc(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function emailHash(email: string) {
  return createHash('sha256').update(email).digest('hex')
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char))
}

function defaultStore(): DeliveryStore {
  return { schedule_paused: true, suppressions: [], batches: {}, tests: {}, subjects: {}, events: [] }
}

function isStore(value: unknown): value is DeliveryStore {
  if (!value || typeof value !== 'object') return false
  const item = value as DeliveryStore
  return typeof item.schedule_paused === 'boolean' && Array.isArray(item.suppressions) && Boolean(item.batches) && Array.isArray(item.events)
}

async function readStore(): Promise<DeliveryStore> {
  const raw = await readStored()
  if (!raw) return defaultStore()
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isStore(parsed)) return defaultStore()
    parsed.tests ??= {}
    parsed.subjects ??= {}
    return parsed
  } catch {
    return defaultStore()
  }
}

async function readStored() {
  if (blobEnabled()) {
    try {
      const result = await get(BLOB_PATH, { access: 'private', useCache: false })
      if (result && result.statusCode === 200) return await new Response(result.stream).text()
    } catch (error) {
      console.error('[newsletter] delivery read failed:', error instanceof Error ? error.message : error)
      if (!onComputer()) throw new Error('Newsletter delivery records are not available right now.')
    }
  }
  try {
    return await readFile(LOCAL_FILE, 'utf8')
  } catch {
    return null
  }
}

async function writeStore(store: DeliveryStore) {
  const body = `${JSON.stringify(store, null, 2)}\n`
  if (onComputer()) {
    await mkdir(path.dirname(LOCAL_FILE), { recursive: true })
    const temporary = `${LOCAL_FILE}.tmp`
    await writeFile(temporary, body)
    await rename(temporary, LOCAL_FILE)
  }
  if (!blobEnabled()) {
    if (!onComputer()) throw new Error('Newsletter delivery records are not connected on this site yet.')
    return
  }
  await put(BLOB_PATH, body, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' })
}

function remember(store: DeliveryStore, actor: AuditEvent['actor'], action: string, result: string) {
  store.events.unshift({ at_utc: utc(), actor, action, result })
  store.events = store.events.slice(0, MAX_EVENTS)
}

function enqueue<T>(task: () => Promise<T>) {
  const run = writeQueue.then(task, task)
  writeQueue = run.then(() => undefined, () => undefined)
  return run
}

export function newsletterMailReady() {
  return resetEmailReady()
}

export async function newsletterAudience(): Promise<AudienceCounts> {
  const store = await readStore()
  const suppressed = new Set(store.suppressions)
  let rows: string[]
  try {
    rows = await listProfileEmails()
  } catch (error) {
    if (error instanceof ProfileEntryError) throw new Error(error.message)
    throw error
  }
  const seen = new Set<string>()
  let invalid = 0
  let duplicates = 0
  let unsubscribed = 0
  let eligible = 0
  for (const row of rows) {
    let email: string
    try {
      email = cleanEmail(row)
    } catch {
      invalid += 1
      continue
    }
    if (seen.has(email)) {
      duplicates += 1
      continue
    }
    seen.add(email)
    if (suppressed.has(emailHash(email))) unsubscribed += 1
    else eligible += 1
  }
  return {
    source: 'profile entries',
    synced_at_utc: utc(),
    total: rows.length,
    invalid,
    duplicates,
    unsubscribed,
    eligible,
  }
}

async function eligibleAddresses() {
  const store = await readStore()
  const suppressed = new Set(store.suppressions)
  const rows = await listProfileEmails()
  const seen = new Set<string>()
  const emails: string[] = []
  for (const row of rows) {
    let email: string
    try {
      email = cleanEmail(row)
    } catch {
      continue
    }
    if (seen.has(email) || suppressed.has(emailHash(email))) continue
    seen.add(email)
    emails.push(email)
  }
  return emails
}

export function defaultSubject(edition: NewsletterEdition) {
  return `New newsletter is live: ${edition.title}`.slice(0, 180)
}

export function renderNewsletterEmail(edition: NewsletterEdition, highlights: NewsletterEdition[], options: {
  origin: string
  subject: string
  unsubscribeUrl: string
  test: boolean
}) {
  const preview = escapeHtml(edition.summary)
  const banner = `<img src="${escapeHtml(new URL(NEWSLETTER_HEADER.src, options.origin).href)}" alt="${escapeHtml(NEWSLETTER_HEADER.alt)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;background:#111318">`
  const items = highlights.slice(0, 3).map((item) => {
    const href = `${options.origin}/newsletter#edition-${encodeURIComponent(item.id)}`
    return `<li style="margin:0 0 8px"><a href="${href}" style="color:#111318">${escapeHtml(item.summary)}</a></li>`
  }).join('')
  const issueUrl = `${options.origin}/newsletter#edition-${encodeURIComponent(edition.id)}`
  const testLine = options.test
    ? '<p style="margin:0 0 16px;padding:10px 12px;background:#eceff3;color:#20242b;font-size:13px">Test send to the admin inbox. This is separate from the profile-address send.</p>'
    : ''
  const html = `<div style="display:none;max-height:0;overflow:hidden">${preview}</div>
<div style="margin:0;padding:24px 12px;background:#f3f4f6">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;color:#20242b;font:16px/1.5 Arial,sans-serif">
    ${banner}
    <div style="padding:28px 24px">
      ${testLine}
      <p style="margin:0 0 8px">Hello,</p>
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6d7380">${escapeHtml(NEWSLETTER_NAME)}</p>
      <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;color:#111318">${escapeHtml(edition.title)}</h1>
      <p style="margin:0 0 16px">${escapeHtml(edition.lead)}</p>
      <ul style="margin:0 0 20px;padding-left:18px">${items}</ul>
      <p style="margin:0 0 24px"><a href="${issueUrl}" style="display:inline-block;padding:12px 18px;background:#111318;color:#ffffff;text-decoration:none;font-weight:700">View More Newsletter</a></p>
    </div>
    <div style="padding:20px 24px;background:#111318;color:#aeb4bf;font-size:13px">
      <p style="margin:0 0 8px">Social links are not configured.</p>
      <p style="margin:0 0 8px">AI chatbot — planned</p>
      <p style="margin:0 0 8px"><a href="${options.origin}/profile" style="color:#f3f4f6">Email preferences</a> · <a href="${escapeHtml(options.unsubscribeUrl)}" style="color:#f3f4f6">Unsubscribe</a></p>
      <p style="margin:0">Flex-Vision LLC. A mailing address is not recorded on this site. Sent with Resend.</p>
    </div>
  </div>
</div>`
  const text = [
    options.test ? 'Test send to the admin inbox. This is separate from the profile-address send.' : '',
    'Hello,',
    NEWSLETTER_NAME,
    edition.title,
    edition.lead,
    ...highlights.slice(0, 3).map((item) => `- ${item.summary}`),
    `View More Newsletter: ${issueUrl}`,
    'Social links are not configured.',
    'AI chatbot — planned',
    `Email preferences: ${options.origin}/profile`,
    `Unsubscribe: ${options.unsubscribeUrl}`,
    'Flex-Vision LLC. A mailing address is not recorded on this site.',
  ].filter(Boolean).join('\n\n')
  return { subject: options.subject, preview_text: edition.summary, html, text }
}

export async function previewNewsletterEmail(id: string, request: Request, subjectInput?: string) {
  const edition = await requirePublished(id)
  const highlights = await publishedEditions()
  const subject = cleanSubject(subjectInput || (await readStore()).subjects[id] || defaultSubject(edition))
  return renderNewsletterEmail(edition, highlights, {
    origin: siteOrigin(request),
    subject,
    unsubscribeUrl: `${siteOrigin(request)}/newsletter/unsubscribe`,
    test: false,
  })
}

export async function sendNewsletterEdition(input: { id: string; mode: 'test' | 'profile'; request: Request; subject?: string; actor: 'admin' | 'schedule' }) {
  if (!newsletterMailReady()) throw new Error('Email sending is not configured on this server.')
  const edition = await requirePublished(input.id)
  const highlights = await publishedEditions()
  const origin = siteOrigin(input.request)
  const subject = cleanSubject(input.subject || (await readStore()).subjects[input.id] || defaultSubject(edition))
  if (input.mode === 'test') {
    const message = renderNewsletterEmail(edition, highlights, {
      origin,
      subject,
      unsubscribeUrl: `${origin}/newsletter/unsubscribe?token=${encodeURIComponent(sealNewsletterRecipient(ADMIN_EMAIL))}`,
      test: true,
    })
    try {
      await postResend([messageBody(ADMIN_EMAIL, message)], `newsletter-test-${edition.id}-${Date.now()}`)
      await enqueue(() => updateStore((store) => {
        store.subjects[edition.id] = subject
        store.tests[edition.id] = { at_utc: utc(), result: 'Submitted' }
        remember(store, input.actor, 'test_send', `Submitted a test for ${edition.id}. Resend acceptance is the recorded result.`)
      }))
      return { mode: 'test' as const, result: 'Submitted' as const, eligible: 1 }
    } catch (error) {
      const failure_reason = error instanceof Error ? error.message : 'The test send failed.'
      await enqueue(() => updateStore((store) => {
        store.tests[edition.id] = { at_utc: utc(), result: 'Failed', failure_reason }
        remember(store, input.actor, 'test_send', failure_reason)
      }))
      throw new Error(failure_reason)
    }
  }

  const emails = await eligibleAddresses()
  if (!emails.length) throw new Error('No profile email is eligible. Unsubscribed and invalid addresses are already excluded.')
  await enqueue(() => updateStore((store) => {
    const current = store.batches[edition.id]
    if (current && (current.status === 'Submitted' || current.status === 'Partially Failed' || current.accepted > 0)) {
      throw new Error('This edition already has a profile-address send. A second send would duplicate recipients.')
    }
    if (current?.status === 'Sending' && Date.now() - Date.parse(current.started_at_utc) < SEND_LOCK_MS) {
      throw new Error('A profile-address send for this edition is already in progress.')
    }
    store.subjects[edition.id] = subject
    store.batches[edition.id] = {
      status: 'Sending',
      provider: 'Resend',
      started_at_utc: utc(),
      eligible: emails.length,
      accepted: 0,
      failed: emails.length,
      subject,
      push: { status: 'Skipped', reason: PUSH_REASON },
    }
    remember(store, input.actor, 'profile_send', `Queued ${emails.length} profile emails for ${edition.id}.`)
  }))

  let accepted = 0
  try {
    for (let index = 0; index < emails.length; index += 100) {
      const chunk = emails.slice(index, index + 100)
      const messages = chunk.map((email) => messageBody(email, renderNewsletterEmail(edition, highlights, {
        origin,
        subject,
        unsubscribeUrl: `${origin}/newsletter/unsubscribe?token=${encodeURIComponent(sealNewsletterRecipient(email))}`,
        test: false,
      })))
      await postResend(messages, `newsletter-${edition.id}-chunk-${index / 100}`)
      accepted += chunk.length
    }
  } catch (error) {
    const failure_reason = error instanceof Error ? error.message : 'The profile-address send failed.'
    await enqueue(() => updateStore((store) => {
      const batch = store.batches[edition.id]
      if (!batch) return
      batch.status = accepted > 0 ? 'Partially Failed' : 'Failed'
      batch.finished_at_utc = utc()
      batch.accepted = accepted
      batch.failed = emails.length - accepted
      batch.failure_reason = failure_reason
      remember(store, input.actor, 'profile_send', failure_reason)
    }))
    throw new Error(failure_reason)
  }

  await enqueue(() => updateStore((store) => {
    const batch = store.batches[edition.id]
    if (!batch) return
    batch.status = 'Submitted'
    batch.finished_at_utc = utc()
    batch.accepted = accepted
    batch.failed = 0
    delete batch.failure_reason
    remember(store, input.actor, 'profile_send', `Resend accepted ${accepted} messages for ${edition.id}. Acceptance is not a delivery receipt.`)
  }))
  return { mode: 'profile' as const, result: 'Submitted' as const, eligible: emails.length, accepted, push: 'Skipped' as const }
}

export async function setNewsletterSchedulePaused(paused: boolean) {
  await enqueue(() => updateStore((store) => {
    store.schedule_paused = paused
    remember(store, 'admin', paused ? 'schedule_pause' : 'schedule_resume', paused ? 'Monthly profile-address pull paused.' : 'Monthly profile-address pull resumed.')
  }))
  return scheduleView(await readStore())
}

export async function suppressNewsletterRecipient(token: string) {
  const email = openNewsletterRecipient(token)
  if (!email) return 'invalid' as const
  let normalized: string
  try {
    normalized = cleanEmail(email)
  } catch {
    return 'invalid' as const
  }
  const hash = emailHash(normalized)
  await enqueue(() => updateStore((store) => {
    if (!store.suppressions.includes(hash)) store.suppressions.push(hash)
    remember(store, 'recipient', 'unsubscribe', 'An unsubscribe token was applied. The address is stored only as a hash.')
  }))
  return 'removed' as const
}

export async function newsletterDeliveryView() {
  const store = await readStore()
  let audience: AudienceCounts | { error: string }
  try {
    audience = await newsletterAudience()
  } catch (error) {
    audience = { error: error instanceof Error ? error.message : 'Profile addresses could not be read.' }
  }
  return {
    mail_ready: newsletterMailReady(),
    audience,
    schedule: scheduleView(store),
    push: { status: 'Skipped' as const, reason: PUSH_REASON },
    batches: store.batches,
    tests: store.tests,
    events: store.events,
  }
}

export async function runMonthlyProfilePull(request: Request) {
  const store = await readStore()
  const eastern = easternParts()
  if (store.schedule_paused) {
    await enqueue(() => updateStore((current) => remember(current, 'schedule', 'schedule_check', 'Paused, so no profile addresses were emailed.')))
    return { acted: false, reason: 'The monthly profile-address pull is paused.' }
  }
  if (eastern.day !== NEWSLETTER_SCHEDULE.day_of_month) {
    return { acted: false, reason: 'Today is not the monthly pull date in America/New_York.' }
  }
  const editions = await publishedEditions()
  const pending = editions.find((edition) => {
    const batch = store.batches[edition.id]
    return !batch || (batch.status === 'Failed' && batch.accepted === 0)
  })
  if (!pending) {
    await enqueue(() => updateStore((current) => remember(current, 'schedule', 'schedule_check', 'No published edition is waiting to be emailed.')))
    return { acted: false, reason: 'No published edition is waiting to be emailed.' }
  }
  const result = await sendNewsletterEdition({ id: pending.id, mode: 'profile', request, actor: 'schedule' })
  return { acted: true, edition_id: pending.id, ...result, eastern_time: `${eastern.hour}:${eastern.minute}` }
}

function scheduleView(store: DeliveryStore) {
  return { ...NEWSLETTER_SCHEDULE, paused: store.schedule_paused }
}

function easternParts() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NEWSLETTER_SCHEDULE.timezone,
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0')
  return { day: read('day'), hour: read('hour'), minute: read('minute') }
}

async function requirePublished(id: string) {
  const edition = (await readEditions()).find((item) => item.id === id)
  if (!edition) throw new Error('That edition is already gone.')
  if (edition.status !== 'Published') throw new Error('Publish the edition before emailing it. Saving a draft does not send email.')
  return edition
}

function cleanSubject(value: string) {
  const subject = value.trim().replace(/\s+/g, ' ')
  if (subject.length < 8 || subject.length > 180) throw new Error('Enter an email subject between 8 and 180 characters.')
  return subject
}

function messageBody(to: string, message: { subject: string; html: string; text: string }) {
  return {
    from: process.env.RESEND_FROM?.trim(),
    to: [to],
    subject: message.subject,
    html: message.html,
    text: message.text,
  }
}

async function postResend(messages: ReturnType<typeof messageBody>[], idempotencyKey: string) {
  const response = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(messages),
  })
  if (!response.ok) {
    const detail = (await response.text()).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    throw new Error(`Resend returned ${response.status}: ${detail.slice(0, 180)}`)
  }
}

async function updateStore(change: (store: DeliveryStore) => void) {
  const store = await readStore()
  change(store)
  await writeStore(store)
}
