-- ============================================================
-- TKOW / FLEX-VISION BESS DIGITAL TWIN
-- Seed: qualification test definitions (BESS-TEST-01 … 12)
-- File: supabase/seed/202607270003_qualification_test_definitions.sql
--
-- Requires: migrations/202607270001_initial_bess_schema.sql
-- ============================================================

begin;

insert into public.qualification_test_definitions (
  test_number,
  test_code,
  name,
  objective,
  model_only_allowed,
  required_sampling_rate_hz,
  pass_criteria,
  failure_criteria,
  required_deliverables
)
values
(
  1,
  'BESS-TEST-01',
  'Telemetry Verification and Data Integrity',
  'Verify PCS telemetry accuracy, timestamping, and completeness.',
  false,
  10,
  '[
    "P and Q error within required tolerance",
    "Time alignment within required tolerance",
    "No missing or flatlined channels"
  ]'::jsonb,
  '[
    "Missing required channel",
    "Unacceptable measurement error",
    "Unacceptable timestamp misalignment"
  ]'::jsonb,
  '[
    "Raw time-series data",
    "Meter comparison",
    "Pass/fail statement"
  ]'::jsonb
),
(
  2,
  'BESS-TEST-02',
  'Grid-Adaptive Voltage and Frequency Regulation',
  'Demonstrate stable islanded operation without an external grid reference.',
  false,
  10,
  '[
    "Stable voltage and frequency",
    "No sustained oscillation",
    "No protective trip"
  ]'::jsonb,
  '[
    "Control hunting",
    "Marginal stability",
    "Protective trip"
  ]'::jsonb,
  '[
    "Voltage time series",
    "Frequency time series",
    "Control-mode states"
  ]'::jsonb
),
(
  3,
  'BESS-TEST-03',
  'Current Limit Characterization',
  'Demonstrate predictable PCS behavior under active, reactive, and mixed current-priority configurations.',
  false,
  120,
  '[
    "Stable operation during current limit",
    "Current-limit state explicitly reported",
    "Predictable priority behavior"
  ]'::jsonb,
  '[
    "Limit-cycle oscillation",
    "Control-mode hunting",
    "Voltage recovery outside accepted tolerance"
  ]'::jsonb,
  '[
    "P-Q capability map",
    "Annotated time-series plots",
    "Current-limit logic description",
    "EMT analysis"
  ]'::jsonb
),
(
  4,
  'BESS-TEST-04',
  'AI Buffering Proxy Test',
  'Demonstrate fast ramp tracking without control instability.',
  false,
  120,
  '[
    "Ramp tracking within accepted error",
    "No current-limit entry during declared profile",
    "No sustained oscillation"
  ]'::jsonb,
  '[
    "Sustained oscillation",
    "Repeated current-limit entry",
    "Non-decaying ringing",
    "Unexpected control-mode transition"
  ]'::jsonb,
  '[
    "Command profile",
    "P Q V I time series",
    "Current-limit flags",
    "Control-mode flags"
  ]'::jsonb
),
(
  5,
  'BESS-TEST-05',
  'AI Buffering EMT Validation',
  'Validate PCS stability under extreme weak-grid conditions.',
  true,
  5000,
  '[
    "No unstable oscillation modes",
    "No loss of synchronism",
    "No uncontrolled voltage collapse",
    "Controlled current-limit recovery"
  ]'::jsonb,
  '[
    "Oscillation persisting beyond accepted duration",
    "Voltage collapse",
    "Undefined control-state transition",
    "Model instability"
  ]'::jsonb,
  '[
    "EMT model",
    "dq impedance curves",
    "Nyquist or passivity evidence",
    "Model outputs"
  ]'::jsonb
),
(
  6,
  'BESS-TEST-06',
  'Demand Response Dispatch Performance',
  'Verify dispatch execution while preserving buffering and ride-through reserves.',
  false,
  10,
  '[
    "Commanded power achieved in required time",
    "SOC reserve maintained",
    "State-machine priority behavior documented"
  ]'::jsonb,
  '[
    "Reserve violation",
    "Dispatch response failure",
    "Undefined service priority"
  ]'::jsonb,
  '[
    "Dispatch time series",
    "SOC reserve logic",
    "Demand-response state machine"
  ]'::jsonb
),
(
  7,
  'BESS-TEST-07',
  'LVRT and HVRT Functional Ride-Through',
  'Prove voltage ride-through behavior at weak- and strong-grid conditions.',
  false,
  5000,
  '[
    "No trip inside applicable ride-through envelope",
    "Correct trip outside envelope",
    "Reactive support is documented and consistent"
  ]'::jsonb,
  '[
    "Improper protective trip",
    "Failure to support voltage",
    "Undefined reactive-power priority"
  ]'::jsonb,
  '[
    "Voltage profiles",
    "Protection relay states",
    "P Q V I frequency data"
  ]'::jsonb
),
(
  8,
  'BESS-TEST-08',
  'Seamless Grid and Island Transition',
  'Validate transition logic, island stability, resynchronization, and reconnection.',
  false,
  120,
  '[
    "No unstable mode hunting",
    "No uncontrolled frequency drift",
    "Controlled reconnection"
  ]'::jsonb,
  '[
    "Loss of synchronism",
    "Protective trip",
    "Excessive inrush",
    "Improper transition sequence"
  ]'::jsonb,
  '[
    "Transition event log",
    "Voltage and frequency time series",
    "Breaker sequence"
  ]'::jsonb
),
(
  9,
  'BESS-TEST-09',
  'Islanded Operation with Generator Following',
  'Validate interaction between a grid-forming BESS and a following generator.',
  true,
  5000,
  '[
    "No sustained oscillation",
    "Controlled SOC drift",
    "Voltage and frequency remain within declared limits"
  ]'::jsonb,
  '[
    "Unstable source interaction",
    "Uncontrolled SOC drift",
    "Frequency or voltage instability"
  ]'::jsonb,
  '[
    "Generator model",
    "BESS model",
    "AI load disturbance profile",
    "N-1 event results"
  ]'::jsonb
),
(
  10,
  'BESS-TEST-10',
  'Black Start',
  'Demonstrate energization of a dead bus and stable voltage and frequency establishment.',
  false,
  120,
  '[
    "Stable bus energization",
    "No nuisance trips",
    "Voltage and frequency within declared limits"
  ]'::jsonb,
  '[
    "Failure to energize",
    "Unstable voltage or frequency",
    "Protective trip"
  ]'::jsonb,
  '[
    "Black-start sequence",
    "Voltage and frequency plots",
    "Auxiliary supply requirements"
  ]'::jsonb
),
(
  11,
  'BESS-TEST-11',
  'SOC Drift and Combined Energy Management',
  'Demonstrate stable SOC management while supporting buffering, demand response, and ride-through reserves.',
  true,
  10,
  '[
    "SOC remains within declared operating window",
    "Net drift remains within accepted range",
    "Reserve thresholds cause explicit state changes"
  ]'::jsonb,
  '[
    "Unbounded SOC drift",
    "Undefined reserve behavior",
    "Undocumented energy-management behavior"
  ]'::jsonb,
  '[
    "SOC P Q and reserve plots",
    "Energy-balance summary",
    "State-machine diagram",
    "Timestamped event log"
  ]'::jsonb
),
(
  12,
  'BESS-TEST-12',
  'Control Transparency Package Review',
  'Provide models and control artifacts required for site integration and stability review.',
  true,
  null,
  '[
    "Package is complete",
    "Model is runnable",
    "Model behavior is consistent with measurements",
    "Stability evidence is provided"
  ]'::jsonb,
  '[
    "Incomplete model package",
    "Black-box model without stability evidence",
    "Model does not reproduce measured behavior"
  ]'::jsonb,
  '[
    "EMT model",
    "dq or sequence impedance",
    "Nyquist or passivity assessment",
    "Controller description",
    "Parameter list"
  ]'::jsonb
);

commit;
