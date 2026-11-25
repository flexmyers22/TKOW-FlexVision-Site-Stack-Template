# Design Basis — Disproportionation of Toluene

## Source Document

| Field | Value |
|-------|-------|
| **Title** | Disproportionation of Toluene |
| **Type** | Senior Design Project |
| **Organization** | Flex-Vision Engineering |
| **Local path** | `plant/aspen/disproportionation_of_toluene.pdf` |
| **Original** | `Flex-Vision/Engineering Docs/Chemical Engineering/Disproportionation of Toluene.pdf` |
| **Pages** | 153 |

This senior design report is the **authoritative process basis** for the Toluene CUDA Smart Facility digital twin.

## Role in the Digital Twin Stack

```
Senior Design PDF (this document)
        ↓
Process flowsheet & design specs
        ↓
Equipment JSON (plant/equipment/)
        ↓
Excel Control Workbook
        ↓
Supabase (toluene_equipment, cuda_tiles)
        ↓
CUDA kernels + GLB viewer
```

## Process Summary

Toluene disproportionation (TDP) converts toluene to **benzene** and **xylenes** over a zeolite catalyst. The senior design defines:

- Material and energy balances
- Reactor conditions (temperature, pressure, conversion)
- Separation train (distillation, recycle)
- Equipment sizing and utility requirements
- P&ID / flowsheet topology

## Mapped Equipment Tags

Equipment in the digital twin is tagged to align with the senior design flowsheet:

| Tag | Service | Digital twin role |
|-----|---------|-------------------|
| **T101** | Toluene storage | Feed inventory, level binary |
| **P101** | Toluene centrifugal pump | Flow balance CUDA tile |
| **H101** | Heat exchanger + furnace | Thermal state CUDA tile |
| **R101** | Plug flow reactor (30% conv.) | Thermal state CUDA tile |
| **C101** | Side distillation tray column | Flow balance CUDA tile |

Upstream/downstream links in `toluene_equipment` mirror the senior design material flow:

```
T101 → P101 → H101 → R101 → C101
```

OCR-extracted design values: `ocr_equipment_extract.md`

## Using the PDF

1. Open `disproportionation_of_toluene.pdf` for full design calculations, tables, and flowsheets.
2. Cross-reference equipment tags when adding GLB models or updating metadata.
3. Use Aspen simulation exports (if available) to validate against design operating points.

## Notes

- Equipment metadata in `plant/equipment/*.json` and `database/seeds/equipment_seed.sql` was populated from OCR of the senior design PDF.
