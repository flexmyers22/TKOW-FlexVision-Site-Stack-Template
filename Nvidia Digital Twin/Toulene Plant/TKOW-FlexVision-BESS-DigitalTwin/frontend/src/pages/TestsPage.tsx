export function TestsPage() {
  return (
    <section>
      <h1>Qualification Tests</h1>
      <div className="panel">
        <pre>{`QT-GC-01  Grid connected standby     simulation/grid_connected/
QT-IS-01  Island transition          simulation/islanded/
QT-BS-01  Black start                simulation/black_start/
QT-AI-01  AI load ramp               simulation/ai_load_ramps/
QT-CL-01  Current limit              simulation/current_limit/
QT-OSC-01 Oscillation suite          backend analyze`}</pre>
      </div>
    </section>
  );
}
