#!/usr/bin/env python3
"""Extract Flex-Vision Property Management.xlsx into plant/property/flexvision-facilities.json."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

try:
    import openpyxl
except ImportError as exc:  # pragma: no cover
    raise SystemExit("pip install openpyxl") from exc

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "plant" / "excel" / "Property_Management.xlsx"
OUT = ROOT / "plant" / "property" / "flexvision-facilities.json"


def cell_text(v) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def main() -> None:
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    sheets = [s.strip() for s in wb.sheetnames]

    vendors = []
    ws = wb[[n for n in wb.sheetnames if n.strip() == "Vendor List"][0]]
    for i, row in enumerate(ws.iter_rows(values_only=True), 1):
        if i == 1:
            continue
        name, typ = (cell_text(row[0]), cell_text(row[1]) if len(row) > 1 else None)
        if name:
            vendors.append({"name": name, "type": typ})

    layout_labels = []
    ws = wb[[n for n in wb.sheetnames if n.strip() == "Plant Layout"][0]]
    for r in range(1, ws.max_row + 1):
        for c in range(1, ws.max_column + 1):
            t = cell_text(ws.cell(r, c).value)
            if t:
                layout_labels.append({"row": r, "col": c, "label": t})

    products = []
    ws = wb[[n for n in wb.sheetnames if n.strip() == "Product"][0]]
    for row in ws.iter_rows(min_row=1, max_col=1, values_only=True):
        t = cell_text(row[0])
        if t and t.lower() not in {"type"}:
            products.append(t)

    orders = []
    ws = wb[[n for n in wb.sheetnames if n.strip() == "Production order"][0]]
    headers = [cell_text(c) for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not any(row):
            continue
        rec = {headers[i] or f"c{i}": cell_text(row[i]) if not isinstance(row[i], (int, float)) else row[i] for i in range(len(headers))}
        orders.append(rec)

    payload = {
        "source": {
            "title": "Property Management",
            "file": "plant/excel/Property_Management.xlsx",
            "pdf": "plant/excel/Property_Management.pdf",
            "powered_by": "Flex-Vision",
            "synced_at": date.today().isoformat(),
            "workbook_sheets": sheets,
        },
        "layout_labels": layout_labels,
        "vendors": vendors,
        "products": products,
        "production_orders": orders,
        "facilities": [
            {
                "facility_id": "FV-TOLUENE-001",
                "name": "Toluene Plant",
                "layout_label": "Toluene Production Floor",
                "status": "digital_twin_active",
            },
            {
                "facility_id": "FV-PLASTIC-001",
                "name": "Plastic Plant",
                "products": [p for p in products if "poly" in p.lower()],
                "status": "workbook_defined",
            },
            {
                "facility_id": "FV-GRAPHICS-PLATE-001",
                "name": "Graphics Plate Room",
                "division": "Graphics Film Division",
                "areas": [
                    x["label"]
                    for x in layout_labels
                    if x["label"] in {"Plate Room", "Imager", "Thermal", "EVO"}
                ],
                "status": "workbook_defined",
            },
        ],
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} ({len(layout_labels)} layout labels, {len(vendors)} vendors)")


if __name__ == "__main__":
    main()
