import { useApi } from '../hooks/useApi';

export function OverviewPage() {
  const { data, error } = useApi<{
    project_id: string;
    bess: Record<string, unknown>;
    pcs: Record<string, unknown>;
  }>('/api/overview');

  return (
    <section>
      <h1>Overview</h1>
      <p className="muted">Site BESS digital twin — AC terminals PCS-inclusive</p>
      {error && <p className="alarm">{error} (start backend on :8787)</p>}
      <div className="grid">
        <div className="panel">
          <div className="label">Project</div>
          <div className="metric" style={{ fontSize: '1rem' }}>{data?.project_id ?? 'TKOW-FV-BESS-DT-001'}</div>
        </div>
        <div className="panel">
          <div className="label">BESS mode</div>
          <div className="metric">{String(data?.bess?.operating_mode ?? 'standby')}</div>
        </div>
        <div className="panel">
          <div className="label">PCS</div>
          <div className="metric">{String(data?.pcs?.control_mode ?? 'grid_following')}</div>
        </div>
        <div className="panel">
          <div className="label">SOC</div>
          <div className="metric">{String(data?.pcs?.soc_pct ?? data?.bess?.state_of_charge_pct ?? '—')}%</div>
        </div>
      </div>
    </section>
  );
}
