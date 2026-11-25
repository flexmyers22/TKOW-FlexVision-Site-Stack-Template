-- ============================================================
-- TKOW / FLEX-VISION BESS DIGITAL TWIN
-- Initial Supabase PostgreSQL schema
-- Migration: 202607270001_initial_bess_schema.sql
-- ============================================================

begin;

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- 2. ENUM TYPES
-- ============================================================

create type public.organization_role as enum (
  'owner',
  'administrator',
  'engineer',
  'operator',
  'analyst',
  'viewer'
);

create type public.project_status as enum (
  'planning',
  'design',
  'simulation',
  'commissioning',
  'operational',
  'maintenance',
  'retired'
);

create type public.asset_type as enum (
  'utility_grid',
  'generator',
  'transformer',
  'switchgear',
  'bus',
  'breaker',
  'protection_relay',
  'bess',
  'pcs',
  'battery_rack',
  'battery_module',
  'bms',
  'meter',
  'controller',
  'ai_compute_load',
  'building_load',
  'fan_motor',
  'pump_motor',
  'sensor',
  'gateway',
  'other'
);

create type public.asset_status as enum (
  'offline',
  'standby',
  'starting',
  'running',
  'charging',
  'discharging',
  'limited',
  'warning',
  'fault',
  'tripped',
  'maintenance',
  'unknown'
);

create type public.control_mode as enum (
  'standby',
  'grid_following',
  'grid_forming',
  'islanded',
  'black_start',
  'demand_response',
  'ai_buffering',
  'lvrt',
  'hvrt',
  'current_limit',
  'maintenance',
  'emergency_shutdown'
);

create type public.command_status as enum (
  'pending',
  'accepted',
  'executing',
  'completed',
  'rejected',
  'failed',
  'expired',
  'cancelled'
);

create type public.alarm_severity as enum (
  'info',
  'warning',
  'major',
  'critical',
  'emergency'
);

create type public.alarm_status as enum (
  'active',
  'acknowledged',
  'cleared',
  'suppressed'
);

create type public.test_status as enum (
  'not_started',
  'scheduled',
  'running',
  'passed',
  'failed',
  'exception',
  'cancelled'
);

create type public.evidence_type as enum (
  'raw_csv',
  'plot',
  'pdf_report',
  'excel_workbook',
  'emt_model',
  'cad_model',
  'drawing',
  'certificate',
  'event_log',
  'configuration',
  'state_machine',
  'other'
);

create type public.oscillation_classification as enum (
  'stable',
  'normal_transient',
  'decaying_ringing',
  'sustained_oscillation',
  'control_hunting',
  'mechanical_vibration',
  'unknown'
);

-- ============================================================
-- 3. SHARED UPDATED-AT FUNCTION
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 4. USER PROFILES
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  job_title text,
  company_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ============================================================
-- 5. ORGANIZATIONS AND MEMBERS
-- ============================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create table public.organization_members (
  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  user_id uuid not null
    references auth.users(id) on delete cascade,

  role public.organization_role not null default 'viewer',
  joined_at timestamptz not null default now(),

  primary key (organization_id, user_id)
);

create index organization_members_user_id_idx
  on public.organization_members(user_id);

-- ============================================================
-- 6. PROJECTS
-- ============================================================

create table public.projects (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  project_code text not null,
  name text not null,
  description text,

  status public.project_status not null default 'planning',

  site_name text,
  site_timezone text not null default 'America/New_York',

  nominal_frequency_hz numeric(6,3) not null default 60.000,
  nominal_voltage_v numeric(12,3),

  qualification_standard text
    default 'NVIDIA BESS Self-Qualification Guidelines',

  created_by uuid not null references auth.users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, project_code)
);

create index projects_organization_id_idx
  on public.projects(organization_id);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- ============================================================
-- 7. ASSET REGISTRY
-- ============================================================

create table public.assets (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null
    references public.projects(id) on delete cascade,

  parent_asset_id uuid
    references public.assets(id) on delete set null,

  asset_code text not null,
  name text not null,
  asset_type public.asset_type not null,

  manufacturer text,
  model_number text,
  serial_number text,
  firmware_version text,

  status public.asset_status not null default 'unknown',
  control_mode public.control_mode not null default 'standby',

  rated_power_kw numeric(16,3),
  rated_energy_kwh numeric(16,3),
  rated_voltage_v numeric(12,3),
  rated_current_a numeric(12,3),
  rated_frequency_hz numeric(6,3),

  phase_count smallint
    check (phase_count is null or phase_count in (1, 2, 3)),

  qualification_boundary boolean not null default false,

  geometry_file_url text,
  drawing_file_url text,
  specification_file_url text,

  latitude numeric(9,6),
  longitude numeric(9,6),

  metadata jsonb not null default '{}'::jsonb,

  installed_at timestamptz,
  commissioned_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (project_id, asset_code),

  check (
    latitude is null
    or latitude between -90 and 90
  ),

  check (
    longitude is null
    or longitude between -180 and 180
  )
);

create index assets_project_id_idx
  on public.assets(project_id);

create index assets_parent_asset_id_idx
  on public.assets(parent_asset_id);

create index assets_asset_type_idx
  on public.assets(asset_type);

create index assets_status_idx
  on public.assets(status);

create index assets_metadata_gin_idx
  on public.assets using gin(metadata);

create trigger assets_set_updated_at
before update on public.assets
for each row execute function public.set_updated_at();

-- ============================================================
-- 8. ELECTRICAL CONNECTIONS / DIGITAL-TWIN TOPOLOGY
-- ============================================================

create table public.asset_connections (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null
    references public.projects(id) on delete cascade,

  source_asset_id uuid not null
    references public.assets(id) on delete cascade,

  destination_asset_id uuid not null
    references public.assets(id) on delete cascade,

  connection_type text not null
    check (
      connection_type in (
        'ac_power',
        'dc_power',
        'control',
        'telemetry',
        'mechanical',
        'network',
        'protection'
      )
    ),

  normally_closed boolean,
  nominal_voltage_v numeric(12,3),
  maximum_current_a numeric(12,3),

  description text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  check (source_asset_id <> destination_asset_id),

  unique (
    source_asset_id,
    destination_asset_id,
    connection_type
  )
);

create index asset_connections_project_id_idx
  on public.asset_connections(project_id);

create index asset_connections_source_idx
  on public.asset_connections(source_asset_id);

create index asset_connections_destination_idx
  on public.asset_connections(destination_asset_id);

-- ============================================================
-- 9. TELEMETRY CHANNEL DEFINITIONS
-- ============================================================

create table public.telemetry_channels (
  id uuid primary key default gen_random_uuid(),

  asset_id uuid not null
    references public.assets(id) on delete cascade,

  channel_key text not null,
  display_name text not null,

  unit text,
  data_type text not null default 'numeric'
    check (
      data_type in (
        'numeric',
        'boolean',
        'text',
        'integer',
        'json'
      )
    ),

  minimum_value numeric,
  maximum_value numeric,

  sampling_rate_hz numeric(12,3),
  source_protocol text,
  source_address text,

  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (asset_id, channel_key)
);

create index telemetry_channels_asset_id_idx
  on public.telemetry_channels(asset_id);

create trigger telemetry_channels_set_updated_at
before update on public.telemetry_channels
for each row execute function public.set_updated_at();

-- ============================================================
-- 10. OPERATIONAL TELEMETRY
-- Intended for normal polling, such as 1 Hz to 10 Hz.
-- High-frequency EMT files should be stored externally and
-- referenced from test evidence rather than inserted row by row.
-- ============================================================

create table public.telemetry_readings (
  id bigint generated always as identity primary key,

  project_id uuid not null
    references public.projects(id) on delete cascade,

  asset_id uuid not null
    references public.assets(id) on delete cascade,

  recorded_at timestamptz not null,

  voltage_v numeric(14,4),
  current_a numeric(14,4),

  active_power_kw numeric(16,4),
  reactive_power_kvar numeric(16,4),
  apparent_power_kva numeric(16,4),

  frequency_hz numeric(8,4),
  power_factor numeric(7,5),

  state_of_charge_pct numeric(7,4),
  state_of_health_pct numeric(7,4),

  temperature_c numeric(8,3),

  current_limit_active boolean not null default false,
  breaker_closed boolean,
  grid_connected boolean,

  control_mode public.control_mode,
  asset_status public.asset_status,

  binary_status bit(8) not null default B'00000000',

  quality_code text not null default 'good'
    check (
      quality_code in (
        'good',
        'uncertain',
        'bad',
        'missing',
        'estimated'
      )
    ),

  raw_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  check (
    state_of_charge_pct is null
    or state_of_charge_pct between 0 and 100
  ),

  check (
    state_of_health_pct is null
    or state_of_health_pct between 0 and 100
  ),

  check (
    power_factor is null
    or power_factor between -1 and 1
  )
);

create index telemetry_readings_asset_time_idx
  on public.telemetry_readings(asset_id, recorded_at desc);

create index telemetry_readings_project_time_idx
  on public.telemetry_readings(project_id, recorded_at desc);

create index telemetry_readings_current_limit_idx
  on public.telemetry_readings(asset_id, recorded_at desc)
  where current_limit_active = true;

create index telemetry_readings_raw_payload_gin_idx
  on public.telemetry_readings using gin(raw_payload);

-- ============================================================
-- 11. CURRENT OPERATING STATE
-- One row per asset for fast dashboard reads.
-- ============================================================

create table public.asset_current_state (
  asset_id uuid primary key
    references public.assets(id) on delete cascade,

  project_id uuid not null
    references public.projects(id) on delete cascade,

  recorded_at timestamptz not null,

  status public.asset_status not null,
  control_mode public.control_mode not null,

  voltage_v numeric(14,4),
  current_a numeric(14,4),
  active_power_kw numeric(16,4),
  reactive_power_kvar numeric(16,4),
  frequency_hz numeric(8,4),
  state_of_charge_pct numeric(7,4),
  temperature_c numeric(8,3),

  current_limit_active boolean not null default false,
  grid_connected boolean,
  breaker_closed boolean,

  binary_status bit(8) not null default B'00000000',

  updated_at timestamptz not null default now()
);

create index asset_current_state_project_id_idx
  on public.asset_current_state(project_id);

-- ============================================================
-- 12. FUNCTION TO UPSERT CURRENT STATE
-- ============================================================

create or replace function public.update_asset_current_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.asset_current_state (
    asset_id,
    project_id,
    recorded_at,
    status,
    control_mode,
    voltage_v,
    current_a,
    active_power_kw,
    reactive_power_kvar,
    frequency_hz,
    state_of_charge_pct,
    temperature_c,
    current_limit_active,
    grid_connected,
    breaker_closed,
    binary_status,
    updated_at
  )
  values (
    new.asset_id,
    new.project_id,
    new.recorded_at,
    coalesce(new.asset_status, 'unknown'),
    coalesce(new.control_mode, 'standby'),
    new.voltage_v,
    new.current_a,
    new.active_power_kw,
    new.reactive_power_kvar,
    new.frequency_hz,
    new.state_of_charge_pct,
    new.temperature_c,
    new.current_limit_active,
    new.grid_connected,
    new.breaker_closed,
    new.binary_status,
    now()
  )
  on conflict (asset_id)
  do update set
    project_id = excluded.project_id,
    recorded_at = excluded.recorded_at,
    status = excluded.status,
    control_mode = excluded.control_mode,
    voltage_v = excluded.voltage_v,
    current_a = excluded.current_a,
    active_power_kw = excluded.active_power_kw,
    reactive_power_kvar = excluded.reactive_power_kvar,
    frequency_hz = excluded.frequency_hz,
    state_of_charge_pct = excluded.state_of_charge_pct,
    temperature_c = excluded.temperature_c,
    current_limit_active = excluded.current_limit_active,
    grid_connected = excluded.grid_connected,
    breaker_closed = excluded.breaker_closed,
    binary_status = excluded.binary_status,
    updated_at = now()
  where excluded.recorded_at >= asset_current_state.recorded_at;

  return new;
end;
$$;

create trigger telemetry_update_current_state
after insert on public.telemetry_readings
for each row execute function public.update_asset_current_state();

-- ============================================================
-- 13. CUSTOM TELEMETRY VALUES
-- Supports channels not included in the standard telemetry table.
-- ============================================================

create table public.telemetry_values (
  id bigint generated always as identity primary key,

  channel_id uuid not null
    references public.telemetry_channels(id) on delete cascade,

  recorded_at timestamptz not null,

  numeric_value numeric,
  boolean_value boolean,
  text_value text,
  json_value jsonb,

  quality_code text not null default 'good'
    check (
      quality_code in (
        'good',
        'uncertain',
        'bad',
        'missing',
        'estimated'
      )
    ),

  created_at timestamptz not null default now(),

  check (
    num_nonnulls(
      numeric_value,
      boolean_value,
      text_value,
      json_value
    ) = 1
  )
);

create index telemetry_values_channel_time_idx
  on public.telemetry_values(channel_id, recorded_at desc);

-- ============================================================
-- 14. CONTROL COMMANDS
-- ============================================================

create table public.control_commands (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null
    references public.projects(id) on delete cascade,

  asset_id uuid not null
    references public.assets(id) on delete cascade,

  command_type text not null,

  requested_mode public.control_mode,

  active_power_setpoint_kw numeric(16,4),
  reactive_power_setpoint_kvar numeric(16,4),
  voltage_setpoint_v numeric(14,4),
  frequency_setpoint_hz numeric(8,4),
  soc_target_pct numeric(7,4),
  ramp_rate_kw_per_second numeric(16,4),

  payload jsonb not null default '{}'::jsonb,

  status public.command_status not null default 'pending',

  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),

  accepted_at timestamptz,
  executed_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,

  rejection_reason text,
  failure_reason text,

  check (
    soc_target_pct is null
    or soc_target_pct between 0 and 100
  )
);

create index control_commands_asset_time_idx
  on public.control_commands(asset_id, requested_at desc);

create index control_commands_pending_idx
  on public.control_commands(project_id, requested_at)
  where status in ('pending', 'accepted', 'executing');

-- ============================================================
-- 15. OPERATING EVENTS
-- ============================================================

create table public.operating_events (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null
    references public.projects(id) on delete cascade,

  asset_id uuid
    references public.assets(id) on delete set null,

  event_type text not null,
  event_code text,

  started_at timestamptz not null,
  ended_at timestamptz,

  previous_status public.asset_status,
  new_status public.asset_status,

  previous_mode public.control_mode,
  new_mode public.control_mode,

  description text,
  payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  check (
    ended_at is null
    or ended_at >= started_at
  )
);

create index operating_events_project_time_idx
  on public.operating_events(project_id, started_at desc);

create index operating_events_asset_time_idx
  on public.operating_events(asset_id, started_at desc);

-- ============================================================
-- 16. ALARMS
-- ============================================================

create table public.alarms (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null
    references public.projects(id) on delete cascade,

  asset_id uuid
    references public.assets(id) on delete set null,

  alarm_code text not null,
  title text not null,
  description text,

  severity public.alarm_severity not null,
  status public.alarm_status not null default 'active',

  source text,
  detected_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id),
  cleared_at timestamptz,

  measured_value numeric,
  threshold_value numeric,
  unit text,

  metadata jsonb not null default '{}'::jsonb,

  check (
    cleared_at is null
    or cleared_at >= detected_at
  )
);

create index alarms_project_status_idx
  on public.alarms(project_id, status, detected_at desc);

create index alarms_asset_time_idx
  on public.alarms(asset_id, detected_at desc);

create unique index alarms_one_active_code_per_asset_idx
  on public.alarms(asset_id, alarm_code)
  where status in ('active', 'acknowledged');

-- ============================================================
-- 17. OSCILLATION ANALYSIS
-- ============================================================

create table public.oscillation_analysis (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null
    references public.projects(id) on delete cascade,

  asset_id uuid not null
    references public.assets(id) on delete cascade,

  window_start timestamptz not null,
  window_end timestamptz not null,

  signal_name text not null,
  classification public.oscillation_classification not null,

  dominant_frequency_hz numeric(10,4),
  amplitude numeric(16,6),
  damping_ratio numeric(10,6),
  decay_time_seconds numeric(12,4),

  control_transition_count integer not null default 0,
  current_limit_entry_count integer not null default 0,

  sustained_duration_seconds numeric(12,4),

  confidence_score numeric(6,5),
  analysis_method text,
  notes text,

  result_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  check (window_end > window_start),

  check (
    confidence_score is null
    or confidence_score between 0 and 1
  ),

  check (control_transition_count >= 0),

  check (current_limit_entry_count >= 0)
);

create index oscillation_analysis_asset_time_idx
  on public.oscillation_analysis(asset_id, window_start desc);

create index oscillation_analysis_classification_idx
  on public.oscillation_analysis(
    project_id,
    classification,
    window_start desc
  );

-- ============================================================
-- 18. QUALIFICATION TEST DEFINITIONS
-- ============================================================

create table public.qualification_test_definitions (
  id uuid primary key default gen_random_uuid(),

  test_number smallint not null unique
    check (test_number between 1 and 12),

  test_code text not null unique,
  name text not null,
  objective text not null,

  model_only_allowed boolean not null default false,
  required_sampling_rate_hz numeric(12,3),

  pass_criteria jsonb not null default '[]'::jsonb,
  failure_criteria jsonb not null default '[]'::jsonb,
  required_deliverables jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now()
);

-- ============================================================
-- 19. QUALIFICATION TEST RUNS
-- ============================================================

create table public.qualification_test_runs (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null
    references public.projects(id) on delete cascade,

  test_definition_id uuid not null
    references public.qualification_test_definitions(id),

  asset_id uuid
    references public.assets(id) on delete set null,

  run_number integer not null default 1,
  status public.test_status not null default 'not_started',

  test_environment text
    check (
      test_environment is null
      or test_environment in (
        'bench',
        'hil',
        'factory',
        'field',
        'emt_model',
        'simulation'
      )
    ),

  started_at timestamptz,
  completed_at timestamptz,

  operator_id uuid references auth.users(id),

  configuration jsonb not null default '{}'::jsonb,
  controller_settings jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,

  pass_fail_statement text,
  known_issues text,
  deviations text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    project_id,
    test_definition_id,
    run_number
  ),

  check (
    completed_at is null
    or started_at is null
    or completed_at >= started_at
  )
);

create index qualification_test_runs_project_idx
  on public.qualification_test_runs(project_id);

create trigger qualification_test_runs_set_updated_at
before update on public.qualification_test_runs
for each row execute function public.set_updated_at();

-- ============================================================
-- 20. TEST EVIDENCE
-- ============================================================

create table public.test_evidence (
  id uuid primary key default gen_random_uuid(),

  test_run_id uuid not null
    references public.qualification_test_runs(id) on delete cascade,

  evidence_type public.evidence_type not null,

  title text not null,
  description text,

  storage_bucket text not null default 'qualification-evidence',
  storage_path text not null,

  file_name text not null,
  mime_type text,
  file_size_bytes bigint,

  checksum_sha256 text,
  metadata jsonb not null default '{}'::jsonb,

  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now(),

  unique (storage_bucket, storage_path),

  check (
    file_size_bytes is null
    or file_size_bytes >= 0
  )
);

create index test_evidence_test_run_id_idx
  on public.test_evidence(test_run_id);

-- ============================================================
-- 21. HELPER AUTHORIZATION FUNCTION
-- ============================================================

create or replace function public.is_project_member(
  requested_project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    join public.organization_members om
      on om.organization_id = p.organization_id
    where p.id = requested_project_id
      and om.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_project_role(
  requested_project_id uuid,
  allowed_roles public.organization_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    join public.organization_members om
      on om.organization_id = p.organization_id
    where p.id = requested_project_id
      and om.user_id = (select auth.uid())
      and om.role = any(allowed_roles)
  );
$$;

-- ============================================================
-- 22. ENABLE ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.assets enable row level security;
alter table public.asset_connections enable row level security;
alter table public.telemetry_channels enable row level security;
alter table public.telemetry_readings enable row level security;
alter table public.asset_current_state enable row level security;
alter table public.telemetry_values enable row level security;
alter table public.control_commands enable row level security;
alter table public.operating_events enable row level security;
alter table public.alarms enable row level security;
alter table public.oscillation_analysis enable row level security;
alter table public.qualification_test_definitions enable row level security;
alter table public.qualification_test_runs enable row level security;
alter table public.test_evidence enable row level security;

-- ============================================================
-- 23. PROFILE POLICIES
-- ============================================================

create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- ============================================================
-- 24. ORGANIZATION POLICIES
-- ============================================================

create policy "Members can view organizations"
on public.organizations
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = organizations.id
      and om.user_id = (select auth.uid())
  )
);

create policy "Authenticated users can create organizations"
on public.organizations
for insert
to authenticated
with check (created_by = (select auth.uid()));

create policy "Owners and administrators can update organizations"
on public.organizations
for update
to authenticated
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = organizations.id
      and om.user_id = (select auth.uid())
      and om.role in ('owner', 'administrator')
  )
);

create policy "Members can view organization membership"
on public.organization_members
for select
to authenticated
using (
  exists (
    select 1
    from public.organization_members current_member
    where current_member.organization_id =
          organization_members.organization_id
      and current_member.user_id = (select auth.uid())
  )
);

create policy "Owners and administrators can manage members"
on public.organization_members
for all
to authenticated
using (
  exists (
    select 1
    from public.organization_members current_member
    where current_member.organization_id =
          organization_members.organization_id
      and current_member.user_id = (select auth.uid())
      and current_member.role in ('owner', 'administrator')
  )
)
with check (
  exists (
    select 1
    from public.organization_members current_member
    where current_member.organization_id =
          organization_members.organization_id
      and current_member.user_id = (select auth.uid())
      and current_member.role in ('owner', 'administrator')
  )
);

-- ============================================================
-- 25. PROJECT POLICIES
-- ============================================================

create policy "Members can view projects"
on public.projects
for select
to authenticated
using (public.is_project_member(id));

create policy "Engineers can create projects"
on public.projects
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.organization_members om
    where om.organization_id = projects.organization_id
      and om.user_id = (select auth.uid())
      and om.role in (
        'owner',
        'administrator',
        'engineer'
      )
  )
);

create policy "Engineers can update projects"
on public.projects
for update
to authenticated
using (
  public.has_project_role(
    id,
    array[
      'owner',
      'administrator',
      'engineer'
    ]::public.organization_role[]
  )
);

-- ============================================================
-- 26. PROJECT-SCOPED READ POLICIES
-- ============================================================

create policy "Members can view assets"
on public.assets
for select
to authenticated
using (public.is_project_member(project_id));

create policy "Members can view asset connections"
on public.asset_connections
for select
to authenticated
using (public.is_project_member(project_id));

create policy "Members can view telemetry readings"
on public.telemetry_readings
for select
to authenticated
using (public.is_project_member(project_id));

create policy "Members can view current asset states"
on public.asset_current_state
for select
to authenticated
using (public.is_project_member(project_id));

create policy "Members can view control commands"
on public.control_commands
for select
to authenticated
using (public.is_project_member(project_id));

create policy "Members can view operating events"
on public.operating_events
for select
to authenticated
using (public.is_project_member(project_id));

create policy "Members can view alarms"
on public.alarms
for select
to authenticated
using (public.is_project_member(project_id));

create policy "Members can view oscillation analysis"
on public.oscillation_analysis
for select
to authenticated
using (public.is_project_member(project_id));

create policy "Members can view qualification runs"
on public.qualification_test_runs
for select
to authenticated
using (public.is_project_member(project_id));

-- ============================================================
-- 27. ENGINEERING WRITE POLICIES
-- ============================================================

create policy "Engineers can manage assets"
on public.assets
for all
to authenticated
using (
  public.has_project_role(
    project_id,
    array[
      'owner',
      'administrator',
      'engineer'
    ]::public.organization_role[]
  )
)
with check (
  public.has_project_role(
    project_id,
    array[
      'owner',
      'administrator',
      'engineer'
    ]::public.organization_role[]
  )
);

create policy "Engineers can manage connections"
on public.asset_connections
for all
to authenticated
using (
  public.has_project_role(
    project_id,
    array[
      'owner',
      'administrator',
      'engineer'
    ]::public.organization_role[]
  )
)
with check (
  public.has_project_role(
    project_id,
    array[
      'owner',
      'administrator',
      'engineer'
    ]::public.organization_role[]
  )
);

create policy "Operators can create commands"
on public.control_commands
for insert
to authenticated
with check (
  requested_by = (select auth.uid())
  and public.has_project_role(
    project_id,
    array[
      'owner',
      'administrator',
      'engineer',
      'operator'
    ]::public.organization_role[]
  )
);

create policy "Operators can update commands"
on public.control_commands
for update
to authenticated
using (
  public.has_project_role(
    project_id,
    array[
      'owner',
      'administrator',
      'engineer',
      'operator'
    ]::public.organization_role[]
  )
);

create policy "Operators can acknowledge alarms"
on public.alarms
for update
to authenticated
using (
  public.has_project_role(
    project_id,
    array[
      'owner',
      'administrator',
      'engineer',
      'operator'
    ]::public.organization_role[]
  )
);

create policy "Engineers can manage qualification runs"
on public.qualification_test_runs
for all
to authenticated
using (
  public.has_project_role(
    project_id,
    array[
      'owner',
      'administrator',
      'engineer',
      'analyst'
    ]::public.organization_role[]
  )
)
with check (
  public.has_project_role(
    project_id,
    array[
      'owner',
      'administrator',
      'engineer',
      'analyst'
    ]::public.organization_role[]
  )
);

-- ============================================================
-- 28. CHANNEL AND CUSTOM TELEMETRY POLICIES
-- ============================================================

create policy "Members can view telemetry channels"
on public.telemetry_channels
for select
to authenticated
using (
  exists (
    select 1
    from public.assets a
    where a.id = telemetry_channels.asset_id
      and public.is_project_member(a.project_id)
  )
);

create policy "Engineers can manage telemetry channels"
on public.telemetry_channels
for all
to authenticated
using (
  exists (
    select 1
    from public.assets a
    where a.id = telemetry_channels.asset_id
      and public.has_project_role(
        a.project_id,
        array[
          'owner',
          'administrator',
          'engineer'
        ]::public.organization_role[]
      )
  )
)
with check (
  exists (
    select 1
    from public.assets a
    where a.id = telemetry_channels.asset_id
      and public.has_project_role(
        a.project_id,
        array[
          'owner',
          'administrator',
          'engineer'
        ]::public.organization_role[]
      )
  )
);

create policy "Members can view custom telemetry values"
on public.telemetry_values
for select
to authenticated
using (
  exists (
    select 1
    from public.telemetry_channels tc
    join public.assets a on a.id = tc.asset_id
    where tc.id = telemetry_values.channel_id
      and public.is_project_member(a.project_id)
  )
);

-- ============================================================
-- 29. TEST DEFINITION POLICIES
-- Shared reference data.
-- ============================================================

create policy "Authenticated users can view test definitions"
on public.qualification_test_definitions
for select
to authenticated
using (true);

-- ============================================================
-- 30. TEST EVIDENCE POLICIES
-- ============================================================

create policy "Members can view test evidence"
on public.test_evidence
for select
to authenticated
using (
  exists (
    select 1
    from public.qualification_test_runs qtr
    where qtr.id = test_evidence.test_run_id
      and public.is_project_member(qtr.project_id)
  )
);

create policy "Engineers can add test evidence"
on public.test_evidence
for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1
    from public.qualification_test_runs qtr
    where qtr.id = test_evidence.test_run_id
      and public.has_project_role(
        qtr.project_id,
        array[
          'owner',
          'administrator',
          'engineer',
          'analyst'
        ]::public.organization_role[]
      )
  )
);

commit;
