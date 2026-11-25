import { useApi } from '../hooks/useApi';

export function PCSControlPage() {
  const { data } = useApi<Record<string, unknown>>('/api/pcs');
  return (
    <section>
      <h1>PCS Control — PCS-001</h1>
      <div className="grid">
        <div className="panel"><div className="label">V</div><div className="metric">{String(data?.voltage_v ?? '—')} V</div></div>
        <div className="panel"><div className="label">P</div><div className="metric">{String(data?.active_power_kw ?? '—')} kW</div></div>
        <div className="panel"><div className="label">Q</div><div className="metric">{String(data?.reactive_power_kvar ?? '—')} kvar</div></div>
        <div className="panel"><div className="label">f</div><div className="metric">{String(data?.frequency_hz ?? '—')} Hz</div></div>
        <div className="panel"><div className="label">Mode</div><div className="metric">{String(data?.control_mode ?? '—')}</div></div>
        <div className="panel"><div className="label">State</div><div className="metric">{String(data?.operating_state ?? '—')}</div></div>
        <div className="panel"><div className="label">Binary</div><div className="metric">{String(data?.binary_status ?? '—')}</div></div>
      </div>
    </section>
  );
}
