import type { Metadata } from 'next'
import { AboutFrame } from '@/components/about-frame'
import { company, latestReport, markets, plan, workstreams } from '@/lib/about'

export const metadata: Metadata = {
  title: 'About | Flex-Vision',
  description: 'Flex-Vision company overview, 2026-2030 business plan, and quarterly progress.',
}

export default function AboutPage() {
  const latest = latestReport()
  return (
    <AboutFrame current="about">
      <div className="wrap about-page">
        <p className="eyebrow">Company overview</p>
        <h1>About Flex-Vision</h1>
        <p className="about-lead">{company.purpose}</p>
        <p className="about-copy">{company.overview}</p>
        <p className="about-meta">Last reviewed {company.last_reviewed}. Public claim status: {company.public_claim_status}.</p>
        <div className="actions">
          <a className="btn btn-primary" href={plan.href} download={plan.file_name}>Download the vision</a>
          <a className="btn btn-secondary" href="/about/updates">Read quarterly updates</a>
        </div>

        <section className="about-block" aria-labelledby="work-title">
          <div className="section-head">
            <h2 id="work-title">What we are working on</h2>
            <p>Status uses Planned, In progress, Completed, Paused, or Unknown. Exploratory means the work has not established demand.</p>
          </div>
          <div className="card-grid">
            {workstreams.map((item) => (
              <article className="info-card" key={item.workstream_id}>
                <p className="about-kicker">{item.status}</p>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <p className="about-meta">Updated {item.last_updated}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-block" aria-labelledby="markets-title">
          <div className="section-head">
            <h2 id="markets-title">Markets of focus</h2>
            <p>These labels describe areas of exploration. They are not a claim of traction.</p>
          </div>
          <div className="card-grid">
            {markets.map((item) => (
              <article className="info-card" key={item.market_id}>
                <p className="about-kicker">{item.status}</p>
                <h3><a href={`/about/updates?market=${item.market_id}`}>{item.market_name}</a></h3>
                <p>{item.activity}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-block" aria-labelledby="latest-title">
          <div className="section-head">
            <h2 id="latest-title">Latest quarterly update</h2>
            <p><a href="/about/updates">Open the archive</a></p>
          </div>
          <article className="info-card">
            <p className="about-kicker">{latest.quarter_key} · {latest.overall_status}</p>
            <h3><a href={`/about/updates/${latest.quarter_key.toLowerCase()}`}>{latest.quarter_key} progress</a></h3>
            <p>{latest.summary}</p>
            <p className="about-meta">Reporting period {latest.period_start} to {latest.period_end}. Published {latest.report_date}.</p>
          </article>
        </section>
        <p className="about-meta"><a href="/about/records">Download the About records as CSV</a></p>
      </div>
    </AboutFrame>
  )
}
