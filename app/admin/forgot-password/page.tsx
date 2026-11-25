import type { Metadata } from 'next'
import { AdminForgotPassword } from '@/components/admin-forgot-password'

export const metadata: Metadata = {
  title: 'Forgot password | Flex-Vision',
  description: 'Replace the Flex-Vision admin password.',
}

export default function AdminForgotPasswordPage() {
  return <AdminForgotPassword />
}
