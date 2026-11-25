import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  PIGGY_GOAL_ID,
  PIGGY_MAX_CENTS,
  SAVINGS_CSV_HEADER,
  WORKFLOW_CSV_HEADER,
  starterSavingsEntries,
  starterWorkflowEvents,
  type SavingsEntry,
  type WorkflowEvent,
} from '@/lib/piggybank-ledger'

const ROOT = path.join(process.cwd(), '.data', 'piggybank')
const SAVINGS_JSON = path.join(ROOT, 'savings_entries.json')
const EVENTS_JSON = path.join(ROOT, 'workflow_events.json')
const SAVINGS_CSV = path.join(ROOT, 'savings_entries.csv')
const EVENTS_CSV = path.join(ROOT, 'workflow_events.csv')
const MAX_ENTRIES = 500
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9-]{8,80}$/

type LedgerStore = {
  entries: SavingsEntry[]
  events: WorkflowEvent[]
}

let writeQueue: Promise<unknown> = Promise.resolve()

export async function readPiggybankLedger() {
  const store = await ensureStore()
  return publicLedger(store)
}

export async function savingsEntriesDocument(format: 'csv' | 'json') {
  const store = await ensureStore()
  if (format === 'csv') return { body: savingsCsv(store.entries), contentType: 'text/csv; charset=utf-8', filename: 'savings_entries.csv' }
  return { body: `${JSON.stringify(store.entries, null, 2)}\n`, contentType: 'application/json; charset=utf-8', filename: 'savings_entries.json' }
}

export async function addKeypadEntry(amountCents: number, idempotencyKey: string) {
  if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > PIGGY_MAX_CENTS) {
    throw new Error('Enter a dollar amount from $0.01 to $1,000.00.')
  }
  if (!IDEMPOTENCY_PATTERN.test(idempotencyKey)) throw new Error('The keypad request could not be identified.')
  return enqueue(async () => {
    const store = await readStore()
    const existing = store.entries.find((entry) => entry.idempotency_key === idempotencyKey)
    if (existing) return { ...publicLedger(store), entry: existing, duplicate: true }
    if (store.entries.length >= MAX_ENTRIES) throw new Error('The savings ledger has reached its entry limit.')
    const createdAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    const sequence = nextSequence(store.entries)
    const entry: SavingsEntry = {
      entry_id: `entry_keypad_${String(sequence).padStart(4, '0')}`,
      goal_id: PIGGY_GOAL_ID,
      amount_cents: amountCents,
      currency: 'USD',
      method: 'simulated_cash',
      source: 'ui_keypad',
      status: 'recorded',
      idempotency_key: idempotencyKey,
      created_at_utc: createdAt,
      note: 'keypad entry',
    }
    const runId = `run_keypad_${String(sequence).padStart(4, '0')}`
    const events: WorkflowEvent[] = [
      {
        event_id: `workflow_keypad_${String(sequence).padStart(4, '0')}_entry`,
        event_type: 'ledger_entry_created',
        source_record_id: entry.entry_id,
        run_id: runId,
        status: 'completed',
        created_at_utc: createdAt,
        error_code: '',
      },
      {
        event_id: `workflow_keypad_${String(sequence).padStart(4, '0')}_csv`,
        event_type: 'csv_json_export_written',
        source_record_id: entry.entry_id,
        run_id: runId,
        status: 'completed',
        created_at_utc: createdAt,
        error_code: '',
      },
    ]
    store.entries.push(entry)
    store.events.push(...events)
    await writeStore(store)
    return { ...publicLedger(store), entry, duplicate: false }
  })
}

async function ensureStore() {
  return enqueue(async () => {
    const store = await readStore()
    await writeStore(store)
    return store
  })
}

function publicLedger(store: LedgerStore) {
  const recordedCents = store.entries.reduce((total, entry) => total + (entry.status === 'reversed' ? 0 : entry.amount_cents), 0)
  return { entries: store.entries, events: store.events, recorded_cents: recordedCents }
}

function nextSequence(entries: SavingsEntry[]) {
  const used = entries.map((entry) => {
    const match = /^entry_(?:demo|keypad)_(\d+)$/.exec(entry.entry_id)
    return match ? Number(match[1]) : 0
  })
  return Math.max(0, ...used) + 1
}

async function readStore(): Promise<LedgerStore> {
  try {
    const [entriesRaw, eventsRaw] = await Promise.all([readFile(SAVINGS_JSON, 'utf8'), readFile(EVENTS_JSON, 'utf8')])
    return { entries: parseEntries(entriesRaw), events: parseEvents(eventsRaw) }
  } catch {
    return { entries: starterSavingsEntries.map((entry) => ({ ...entry })), events: starterWorkflowEvents.map((event) => ({ ...event })) }
  }
}

async function writeStore(store: LedgerStore) {
  await mkdir(ROOT, { recursive: true })
  await replaceFile(SAVINGS_JSON, `${JSON.stringify(store.entries, null, 2)}\n`)
  await replaceFile(EVENTS_JSON, `${JSON.stringify(store.events, null, 2)}\n`)
  await replaceFile(SAVINGS_CSV, savingsCsv(store.entries))
  await replaceFile(EVENTS_CSV, workflowCsv(store.events))
}

function savingsCsv(entries: SavingsEntry[]) {
  const rows = entries.map((entry) => [
    entry.entry_id,
    entry.goal_id,
    String(entry.amount_cents),
    entry.currency,
    entry.method,
    entry.source,
    entry.status,
    entry.idempotency_key,
    entry.created_at_utc,
    entry.note,
  ].map(csvCell).join(','))
  return `${SAVINGS_CSV_HEADER}\n${rows.join('\n')}\n`
}

function workflowCsv(events: WorkflowEvent[]) {
  const rows = events.map((event) => [
    event.event_id,
    event.event_type,
    event.source_record_id,
    event.run_id,
    event.status,
    event.created_at_utc,
    event.error_code,
  ].map(csvCell).join(','))
  return `${WORKFLOW_CSV_HEADER}\n${rows.join('\n')}\n`
}

function parseEntries(raw: string) {
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) return starterSavingsEntries.map((entry) => ({ ...entry }))
  return parsed.filter(isSavingsEntry)
}

function parseEvents(raw: string) {
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) return starterWorkflowEvents.map((event) => ({ ...event }))
  return parsed.filter(isWorkflowEvent)
}

function isSavingsEntry(value: unknown): value is SavingsEntry {
  if (!isRecord(value)) return false
  return typeof value.entry_id === 'string'
    && value.goal_id === PIGGY_GOAL_ID
    && Number.isInteger(value.amount_cents)
    && value.currency === 'USD'
    && typeof value.method === 'string'
    && typeof value.source === 'string'
    && typeof value.status === 'string'
    && typeof value.idempotency_key === 'string'
    && typeof value.created_at_utc === 'string'
    && typeof value.note === 'string'
    && !('routing' in value)
    && !('account' in value)
    && !('card_number' in value)
    && !('cvv' in value)
    && !('bank_password' in value)
}

function isWorkflowEvent(value: unknown): value is WorkflowEvent {
  if (!isRecord(value)) return false
  return typeof value.event_id === 'string'
    && typeof value.event_type === 'string'
    && typeof value.source_record_id === 'string'
    && typeof value.run_id === 'string'
    && typeof value.status === 'string'
    && typeof value.created_at_utc === 'string'
    && typeof value.error_code === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function csvCell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`
  return safe
}

async function replaceFile(filePath: string, body: string) {
  const temporary = `${filePath}.tmp`
  await writeFile(temporary, body)
  await rename(temporary, filePath)
}

function enqueue<T>(task: () => Promise<T>) {
  const run = writeQueue.then(task, task)
  writeQueue = run.then(() => undefined, () => undefined)
  return run
}
