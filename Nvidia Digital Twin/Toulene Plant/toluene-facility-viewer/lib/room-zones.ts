export interface RoomZone {
  id: string
  name: string
  description: string
  status: string
  provenance: string
  primPath: string
  learningRef: string
  slide: number
  /** Relative marker from the supplied production-floor plan. Not a surveyed coordinate. */
  marker: [number, number]
  exterior?: boolean
}

export interface ZoneAsset {
  assetId: string
  zoneId: string
  assetType: string
  manufacturer: string
  model: string
  status: string
  footprint: string
}

export const ROOM_ZONES: RoomZone[] = [
  {
    id: "Z-ROOM-001",
    name: "Room shell and access",
    description: "Walls, doors, columns, coordinate origin, and obstructions",
    status: "Pending",
    provenance: "UNKNOWN",
    primPath: "/TKOW/Toluene/RoomBuildout/Zones/RoomShell",
    learningRef: "https://chatgpt.com/space/page_db1975925f8c81919c299e1163d9d842",
    slide: 3,
    marker: [-16, -12],
  },
  {
    id: "Z-ECAD-010",
    name: "ECAD and PCB assembly cell",
    description: "Design station, Alta placeholder, feeder and board work, inspection, test, and downstream solder placeholders",
    status: "Proposed",
    provenance: "PROPOSED",
    primPath: "/TKOW/Toluene/RoomBuildout/Zones/ECAD_PCB_Assembly",
    learningRef: "https://chatgpt.com/space/page_db1975925f8c81919c299e1163d9d842",
    slide: 4,
    marker: [-8, -12],
  },
  {
    id: "Z-LOG-020",
    name: "Logistics staging and robot service",
    description: "Buffers, pickup and drop-off nodes, and a robot parking and charging placeholder",
    status: "Proposed",
    provenance: "PROPOSED",
    primPath: "/TKOW/Toluene/RoomBuildout/Zones/Logistics",
    learningRef: "https://chatgpt.com/space/page_db1975925f8c81919c299e1163d9d842",
    slide: 5,
    marker: [0, -12],
  },
  {
    id: "Z-PROD-030",
    name: "Product production cells",
    description: "Configurable machine placeholders and material handoffs",
    status: "TBD",
    provenance: "UNKNOWN",
    primPath: "/TKOW/Toluene/RoomBuildout/Zones/Production",
    learningRef: "https://chatgpt.com/space/page_db1975925f8c81919c299e1163d9d842",
    slide: 6,
    marker: [8, -12],
  },
  {
    id: "Z-CAB-040",
    name: "Electrical and control cabinets",
    description: "Cabinet placeholders and data or power interface annotations",
    status: "Proposed",
    provenance: "PROPOSED",
    primPath: "/TKOW/Toluene/RoomBuildout/Zones/Electrical_Cabinets",
    learningRef: "https://chatgpt.com/space/page_db1975925f8c81919c299e1163d9d842",
    slide: 7,
    marker: [16, -12],
  },
  {
    id: "LINE",
    name: "Toluene Production Line",
    description: "Existing toluene process equipment in the center of the production floor",
    status: "Proposed",
    provenance: "PROPOSED",
    primPath: "Unknown",
    learningRef: "",
    slide: 0,
    marker: [0, 2],
  },
  {
    id: "Z-MAT-050",
    name: "Material receiving and storage",
    description: "Receiving, raw, WIP, and finished buffers, quarantine, and storage placeholders",
    status: "TBD",
    provenance: "UNKNOWN",
    primPath: "/TKOW/Toluene/RoomBuildout/Zones/Materials",
    learningRef: "https://chatgpt.com/space/page_db1975925f8c81919c299e1163d9d842",
    slide: 8,
    marker: [-16, 12],
  },
  {
    id: "Z-INSPECT-060",
    name: "Inspection and quality",
    description: "Visual, AOI, and metrology placeholders with accepted, rework, and quarantine paths",
    status: "Proposed",
    provenance: "PROPOSED",
    primPath: "/TKOW/Toluene/RoomBuildout/Zones/Inspection",
    learningRef: "https://chatgpt.com/space/page_db1975925f8c81919c299e1163d9d842",
    slide: 9,
    marker: [-8, 12],
  },
  {
    id: "Z-EGRESS-070",
    name: "Egress and emergency access",
    description: "Access areas kept distinct from machine routes. No compliance claim",
    status: "Pending",
    provenance: "UNKNOWN",
    primPath: "/TKOW/Toluene/RoomBuildout/Zones/Egress",
    learningRef: "https://chatgpt.com/space/page_db1975925f8c81919c299e1163d9d842",
    slide: 10,
    marker: [0, 12],
  },
  {
    id: "Z-UTIL-080",
    name: "Utility and service corridors",
    description: "Proposed service paths. Capacity and verified connections are Unknown",
    status: "Unknown",
    provenance: "UNKNOWN",
    primPath: "/TKOW/Toluene/RoomBuildout/Zones/Utilities",
    learningRef: "https://chatgpt.com/space/page_db1975925f8c81919c299e1163d9d842",
    slide: 11,
    marker: [8, 12],
  },
  {
    id: "ROVER",
    name: "Rover parking",
    description: "Fixed parking stall for the inspection rover inside the facility. It is separate from vehicle parking. The spot is a relative marker. Surveyed coordinates are Unknown.",
    status: "Proposed",
    provenance: "SIMULATED",
    primPath: "Unknown",
    learningRef: "",
    slide: 0,
    marker: [16, 8],
  },
  {
    id: "VEHICLE",
    name: "Vehicle parking",
    description: "Proposed vehicle parking on the terrain outside the facility. This spot is separate from the inspection rover stall. The spot is a relative marker. Surveyed coordinates are Unknown.",
    status: "Proposed",
    provenance: "PROPOSED",
    primPath: "Unknown",
    learningRef: "",
    slide: 0,
    marker: [18, 26],
    exterior: true,
  },
  {
    id: "XFMR",
    name: "Power transformer",
    description: "Proposed power-generation transformer on the terrain outside the facility, with a three-phase connection to the production floor. The rating is recorded on the Electrical rating sheet. Surveyed coordinates are Unknown.",
    status: "Proposed",
    provenance: "PROPOSED",
    primPath: "Unknown",
    learningRef: "",
    slide: 0,
    marker: [30, 8],
    exterior: true,
  },
]

export const ZONE_ASSETS: ZoneAsset[] = [
  { assetId: "PLC-ECAD-001", zoneId: "Z-ECAD-010", assetType: "ECAD workstation", manufacturer: "Unknown", model: "Placeholder", status: "Proposed", footprint: "Unknown" },
  { assetId: "PLC-ALTA-001", zoneId: "Z-ECAD-010", assetType: "PCB pick-and-place", manufacturer: "Voltera", model: "Alta placeholder", status: "Pending", footprint: "Unknown" },
  { assetId: "PLC-ROBOT-001", zoneId: "Z-LOG-020", assetType: "ROS logistics mobile base", manufacturer: "Unknown", model: "Placeholder", status: "Proposed", footprint: "Unknown" },
  { assetId: "PLC-PROD-001", zoneId: "Z-PROD-030", assetType: "Production machine", manufacturer: "Unknown", model: "Placeholder", status: "TBD", footprint: "Unknown" },
  { assetId: "PLC-CAB-001", zoneId: "Z-CAB-040", assetType: "Electrical/control cabinet", manufacturer: "Unknown", model: "Placeholder", status: "TBD", footprint: "Unknown" },
  { assetId: "ROVER-001", zoneId: "ROVER", assetType: "Inspection rover parking", manufacturer: "Unknown", model: "Placeholder", status: "Proposed", footprint: "Unknown" },
  { assetId: "XFMR-001", zoneId: "XFMR", assetType: "Power transformer", manufacturer: "Unknown", model: "Placeholder", status: "Proposed", footprint: "Unknown" },
]

export const BASE_LAYOUT = {
  id: "LAYOUT-BASE-001",
  name: "Base layout placeholder",
  status: "Pending",
}

export function roomZoneById(id: string | null): RoomZone | null {
  return ROOM_ZONES.find((zone) => zone.id === id) ?? null
}

export function assetsInZone(zoneId: string): ZoneAsset[] {
  return ZONE_ASSETS.filter((asset) => asset.zoneId === zoneId)
}
