import type { Metadata } from 'next'
import { ForgotPasswordForm } from '@/components/forgot-password-form'

export const metadata: Metadata = {
  title: 'Forgot password | Flex-Vision',
  description: 'Request a reset for a Flex-Vision profile password.',
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
