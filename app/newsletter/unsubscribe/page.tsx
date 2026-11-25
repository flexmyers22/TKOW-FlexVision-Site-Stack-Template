import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { suppressNewsletterRecipient } from '@/lib/server/newsletter-mail'

export const metadata: Metadata = {
  title: 'Unsubscribe | Flex-Vision',
  description: 'Stop Flex-Vision newsletter email for this link.',
}

export const dynamic = 'force-dynamic'

async function unsubscribe(formData: FormData) {
  'use server'
  const result = await suppressNewsletterRecipient(String(formData.get('token') ?? ''))
  redirect(result === 'removed' ? '/newsletter/unsubscribe?done=removed' : '/newsletter/unsubscribe?done=invalid')
}

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const params = await searchParams
  const token = params.token ?? ''
  const ready = token.length > 20
  return (
    <main style={{ maxWidth: 560, margin: '48px auto', padding: '0 20px', fontFamily: 'Arial, sans-serif', color: '#20242b' }}>
      <h1 style={{ fontSize: 32, letterSpacing: '-0.04em' }}>Unsubscribe</h1>
      {params.done === 'removed' ? <p>Newsletter email for this link is stopped. Profile sign-in stays available.</p> : null}
      {params.done === 'invalid' ? <p>This unsubscribe link is not valid. Use the link from a newsletter email.</p> : null}
      {params.done ? null : ready ? (
        <form action={unsubscribe}>
          <p>This stops Flex-Vision newsletter email for the address in this link. Profile sign-in stays available.</p>
          <input type="hidden" name="token" value={token} />
          <button type="submit" style={{ padding: '12px 18px', background: '#111318', color: '#fff', border: 0, fontWeight: 700 }}>Unsubscribe</button>
        </form>
      ) : (
        <p>This unsubscribe link is missing its token. Use the link from a newsletter email.</p>
      )}
    </main>
  )
}
