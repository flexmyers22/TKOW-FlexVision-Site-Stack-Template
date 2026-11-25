import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AboutUpdatesList } from '@/components/about-updates-list'

export const metadata: Metadata = {
  title: 'Quarterly updates | Flex-Vision',
  description: 'Dated archive of Flex-Vision quarterly progress reports.',
}

export default function UpdatesPage() {
  return (
    <Suspense fallback={null}>
      <AboutUpdatesList />
    </Suspense>
  )
}
