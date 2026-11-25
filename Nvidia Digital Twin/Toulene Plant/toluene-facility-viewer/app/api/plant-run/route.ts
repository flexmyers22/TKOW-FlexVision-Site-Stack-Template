import { execFile } from "node:child_process"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import type { PlantRunResult } from "@/lib/plant-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const exec = promisify(execFile)

const FACILITY_DIR =
  process.env.FACILITY_DIR ?? path.resolve(process.cwd(), "..", "toluene-cuda-smart-facility")
const RUNS_DIR = path.join(FACILITY_DIR, "runs")
const TSX_CLI = path.join(FACILITY_DIR, "node_modules", "tsx", "dist", "cli.mjs")

async function latestRun() {
  const files = await readdir(RUNS_DIR).catch(() => [] as string[])
  const reports = files.filter((f) => /^RUN-.*\.json$/.test(f)).sort()
  const latest = reports.at(-1)
  if (!latest) return null

  const run = JSON.parse(await readFile(path.join(RUNS_DIR, latest), "utf8")) as PlantRunResult
  const csvName = latest.replace(/\.json$/, ".csv")
  return {
    run,
    reportPath: path.join(RUNS_DIR, latest),
    csvPath: files.includes(csvName) ? path.join(RUNS_DIR, csvName) : null,
  }
}

export async function GET() {
  const latest = await latestRun()
  if (!latest) {
    return Response.json({ error: `No plant runs found in ${RUNS_DIR}` }, { status: 404 })
  }
  return Response.json(latest)
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { tankLevelPct?: number }
  const args = [TSX_CLI, "scripts/plant-run-csv.ts"]
  const level = Number(body.tankLevelPct)
  if (body.tankLevelPct != null && Number.isFinite(level)) {
    args.push("--tank-level", String(Math.max(0, Math.min(100, level))))
  }

  try {
    const { stdout } = await exec(process.execPath, args, { cwd: FACILITY_DIR, timeout: 60_000 })
    const latest = await latestRun()
    return Response.json({ ...latest, log: stdout })
  } catch (err) {
    const e = err as Error & { stdout?: string; stderr?: string }
    return Response.json(
      { error: e.message, log: `${e.stdout ?? ""}${e.stderr ?? ""}` },
      { status: 500 },
    )
  }
}
