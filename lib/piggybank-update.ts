export const piggybankUpdate = {
  title: 'TKOW Granddad Football Piggybank',
  revision: 'Rev C',
  verification: 'provisional',
  dotId: 'TKOW.FV.ENG.FIN.PIGGY',
  summary: 'Simulation and savings ledger prototype. It does not connect to a bank or move money.',
  ledger: [
    {
      entryId: 'entry_demo_0001',
      goalId: 'goal_granddad_football',
      amountCents: 125,
      method: 'simulated_cash',
      source: 'ui_keypad',
      status: 'recorded',
      createdAtUtc: '2026-11-08T18:00:00Z',
    },
    {
      entryId: 'entry_demo_0002',
      goalId: 'goal_granddad_football',
      amountCents: 500,
      method: 'simulated_cash',
      source: 'qr_demo',
      status: 'recorded',
      createdAtUtc: '2026-11-08T18:05:00Z',
    },
  ],
  events: [
    {
      eventId: 'workflow_demo_0001',
      eventType: 'ledger_entry_created',
      sourceRecordId: 'entry_demo_0001',
      status: 'completed',
      createdAtUtc: '2026-11-08T18:00:01Z',
    },
    {
      eventId: 'workflow_demo_0002',
      eventType: 'csv_export_requested',
      sourceRecordId: 'goal_granddad_football',
      status: 'queued',
      createdAtUtc: '2026-11-08T18:06:00Z',
    },
  ],
  workflow: {
    name: 'Granddad Football Savings Data Pull',
    dotId: 'TKOW.FV.ENG.FIN.PIGGY.AUTOMATION.DATA_PULL',
    enabled: false,
    cadence: 'Weekly',
    timezone: 'America/New_York',
    localTime: 'Sunday 20:12',
    nextRunAtUtc: null as string | null,
    action: 'pull_demo_data',
    execution: 'Fast',
    push: true,
    email: true,
    statusWord: '100000000000000',
    statusRevision: 'Rev A',
    activeFlag: 'NEW_BUILD',
  },
  records: [
    { dotId: 'TKOW.FV.ENG.FIN.PIGGY', type: 'project', name: 'TKOW Granddad Football Piggybank', revision: 'Rev C', status: 'provisional' },
    { dotId: 'TKOW.FV.ENG.FIN.PIGGY.GOAL.GRANDDAD_FOOTBALL', type: 'goal', name: 'Granddad Football Fund', revision: 'Rev A', status: 'sample' },
    { dotId: 'TKOW.FV.ENG.FIN.PIGGY.LEDGER.ENTRY', type: 'entity', name: 'Savings ledger entry', revision: 'Rev A', status: 'sample' },
    { dotId: 'TKOW.FV.ENG.FIN.PIGGY.AUTOMATION.DATA_PULL', type: 'workflow', name: 'Scheduled demo data pull', revision: 'Rev C', status: 'provisional' },
    { dotId: 'TKOW.FV.ENG.FIN.PIGGY.AUTOMATION.DATA_PULL.RUN.STATUS_WORD', type: 'field', name: '15-bit run status word', revision: 'Rev A', status: 'provisional' },
    { dotId: 'TKOW.FV.ENG.FIN.PIGGY.ARTIFACT.STARTER_CSV', type: 'artifact', name: 'Starter CSV data', revision: 'Rev A', status: 'sample' },
  ],
}

export function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}
