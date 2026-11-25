# Dashboards

Operations UI for the digital twin.

## Web GLB viewer (remote / fallback)

```bash
npm run export:glb
npm run viewer
# open http://localhost:3000/dashboards/viewer.html
```

Works from any machine — no Omniverse install required.

## Omniverse UI (Blackwell — Option B)

Full USD scene with alarm materials:

```bash
./scripts/blackwell/launch-kit.sh --refresh
```

Connect via DCV/Parsec to Blackwell. See [omniverse/BLACKWELL_SETUP.md](../omniverse/BLACKWELL_SETUP.md).

## Data sources

| Source | Use |
|--------|-----|
| `Equipment Runtime Data` | Latest unit outputs |
| `process_history` | Trends |
| `omniverse/runtime/twin_state.json` | Live binary + alarms for Kit |
| `ai_predictions` | Forecasts |
| `equipment_connections` | Process topology |
