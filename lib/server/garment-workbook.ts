import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildWorkbook } from '@/lib/server/xlsx'

const WORKBOOK = path.join(process.cwd(), '.data', 'garment-registry', 'garment-registry.xlsx')
const HEADERS = ['Garment ID', 'Name', 'Category', 'Colorway', 'Status', 'Image', 'Source'] as const

export type GarmentWorkbookRow = {
  garmentId?: string
  title: string
  category: string
  colorway?: string
  status?: string
  image: string
  source?: string
}

export async function writeGarmentWorkbook(additions: GarmentWorkbookRow[]) {
  const rows = [HEADERS, ...additions.map(row => [
    row.garmentId ?? '',
    row.title,
    row.category,
    row.colorway ?? '',
    row.status ?? '',
    row.image,
    row.source ?? '',
  ])]
  const bytes = buildWorkbook([{ name: 'Garments', rows }])
  await mkdir(path.dirname(WORKBOOK), { recursive: true })
  await writeFile(WORKBOOK, bytes)
  return WORKBOOK
}
