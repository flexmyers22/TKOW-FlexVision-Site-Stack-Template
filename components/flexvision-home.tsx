'use client'

import { useEffect, useState } from 'react'
import { BrandLockup } from '@/components/brand-lockup'
import { company, latestReport, plan } from '@/lib/about'

const STORAGE_KEY = 'flexVisionPageContentV2'

const DEFAULTS = {
  navNewsletter: 'Newsletter',
  navTeam: 'Team',
  navServices: 'Services',
  navProducts: 'Products',
  navAbout: 'About',
  navAiChat: 'AI Chat',
  navProfile: 'Profile',
  heroEyebrow: 'Engineering • AI • Manufacturing',
  heroTitle: 'Ideas move from grid to machine.',
  heroCopy: 'Flex‑Vision connects product design, robotics, and manufacturing into a clear path from concept to build.',
  heroPrimary: 'Explore services',
  heroSecondary: 'Meet Flex‑Vision',
  heroCaptionOne: 'Design systems',
  heroCaptionTwo: 'Build intelligence',
  servicesTitle: 'What we build',
  servicesCopy: 'Connect engineering knowledge to practical tools, digital workflows, and production-ready decisions.',
  serviceOneTitle: 'Robotics & controls',
  serviceOneCopy: 'Embedded systems, industrial I/O, machine vision, and automation studies.',
  serviceTwoTitle: 'CAD to manufacturing',
  serviceTwoCopy: 'Coordinate-based concepts, product geometry, drawings, and structured handoffs.',
  serviceThreeTitle: 'Textile & material design',
  serviceThreeCopy: 'Pattern development, process research, and technical product documentation.',
  showcaseEyebrow: 'The Flex‑Vision workflow',
  showcaseTitle: 'One connected view of the work.',
  showcaseCopy: 'Use this feature panel for the current project, a product collection, or an engineering-library highlight. Replace the art panel with a selected image from the local source folder.',
  showcaseButton: 'View the banner section',
  aiEyebrow: 'TKOW engineering workspace',
  aiTitle: 'AI chatbot',
  aiCopy: 'This section is the engineering chat. Ask from project evidence, review the library, and use the MATLAB, credential, and piggybank tools in that workspace.',
  aiButton: 'Open AI chatbot',
  bannerLabel: 'Flex‑Vision • Engineering in motion',
  footerCompany: 'Flex‑Vision LLC',
}

export function FlexVisionHome() {
  const [values, setValues] = useState(DEFAULTS)
  const [year, setYear] = useState<number | null>(null)

  useEffect(() => {
    setYear(new Date().getFullYear())
    const saved = readSavedContent()
    if (saved) setValues((current) => ({ ...current, ...saved }))
  }, [])

  return (
    <div className="fv-home">
      <div className="site-shell">
        <header className="topbar">
          <nav className="nav wrap" aria-label="Main navigation">
            <BrandLockup homeHref="#home" />
            <div className="nav-links">
              <a href="/newsletter">{values.navNewsletter}</a>
              <a href="#team">{values.navTeam}</a>
              <a href="#services">{values.navServices}</a>
              <a href="#products">{values.navProducts}</a>
              <a href="/collection">Collection</a>
              <a href="/about">{values.navAbout}</a>
              <a href="/ai-chat">{values.navAiChat}</a>
            </div>
            <a className="profile" href="/profile">{values.navProfile}</a>
          </nav>
        </header>
        <main id="home">
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-grid wrap">
              <div>
                <p className="eyebrow">{values.heroEyebrow}</p>
                <h1 id="hero-title">{values.heroTitle}</h1>
                <p className="hero-copy">{values.heroCopy}</p>
                <div className="actions">
                  <a className="btn btn-primary" href="#services">{values.heroPrimary}</a>
                  <a className="btn btn-secondary" href="/about">{values.heroSecondary}</a>
                </div>
              </div>
              <div className="feature-visual" role="img" aria-label="Abstract engineering and motion graphic">
                <div className="orbit"><div className="orbit-core"><img src="/logos/flexvision-mark.png" alt="" /></div></div>
                <div className="visual-caption"><span>{values.heroCaptionOne}</span><span>{values.heroCaptionTwo}</span></div>
              </div>
            </div>
          </section>
          <section className="section" id="services">
            <div className="wrap">
              <div className="section-head">
                <h2>{values.servicesTitle}</h2>
                <p>{values.servicesCopy}</p>
              </div>
              <div className="card-grid">
                <article className="info-card" id="team"><span className="card-index">01</span><h3>{values.serviceOneTitle}</h3><p>{values.serviceOneCopy}</p></article>
                <article className="info-card" id="products"><span className="card-index">02</span><h3>{values.serviceTwoTitle}</h3><p>{values.serviceTwoCopy}</p></article>
                <article className="info-card" id="materials"><span className="card-index">03</span><h3>{values.serviceThreeTitle}</h3><p>{values.serviceThreeCopy}</p></article>
              </div>
              <a className="ad-slot" href="/product-payment" aria-label="We Parlay partner. Product inventory and payment.">
                <img src="/logos/weparlay.png" alt="We Parlay" />
                <span>Partner<strong>Product inventory and payment</strong></span>
              </a>
            </div>
          </section>
          <section className="showcase" id="about">
            <div className="showcase-panel wrap">
              <div>
                <p className="eyebrow" style={{ color: '#20242B' }}>About Flex-Vision</p>
                <h2>{company.purpose}</h2>
                <p>The downloadable vision is the {plan.edition} business plan. The latest progress report is {latestReport().quarter_key}. Unmeasured results on this site stay labeled, not filled in.</p>
                <div className="actions">
                  <a className="btn btn-primary" href="/about">Read the company overview</a>
                  <a className="btn btn-secondary" href={plan.href} download={plan.file_name}>Download the vision</a>
                </div>
              </div>
              <div className="showcase-art workflow-board">
                <img src="/lookbook/hoodie-series.jpg" alt="Flexprint hoodie series in Desert Sand, Olive Field, Terracotta, Stone Gray, and Earth Mix" />
              </div>
            </div>
          </section>
          <section className="section" id="ai-chatbot" aria-labelledby="ai-chat-title">
            <div className="wrap">
              <div className="showcase-panel chat-panel">
                <div>
                  <p className="eyebrow">{values.aiEyebrow}</p>
                  <h2 id="ai-chat-title">{values.aiTitle}</h2>
                  <p>{values.aiCopy}</p>
                  <ul className="chat-points">
                    <li>Engineering chat with the selected model</li>
                    <li>Library, CAD queue, and MATLAB vision</li>
                    <li>Credential library and piggybank keypad ledger</li>
                  </ul>
                  <a className="btn btn-primary" href="/ai-chat">{values.aiButton}</a>
                </div>
                <div className="showcase-art workspace-board">
                  <img src="/lookbook/workspace-geometry.png" alt="Geometric construction study on a pale field" />
                </div>
              </div>
            </div>
          </section>
          <section className="banner" id="banner" aria-label="Flex-Vision geometric banner">
            <div className="banner-label">{values.bannerLabel}</div>
          </section>
        </main>
        <footer className="footer">
          <div className="footer-inner wrap">
            <span>© {year ?? ''} {values.footerCompany}</span>
            {process.env.NODE_ENV !== 'production' ? <a className="footer-admin" href="http://127.0.0.1:3000/admin">Admin</a> : null}
            <div className="footer-partners">
              <span>Partners</span>
              <a href="https://weparlay.us/" target="_blank" rel="noopener noreferrer" aria-label="We Parlay website">
                <img src="/logos/weparlay.png" alt="We Parlay" />
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

function readSavedContent() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const saved: Partial<typeof DEFAULTS> = {}
    for (const key of Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]) {
      const value = (parsed as Record<string, unknown>)[key]
      if (typeof value === 'string') saved[key] = value
    }
    return saved
  } catch {
    return null
  }
}
