"use client"

import { useMemo, useRef } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Html, OrbitControls, Environment, ContactShadows, Grid } from "@react-three/drei"
import { Quaternion, Vector3 } from "three"
import { EquipmentMesh } from "./equipment-mesh"
import { PipeRun } from "./pipe-run"
import { PLANT_PIPES, type Equipment } from "@/lib/plant-data"
import { ROOM_ZONES, roomZoneById } from "@/lib/room-zones"
import { ACCENT_HEX, FLOOR_COLOR, TERRAIN_COLOR } from "@/lib/scene-colors"

interface PlantSceneProps {
  equipment: Equipment[]
  selectedTag: string | null
  onSelect: (tag: string | null) => void
  areaId?: string | null
  onSelectArea?: (id: string) => void
  rover?: { x_m: number; y_m: number } | null
  roverPath?: { x_m: number; y_m: number }[]
}

export function PlantScene({ equipment, selectedTag, onSelect, areaId = null, onSelectArea, rover, roverPath = [] }: PlantSceneProps) {
  const byTag = (tag: string) => equipment.find((e) => e.tag === tag) as Equipment

  return (
    <Canvas
      shadows
      camera={{ position: [0, 46, 32], fov: 42 }}
      dpr={[1, 2]}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={[FLOOR_COLOR]} />
      <fog attach="fog" args={[FLOOR_COLOR, 70, 130]} />

      <ambientLight intensity={0.5} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <Environment preset="warehouse" />

      <Terrain />
      {/* Plant floor. The slab is the facility interior. Terrain continues outside it. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[46, 36]} />
        <meshStandardMaterial color={FLOOR_COLOR} metalness={0.1} roughness={0.9} />
      </mesh>
      <Grid
        position={[0, 0, 0]}
        args={[60, 60]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#2c3038"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#6d7380"
        fadeDistance={70}
        fadeStrength={1.5}
        infiniteGrid
      />

      <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={50} blur={2.2} far={12} />

      {/* Pipe network */}
      {PLANT_PIPES.map((pipe) => {
        const a = byTag(pipe.from)
        const b = byTag(pipe.to)
        const active = a.status === "running" && b.status !== "idle"
        return (
          <PipeRun key={`${pipe.from}-${pipe.to}`} from={a.position} to={b.position} active={active} />
        )
      })}

      {/* Equipment units */}
      {equipment.map((eq) => (
        <EquipmentMesh
          key={eq.tag}
          equipment={eq}
          selected={selectedTag === eq.tag}
          onSelect={onSelect}
        />
      ))}

      {roverPath.length > 1 && <RoverRoute poses={roverPath} />}
      {rover && <PlantRover position={[rover.x_m, 0, rover.y_m]} />}

      <ProductionLine selected={areaId === "LINE"} onSelect={() => onSelectArea?.("LINE")} />
      <PowerFeed selected={areaId === "XFMR"} onSelect={() => onSelectArea?.("XFMR")} />
      {ROOM_ZONES.filter((zone) => zone.id !== "LINE").map((zone) => (
        <AreaPad
          key={zone.id}
          id={zone.id === "ROVER" ? "Rover" : zone.id === "VEHICLE" ? "Vehicle" : zone.id}
          name={zone.id === "ROVER" || zone.id === "VEHICLE" ? "Parking" : zone.name}
          position={[zone.marker[0], 0.04, zone.marker[1]]}
          selected={areaId === zone.id}
          onSelect={() => onSelectArea?.(zone.id)}
        />
      ))}
      <AreaFocus zoneId={areaId} />

      <OrbitControls
        makeDefault
        enablePan
        minDistance={6}
        maxDistance={80}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 0, 0]}
      />
    </Canvas>
  )
}

function Terrain() {
  const mounds: [number, number, number][] = [[-30, 22, 7], [34, -6, 5], [-26, -24, 6], [6, 36, 4.5]]
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color={TERRAIN_COLOR} roughness={1} metalness={0} />
      </mesh>
      {mounds.map(([x, z, size]) => (
        <mesh key={`${x}-${z}`} position={[x, -0.15, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[size, 24]} />
          <meshStandardMaterial color="#3a342c" roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function PlantRover({ position }: { position: [number, number, number] }) {
  const wheels: [number, number, number][] = [[-0.48, 0.16, -0.62], [0.48, 0.16, -0.62], [-0.48, 0.16, 0.62], [0.48, 0.16, 0.62]]
  return (
    <group position={position}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[1.2, 0.42, 1.9]} />
        <meshStandardMaterial color="#d7d9dd" metalness={0.65} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.68, -0.55]} castShadow>
        <boxGeometry args={[0.7, 0.28, 0.55]} />
        <meshStandardMaterial color="#aeb4bf" metalness={0.4} roughness={0.45} />
      </mesh>
      {wheels.map(([x, y, z]) => (
        <mesh key={`${x}-${z}`} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.18, 12]} />
          <meshStandardMaterial color="#111318" roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

function RoverRoute({ poses }: { poses: { x_m: number; y_m: number }[] }) {
  return (
    <group>
      {poses.slice(0, -1).map((from, index) => {
        const to = poses[index + 1]
        return (
          <Conductor
            key={`${from.x_m}-${from.y_m}`}
            from={[from.x_m, 0.08, from.y_m]}
            to={[to.x_m, 0.08, to.y_m]}
            selected={false}
          />
        )
      })}
    </group>
  )
}

function Conductor({ from, to, selected }: { from: [number, number, number]; to: [number, number, number]; selected: boolean }) {
  const { position, quaternion, length } = useMemo(() => {
    const start = new Vector3(...from)
    const end = new Vector3(...to)
    const direction = new Vector3().subVectors(end, start)
    const mid = new Vector3().addVectors(start, end).multiplyScalar(0.5)
    const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize())
    return { position: mid, quaternion, length: direction.length() }
  }, [from, to])

  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[0.045, 0.045, length, 8]} />
      <meshStandardMaterial color={selected ? ACCENT_HEX : "#aeb4bf"} metalness={0.75} roughness={0.3} />
    </mesh>
  )
}

function PowerFeed({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  const phases: [number, number, number][] = [[30, 1.85, 7.35], [30, 1.85, 8], [30, 1.85, 8.65]]
  const ends: [number, number, number][] = [[-0.7, 0.45, -3.4], [0, 0.45, -4], [0.7, 0.45, -4.6]]
  return (
    <group onClick={(event) => { event.stopPropagation(); onSelect() }}>
      <mesh position={[30, 0.85, 8]} castShadow>
        <boxGeometry args={[2.2, 1.5, 1.5]} />
        <meshStandardMaterial color="#aeb4bf" metalness={0.55} roughness={0.4} />
      </mesh>
      {phases.map(([, , z]) => (
        <mesh key={z} position={[30, 1.75, z]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.32, 10]} />
          <meshStandardMaterial color="#d7d9dd" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {phases.map((from, index) => (
        <Conductor key={from[2]} from={from} to={ends[index]} selected={selected} />
      ))}
    </group>
  )
}

function ProductionLine({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  const color = selected ? ACCENT_HEX : "#6d7380"
  return (
    <group>
      {[[0, -4, 22, 0.12], [0, 6, 22, 0.12], [-11, 1, 0.12, 10], [11, 1, 0.12, 10]].map(([x, z, w, d]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.05, z]} rotation={[-Math.PI / 2, 0, 0]} onClick={(event) => { event.stopPropagation(); onSelect() }}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      <Html position={[0, 1.2, 1]} center distanceFactor={16}>
        <button type="button" onClick={onSelect} className="pointer-events-auto rounded-md border px-2 py-1 font-mono text-[10px]" style={{ borderColor: color, background: "rgba(17,19,24,0.88)", color: "#f3f4f6" }}>
          Toluene Production Line
        </button>
      </Html>
    </group>
  )
}

function AreaPad({
  id,
  name,
  position,
  selected,
  onSelect,
}: {
  id: string
  name: string
  position: [number, number, number]
  selected: boolean
  onSelect: () => void
}) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={(event) => { event.stopPropagation(); onSelect() }}>
        <planeGeometry args={[4.6, 3.2]} />
        <meshStandardMaterial color={selected ? ACCENT_HEX : "#2a2e36"} metalness={0.2} roughness={0.8} />
      </mesh>
      <Html position={[0, 0.4, 0]} center distanceFactor={14}>
        <button
          type="button"
          onClick={onSelect}
          className="pointer-events-auto whitespace-nowrap rounded-md border px-2 py-1 text-center font-mono text-[10px] leading-tight"
          style={{
            borderColor: selected ? ACCENT_HEX : "rgba(174,180,191,0.45)",
            background: "rgba(17,19,24,0.88)",
            color: "#f3f4f6",
          }}
        >
          <span className="block font-semibold">{id}</span>
          <span className="block max-w-36 truncate text-[9px] text-[#aeb4bf]">{name}</span>
        </button>
      </Html>
    </group>
  )
}

function AreaFocus({ zoneId }: { zoneId: string | null }) {
  const { camera, controls } = useThree()
  const focusKey = useRef<string | null>(null)
  const settled = useRef(true)
  const target = useRef(new Vector3())
  const desired = useRef(new Vector3())

  useFrame(() => {
    const orbit = controls as { target: Vector3 } | null
    if (!orbit) return
    if (focusKey.current !== zoneId) {
      focusKey.current = zoneId
      settled.current = false
    }
    if (settled.current) return
    const zone = roomZoneById(zoneId)
    if (!zone) {
      target.current.set(0, 0, 0)
      desired.current.set(0, 46, 32)
    } else if (zone.id === "LINE") {
      target.current.set(0, 1.5, 2)
      desired.current.set(8, 12, 16)
    } else {
      target.current.set(zone.marker[0], 0.4, zone.marker[1])
      desired.current.set(zone.marker[0] + 4, 8, zone.marker[1] + 8)
    }
    orbit.target.lerp(target.current, 0.08)
    camera.position.lerp(desired.current, 0.08)
    if (camera.position.distanceTo(desired.current) < 0.25) settled.current = true
  })

  return null
}
