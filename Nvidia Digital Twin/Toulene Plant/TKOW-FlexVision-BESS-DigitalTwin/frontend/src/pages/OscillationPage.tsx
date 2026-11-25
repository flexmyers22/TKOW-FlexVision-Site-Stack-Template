import { useApi } from '../hooks/useApi';

export function OscillationPage() {
  const { data } = useApi<{
    pipeline: string[];
    verdict: string;
    detail_class: string;
    set_warn_bit: boolean;
  }>('/api/oscillation/latest');

  const cls =
    data?.verdict === 'UNSTABLE' || data?.verdict === 'HUNTING'
      ? 'alarm'
      : data?.verdict === 'RINGING'
        ? 'warn'
        : 'ok';

  return (
    <section>
      <h1>Oscillation</h1>
      <div className="panel">
        <div className="label">Verdict</div>
        <div className={`metric ${cls}`}>{data?.verdict ?? '—'}</div>
        <p className="muted">{data?.detail_class} · WARN={String(data?.set_warn_bit ?? false)}</p>
      </div>
      <div className="panel">
        <div className="label">Pipeline</div>
        <pre>{(data?.pipeline ?? [
          'Read P, Q, V, I and frequency',
          'Remove expected 60 Hz carrier where appropriate',
          'Measure amplitude and dominant frequencies',
          'Determine whether oscillation is decaying',
          'Check control-mode transition count',
          'Classify: STABLE / RINGING / HUNTING / UNSTABLE',
        ]).map((s) => `↓  ${s}`).join('\n')}</pre>
      </div>
    </section>
  );
}
