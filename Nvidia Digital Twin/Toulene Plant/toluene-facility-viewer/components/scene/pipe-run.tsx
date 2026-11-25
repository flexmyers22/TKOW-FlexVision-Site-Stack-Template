"use client"

import { useMemo } from "react"
import { Vector3, Quaternion } from "three"
import { PIPE_COLOR } from "@/lib/scene-colors"

interface PipeRunProps {
  from: [number, number, number]
  to: [number, number, number]
  active: boolean
}

// A straight horizontal pipe segment connecting two units at manifold height.
export function PipeRun({ from, to, active }: PipeRunProps) {
  const { position, quaternion, length } = useMemo(() => {
    const y = 0.6
    const start = new Vector3(from[0], y, from[2])
    const end = new Vector3(to[0], y, to[2])
    const dir = new Vector3().subVectors(end, start)
    const len = dir.length()
    const mid = new Vector3().addVectors(start, end).multiplyScalar(0.5)
    // Align the cylinder's local +Y axis with the pipe direction.
    const quat = new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      dir.clone().normalize(),
    )
    return { position: mid, quaternion: quat, length: len }
  }, [from, to])

  return (
    <group position={position} quaternion={quaternion}>
      <mesh>
        <cylinderGeometry args={[0.12, 0.12, length, 16]} />
        <meshStandardMaterial
          color={active ? "#d7d9dd" : PIPE_COLOR}
          metalness={0.7}
          roughness={0.35}
          emissive={active ? "#d7d9dd" : "#000000"}
          emissiveIntensity={active ? 0.3 : 0}
        />
      </mesh>
    </group>
  )
}
