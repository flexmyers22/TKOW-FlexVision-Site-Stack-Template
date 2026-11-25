# Flex-Vision Property Management Workbook

Source workbook for the **multi-facility Flex-Vision digital twin portfolio**:

| Facility | Workbook signal | Twin status |
|----------|-----------------|-------------|
| **Toluene Plant** | `Plant Layout` → Toluene Production Floor; Production order #1 | Active in this repo |
| **Plastic Plant** | Vendors (Myers Industries); products Polyester / Polyethylene | Defined in workbook |
| **Graphics Plate Room** | `Plant Layout` → Graphics Film Division → Plate Room (Imager, Thermal, EVO) | Defined in workbook |

## Local copies

| File | Path |
|------|------|
| Excel | `plant/excel/Property_Management.xlsx` |
| PDF export | `plant/excel/Property_Management.pdf` |
| Structured extract | `plant/property/flexvision-facilities.json` |

SharePoint (authoritative live copy):

https://kennesawedu-my.sharepoint.com/:x:/r/personal/jmyer116_students_kennesaw_edu/Documents/Property%20Mangement.xlsx

## Sheets (20)

Cover / identity, Electrical rating, Safety, Phase wiring, Pump, Motor, Charts, Pivot Table, Periodic Table, Land, **Plant Layout**, Waves, **Binary Mapping**, Vendor List, Product, Design, Server, Production order, Time, Distillation.

## Refresh extract

```bash
python scripts/sync-property-workbook.py
```
