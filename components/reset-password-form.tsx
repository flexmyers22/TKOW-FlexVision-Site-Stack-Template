'use client'

import { FormEvent, useEffect, useState } from 'react'
import { AccountFrame } from '@/components/account-frame'

export function ResetPasswordForm() {
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('token') ?? ''
    setToken((current) => current || value)
    if (value) window.history.replaceState(null, '', '/reset-password')
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirm) {
      setStatus('The two passwords do not match.')
      return
    }
    setBusy(true)
    setStatus('')
    try {
      const response = await fetch('/v1/profile/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, Password: password, Confirm: confirm }),
      })
      const payload = await response.json().catch(() => ({})) as { updated?: boolean; error?: { message?: string } }
      if (!response.ok || !payload.updated) throw new Error(payload.error?.message || 'The password could not be reset. Try again.')
      setPassword('')
      setConfirm('')
      setVisible(false)
      setDone(true)
    } catch (problem) {
      setStatus(problem instanceof Error ? problem.message : 'The password could not be reset. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (token === null) return <AccountFrame title="Reset password"><p className="account-note">Loading the reset link.</p></AccountFrame>

  if (done || !token) {
    return (
      <AccountFrame title="Reset password">
        <p className="account-note">{done
          ? 'Your password is updated. Sign in with the new password.'
          : 'Open this page from the link in your reset email, or request a new link.'}</p>
        <div className="account-actions">
          <a className="account-link" href="/forgot-password">Request a new link</a>
          <a className="btn btn-primary" href="/profile">Go to sign in</a>
        </div>
      </AccountFrame>
    )
  }

  return (
    <AccountFrame title="Reset password">
      <p className="account-note">Choose a new password of at least 8 characters.</p>
      <form onSubmit={(event) => void submit(event)}>
        <div className="account-field">
          <label htmlFor="reset-password">New password</label>
          <span className="password-line">
            <input id="reset-password" type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
            <button type="button" aria-pressed={visible} onClick={() => setVisible((current) => !current)}>{visible ? 'Hide' : 'Show'}</button>
          </span>
        </div>
        <label className="account-field" htmlFor="reset-confirm">Confirm new password
          <input id="reset-confirm" type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </label>
        <div className="account-actions">
          <a className="account-link" href="/forgot-password">Request a new link</a>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving' : 'Save new password'}</button>
        </div>
        <p className="account-status" role="status">{status}</p>
      </form>
    </AccountFrame>
  )
}
