import type { Metadata } from 'next'
import { ResetPasswordForm } from '@/components/reset-password-form'

export const metadata: Metadata = {
  title: 'Reset password | Flex-Vision',
  description: 'Set a new password for a Flex-Vision profile.',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />
}
