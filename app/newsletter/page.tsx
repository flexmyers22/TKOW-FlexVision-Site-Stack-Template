import type { Metadata } from 'next'
import { NewsletterPage } from '@/components/newsletter-page'

export const metadata: Metadata = {
  title: 'Newsletter | Flex-Vision',
  description: 'Flex-Vision newsletter editions and log, written from the engineering library.',
}

export default function Page() {
  return <NewsletterPage />
}
