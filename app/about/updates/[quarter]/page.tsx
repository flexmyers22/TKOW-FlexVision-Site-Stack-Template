import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AboutFrame } from '@/components/about-frame'
import { marketById, reportByKey, reports, workstreamById } from '@/lib/about'

export function generateStaticParams() {
  return reports.map((report) => ({ quarter: report.quarter_key.toLowerCase() }))
}

export async function generateMetadata({ params }: { params: Promise<{ quarter: string }> }): Promise<Metadata> {
  const { quarter } = await params
  const report = reportByKey(quarter)
  return { title: report ? `${report.quarter_key} progress | Flex-Vision` : 'Quarterly update | Flex-Vision' }
}

export default async function ReportPage({ params }: { params: Promise<{ quarter: string }> }) {
  const { quarter } = await params
  const report = reportByKey(quarter)
  if (!report) notFound()
  return (
    <AboutFrame current="updates">
      <div className="wrap about-page">
        <p className="eyebrow">Quarterly report</p>
        <h1>{report.quarter_key}</h1>
        <p className="about-meta">{report.period_start} to {report.period_end}. Published {report.report_date}. {report.publication_status}. Author {report.author}. Approver {report.approver}.</p>
        <p className="about-lead">{report.summary}</p>
        <p className="about-kicker">Overall status: {report.overall_status}</p>

        <section className="about-block" aria-labelledby="goals-title">
          <h2 id="goals-title">Goal movement</h2>
          {report.goals.map((goal) => (
            <article className="info-card about-record" key={goal.goal_id}>
              <p className="about-kicker">{goal.goal_id} · {goal.status}</p>
              <h3>{goal.title}</h3>
              <p>Baseline: {goal.baseline}. Target: {goal.target}. Current result: {goal.result}</p>
              <p>{goal.narrative}</p>
              <p className="about-meta">Evidence: {goal.evidence}</p>
            </article>
          ))}
        </section>

        <section className="about-block" aria-labelledby="milestones-title">
          <h2 id="milestones-title">Milestones</h2>
          {report.milestones.map((item) => (
            <article className="info-card about-record" key={item.milestone}>
              <p className="about-kicker">{item.status} · planned {item.planned_date}</p>
              <h3>{item.milestone}</h3>
              <p>{item.outcome}</p>
            </article>
          ))}
        </section>

        <section className="about-block" aria-labelledby="activity-title">
          <h2 id="activity-title">Markets and workstreams</h2>
          {report.markets.map((id) => {
            const market = marketById(id)
            if (!market) return null
            return <article className="info-card about-record" key={id}><p className="about-kicker">{market.status}</p><h3>{market.market_name}</h3><p>{market.activity}</p><p className="about-meta">Confidence: {market.confidence}</p></article>
          })}
          {report.workstreams.map((id) => {
            const item = workstreamById(id)
            if (!item) return null
            return <article className="info-card about-record" key={id}><p className="about-kicker">{item.workstream_id} · {item.status}</p><h3>{item.name}</h3><p>{item.description}</p></article>
          })}
        </section>

        <section className="about-block" aria-labelledby="risk-title">
          <h2 id="risk-title">Risks and next quarter</h2>
          <article className="info-card about-record"><h3>Public-safe risk</h3><p>{report.risks}</p></article>
          {report.next.map((item) => (
            <article className="info-card about-record" key={item.priority}>
              <p className="about-kicker">Planned · {item.due}</p>
              <h3>{item.priority}</h3>
              <p>{item.outcome}</p>
              <p className="about-meta">Owner: {item.owner}</p>
            </article>
          ))}
        </section>
        <p className="about-meta"><a href="/about/updates">Back to the archive</a> · <a href="/about">About</a></p>
      </div>
    </AboutFrame>
  )
}
