export type AboutStatus = 'Planned' | 'In progress' | 'Completed' | 'Paused' | 'Unknown' | 'Exploratory'

export type Workstream = {
  workstream_id: string
  name: string
  description: string
  status: AboutStatus
  last_updated: string
}

export type Market = {
  market_id: string
  market_name: string
  status: AboutStatus
  research_question: string
  activity: string
  observation: string
  confidence: string
}

export type GoalProgress = {
  goal_id: string
  title: string
  baseline: string
  target: string
  result: string
  status: AboutStatus
  narrative: string
  evidence: string
}

export type QuarterlyReport = {
  report_id: string
  quarter_key: string
  period_start: string
  period_end: string
  report_date: string
  author: string
  approver: string
  publication_status: 'Published'
  summary: string
  overall_status: AboutStatus
  goals: GoalProgress[]
  milestones: { milestone: string; planned_date: string; outcome: string; status: AboutStatus }[]
  markets: string[]
  workstreams: string[]
  risks: string
  next: { priority: string; outcome: string; owner: string; due: string }[]
}

export const company = {
  company_id: 'flex-vision',
  display_name: 'Flex-Vision LLC',
  purpose: 'Connect product design, robotics, and manufacturing into a clear path from concept to build.',
  overview: 'Flex-Vision LLC is building a public record of that path: engineering services, a product collection, and an engineering workspace on this website. This overview uses language already published on the site. Revenue, customer counts, signed demand, and market share are not recorded here.',
  last_reviewed: '2026-11-25',
  public_claim_status: 'Approved for public release',
  capabilities: [
    { title: 'Robotics and controls', copy: 'Embedded systems, industrial I/O, machine vision, and automation studies.' },
    { title: 'CAD to manufacturing', copy: 'Coordinate-based concepts, product geometry, drawings, and structured handoffs.' },
    { title: 'Textile and material design', copy: 'Pattern development, process research, and technical product documentation.' },
  ],
}

export const workstreams: Workstream[] = [
  { workstream_id: 'WS-001', name: 'Public website', description: 'Homepage, collection, newsletter, and this About record.', status: 'In progress', last_updated: '2026-11-23' },
  { workstream_id: 'WS-002', name: 'Engineering workspace', description: 'AI chat grounded in the engineering library, with CAD, MATLAB, and credential tools in that workspace.', status: 'In progress', last_updated: '2026-11-23' },
  { workstream_id: 'WS-003', name: 'Product collection', description: 'Garment and product records shown in the collection lookbook.', status: 'In progress', last_updated: '2026-11-23' },
  { workstream_id: 'WS-004', name: 'CAD to manufacturing handoff', description: 'Product workspace records for geometry, drawings, and manufacturing notes. Release status remains proposed until evidence is attached.', status: 'In progress', last_updated: '2026-11-23' },
]

export const markets: Market[] = [
  { market_id: 'MKT-001', market_name: 'Product engineering and manufacturing handoff', status: 'Exploratory', research_question: 'Which product teams need a recorded path from geometry to a manufacturing handoff?', activity: 'The site publishes CAD-to-manufacturing service language and a local product workspace.', observation: 'Validated demand is not recorded.', confidence: 'Exploratory' },
  { market_id: 'MKT-002', market_name: 'Digital twin', status: 'Exploratory', research_question: 'Which equipment and facility reviews should stay beside the engineering record as a digital twin?', activity: 'A digital twin workspace is in development for equipment and facility review.', observation: 'A customer deployment count is not recorded. Surveyed facility coordinates are not recorded as verified.', confidence: 'Exploratory' },
  { market_id: 'MKT-004', market_name: 'Robotics', status: 'Exploratory', research_question: 'Where does a robotics study sit beside the product record?', activity: 'The public site places robotics on the path from concept to build.', observation: 'A deployed robot count is not recorded.', confidence: 'Exploratory' },
  { market_id: 'MKT-005', market_name: 'Controls', status: 'Exploratory', research_question: 'Which control and industrial I/O studies belong with the product handoff?', activity: 'Service language covers embedded systems, industrial I/O, and automation studies.', observation: 'An installed control-system count is not recorded.', confidence: 'Exploratory' },
  { market_id: 'MKT-006', market_name: 'Machine vision', status: 'Exploratory', research_question: 'Where do machine-vision studies belong in the same record as the product?', activity: 'The engineering workspace includes a MATLAB vision section.', observation: 'A customer deployment count is not recorded.', confidence: 'Exploratory' },
  { market_id: 'MKT-003', market_name: 'Textile and material products', status: 'Exploratory', research_question: 'Which material and garment studies should stay in the public collection?', activity: 'The collection publishes garment looks. A We Parlay partner link is on the homepage.', observation: 'A listed partner link is not a measure of sales or a signed commercial result.', confidence: 'Exploratory' },
]

export const plan = {
  plan_id: 'PLAN-2026-2030',
  title: 'Flex-Vision LLC Business Plan 2026-2030',
  edition: '2026-2030',
  release_status: 'Strategic Planning Draft',
  file_name: 'Flex-Vision_Business_Plan_2026-2030.pdf',
  file_type: 'PDF',
  file_size: '84 KB',
  published_on: '2026-11-23',
  approved_by: 'Company owner',
  scope: 'This is the business plan file supplied for download. The document itself is labeled Strategic Planning Draft.',
  href: '/about/Flex-Vision_Business_Plan_2026-2030.pdf',
}

export const reports: QuarterlyReport[] = [
  {
    report_id: 'RPT-2026-Q4',
    quarter_key: '2026-Q4',
    period_start: '2026-10-01',
    period_end: '2026-12-31',
    report_date: '2026-11-23',
    author: 'Flex-Vision LLC',
    approver: 'Company owner',
    publication_status: 'Published',
    overall_status: 'In progress',
    summary: 'This quarter opens the public company record. The website already describes engineering, manufacturing, and material work. Numeric targets, revenue, and customer results on this page are not recorded. The downloadable file is the supplied 2026-2030 business plan.',
    goals: [
      { goal_id: 'GOAL-001', title: 'Publish a supportable company overview', baseline: 'Not recorded', target: 'Not recorded', result: 'About page and public business summary drafted from the existing site language.', status: 'In progress', narrative: 'The overview is public. A later review can replace any sentence that the owner does not want to keep.', evidence: 'Homepage service copy and this About record.' },
      { goal_id: 'GOAL-002', title: 'Keep a quarterly progress archive', baseline: 'Not recorded', target: 'Not recorded', result: '2026-Q4 is the first published report. Earlier quarters are not recorded.', status: 'In progress', narrative: 'Completion is not claimed. The next quarter should compare these priorities with what actually shipped.', evidence: 'This report.' },
      { goal_id: 'GOAL-003', title: 'Record commercial results', baseline: 'Not recorded', target: 'Not recorded', result: 'Not yet measured', status: 'Unknown', narrative: 'Revenue, customer count, and signed agreements are not in the public record.', evidence: 'No evidence attached.' },
    ],
    milestones: [
      { milestone: 'Public About overview', planned_date: '2026-Q4', outcome: 'Page, archive, and public plan download are on the site.', status: 'In progress' },
      { milestone: 'Measured commercial baseline', planned_date: 'Not recorded', outcome: 'Not yet measured', status: 'Unknown' },
    ],
    markets: ['MKT-001', 'MKT-002', 'MKT-004', 'MKT-005', 'MKT-006', 'MKT-003'],
    workstreams: ['WS-001', 'WS-002', 'WS-003', 'WS-004'],
    risks: 'Readers can mistake exploratory market notes for demand. This report keeps those notes labeled Exploratory. Confidential operating detail stays out of the public plan file.',
    next: [
      { priority: 'Review the public summary', outcome: 'Owner confirms which sentences stay public.', owner: 'Company owner', due: '2027-Q1' },
      { priority: 'Fill the first measured baseline', outcome: 'Any commercial number that is approved for public release replaces Not recorded.', owner: 'Not assigned', due: '2027-Q1' },
    ],
  },
]

export function reportByKey(key: string) {
  return reports.find((report) => report.quarter_key.toLowerCase() === key.toLowerCase()) ?? null
}

export function workstreamById(id: string) {
  return workstreams.find((item) => item.workstream_id === id)
}

export function marketById(id: string) {
  return markets.find((item) => item.market_id === id)
}

export function latestReport() {
  return reports[0]
}

export function aboutRecordsCsv() {
  const rows = [
    ['entity', 'id', 'title', 'status', 'date', 'evidence'],
    ['company', company.company_id, company.display_name, company.public_claim_status, company.last_reviewed, 'Homepage service copy'],
    ['plan', plan.plan_id, plan.title, plan.release_status, plan.published_on, plan.file_name],
    ...workstreams.map((item) => ['workstream', item.workstream_id, item.name, item.status, item.last_updated, item.description]),
    ...markets.map((item) => ['market', item.market_id, item.market_name, item.status, company.last_reviewed, item.activity]),
    ...reports.flatMap((report) => report.goals.map((goal) => ['progress', goal.goal_id, goal.title, goal.status, report.quarter_key, goal.evidence])),
  ]
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

function csvCell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
