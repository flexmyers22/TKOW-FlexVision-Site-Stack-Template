"use client"

import { useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import type { Group } from "three"
import type { Equipment } from "@/lib/plant-data"
import { STATUS_HEX, EQUIPMENT_BASE, EQUIPMENT_DARK, ACCENT_HEX } from "@/lib/scene-colors"

interface EquipmentMeshProps {
  equipment: Equipment
  selected: boolean
  onSelect: (tag: string) => void
}

// Renders a procedural stand-in for each plant unit. When real GLB files are
// dropped into plant/glb, swap the inner geometry for a <primitive> from useGLTF.
export function EquipmentMesh({ equipment, selected, onSelect }: EquipmentMeshProps) {
  const group = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)
  const statusHex = STATUS_HEX[equipment.status]

  useFrame((state) => {
    if (!group.current) return
    // Subtle lift + pulse when active in the scene.
    const target = selected ? 0.25 : hovered ? 0.1 : 0
    group.current.position.y += (target - group.current.position.y) * 0.15
    if (equipment.status === "fault") {
      const pulse = (Math.sin(state.clock.elapsedTime * 6) + 1) / 2
      group.current.scale.setScalar(1 + pulse * 0.01)
    }
  })

  return (
    <group position={equipment.position}>
      <group
        ref={group}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(equipment.tag)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = "pointer"
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = "auto"
        }}
      >
        <EquipmentGeometry equipment={equipment} highlight={selected || hovered} />

        {/* Status beacon floating above the unit */}
        <mesh position={[0, unitHeight(equipment) + 0.6, 0]}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshStandardMaterial
            color={statusHex}
            emissive={statusHex}
            emissiveIntensity={equipment.status === "idle" ? 0.2 : 1.4}
            toneMapped={false}
          />
        </mesh>
      </group>

      <Html
        position={[0, unitHeight(equipment) + 1.1, 0]}
        center
        distanceFactor={12}
        occlude={false}
      >
        <div
          className="pointer-events-none select-none whitespace-nowrap rounded-md border px-2 py-1 text-center font-mono text-xs leading-tight backdrop-blur-sm"
          style={{
            borderColor: selected ? ACCENT_HEX : "rgba(255,255,255,0.15)",
            background: "rgba(20,23,28,0.82)",
            color: "#e6e8ec",
          }}
        >
          <div className="font-semibold" style={{ color: selected ? ACCENT_HEX : "#e6e8ec" }}>
            {equipment.tag}
          </div>
          <div className="flex items-center justify-center gap-1" style={{ color: statusHex }}>
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: statusHex }}
            />
            {equipment.status.toUpperCase()}
          </div>
        </div>
      </Html>
    </group>
  )
}

function unitHeight(eq: Equipment): number {
  switch (eq.type) {
    case "column":
      return 4
    case "reactor":
      return 3
    case "tank":
      return 2.4
    case "heater":
      return 2.2
    default:
      return 1.4
  }
}

function EquipmentGeometry({ equipment, highlight }: { equipment: Equipment; highlight: boolean }) {
  const emissive = highlight ? ACCENT_HEX : "#000000"
  const emissiveIntensity = highlight ? 0.35 : 0

  const bodyMat = (
    <meshStandardMaterial
      color={EQUIPMENT_BASE}
      metalness={0.6}
      roughness={0.4}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
    />
  )
  const darkMat = (
    <meshStandardMaterial color={EQUIPMENT_DARK} metalness={0.7} roughness={0.5} />
  )

  switch (equipment.type) {
    case "tank":
      return (
        <group>
          <mesh position={[0, 1.1, 0]} castShadow>
            <cylinderGeometry args={[1.1, 1.1, 2.2, 32]} />
            {bodyMat}
          </mesh>
          <mesh position={[0, 2.3, 0]} castShadow>
            <sphereGeometry args={[1.1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            {bodyMat}
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[1.2, 1.2, 0.2, 32]} />
            {darkMat}
          </mesh>
        </group>
      )
    case "pump":
      return (
        <group>
          <mesh position={[0, 0.35, 0]} castShadow>
            <boxGeometry args={[1.8, 0.7, 1]} />
            {darkMat}
          </mesh>
          <mesh position={[-0.3, 0.95, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.55, 0.55, 1, 24]} />
            {bodyMat}
          </mesh>
          <mesh position={[0.7, 0.95, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.8, 24]} />
            {darkMat}
          </mesh>
        </group>
      )
    case "heater":
      return (
        <group>
          <mesh position={[0, 1, 0]} castShadow>
            <boxGeometry args={[1.8, 2, 1.8]} />
            {bodyMat}
          </mesh>
          <mesh position={[0.55, 2.4, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.28, 1, 20]} />
            {darkMat}
          </mesh>
        </group>
      )
    case "reactor":
      return (
        <group>
          <mesh position={[0, 1.5, 0]} castShadow>
            <cylinderGeometry args={[0.9, 0.9, 3, 32]} />
            {bodyMat}
          </mesh>
          <mesh position={[0, 3, 0]} castShadow>
            <sphereGeometry args={[0.9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            {bodyMat}
          </mesh>
          <mesh position={[0, 0, 0]} rotation={[Math.PI, 0, 0]} castShadow>
            <sphereGeometry args={[0.9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            {bodyMat}
          </mesh>
          <mesh position={[0, 1.5, 0]}>
            <torusGeometry args={[0.92, 0.06, 12, 40]} />
            {darkMat}
          </mesh>
        </group>
      )
    case "column":
      return (
        <group>
          <mesh position={[0, 2, 0]} castShadow>
            <cylinderGeometry args={[0.6, 0.6, 4, 32]} />
            {bodyMat}
          </mesh>
          <mesh position={[0, 4.1, 0]} castShadow>
            <sphereGeometry args={[0.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            {bodyMat}
          </mesh>
          {[1, 1.8, 2.6, 3.4].map((y) => (
            <mesh key={y} position={[0, y, 0]}>
              <torusGeometry args={[0.62, 0.04, 10, 36]} />
              {darkMat}
            </mesh>
          ))}
        </group>
      )
    default:
      return (
        <mesh castShadow>
          <boxGeometry args={[1, 1, 1]} />
          {bodyMat}
        </mesh>
      )
  }
}
