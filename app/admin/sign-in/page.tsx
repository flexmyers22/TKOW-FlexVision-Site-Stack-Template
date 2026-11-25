import type { Metadata } from 'next'
import { AdminSignIn } from '@/components/admin-sign-in'

export const metadata: Metadata = {
  title: 'Admin | Flex-Vision',
  description: 'Admin email and password for Flex-Vision.',
}

export default function AdminSignInPage() {
  return <AdminSignIn />
}
