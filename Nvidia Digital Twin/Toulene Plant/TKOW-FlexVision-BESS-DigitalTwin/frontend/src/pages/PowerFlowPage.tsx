export function PowerFlowPage() {
  return (
    <section>
      <h1>Power Flow</h1>
      <div className="panel">
        <pre>{`GRID-001 → XFMR-001 → SWGR-001 → BUS-001 → BESS-001 ↔ PCS-001
GEN-001 ────────────────┘              ├── LOAD-AI-001
                                       └── MTR-001`}</pre>
      </div>
    </section>
  );
}
