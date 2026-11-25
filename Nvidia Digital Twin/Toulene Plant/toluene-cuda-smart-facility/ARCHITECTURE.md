# TKOW Toluene Digital Twin — Architecture

## Multi-facility portfolio (Flex-Vision)

Canonical property workbook: `plant/excel/Property_Management.xlsx`  
Structured extract: `plant/property/flexvision-facilities.json`

| Facility | ID | Status |
|----------|-----|--------|
| Toluene Plant | `FV-TOLUENE-001` | Active twin (this repo) |
| Plastic Plant | `FV-PLASTIC-001` | Workbook-defined |
| Graphics Plate Room | `FV-GRAPHICS-PLATE-001` | Workbook-defined (Imager / Thermal / EVO) |

See `plant/excel/README.md`.

## Asset formats

| Format | Role | Location |
|--------|------|----------|
| **USD** | Omniverse master scene | `plant/usd/` |
| **GLB** | Web viewer derivative | `plant/glb/` |

## Full data pipeline

```
Field Sensors
      ↓
PLC
      ↓
Excel / Supabase
      ↓
Binary Compiler
      ↓
CUDA Tile Engine (Blackwell GPU)
      ↓
USD Scene Graph
      ↓
Omniverse Digital Twin
```

## CUDA tile registry

| Tile ID | Scope |
|---------|--------|
| CUDA_TILE_T101 | Toluene tank |
| CUDA_TILE_P101 | Feed pump |
| CUDA_TILE_H101 | Heater |
| CUDA_TILE_R101 | Reactor |
| CUDA_TILE_D101 | Flash drum |
| CUDA_TILE_C101 | Side distillation |
| CUDA_TILE_C102 | Benzene column |
| CUDA_TILE_C103 | Xylene column |
| CUDA_TILE_ELECTRICAL | MCC / breakers |
| CUDA_TILE_ENERGY | Plant energy |
| CUDA_TILE_SAFETY | SIS / alarms |

## Process topology

```
T101 → P101 → H101 → R101 → D101 → C101 → C102 → C103 → (recycle) T101
```

## Database layers

| Table | Purpose |
|-------|---------|
| `toluene_equipment` | Equipment registry |
| `cuda_tiles` | GPU tile map |
| `equipment_connections` | Process graph |
| `sensor_registry` | PLC / field sensors |
| `process_history` | Time-series historian |
| `ai_predictions` | ML inference |
| `electrical_assets` | Breaker / motor chain |
| `site_power_nodes` | Utility, gen, switchgear, PCS, BESS |
| `site_power_connections` | Site power graph |
| `electrical_dt_assets` | GRID-001…CTRL-001 twin registry |
| `electrical_comm_channels` | Modbus / IEC61850 / CAN / MQTT |
| `facility_sites` | GIS coordinates |
| `Equipment Runtime Data` | Latest run outputs |

## Omniverse Action Graph

Binary state `00000001` → sensor update → Action Graph → USD prim update → twin refresh.

Config: `omniverse/action_graph/binary_mapping.json`

Runtime state: `omniverse/runtime/twin_state.json`

## Blackwell deployment (Option B)

Full Omniverse runs on the **Blackwell GPU server**. Remote desktop (DCV/Parsec) for the 3D viewport.

```
Laptop (DCV client)
      ↓
Blackwell server
  ├── scripts/blackwell/omniverse-plant.sh  → Supabase + twin_state.json
  ├── Omniverse Kit                         → plant/usd/Site.usd
  └── run_twin_refresh.py                   → alarm materials
```

Guide: **[omniverse/BLACKWELL_SETUP.md](omniverse/BLACKWELL_SETUP.md)**

| Script | Platform |
|--------|----------|
| `scripts/blackwell/omniverse-plant.sh` | Linux (Blackwell) |
| `scripts/blackwell/launch-kit.sh --refresh` | Linux (DCV session) |
| `scripts/blackwell/deploy-from-windows.ps1` | Windows → push to Blackwell |
| `scripts/run-omniverse-plant.ps1` | Windows (local Kit fallback) |

## Folder structure

```
toluene-cuda-smart-facility/
├── plant/usd/              Omniverse master
├── plant/glb/              Web viewer
├── omniverse/
│   ├── BLACKWELL_SETUP.md  GPU server guide
│   ├── action_graph/       Binary → USD materials
│   ├── kit/                Kit launch profiles
│   ├── runtime/            twin_state.json
│   └── physics/            PhysX / thermal stubs
├── scripts/blackwell/      Linux deployment scripts
├── database/               Schemas + seeds
├── cuda/                   GPU kernels
├── ai/                     Predictions
├── electrical/             Site power + MCC (BESS/PCS/AI load)
├── sensors/                Field I/O
├── historian/              Time-series
├── plc/                    PLC bridge
├── dashboards/             Web viewer + ops UI
├── n8n/                    Automation
└── src/                    Services + API
```
