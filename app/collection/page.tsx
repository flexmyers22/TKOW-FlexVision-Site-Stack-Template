import type { Metadata } from 'next'
import { CollectionPage } from '@/components/collection-page'

export const metadata: Metadata = {
  title: 'Collection | Flex-Vision',
  description: 'MM Collection lookbook. Swipe through the Rev A boards and garments added from the registry.',
}

export default function Page() {
  return <CollectionPage />
}
