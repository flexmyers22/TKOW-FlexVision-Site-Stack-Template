"""
Apply binary state from twin_state.json to USD prims in Omniverse.

Run inside Omniverse Kit (Script Editor or extension).
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import omni.usd
from pxr import Gf, Sdf, Usd, UsdGeom, UsdShade, Vt

ACTION_GRAPH_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = Path(os.environ.get("TKOW_PROJECT_ROOT", ACTION_GRAPH_DIR.parents[1]))
MAPPING_PATH = ACTION_GRAPH_DIR / "binary_mapping.json"
STATE_PATH = PROJECT_ROOT / "omniverse" / "runtime" / "twin_state.json"


def _load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _ensure_material(stage: Usd.Stage, name: str, color: list[float], emissive: list[float] | None = None) -> UsdShade.Material:
    mat_path = f"/World/Looks/{name}"
    material = UsdShade.Material.Define(stage, mat_path)
    shader = UsdShade.Shader.Define(stage, f"{mat_path}/Shader")
    shader.CreateIdAttr("UsdPreviewSurface")
    shader.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(*color[:3]))
    shader.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(0.5)
    shader.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(0.45)
    if emissive and any(emissive):
        shader.CreateInput("emissiveColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(*emissive[:3]))
    material.CreateSurfaceOutput().ConnectToSource(shader.ConnectableAPI(), "surface")
    return material


def _bind_material(prim_path: str, material: UsdShade.Material) -> None:
    stage = omni.usd.get_context().get_stage()
    prim = stage.GetPrimAtPath(prim_path)
    if not prim.IsValid():
        print(f"[twin_refresh] prim not found: {prim_path}")
        return
    UsdShade.MaterialBindingAPI(prim).Bind(material)


def _set_visibility(prim_path: str, visible: bool) -> None:
    stage = omni.usd.get_context().get_stage()
    prim = stage.GetPrimAtPath(prim_path)
    if not prim.IsValid():
        return
    imageable = UsdGeom.Imageable(prim)
    if visible:
        imageable.MakeVisible()
    else:
        imageable.MakeInvisible()


def apply_equipment_state(equipment: dict, mapping: dict) -> None:
    stage = omni.usd.get_context().get_stage()
    if stage is None:
        raise RuntimeError("No USD stage open")

    materials_cfg = mapping["materials"]
    mats = {
        "normal": _ensure_material(stage, "TwinNormal", materials_cfg["normal"]["color"], materials_cfg["normal"]["emissive"]),
        "alarm": _ensure_material(stage, "TwinAlarm", materials_cfg["alarm"]["color"], materials_cfg["alarm"]["emissive"]),
        "thermal": _ensure_material(stage, "TwinThermal", materials_cfg["thermal"]["color"], materials_cfg["thermal"]["emissive"]),
        "offline": _ensure_material(stage, "TwinOffline", materials_cfg["offline"]["color"], materials_cfg["offline"]["emissive"]),
    }

    tag = equipment["tag"]
    decoded = equipment.get("decoded", {})
    prim_path = equipment.get("usd_prim") or mapping["equipment_prims"].get(tag)
    if not prim_path:
        print(f"[twin_refresh] no prim for {tag}")
        return

    alarms = equipment.get("alarms", [])
    sensors = equipment.get("sensors", {})

    # Priority: ALM bit or high-temp alarm → red material
    temp_high = any("HIGH_TEMP" in a for a in alarms)
    if decoded.get("ALM") or temp_high:
        _bind_material(prim_path, mats["alarm"])
        print(f"[twin_refresh] ALARM material → {prim_path}")
        return

    # HEAT bit or reactor temp > 450°F → thermal emissive
    temp_val = sensors.get("R101_outlet_temp_f") or sensors.get("R101_reactor_temp_f")
    if decoded.get("HEAT") or (tag == "R101" and temp_val and float(temp_val) > 450):
        _bind_material(prim_path, mats["thermal"])
        print(f"[twin_refresh] THERMAL material → {prim_path}")
        return

    # RUN bit controls visibility + normal material
    if decoded.get("RUN", True):
        _set_visibility(prim_path.rsplit("/", 1)[0], True)
        _bind_material(prim_path, mats["normal"])
    else:
        _bind_material(prim_path, mats["offline"])
        print(f"[twin_refresh] OFFLINE material → {prim_path}")


def apply_twin_state(state_path: Path | None = None) -> int:
    mapping = _load_json(MAPPING_PATH)
    path = state_path or STATE_PATH
    if not path.exists():
        print(f"[twin_refresh] state file missing: {path}")
        return 0

    state = _load_json(path)
    count = 0
    for equipment in state.get("equipment", []):
        apply_equipment_state(equipment, mapping)
        count += 1

    # Alarm panel attribute (if prim exists)
    alarm_cfg = mapping.get("alarm_display", {})
    panel_path = alarm_cfg.get("prim", "/Site/ControlRoom/AlarmPanel")
    if panel_path:
        stage = omni.usd.get_context().get_stage()
        panel = stage.GetPrimAtPath(panel_path)
        if panel.IsValid():
            active = state.get("active_alarms")
            if not active:
                active = []
                for eq in state.get("equipment", []):
                    for alarm in eq.get("alarms", []):
                        active.append(f"{eq['tag']}: {alarm}")
            panel.CreateAttribute("activeAlarms", Sdf.ValueTypeNames.StringArray).Set(Vt.StringArray(active))
            print(f"[twin_refresh] alarm panel → {len(active)} active")

    print(f"[twin_refresh] refreshed {count} equipment prims")
    return count


if __name__ == "__main__":
    apply_twin_state()
