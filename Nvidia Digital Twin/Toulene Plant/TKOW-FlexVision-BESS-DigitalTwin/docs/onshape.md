# Onshape CAD integration

API keys live in `.env` (`ONSHAPE_ACCESS_KEY`, `ONSHAPE_SECRET_KEY`). Never commit real keys.

## Verify credentials

```bash
npm run onshape:ping
```

## Export CAD → twin

Target IDs (priority: env vars → `digital_twin/cad/onshape-target.json`):

```json
{
  "label": "Shell_creation",
  "documentId": "...",
  "workspaceId": "...",
  "elementId": "..."
}
```

Then:

```bash
npm run onshape:export
```

Writes under `digital_twin/cad/onshape/`:

- `.stl` — sync Part Studio STL
- `.gltf` / `.glb` — async translation export
- `.manifest.json` — source IDs + byte sizes

Default target is currently **Shell creation** (update IDs when you have a BESS/PCS assembly).

## API (dev backend)

- `GET /api/onshape/documents` — list documents
- `POST /api/onshape/export` — trigger export (same as CLI)

## Next

Map exported mesh into Omniverse USD / web GLB viewer for BESS-001 / PCS-001.
