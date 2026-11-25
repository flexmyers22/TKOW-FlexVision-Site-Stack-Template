'use client'

import { useSearchParams } from 'next/navigation'
import { AboutFrame } from '@/components/about-frame'
import { marketById, markets, reports, workstreamById, workstreams } from '@/lib/about'

export function AboutUpdatesList() {
  const params = useSearchParams()
  const market = params.get('market') ?? ''
  const workstream = params.get('workstream') ?? ''
  const year = params.get('year') ?? ''
  const visible = reports.filter((report) => {
    if (year && !report.quarter_key.startsWith(year)) return false
    if (market && !report.markets.includes(market)) return false
    if (workstream && !report.workstreams.includes(workstream)) return false
    return true
  })
  return (
    <AboutFrame current="updates">
      <div className="wrap about-page">
        <p className="eyebrow">Progress archive</p>
        <h1>Quarterly updates</h1>
        <p className="about-copy">Each report keeps its own period and date. There is no combined progress score. Filter by year, market, or workstream.</p>
        <div className="about-filters" aria-label="Report filters">
          <a href="/about/updates" aria-current={!market && !workstream && !year ? 'true' : undefined}>All</a>
          <a href="/about/updates?year=2026" aria-current={year === '2026' ? 'true' : undefined}>2026</a>
          {markets.map((item) => <a key={item.market_id} href={`/about/updates?market=${item.market_id}`} aria-current={market === item.market_id ? 'true' : undefined}>{item.market_name}</a>)}
          {workstreams.map((item) => <a key={item.workstream_id} href={`/about/updates?workstream=${item.workstream_id}`} aria-current={workstream === item.workstream_id ? 'true' : undefined}>{item.name}</a>)}
        </div>
        <div className="card-grid">
          {visible.length === 0 ? <p>No report matches that filter. Earlier quarters are not recorded.</p> : visible.map((report) => (
            <article className="info-card" key={report.report_id}>
              <p className="about-kicker">{report.overall_status}</p>
              <h3><a href={`/about/updates/${report.quarter_key.toLowerCase()}`}>{report.quarter_key}</a></h3>
              <p>{report.summary}</p>
              <p className="about-meta">Published {report.report_date}. Markets: {report.markets.map((id) => marketById(id)?.market_name).filter(Boolean).join(', ')}. Work: {report.workstreams.map((id) => workstreamById(id)?.name).filter(Boolean).join(', ')}.</p>
            </article>
          ))}
        </div>
        <p className="about-meta"><a href="/about">Back to About</a></p>
      </div>
    </AboutFrame>
  )
}
