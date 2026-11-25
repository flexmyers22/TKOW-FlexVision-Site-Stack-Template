import { useApi } from '../hooks/useApi';

export function AlarmsPage() {
  const { data } = useApi<{ alarms: { code: string; severity: string; message: string }[] }>('/api/alarms');
  return (
    <section>
      <h1>Alarms</h1>
      <div className="panel">
        {(data?.alarms?.length ?? 0) === 0 && <p className="ok">No active alarms</p>}
        <ul>
          {data?.alarms?.map((a) => (
            <li key={a.code} className={a.severity === 'alarm' ? 'alarm' : 'warn'}>
              [{a.severity}] {a.code} — {a.message}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
