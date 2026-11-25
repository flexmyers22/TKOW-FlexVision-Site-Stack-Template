export const PIGGY_GOAL_ID = 'goal_granddad_football'
export const PIGGY_MAX_CENTS = 100_000
export const SAVINGS_CSV_HEADER = 'entry_id,goal_id,amount_cents,currency,method,source,status,idempotency_key,created_at_utc,note'
export const WORKFLOW_CSV_HEADER = 'event_id,event_type,source_record_id,run_id,status,created_at_utc,error_code'

export type SavingsEntry = {
  entry_id: string
  goal_id: string
  amount_cents: number
  currency: 'USD'
  method: 'simulated_cash' | 'manual_adjustment' | 'provider_confirmed'
  source: 'ui_keypad' | 'hardware_keypad' | 'qr_demo' | 'nfc_demo' | 'console'
  status: 'recorded' | 'pending' | 'reversed'
  idempotency_key: string
  created_at_utc: string
  note: string
}

export type WorkflowEvent = {
  event_id: string
  event_type: string
  source_record_id: string
  run_id: string
  status: string
  created_at_utc: string
  error_code: string
}

export const starterSavingsEntries: SavingsEntry[] = [
  {
    entry_id: 'entry_demo_0001',
    goal_id: PIGGY_GOAL_ID,
    amount_cents: 125,
    currency: 'USD',
    method: 'simulated_cash',
    source: 'ui_keypad',
    status: 'recorded',
    idempotency_key: 'demo-idem-0001',
    created_at_utc: '2026-11-08T18:00:00Z',
    note: 'fictional starter record',
  },
  {
    entry_id: 'entry_demo_0002',
    goal_id: PIGGY_GOAL_ID,
    amount_cents: 500,
    currency: 'USD',
    method: 'simulated_cash',
    source: 'qr_demo',
    status: 'recorded',
    idempotency_key: 'demo-idem-0002',
    created_at_utc: '2026-11-08T18:05:00Z',
    note: 'fictional starter record',
  },
]

export const starterWorkflowEvents: WorkflowEvent[] = [
  {
    event_id: 'workflow_demo_0001',
    event_type: 'ledger_entry_created',
    source_record_id: 'entry_demo_0001',
    run_id: 'run_demo_0001',
    status: 'completed',
    created_at_utc: '2026-11-08T18:00:01Z',
    error_code: '',
  },
  {
    event_id: 'workflow_demo_0002',
    event_type: 'csv_export_requested',
    source_record_id: PIGGY_GOAL_ID,
    run_id: 'run_demo_0002',
    status: 'queued',
    created_at_utc: '2026-11-08T18:06:00Z',
    error_code: '',
  },
]
