/**
 * Domain information model:
 * Organizations → Projects → Assets/Connections → Telemetry/States → Commands/Alarms/Events → Qualification
 */

export interface Organization {
  org_id: string;
  name: string;
}

export interface Project {
  project_id: string;
  org_id: string;
  name: string;
  qualification_boundary: string;
  status?: string;
}

export interface Asset {
  asset_id: string;
  project_id: string;
  asset_type: string;
  primary_function?: string;
  parent_asset_id?: string | null;
}

export interface AssetConnection {
  source_asset_id: string;
  target_asset_id: string;
  connection_type: string;
  stream_id?: string;
  flow_direction?: string;
}

export interface TelemetrySample {
  timestamp: string;
  project_id: string;
  asset_id: string;
  voltage_v?: number | null;
  current_a?: number | null;
  active_power_kw?: number | null;
  reactive_power_kvar?: number | null;
  frequency_hz?: number | null;
  soc_pct?: number | null;
  binary_status?: string | null;
}

export interface OperatingState {
  asset_id: string;
  project_id: string;
  control_mode?: string | null;
  operating_state?: string | null;
  telemetry_status?: string | null;
  binary_status?: string | null;
  grid_connected?: boolean;
  current_limit_active?: boolean;
}

export interface Command {
  project_id: string;
  source_asset_id?: string;
  target_asset_id: string;
  command: string;
  payload?: Record<string, unknown>;
  status?: string;
}

export interface Alarm {
  project_id: string;
  asset_id?: string;
  alarm_code: string;
  severity: 'info' | 'warn' | 'alarm';
  message?: string;
  active?: boolean;
}

export interface DomainEvent {
  project_id: string;
  asset_id?: string;
  event_type: string;
  summary?: string;
  payload?: Record<string, unknown>;
}

export interface QualificationTest {
  test_id: string;
  project_id: string;
  scenario: string;
  simulation_path?: string;
  pass_criteria?: string;
}

export interface QualificationEvidence {
  test_id: string;
  project_id: string;
  passed: boolean;
  evidence_uri?: string;
  details?: Record<string, unknown>;
}

export const INFORMATION_LAYERS = [
  'organizations',
  'projects',
  'assets_and_connections',
  'telemetry_and_operating_states',
  'commands_alarms_and_events',
  'qualification_tests_and_evidence',
] as const;

export const DEFAULT_ORG: Organization = {
  org_id: 'ORG-TKOW',
  name: 'The Tech King of Wakanada / Flex-Vision',
};

export const DEFAULT_PROJECT: Project = {
  project_id: 'TKOW-FV-BESS-DT-001',
  org_id: 'ORG-TKOW',
  name: 'FlexVision BESS Digital Twin',
  qualification_boundary: 'ac_terminals_pcs_inclusive',
  status: 'active',
};
