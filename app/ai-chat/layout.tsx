import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI chatbot | Flex-Vision',
  description: 'TKOW engineering AI chatbot for evidence, CAD, MATLAB, credentials, and the savings ledger.',
}

export default function AiChatLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
