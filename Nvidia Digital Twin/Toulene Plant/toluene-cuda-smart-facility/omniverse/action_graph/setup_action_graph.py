"""
Programmatically build an Omniverse Action Graph for binary → USD updates.

Run once in Omniverse Script Editor with Site.usd loaded.
Requires omni.graph.nodes and omni.graph.action.
"""

import json
from pathlib import Path

import omni.graph.core as og
import omni.usd

MAPPING_PATH = Path(__file__).resolve().parent / "binary_mapping.json"
GRAPH_PATH = "/ActionGraph/TwinRefresh"


def setup_action_graph() -> str:
    mapping = json.loads(MAPPING_PATH.read_text(encoding="utf-8"))
    keys = og.Controller.Keys

    (graph, nodes, _, _) = og.Controller.edit(
        {
            "graph_path": GRAPH_PATH,
            "evaluator_name": "execution",
            "pipeline_stage": og.GraphPipelineStage.GRAPH_PIPELINE_STAGE_SIMULATION,
        },
        {
            keys.CREATE_NODES: [
                ("OnTick", "omni.graph.action.OnTick"),
                ("ReadTwinState", "omni.graph.nodes.ReadFile"),
                ("ApplyBinary", "omni.graph.scriptnode.ScriptNode"),
            ],
            keys.SET_VALUES: [
                ("ReadTwinState.inputs:filePath", str(Path(__file__).resolve().parents[1] / "runtime" / "twin_state.json")),
                ("ApplyBinary.inputs:scriptPath", str(Path(__file__).resolve().parent / "apply_binary_state.py")),
            ],
            keys.CONNECT: [
                ("OnTick.outputs:tick", "ReadTwinState.inputs:execIn"),
                ("ReadTwinState.outputs:execOut", "ApplyBinary.inputs:execIn"),
            ],
        },
    )

    print(f"[setup_action_graph] created {GRAPH_PATH}")
    print(f"  equipment prims: {len(mapping['equipment_prims'])}")
    return GRAPH_PATH


if __name__ == "__main__":
    stage = omni.usd.get_context().get_stage()
    if stage is None:
        raise RuntimeError("Open plant/usd/Site.usd before running setup_action_graph.py")
    setup_action_graph()
