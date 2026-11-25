-- electrical_assets_seed.sql

insert into electrical_assets (asset_tag, breaker_number, panel_name, load_type, voltage, current, equipment_tag) values
  ('BRK-P101', '12', 'MCC-1', 'motor', 480, 8.5, 'P101'),
  ('BRK-H101', '14', 'MCC-1', 'heater', 480, 4200, 'H101'),
  ('BRK-R101', '16', 'MCC-1', 'auxiliary', 480, 15, 'R101'),
  ('BRK-C101', '18', 'MCC-2', 'motor', 480, 25, 'C101'),
  ('BRK-C102', '20', 'MCC-2', 'motor', 480, 18, 'C102'),
  ('BRK-C103', '22', 'MCC-2', 'motor', 480, 18, 'C103')
on conflict (asset_tag) do nothing;

insert into facility_sites (site_code, site_name, latitude, longitude, elevation_m, areas) values
(
  'TKOW-TOL-PLANT',
  'TKOW Toluene Disproportionation Plant',
  33.123,
  -84.456,
  125.3,
  '["Process Area A", "Tank Farm", "Utilities", "Electrical Substation", "Control Room", "Warehouse"]'::jsonb
)
on conflict (site_code) do nothing;
