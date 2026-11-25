'use client'

import { FormEvent, useEffect, useState } from 'react'
import { AccountFrame } from '@/components/account-frame'
import { ProviderButtons, oauthStatus } from '@/components/oauth-step'

export function AdminSignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<'password' | 'oauth'>('password')

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('oauth')
    const message = oauthStatus(reason)
    if (message) setStatus(message)
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setStatus('')
    try {
      const response = await fetch('/v1/admin/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ EMAIL: email.trim(), Password: password }),
      })
      const payload = await response.json() as { access?: boolean; step?: string; error?: { message?: string } }
      if (response.ok && payload.step === 'oauth') {
        setPassword('')
        setVisible(false)
        setStep('oauth')
        setBusy(false)
        return
      }
      if (!response.ok || !payload.access) {
        throw new Error(payload.error?.message || 'That email and password do not match the admin entry.')
      }
      setPassword('')
      setVisible(false)
      window.location.assign('/admin')
    } catch (problem) {
      setStatus(problem instanceof Error ? problem.message : 'The admin entry could not be checked.')
      setBusy(false)
    }
  }

  return (
    <AccountFrame title="Admin">
      <p className="account-note">{step === 'oauth' ? 'Password matched. Continue with Google or Microsoft using that same email.' : 'Enter the admin email and password. The second step is a Google or Microsoft account with that same email.'}</p>
      {step === 'oauth' ? <ProviderButtons from="admin" /> : <form onSubmit={(event) => void submit(event)}>
        <label className="account-field" htmlFor="admin-email">Email
          <input id="admin-email" type="email" autoComplete="username" required placeholder="name@email.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <div className="account-field">
          <label htmlFor="admin-password">Password</label>
          <span className="password-line">
            <input id="admin-password" type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            <button type="button" aria-pressed={visible} onClick={() => setVisible((current) => !current)}>{visible ? 'Hide' : 'Show'}</button>
          </span>
        </div>
        <div className="account-actions">
          <a className="account-link" href="/admin/forgot-password">Forgot password</a>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Checking entry' : 'Continue'}</button>
        </div>
        <p className="account-status" role="status">{status}</p>
      </form>}
      {step === 'password' ? <ProviderButtons from="admin" /> : null}
      {step === 'oauth' ? <p className="account-status" role="status">{status}</p> : null}
    </AccountFrame>
  )
}
