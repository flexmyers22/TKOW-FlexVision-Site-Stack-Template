import { BrandLockup } from '@/components/brand-lockup'
import { NEWSLETTER_HEADER, publishedEditions, type NewsletterEdition } from '@/lib/server/newsletter'

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']

function formatDate(date: string, month: 'long' | 'short') {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month, day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function editionCount(count: number) {
  const word = COUNT_WORDS[count] ?? String(count)
  return `${word} ${count === 1 ? 'edition' : 'editions'} from the library.`
}

function sourceLine(edition: NewsletterEdition) {
  if (!edition.citations.length) return ''
  return `Sources: ${edition.citations.map((citation) => `${citation.path} · ${citation.section}`).join('; ')}`
}

export async function NewsletterPage() {
  const editions = await publishedEditions()
  const lead = editions[0]
  const quoted = editions.find((edition) => edition.quote)
  return (
    <div className="fv-home">
      <header className="topbar">
        <nav className="nav wrap" aria-label="Main navigation">
          <BrandLockup />
          <div className="nav-links">
            <a href="/newsletter" aria-current="page">Newsletter</a>
            <a href="/#team">Team</a>
            <a href="/#services">Services</a>
            <a href="/#products">Products</a>
            <a href="/collection">Collection</a>
            <a href="/about">About</a>
            <a href="/ai-chat">AI Chat</a>
          </div>
          <a className="profile" href="/profile">Profile</a>
        </nav>
      </header>
      <main className="section" id="newsletter">
        <div className="wrap">
          <article className="newsletter-doc" aria-labelledby="newsletter-title">
            <header className="doc-banner">
              <img className="doc-banner-image" src={NEWSLETTER_HEADER.src} alt={NEWSLETTER_HEADER.alt} />
              <div className="doc-banner-bar">
                <a className="doc-brand" href="/">Flex-Vision</a>
                <span className="doc-issue">{lead ? `${formatDate(lead.date, 'long')} · Published` : 'No published edition'}</span>
              </div>
            </header>
            <section className="doc-body">
              <p className="eyebrow">Flex-Vision Newsletter</p>
              <h1 id="newsletter-title">{lead ? lead.title : 'No published edition'}</h1>
              <p className="doc-kicker">{editionCount(editions.length)}</p>
              {lead ? (
                <>
                  <p className="hero-copy">{lead.lead}</p>
                  <ul className="doc-highlights">
                    {editions.slice(0, 3).map((edition) => (
                      <li key={edition.id}><a href={`#edition-${edition.id}`}>{edition.summary}</a></li>
                    ))}
                  </ul>
                  <a className="doc-cta" href="#newsletter-log">View More Newsletter</a>
                </>
              ) : (
                <p className="hero-copy">Each edition is one engineering-library article. New editions are drafted from cited library passages and approved in the admin portal before they appear here.</p>
              )}
            </section>
            {lead ? (
              <section className="doc-content">
                <div className="doc-section-title">
                  <h3>In this issue</h3>
                  <a href="#newsletter-log">View log</a>
                </div>
                {editions.map((edition, index) => (
                  <article className={`doc-story${edition.image ? ' has-image' : ''}`} id={`edition-${edition.id}`} key={edition.id}>
                    <div className="doc-number">{String(index + 1).padStart(2, '0')}</div>
                    <div>
                      <h4>{edition.title}</h4>
                      <p>{edition.category} · {formatDate(edition.date, 'short')}. {edition.summary}</p>
                    </div>
                    {edition.image ? <img className="doc-thumb" src={edition.image.src} alt="" loading="lazy" /> : null}
                  </article>
                ))}
                {quoted?.quote ? (
                  <blockquote className="doc-quote">
                    {quoted.quote.text}
                    <cite>{quoted.quote.cite}</cite>
                  </blockquote>
                ) : null}
                <h2 className="newsletter-log-title" id="newsletter-log">Newsletter log</h2>
                <div className="newsletter-log-wrap">
                  <table className="newsletter-log">
                    <thead>
                      <tr>
                        <th scope="col">Title</th>
                        <th scope="col">Description</th>
                        <th scope="col">Category</th>
                        <th scope="col">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editions.map((edition) => (
                        <tr key={edition.id}>
                          <td>{edition.title}</td>
                          <td>{edition.description}</td>
                          <td>{edition.category}</td>
                          <td>{formatDate(edition.date, 'short')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="newsletter-sources">{sourceLine(lead)}</p>
              </section>
            ) : null}
            <footer className="doc-footer">
              <p>Social links are not configured.</p>
              <p>AI chatbot — planned</p>
              <nav className="doc-footer-links" aria-label="Newsletter footer">
                <a href="/profile">Email preferences</a>
                <a href="/">Home</a>
                <a href="/collection">Collection</a>
              </nav>
              <p className="doc-fine">© Flex-Vision LLC. A mailing address is not recorded on this site.</p>
            </footer>
          </article>
        </div>
      </main>
    </div>
  )
}
