const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export function resetEmailReady() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM?.trim())
}

export function siteOrigin(request: Request) {
  const url = new URL(request.url)
  if (LOCAL_HOSTS.has(url.hostname)) return url.origin
  return (process.env.SITE_URL?.trim() || 'https://www.flexvision.pro').replace(/\/+$/, '')
}

export async function sendResetEmail(to: string, link: string) {
  const text = [
    'A password reset was requested for your Flex-Vision profile.',
    '',
    `Set a new password here: ${link}`,
    '',
    'The link works once and expires in 30 minutes. If you did not ask for this, ignore this email and your password stays the same.',
  ].join('\n')
  const html = `<div style="font-family:Arial,sans-serif;color:#111318;line-height:1.5">
<p>A password reset was requested for your Flex-Vision profile.</p>
<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#111318;color:#ffffff;text-decoration:none;border-radius:6px">Set a new password</a></p>
<p style="color:#555">The link works once and expires in 30 minutes. If you did not ask for this, ignore this email and your password stays the same.</p>
</div>`
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.RESEND_FROM?.trim(), to: [to], subject: 'Reset your Flex-Vision password', text, html }),
  })
  if (!response.ok) throw new Error(`Resend returned ${response.status}: ${(await response.text()).slice(0, 300)}`)
}
