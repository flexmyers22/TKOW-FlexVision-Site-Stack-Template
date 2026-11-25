import { aboutRecordsCsv } from '@/lib/about'

export const runtime = 'nodejs'

export function GET() {
  return new Response(aboutRecordsCsv(), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="Flex-Vision_About_Records.csv"',
    },
  })
}
