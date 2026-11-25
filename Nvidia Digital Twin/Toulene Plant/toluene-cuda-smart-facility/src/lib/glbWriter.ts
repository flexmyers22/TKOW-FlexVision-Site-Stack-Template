export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface MeshData {
  positions: Float32Array;
  indices: Uint16Array;
}

export interface GlbMaterial {
  name: string;
  baseColor: [number, number, number, number];
  metallic?: number;
  roughness?: number;
}

export function boxMesh(width: number, height: number, depth: number): MeshData {
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;
  const positions = new Float32Array([
    -hw, -hh, hd, hw, -hh, hd, hw, hh, hd, -hw, hh, hd,
    -hw, -hh, -hd, -hw, hh, -hd, hw, hh, -hd, hw, -hh, -hd,
    -hw, hh, -hd, -hw, hh, hd, hw, hh, hd, hw, hh, -hd,
    -hw, -hh, -hd, hw, -hh, -hd, hw, -hh, hd, -hw, -hh, hd,
    hw, -hh, -hd, hw, hh, -hd, hw, hh, hd, hw, -hh, hd,
    -hw, -hh, -hd, -hw, -hh, hd, -hw, hh, hd, -hw, hh, -hd,
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
  ]);
  return { positions, indices };
}

export function cylinderMesh(radius: number, height: number, segments = 24): MeshData {
  const hh = height / 2;
  const positions: number[] = [0, -hh, 0];
  const indices: number[] = [];

  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const x0 = Math.cos(a0) * radius;
    const z0 = Math.sin(a0) * radius;
    const x1 = Math.cos(a1) * radius;
    const z1 = Math.sin(a1) * radius;
    const base = positions.length / 3;
    positions.push(x0, -hh, z0, x1, -hh, z1, x1, hh, z1, x0, hh, z0);
    indices.push(0, base, base + 1, base, base + 3, base + 2, base + 1, base + 2, base + 3);
  }

  const topCenter = positions.length / 3;
  positions.push(0, hh, 0);
  const bottomCenter = positions.length / 3;
  positions.push(0, -hh, 0);
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const rimBase = positions.length / 3;
    positions.push(Math.cos(a0) * radius, hh, Math.sin(a0) * radius);
    positions.push(Math.cos(a1) * radius, hh, Math.sin(a1) * radius);
    indices.push(topCenter, rimBase, rimBase + 1);
    const b0 = positions.length / 3;
    positions.push(Math.cos(a0) * radius, -hh, Math.sin(a0) * radius);
    positions.push(Math.cos(a1) * radius, -hh, Math.sin(a1) * radius);
    indices.push(bottomCenter, b0 + 1, b0);
  }

  return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

function pad4(n: number): number {
  return (n + 3) & ~3;
}

export function writeGlb(mesh: MeshData, material: GlbMaterial, nodeName: string): Buffer {
  const posBytes = mesh.positions.byteLength;
  const idxBytes = mesh.indices.byteLength;
  const posOffset = 0;
  const idxOffset = pad4(posOffset + posBytes);
  const binLength = pad4(idxOffset + idxBytes);

  const json = {
    asset: { version: '2.0', generator: 'toluene-cuda-smart-facility' },
    scene: 0,
    scenes: [{ name: 'Scene', nodes: [0] }],
    nodes: [{ name: nodeName, mesh: 0 }],
    meshes: [
      {
        name: `${nodeName}_mesh`,
        primitives: [
          {
            attributes: { POSITION: 0 },
            indices: 1,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        name: material.name,
        pbrMetallicRoughness: {
          baseColorFactor: material.baseColor,
          metallicFactor: material.metallic ?? 0.3,
          roughnessFactor: material.roughness ?? 0.6,
        },
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: mesh.positions.length / 3,
        type: 'VEC3',
        min: [
          Math.min(...Array.from(mesh.positions.filter((_, i) => i % 3 === 0))),
          Math.min(...Array.from(mesh.positions.filter((_, i) => i % 3 === 1))),
          Math.min(...Array.from(mesh.positions.filter((_, i) => i % 3 === 2))),
        ],
        max: [
          Math.max(...Array.from(mesh.positions.filter((_, i) => i % 3 === 0))),
          Math.max(...Array.from(mesh.positions.filter((_, i) => i % 3 === 1))),
          Math.max(...Array.from(mesh.positions.filter((_, i) => i % 3 === 2))),
        ],
      },
      {
        bufferView: 1,
        componentType: 5123,
        count: mesh.indices.length,
        type: 'SCALAR',
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: posOffset, byteLength: posBytes, target: 34962 },
      { buffer: 0, byteOffset: idxOffset, byteLength: idxBytes, target: 34963 },
    ],
    buffers: [{ byteLength: binLength }],
  };

  const jsonStr = JSON.stringify(json);
  const jsonPad = pad4(jsonStr.length);
  const jsonChunk = Buffer.alloc(jsonPad, 0x20);
  jsonChunk.write(jsonStr);

  const binChunk = Buffer.alloc(binLength);
  Buffer.from(mesh.positions.buffer).copy(binChunk, posOffset);
  Buffer.from(mesh.indices.buffer).copy(binChunk, idxOffset);

  const totalLength = 12 + 8 + jsonPad + 8 + binLength;
  const out = Buffer.alloc(totalLength);
  let o = 0;
  out.writeUInt32LE(0x46546c67, o); o += 4;
  out.writeUInt32LE(2, o); o += 4;
  out.writeUInt32LE(totalLength, o); o += 4;
  out.writeUInt32LE(jsonPad, o); o += 4;
  out.writeUInt32LE(0x4e4f534a, o); o += 4;
  jsonChunk.copy(out, o); o += jsonPad;
  out.writeUInt32LE(binLength, o); o += 4;
  out.writeUInt32LE(0x004e4942, o); o += 4;
  binChunk.copy(out, o);
  return out;
}
