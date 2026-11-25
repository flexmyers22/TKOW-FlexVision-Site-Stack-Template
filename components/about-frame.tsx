import { BrandLockup } from '@/components/brand-lockup'

export function AboutFrame({ current, children }: { current?: 'about' | 'updates'; children: React.ReactNode }) {
  return (
    <div className="fv-home">
      <header className="topbar">
        <nav className="nav wrap" aria-label="Main navigation">
          <BrandLockup />
          <div className="nav-links">
            <a href="/newsletter">Newsletter</a>
            <a href="/#team">Team</a>
            <a href="/#services">Services</a>
            <a href="/#products">Products</a>
            <a href="/collection">Collection</a>
            <a href="/about" aria-current={current === 'about' ? 'page' : undefined}>About</a>
            <a href="/ai-chat">AI Chat</a>
          </div>
          <a className="profile" href="/profile">Profile</a>
        </nav>
      </header>
      <main className="section">{children}</main>
    </div>
  )
}
