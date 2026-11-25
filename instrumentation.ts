const PULL_EVERY_MS = 60_000

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.VERCEL) return
  const { pullProfileFiles } = await import('./lib/server/profile-entry')
  const pull = () => pullProfileFiles()
    .then((result) => {
      if (result?.changed) console.log(`[profile] pulled ${result.profiles} profiles and ${result.signups} sign-ups into .data/profile`)
    })
    .catch((error) => console.error('[profile] pull failed:', error instanceof Error ? error.message : error))
  void pull()
  setInterval(pull, PULL_EVERY_MS).unref()
}
