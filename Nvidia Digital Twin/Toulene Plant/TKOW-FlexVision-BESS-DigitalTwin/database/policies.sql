-- RLS aligned to information hierarchy (enable with auth)

-- alter table organizations enable row level security;
-- alter table projects enable row level security;
-- alter table assets enable row level security;
-- alter table telemetry_samples enable row level security;
-- alter table commands enable row level security;
-- alter table alarms enable row level security;
-- alter table qualification_evidence enable row level security;

-- Example: members read within their org's projects
-- create policy project_read on projects for select to authenticated
--   using (org_id in (select org_id from organization_members where user_id = auth.uid()));
