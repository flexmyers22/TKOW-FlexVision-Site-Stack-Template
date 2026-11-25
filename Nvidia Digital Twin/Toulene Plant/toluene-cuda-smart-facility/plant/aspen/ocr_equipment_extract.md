# OCR Equipment Extract — Senior Design PDF

Source: `disproportionation_of_toluene.pdf` (153 pages, handwritten + Aspen Plus reports)

## Process Flow (from OCR)

```
Toluene Tank (T101) → Toluene Pump (P101) → Heat Exchanger + Furnace (H101) → Plug Flow Reactor (R101)
    → Flash Drum → Compressor → Side Distillation (C101) → Benzene / Xylene / Toluene columns
```

## Core Equipment (digital twin tags)

### T101 — Toluene Storage / Feed
| Parameter | Value | Source page |
|-----------|-------|-------------|
| Feed basis | 10,000 lb/hr toluene | 33 |
| Molar flow | 108.5 lbmol/hr | 33 |
| Suction pressure | 1 atm (14.69 psi) | 35 |

### P101 — Toluene Pump
| Parameter | Value | Source page |
|-----------|-------|-------------|
| Type | Centrifugal | 35 |
| P1 / P2 | 14.69 psi / 270 psi | 35 |
| Reactor delivery | 215 psi | 35 |
| ΔP losses | CV 10 + HX 7.5 + Furnace 32.5 + Misc 5 psi | 35 |
| Volumetric flow | 0.00145 m³/s | 35 |
| Hydraulic power | 2,557 W | 35 |
| Brake power | 3.9 kW (η=0.65) | 34 |
| Motor power | 4.3 kW (η=0.90) | 34 |
| Capital cost | $4,000 | 34 |

### H101 — Heat Exchanger + Furnace
| Parameter | Value | Source page |
|-----------|-------|-------------|
| Type | Shell-and-tube + furnace | 28 |
| Shell diameter | 0.305 m | 28 |
| Inlet | 80°F, 270 psi | 28 |
| HX outlet | 700°F, 263 psi | 28 |
| Furnace outlet | 1,000°F, 215 psi | 28 |
| Reactor return | 320°F, 208 psi | 28 |
| Heat duty | 3,848,817 W | 28 |
| Area | 30 m², 78 tubes | 27 |
| LMTD | 149 K | 27 |

### R101 — Plug Flow Reactor
| Parameter | Value | Source page |
|-----------|-------------|
| Type | Plug flow reactor | 33 |
| Conversion | 30% | 33 |
| Feed | 10,000 lb/hr, 215 psia | 33 |
| H2 flow | 1,780 lbmol/hr | 32 |
| Toluene volumetric | 185 ft³/hr | 33 |
| Reactor volume | ~185 ft³ (sizing) | 30 |
| Length | ~62 ft | 30 |
| Capital cost | $53,790 | 30 |

### C101 — Side / Tray Distillation Column
| Parameter | Value | Source page |
|-----------|-------|-------------|
| Type | Tray column (side distillation) | 11, 20 |
| Diameter | 5.29 m | 11 |
| Height | 42.31 m (~69 trays) | 11 |
| Feed | 114.21 lbmol/hr, 100°F, 240 psi | 20 |
| Flooding velocity | 0.0623 m/s | 11 |
| Capital cost | $184,615 | 11 |
| Aspen reflux ratio | 5.0 | 40 |
| Reboiler duty | 1,196,790 W | 40 |

## Additional plant equipment (future tags)

Benzene tank, xylene tank, flash drum, compressor, condensers, reboilers — see pages 2–24.
