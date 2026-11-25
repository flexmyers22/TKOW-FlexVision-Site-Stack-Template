import { useApi } from '../hooks/useApi';

export function BatteryPage() {
  const { data } = useApi<Record<string, unknown>>('/api/bess');
  return (
    <section>
      <h1>Battery — BESS-001</h1>
      <div className="grid">
        <div className="panel"><div className="label">SOC</div><div className="metric">{String(data?.state_of_charge_pct ?? '—')}%</div></div>
        <div className="panel"><div className="label">Mode</div><div className="metric">{String(data?.operating_mode ?? '—')}</div></div>
        <div className="panel"><div className="label">Binary</div><div className="metric">{String(data?.binary_status ?? '—')}</div></div>
        <div className="panel"><div className="label">Grid</div><div className="metric">{String(data?.grid_connected)}</div></div>
      </div>
      <div className="panel"><pre>{JSON.stringify(data, null, 2)}</pre></div>
    </section>
  );
}
