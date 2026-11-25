-- 015_electrical_oscillation_events.sql
-- Oscillation / transient event log for BESS–PCS digital twin diagnostics

create table if not exists electrical_oscillation_events (
  id bigint generated always as identity primary key,
  timestamp timestamptz not null default now(),
  asset_id text not null,
  class_id text not null,
  -- NORMAL_WAVEFORM | NORMAL_TRANSIENT | RINGING | SUSTAINED_OSCILLATION | CONTROL_HUNTING | MECHANICAL_VIBRATION
  severity text not null default 'normal',
  frequency_hz numeric,
  duration_s numeric,
  decaying boolean,
  control_mode text,
  binary_status text,
  notes text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_elec_osc_events_ts on electrical_oscillation_events(timestamp desc);
create index if not exists idx_elec_osc_events_asset on electrical_oscillation_events(asset_id);
create index if not exists idx_elec_osc_events_class on electrical_oscillation_events(class_id);
