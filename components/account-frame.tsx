import { BrandLockup } from '@/components/brand-lockup'

export function AccountFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fv-home">
      <header className="topbar">
        <nav className="nav wrap" aria-label="Main navigation">
          <BrandLockup />
          <div className="nav-links">
            <a href="/#services">Services</a>
            <a href="/collection">Collection</a>
            <a href="/ai-chat">AI Chat</a>
          </div>
          <a className="profile" href="/profile" aria-current={title === 'Profile' ? 'page' : undefined}>Profile</a>
        </nav>
      </header>
      <main className="section">
        <section className="account-card" aria-labelledby="account-title">
          <h1 id="account-title">{title}</h1>
          {children}
        </section>
      </main>
    </div>
  )
}
