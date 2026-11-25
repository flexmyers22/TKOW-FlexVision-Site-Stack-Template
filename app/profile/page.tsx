import type { Metadata } from 'next'
import { ProfileForm } from '@/components/profile-form'

export const metadata: Metadata = {
  title: 'Profile | Flex-Vision',
  description: 'Profile email and password for Flex-Vision.',
}

export default function ProfilePage() {
  return <ProfileForm />
}
