'use client'

import { FormEvent, useEffect, useState } from 'react'
import { AccountFrame } from '@/components/account-frame'
import { ProviderButtons, oauthStatus } from '@/components/oauth-step'

type Mode = 'sign-in' | 'sign-up'

export function ProfileForm() {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [visible, setVisible] = useState(false)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<'password' | 'oauth'>('password')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('mode') === 'sign-up') setMode('sign-up')
    const message = oauthStatus(params.get('oauth'))
    if (message) setStatus(message)
  }, [])

  function switchMode(next: Mode) {
    setMode(next)
    setStatus('')
    setPassword('')
    setConfirm('')
    setVisible(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mode === 'sign-up' && password !== confirm) {
      setStatus('The two passwords do not match.')
      return
    }
    setBusy(true)
    setStatus('')
    try {
      const response = await fetch('/v1/profile/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, EMAIL: email.trim(), Password: password, ...(mode === 'sign-up' ? { Confirm: confirm } : {}) }),
      })
      const payload = await response.json().catch(() => ({})) as { access?: boolean; step?: string; error?: { code?: string; message?: string } }
      if (response.ok && payload.step === 'oauth') {
        setPassword('')
        setConfirm('')
        setVisible(false)
        setStep('oauth')
        setBusy(false)
        return
      }
      if (!response.ok || !payload.access) {
        if (payload.error?.code === 'not_found' || payload.error?.code === 'exists') setMode(payload.error.code === 'not_found' ? 'sign-up' : 'sign-in')
        throw new Error(payload.error?.message || 'The profile could not be checked.')
      }
      setPassword('')
      setConfirm('')
      setVisible(false)
      window.location.assign('/')
    } catch (problem) {
      setStatus(problem instanceof Error ? problem.message : 'The profile could not be checked.')
      setBusy(false)
    }
  }

  const signUp = mode === 'sign-up'
  return (
    <AccountFrame title={signUp ? 'Create account' : 'Profile'}>
      {step === 'oauth' ? null : (
        <div className="account-tabs" role="tablist" aria-label="Profile access">
          <button type="button" role="tab" aria-selected={!signUp} onClick={() => switchMode('sign-in')}>Sign in</button>
          <button type="button" role="tab" aria-selected={signUp} onClick={() => switchMode('sign-up')}>Create account</button>
        </div>
      )}
      <p className="account-note">{step === 'oauth'
        ? 'Password matched. Continue with Google or Microsoft using that same email.'
        : signUp
          ? 'Use a full email address and a password of at least 8 characters.'
          : 'Sign in with the email and password for your Flex-Vision account.'}</p>
      {step === 'oauth' ? <ProviderButtons from="profile" /> : <form onSubmit={(event) => void submit(event)}>
        <label className="account-field" htmlFor="profile-email">Email
          <input id="profile-email" type="email" autoComplete="email" required placeholder="name@email.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <div className="account-field">
          <label htmlFor="profile-password">Password</label>
          <span className="password-line">
            <input id="profile-password" type={visible ? 'text' : 'password'} autoComplete={signUp ? 'new-password' : 'current-password'} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
            <button type="button" aria-pressed={visible} onClick={() => setVisible((current) => !current)}>{visible ? 'Hide' : 'Show'}</button>
          </span>
        </div>
        {signUp ? (
          <label className="account-field" htmlFor="profile-confirm">Confirm password
            <input id="profile-confirm" type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </label>
        ) : null}
        <div className="account-actions">
          {signUp ? <span /> : <a className="account-link" href="/forgot-password">Forgot password</a>}
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? (signUp ? 'Creating account' : 'Checking') : (signUp ? 'Create account' : 'Sign in')}</button>
        </div>
        <p className="account-status" role="status">{status}</p>
      </form>}
      {step === 'password' && !signUp ? <ProviderButtons from="profile" /> : null}
      {step === 'oauth' ? <p className="account-status" role="status">{status}</p> : null}
    </AccountFrame>
  )
}
