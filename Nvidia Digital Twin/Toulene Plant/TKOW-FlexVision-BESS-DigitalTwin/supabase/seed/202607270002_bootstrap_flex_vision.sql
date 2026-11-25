-- ============================================================
-- TKOW / FLEX-VISION BESS DIGITAL TWIN
-- Bootstrap seed: org, project, assets, connections
-- File: supabase/seed/202607270002_bootstrap_flex_vision.sql
--
-- BEFORE RUNNING:
--   1. Apply migration 202607270001_initial_bess_schema.sql
--   2. Create an Auth user in Supabase Dashboard
--   3. Replace REPLACE-WITH-AUTH-USER-UUID below with that user's UUID
-- ============================================================

do $$
declare
  v_user_id uuid := 'REPLACE-WITH-AUTH-USER-UUID';
  v_org_id uuid;
  v_project_id uuid;

  v_grid_id uuid;
  v_transformer_id uuid;
  v_switchgear_id uuid;
  v_bus_id uuid;
  v_bess_id uuid;
  v_pcs_id uuid;
  v_battery_id uuid;
  v_bms_id uuid;
  v_meter_id uuid;
  v_ai_load_id uuid;
begin
  insert into public.profiles (
    id,
    display_name,
    job_title,
    company_name
  )
  values (
    v_user_id,
    'Jaylin Myers',
    'Founder and Systems Engineer',
    'Flex-Vision LLC'
  )
  on conflict (id) do nothing;

  insert into public.organizations (
    name,
    slug,
    description,
    created_by
  )
  values (
    'Flex-Vision LLC',
    'flex-vision',
    'Tech King of Wakanda engineering and digital-twin organization.',
    v_user_id
  )
  returning id into v_org_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role
  )
  values (
    v_org_id,
    v_user_id,
    'owner'
  );

  insert into public.projects (
    organization_id,
    project_code,
    name,
    description,
    status,
    site_name,
    nominal_frequency_hz,
    created_by
  )
  values (
    v_org_id,
    'TKOW-FV-BESS-DT-001',
    'Flex-Vision BESS Digital Twin',
    'Grid-interactive battery and controlled-output electrical digital twin.',
    'planning',
    'Flex-Vision Development Site',
    60.000,
    v_user_id
  )
  returning id into v_project_id;

  insert into public.assets (
    project_id,
    asset_code,
    name,
    asset_type,
    status,
    control_mode
  )
  values (
    v_project_id,
    'GRID-001',
    'Utility Grid',
    'utility_grid',
    'running',
    'grid_following'
  )
  returning id into v_grid_id;

  insert into public.assets (
    project_id,
    asset_code,
    name,
    asset_type,
    status
  )
  values (
    v_project_id,
    'XFMR-001',
    'Site Transformer',
    'transformer',
    'running'
  )
  returning id into v_transformer_id;

  insert into public.assets (
    project_id,
    asset_code,
    name,
    asset_type,
    status
  )
  values (
    v_project_id,
    'SWGR-001',
    'Main Switchgear',
    'switchgear',
    'running'
  )
  returning id into v_switchgear_id;

  insert into public.assets (
    project_id,
    asset_code,
    name,
    asset_type,
    status
  )
  values (
    v_project_id,
    'BUS-001',
    'Site AC Bus',
    'bus',
    'running'
  )
  returning id into v_bus_id;

  insert into public.assets (
    project_id,
    asset_code,
    name,
    asset_type,
    status,
    qualification_boundary
  )
  values (
    v_project_id,
    'BESS-001',
    'Battery Energy Storage System',
    'bess',
    'standby',
    true
  )
  returning id into v_bess_id;

  insert into public.assets (
    project_id,
    parent_asset_id,
    asset_code,
    name,
    asset_type,
    status,
    control_mode,
    qualification_boundary
  )
  values (
    v_project_id,
    v_bess_id,
    'PCS-001',
    'Power Conversion System',
    'pcs',
    'standby',
    'grid_following',
    true
  )
  returning id into v_pcs_id;

  insert into public.assets (
    project_id,
    parent_asset_id,
    asset_code,
    name,
    asset_type,
    status
  )
  values (
    v_project_id,
    v_bess_id,
    'BAT-RACK-001',
    'Battery Rack 001',
    'battery_rack',
    'standby'
  )
  returning id into v_battery_id;

  insert into public.assets (
    project_id,
    parent_asset_id,
    asset_code,
    name,
    asset_type,
    status
  )
  values (
    v_project_id,
    v_battery_id,
    'BMS-001',
    'Battery Management System',
    'bms',
    'standby'
  )
  returning id into v_bms_id;

  insert into public.assets (
    project_id,
    asset_code,
    name,
    asset_type,
    status
  )
  values (
    v_project_id,
    'MTR-001',
    'Revenue-Grade Meter',
    'meter',
    'running'
  )
  returning id into v_meter_id;

  insert into public.assets (
    project_id,
    asset_code,
    name,
    asset_type,
    status
  )
  values (
    v_project_id,
    'LOAD-AI-001',
    'AI Compute Load',
    'ai_compute_load',
    'standby'
  )
  returning id into v_ai_load_id;

  insert into public.asset_connections (
    project_id,
    source_asset_id,
    destination_asset_id,
    connection_type,
    description
  )
  values
    (
      v_project_id,
      v_grid_id,
      v_transformer_id,
      'ac_power',
      'Utility supply to site transformer'
    ),
    (
      v_project_id,
      v_transformer_id,
      v_switchgear_id,
      'ac_power',
      'Transformer output to main switchgear'
    ),
    (
      v_project_id,
      v_switchgear_id,
      v_bus_id,
      'ac_power',
      'Main switchgear to site AC bus'
    ),
    (
      v_project_id,
      v_bus_id,
      v_pcs_id,
      'ac_power',
      'Site AC bus to BESS PCS terminals'
    ),
    (
      v_project_id,
      v_pcs_id,
      v_battery_id,
      'dc_power',
      'Bidirectional DC link between PCS and battery rack'
    ),
    (
      v_project_id,
      v_bms_id,
      v_pcs_id,
      'control',
      'Battery limits and operating permissions'
    ),
    (
      v_project_id,
      v_meter_id,
      v_pcs_id,
      'telemetry',
      'Independent electrical measurement'
    ),
    (
      v_project_id,
      v_bus_id,
      v_ai_load_id,
      'ac_power',
      'Site bus supplying AI compute load'
    );
end;
$$;
