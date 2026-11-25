'use client'

import { FormEvent, useState } from 'react'
import { AccountFrame } from '@/components/account-frame'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setStatus('')
    try {
      const response = await fetch('/v1/profile/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ EMAIL: email.trim() }),
      })
      const payload = await response.json().catch(() => ({})) as { message?: string; error?: { message?: string } }
      if (!response.ok) throw new Error(payload.error?.message || 'The reset link could not be sent. Try again.')
      setEmail('')
      setStatus(payload.message || 'If an account uses that email, a reset link is on its way.')
    } catch (problem) {
      setStatus(problem instanceof Error ? problem.message : 'The reset link could not be sent. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AccountFrame title="Forgot password">
      <p className="account-note">Enter the email for your Flex-Vision profile. A reset link comes from no-reply@flexvision.pro and expires in 30 minutes.</p>
      <form onSubmit={(event) => void submit(event)}>
        <label className="account-field" htmlFor="reset-email">Email
          <input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <div className="account-actions">
          <a className="account-link" href="/profile">Back to profile</a>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Sending' : 'Send reset link'}</button>
        </div>
        <p className="account-status" role="status">{status}</p>
      </form>
    </AccountFrame>
  )
}
