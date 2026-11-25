import { mkdir, readFile, writeFile } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { tool, type ToolSet } from 'ai'
import { z } from 'zod'

const ROOT = path.join(process.cwd(), '.data', 'blender')
const PACKAGE_FILE = path.join(ROOT, 'package.json')
const EXPORT_DIR = path.join(ROOT, 'exports')
const MAX_PACKAGE_CHARS = 2_000_000
const MAX_PARTS = 40
const MAX_METERS = 100

export type BlenderPart = {
  name: string
  units: 'mm' | 'in'
  length: number
  width: number
  height: number
  status: string
  meters: { length: number; width: number; height: number }
}

export type BlenderGap = { name: string; reason: string }

export type BlenderPackage = {
  received_at: string
  source_name: string
  workspace: string
  exported_at: string
  warning: string
  parts: BlenderPart[]
  unresolved: BlenderGap[]
}

type BlenderReply = { status?: string; result?: unknown; message?: string }

export function blenderOnThisComputer() {
  return !process.env.VERCEL
}

export async function blenderStatus() {
  if (!blenderOnThisComputer()) {
    return {
      connected: false,
      host: '127.0.0.1',
      port: 9876,
      message: 'Blender runs on the computer that is running the site. The live site cannot reach it.',
    }
  }
  const endpoint = blenderEndpoint()
  try {
    await blenderCommand('ping', {}, 700)
    return {
      connected: true,
      host: endpoint.host,
      port: endpoint.port,
      message: 'Blender MCP is accepting commands on this computer.',
    }
  } catch {
    return {
      connected: false,
      host: endpoint.host,
      port: endpoint.port,
      message: `Start Blender, enable the Blender MCP add-on, and connect it on ${endpoint.host}:${endpoint.port}. Part envelopes are not built until it answers.`,
    }
  }
}

export async function readBlenderPackage() {
  try {
    return JSON.parse(await readFile(PACKAGE_FILE, 'utf8')) as BlenderPackage
  } catch {
    return null
  }
}

export function summarizePackage(record: BlenderPackage | null) {
  if (!record) return null
  return {
    received_at: record.received_at,
    source_name: record.source_name,
    workspace: record.workspace,
    exported_at: record.exported_at,
    warning: record.warning,
    part_count: record.parts.length,
    unresolved_count: record.unresolved.length,
    parts: record.parts.map((part) => ({
      name: part.name,
      units: part.units,
      status: part.status,
      size: `${part.length} × ${part.width} × ${part.height}`,
    })),
    unresolved: record.unresolved,
  }
}

export async function saveBlenderPackage(body: unknown, sourceName = 'product workspace') {
  if (!blenderOnThisComputer()) {
    throw new Error('The product record stays on the computer running the site.')
  }
  const raw = JSON.stringify(body)
  if (raw.length > MAX_PACKAGE_CHARS) throw new Error('That package is too large to store.')
  const record = parsePackage(body, sourceName)
  if (!record.parts.length && !record.unresolved.length) {
    throw new Error('The file has no product records. Export the product workspace JSON and send that file.')
  }
  await mkdir(ROOT, { recursive: true })
  await writeFile(PACKAGE_FILE, `${JSON.stringify(record, null, 2)}\n`)
  return summarizePackage(record)
}

export async function buildBlenderTwin() {
  if (!blenderOnThisComputer()) throw new Error('Blender runs on the computer that is running the site.')
  const record = await readBlenderPackage()
  if (!record?.parts.length) {
    throw new Error('Send a product workspace record with recorded length, width, and height before building envelopes.')
  }
  await blenderCommand('ping', {}, 700)
  const placed = await blenderCommand('execute_code', { code: placementScript(record.parts) }, 20000)
  const glb = path.join(EXPORT_DIR, 'omniverse-envelopes.glb')
  const usd = path.join(EXPORT_DIR, 'omniverse-envelopes.usd')
  await mkdir(EXPORT_DIR, { recursive: true })
  const glbResult = await blenderCommand('export_scene', { filepath: glb, format: 'glb' }, 30000)
  let usdResult: unknown = null
  let usdError = ''
  try {
    usdResult = await blenderCommand('execute_code', { code: usdScript(usd) }, 30000)
  } catch (error) {
    usdError = error instanceof Error ? error.message : 'USD export did not finish.'
  }
  return {
    objects: record.parts.map((part) => part.name),
    unresolved: record.unresolved,
    glb,
    usd: usdError ? null : usd,
    usd_error: usdError,
    blender: { placed, glb: commandResult(glbResult), usd: commandResult(usdResult) },
    warning: record.warning || 'Envelope blocks use recorded sizes only. They are not released CAD.',
  }
}

export async function blenderChatTools(): Promise<{ connected: boolean; packageReady: boolean; tools: ToolSet }> {
  if (!blenderOnThisComputer()) return { connected: false, packageReady: false, tools: {} }
  const record = await readBlenderPackage()
  const packageReady = Boolean(record?.parts.length)
  try {
    await blenderCommand('ping', {}, 400)
  } catch {
    return { connected: false, packageReady, tools: {} }
  }
  if (!packageReady) return { connected: true, packageReady: false, tools: {} }
  return {
    connected: true,
    packageReady: true,
    tools: {
      blender_build_digital_twin: tool({
        description: 'Build one Blender envelope block per recorded product-workspace part and export omniverse-envelopes.glb for NVIDIA Omniverse. Uses stored sizes only. Call only when the user asks to build or update the digital twin in Blender.',
        inputSchema: z.object({
          confirm: z.literal(true),
        }),
        execute: async () => buildBlenderTwin(),
      }),
    },
  }
}

export function packagePrompt(record: BlenderPackage | null) {
  if (!record) return 'No product-workspace package is stored for the digital twin.'
  const parts = record.parts.map((part) => `${part.name}: ${part.length} × ${part.width} × ${part.height} ${part.units} (${part.status})`)
  const gaps = record.unresolved.map((item) => `${item.name}: ${item.reason}`)
  return [
    `Product workspace package received ${record.received_at} from ${record.source_name}.`,
    record.warning,
    parts.length ? `Recorded sizes: ${parts.join('; ')}` : 'No part has a complete recorded size.',
    gaps.length ? `Unresolved parts: ${gaps.join('; ')}` : 'Every listed part has a complete size.',
  ].join('\n')
}

function parsePackage(body: unknown, sourceName: string): BlenderPackage {
  if (typeof body !== 'object' || body === null) throw new Error('The package must be the product workspace JSON.')
  const record = body as Record<string, unknown>
  const projects = Array.isArray(record.product_projects)
    ? record.product_projects
    : Array.isArray(record.productProjects)
      ? record.productProjects
      : null
  if (!projects) throw new Error('The package has no product_projects list. Export the product workspace JSON.')
  const parts: BlenderPart[] = []
  const unresolved: BlenderGap[] = []
  const used = new Set<string>()
  for (const project of projects.slice(0, MAX_PARTS)) {
    if (typeof project !== 'object' || project === null) continue
    const item = project as Record<string, unknown>
    const name = uniqueName(cleanName(item.name), used)
    const units = cleanUnits(item.units)
    const dimensions = typeof item.dimensions === 'object' && item.dimensions !== null
      ? item.dimensions as Record<string, unknown>
      : {}
    const length = finite(dimensions.length)
    const width = finite(dimensions.width)
    const height = finite(dimensions.height)
    if (!units) {
      unresolved.push({ name, reason: 'Units must be mm or in before an envelope can be built.' })
      continue
    }
    if (length === null || width === null || height === null) {
      unresolved.push({ name, reason: 'Length, width, or height is not recorded.' })
      continue
    }
    const meters = {
      length: toMeters(length, units),
      width: toMeters(width, units),
      height: toMeters(height, units),
    }
    if (Object.values(meters).some((value) => value <= 0 || value > MAX_METERS)) {
      unresolved.push({ name, reason: 'A recorded size is outside the envelope range.' })
      continue
    }
    parts.push({
      name,
      units,
      length,
      width,
      height,
      status: typeof item.status === 'string' && item.status.trim() ? item.status.trim().slice(0, 40) : 'Recorded',
      meters,
    })
  }
  return {
    received_at: new Date().toISOString(),
    source_name: sourceName.slice(0, 120),
    workspace: typeof record.workspace === 'string' ? record.workspace.slice(0, 160) : 'Product workspace',
    exported_at: typeof record.exported_at === 'string' ? record.exported_at.slice(0, 40) : '',
    warning: typeof record.warning === 'string'
      ? record.warning.slice(0, 400)
      : 'Unknown and proposed values remain unresolved until CAD evidence verifies them.',
    parts,
    unresolved,
  }
}

function placementScript(parts: BlenderPart[]) {
  const payload = parts.map((part, index) => ({
    name: part.name,
    x: parts.slice(0, index).reduce((sum, item) => sum + item.meters.length, 0) + part.meters.length / 2,
    length: part.meters.length,
    width: part.meters.width,
    height: part.meters.height,
  }))
  return `import bpy, json
parts = json.loads(${JSON.stringify(JSON.stringify(payload))})
created = []
for part in parts:
    old = bpy.data.objects.get(part["name"])
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(part["x"], 0, part["height"] / 2))
    obj = bpy.context.active_object
    obj.name = part["name"]
    obj.dimensions = (part["length"], part["width"], part["height"])
    created.append(obj.name)
print(json.dumps({"created": created}))
`
}

function usdScript(filepath: string) {
  return `import bpy
bpy.ops.wm.usd_export(filepath=${JSON.stringify(filepath)}, selected_objects_only=False)
print("usd-ok")
`
}

function blenderCommand(type: string, params: Record<string, unknown>, timeoutMs: number) {
  const endpoint = blenderEndpoint()
  return new Promise<BlenderReply>((resolve, reject) => {
    const socket = net.connect({ host: endpoint.host, port: endpoint.port })
    let buffer = ''
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error('Blender did not answer.'))
    }, timeoutMs)
    const finish = (error?: Error, reply?: BlenderReply) => {
      clearTimeout(timer)
      socket.destroy()
      if (error) reject(error)
      else resolve(reply as BlenderReply)
    }
    socket.on('connect', () => {
      socket.write(JSON.stringify({ type, params }))
    })
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      try {
        const reply = JSON.parse(buffer) as BlenderReply
        if (reply.status === 'error') finish(new Error(typeof reply.message === 'string' ? reply.message.slice(0, 300) : 'Blender rejected the command.'))
        else finish(undefined, reply)
      } catch {
        if (buffer.length > 2_000_000) finish(new Error('Blender returned more data than this connection accepts.'))
      }
    })
    socket.on('error', () => finish(new Error('Blender MCP is not accepting connections.')))
    socket.on('end', () => {
      if (!buffer) finish(new Error('Blender closed the connection without a reply.'))
    })
  })
}

function blenderEndpoint() {
  const host = (process.env.BLENDER_HOST || '127.0.0.1').trim().toLowerCase()
  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1') {
    throw new Error('Blender stays on this computer.')
  }
  const port = Number(process.env.BLENDER_PORT || 9876)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('BLENDER_PORT must be a port number.')
  return { host: host === 'localhost' ? '127.0.0.1' : host, port }
}

function commandResult(reply: unknown) {
  if (!reply || typeof reply !== 'object') return null
  const result = (reply as BlenderReply).result
  return result && typeof result === 'object' ? result : null
}

function finite(value: unknown) {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
  return Number.isFinite(number) ? number : null
}

function cleanUnits(value: unknown): 'mm' | 'in' | null {
  const units = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (units === 'mm' || units === 'millimeter' || units === 'millimeters') return 'mm'
  if (units === 'in' || units === 'inch' || units === 'inches') return 'in'
  return null
}

function toMeters(value: number, units: 'mm' | 'in') {
  return units === 'mm' ? value / 1000 : value * 0.0254
}

function cleanName(value: unknown) {
  const name = typeof value === 'string' ? value.replace(/[\r\n\u0000]/g, ' ').replace(/\s+/g, ' ').trim() : ''
  return (name || 'Unnamed part').slice(0, 60)
}

function uniqueName(name: string, used: Set<string>) {
  let next = name
  let suffix = 2
  while (used.has(next)) {
    next = `${name.slice(0, 54)} ${suffix}`
    suffix += 1
  }
  used.add(next)
  return next
}
