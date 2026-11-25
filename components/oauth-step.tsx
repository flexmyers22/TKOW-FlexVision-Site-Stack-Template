export function oauthStatus(reason: string | null) {
  if (reason === 'mismatch') return 'That Google or Microsoft account does not match the email you entered.'
  if (reason === 'need-password') return 'Enter the email and password first.'
  if (reason === 'unconfigured') return 'That Google or Microsoft sign-in is not connected yet.'
  if (reason === 'denied') return 'The provider sign-in was canceled.'
  if (reason === 'failed') return 'The provider sign-in did not finish.'
  return ''
}

export function ProviderButtons({ from }: { from: 'profile' | 'admin' }) {
  return (
    <div className="oauth-step">
      <a className="btn btn-primary" href={`/v1/auth/oauth/google?from=${from}`}>Continue with Google</a>
      <a className="btn btn-secondary" href={`/v1/auth/oauth/microsoft?from=${from}`}>Continue with Microsoft</a>
    </div>
  )
}
