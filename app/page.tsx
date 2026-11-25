import type { Metadata } from 'next'
import { FlexVisionHome } from '@/components/flexvision-home'

export const metadata: Metadata = {
  title: 'Flex-Vision | Engineering in Motion',
  description: 'Flex-Vision homepage with the TKOW engineering AI chatbot section.',
}

export default function Page() {
  return <FlexVisionHome />
}
