# Oscillation & transient diagnostics

Classification taxonomy for electrical / BESS digital-twin signal analysis (`CUDA_TILE_ENERGY`).

| Class ID | Name | Description | Severity |
|----------|------|-------------|----------|
| `NORMAL_WAVEFORM` | Normal electrical oscillation | 60 Hz voltage/current waveform | normal |
| `NORMAL_TRANSIENT` | Normal transient | Brief, decaying response after a load change | normal |
| `RINGING` | Ringing | Short oscillation that decreases with time | watch |
| `SUSTAINED_OSCILLATION` | Sustained oscillation | Oscillation that does not decay | alarm → WARN |
| `CONTROL_HUNTING` | Control hunting | Repeated switching between control modes | alarm → WARN |
| `MECHANICAL_VIBRATION` | Mechanical vibration | Fans, pumps, bearings, or motors | watch → process MAINT |

## Analysis pipeline (CUDA_TILE_ENERGY)

```
Read P, Q, V, I and frequency
             ↓
Remove expected 60 Hz carrier where appropriate
             ↓
Measure amplitude and dominant frequencies
             ↓
Determine whether oscillation is decaying
             ↓
Check control-mode transition count
             ↓
Classify: STABLE / RINGING / HUNTING / UNSTABLE
```

| Verdict | Maps to | WARN |
|---------|---------|------|
| STABLE | Normal waveform / normal transient | no |
| RINGING | Ringing (decaying) | no |
| HUNTING | Control hunting | yes |
| UNSTABLE | Sustained oscillation | yes |

```bash
npm run oscillation:analyze
```

Implementation: `src/services/oscillationAnalyzer.ts`

## Source of truth

- `oscillation_taxonomy.json` — full rules + twin actions  
- `src/types/oscillation.ts` — TypeScript classifier  

## Pipeline

```
PCS / MTR waveform or mode chatter
        ↓
classifyOscillation()  /  CUDA_TILE_ENERGY
        ↓
electrical_oscillation_events
        ↓
WARN bit (bit 6) if sustained / hunting
        ↓
CTRL-001 + Omniverse AlarmPanel
```
