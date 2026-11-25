# Core requirements

1. Represent BESS-001 as a digital twin with PCS-inclusive AC boundary.
2. Ingest live or simulated P, Q, V, I, f, SOC.
3. Maintain 8-bit binary status (TELEM…TRIP).
4. Classify oscillation: STABLE / RINGING / HUNTING / UNSTABLE.
5. Support grid-connected, islanded, and black-start operating modes.
6. Buffer AI compute load ramps via BESS dispatch.
7. Enforce current-limit indication (bit 4 / I_LIMIT).
8. Log events and qualification test results under `data/`.
9. Expose REST API for frontend pages.
10. Keep safety trip path independent of supervisory dispatch.
