'use client'

import { FormEvent, useState } from 'react'
import { AccountFrame } from '@/components/account-frame'

export function AdminForgotPassword() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setStatus('')
    try {
      const response = await fetch('/v1/admin/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ EMAIL: email.trim(), Password: password, Confirm: confirm }),
      })
      const payload = await response.json() as { updated?: boolean; error?: { message?: string } }
      if (!response.ok || !payload.updated) {
        throw new Error(payload.error?.message || 'The admin password was not replaced.')
      }
      setPassword('')
      setConfirm('')
      setSaved(true)
      setStatus('The admin password was replaced in the admin entry CSV. Sign in with the new password.')
    } catch (problem) {
      setStatus(problem instanceof Error ? problem.message : 'The admin password was not replaced.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AccountFrame title="Forgot password">
      <p className="account-note">Enter the admin email and a new password. This replaces the password in the base admin CSV and the admin profile folder.</p>
      <form onSubmit={(event) => void submit(event)}>
        <label className="account-field" htmlFor="admin-reset-email">Email
          <input id="admin-reset-email" type="email" autoComplete="username" required placeholder="name@email.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <div className="account-field">
          <label htmlFor="admin-reset-password">New password</label>
          <span className="password-line">
            <input id="admin-reset-password" type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
            <button type="button" aria-pressed={visible} onClick={() => setVisible((current) => !current)}>{visible ? 'Hide' : 'Show'}</button>
          </span>
        </div>
        <label className="account-field" htmlFor="admin-reset-confirm">Confirm password
          <input id="admin-reset-confirm" type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </label>
        <div className="account-actions">
          <a className="account-link" href="/admin/sign-in">Back to admin sign-in</a>
          <button className="btn btn-primary" type="submit" disabled={busy || saved}>{busy ? 'Saving password' : 'Save new password'}</button>
        </div>
        <p className="account-status" role="status">{status}</p>
      </form>
    </AccountFrame>
  )
}
