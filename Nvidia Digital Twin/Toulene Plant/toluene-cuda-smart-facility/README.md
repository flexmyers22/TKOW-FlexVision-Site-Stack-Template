# Toluene CUDA Smart Facility

Digital twin for a **toluene disproportionation plant** based on the Flex-Vision senior design project:

**[Disproportionation of Toluene](plant/aspen/disproportionation_of_toluene.pdf)** (153 pages)

## Design Basis

The plant model, equipment tags, and process flow are derived from:

`Flex-Vision/Engineering Docs/Chemical Engineering/Disproportionation of Toluene.pdf`

A copy is maintained at `plant/aspen/disproportionation_of_toluene.pdf`. See `plant/aspen/flowsheet_reference.md` for how the design maps to the digital twin.

## Architecture

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for the full digital twin stack.

```
Field Sensors → PLC → Supabase → Binary Compiler → CUDA Tiles → USD → Omniverse
```

| Format | Role |
|--------|------|
| **USD** | Omniverse master scene (`plant/usd/`) |
| **GLB** | Web viewer derivative (`plant/glb/`) |

### Process topology

```
T101 → P101 → H101 → R101 → D101 → C101 → C102 → C103 → (recycle) T101
```

## Equipment

| Tag | Type | CUDA Tile |
|-----|------|-----------|
| T101 | Toluene tank | CUDA_TILE_T101 |
| P101 | Feed pump | CUDA_TILE_P101 |
| H101 | Heater / furnace | CUDA_TILE_H101 |
| R101 | Reactor | CUDA_TILE_R101 |
| D101 | Flash drum | CUDA_TILE_D101 |
| C101 | Side distillation | CUDA_TILE_C101 |
| C102 | Benzene column | CUDA_TILE_C102 |
| C103 | Xylene column | CUDA_TILE_C103 |

## Supabase (`@supabase/server`)

Project: **Toulene Digital Twin** (`acfyytgxuwhfasngvwpe`)

### Setup

```bash
npm install
cp .env.example .env   # add SUPABASE_SECRET_KEY from dashboard
```

Required environment variables:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Public / anon client |
| `SUPABASE_SECRET_KEY` | Service role (server only) |
| `SUPABASE_JWKS_URL` | JWT verification |

### API handler

`src/api/handler.ts` uses `withSupabase` for `/equipment` and `/health` routes.

Admin scripts use `createAdminClient()` from `src/db/supabaseServer.ts`.

### Optional: Supabase Server skill

```bash
npx skills add supabase/server
```

## Database

Schemas: `database/schema/` (006–010 for graph, sensors, historian, AI, electrical)

Seeds: `database/seeds/`

| Table | Purpose |
|-------|---------|
| `toluene_equipment` | Equipment registry |
| `cuda_tiles` | GPU tile map |
| `equipment_connections` | Process topology graph |
| `sensor_registry` | PLC / field sensors |
| `process_history` | Time-series historian |
| `ai_predictions` | ML inference |
| `electrical_assets` | Breaker → motor → equipment |
| `facility_sites` | GIS coordinates |
| `Equipment Runtime Data` | Latest run outputs |

Plant runs log to `Equipment Runtime Data`, `process_history`, and auto-sync Omniverse twin state:

```bash
npm run omniverse:plant                    # full pipeline (recommended)
npm run omniverse:plant -- --tank-level 65
npm run plant:run                          # same + auto omniverse sync
npm run plant:run -- --no-omniverse        # skip twin state write
```

Windows launcher (local Kit fallback only — **use Blackwell for production Omniverse**):

```powershell
.\scripts\run-omniverse-plant.ps1
.\scripts\blackwell\deploy-from-windows.ps1 -BlackwellHost user@blackwell-ip -RunPlant
```

### GLB web viewer

```bash
npm run export:glb
npm run viewer                             # open dashboards/viewer.html
```

### Omniverse on Blackwell (Option B — full USD twin)

See **[omniverse/BLACKWELL_SETUP.md](omniverse/BLACKWELL_SETUP.md)** for DCV/Parsec + Kit on the GPU server.

```bash
# On Blackwell (Linux)
./scripts/blackwell/setup-blackwell.sh          # first time
./scripts/blackwell/omniverse-plant.sh          # sim + twin_state.json
./scripts/blackwell/launch-kit.sh --refresh     # open Site.usd + apply alarms
```

Connect via **NICE DCV** or **Parsec** to see the Omniverse viewport.

### Omniverse Action Graph (local Windows)

After `npm run omniverse:plant`, open `plant/usd/Site.usd` in Omniverse Kit and run:

```python
exec(open(r"<project-root>/omniverse/action_graph/run_twin_refresh.py").read())
```

See `omniverse/action_graph/README.md` for material rules and alarm panel wiring.

## Quick Start

### Local development
```bash
cp .env.example .env
npm install
npm run test:connection
npm run omniverse:plant
```

### Blackwell GPU server (Option B — primary Omniverse target)

1. **Deploy from Windows:**
```powershell
.\scripts\blackwell\deploy-from-windows.ps1 -BlackwellHost user@blackwell-ip -RunPlant
```

2. **On Blackwell (first time):**
   ```bash
   ./scripts/blackwell/setup-blackwell.sh
   nano .env    # Supabase keys
   ```

3. **Connect DCV/Parsec**, then:
   ```bash
   ./scripts/blackwell/launch-kit.sh --refresh
   ./scripts/blackwell/install-extension.sh   # optional auto-poll
   ```

Full guide: **[omniverse/BLACKWELL_SETUP.md](omniverse/BLACKWELL_SETUP.md)**
