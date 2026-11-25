export const WORKFLOW_PAGES = [
  'Engineering chat',
  'Library',
  'Parts & BOM',
  'CAD queue',
  'MATLAB',
  'Piggybank',
  'Analytics',
] as const

export type WorkflowPage = (typeof WORKFLOW_PAGES)[number]

export function isWorkflowPage(value: string): value is WorkflowPage {
  return WORKFLOW_PAGES.some((page) => page === value)
}
