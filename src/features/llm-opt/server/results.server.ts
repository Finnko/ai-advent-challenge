import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import type { StoredRun } from '../domain/results'

function resultsPath(): string {
  const override = process.env.LLM_OPT_RESULTS_PATH?.trim()
  if (override) {
    return override
  }
  return join(homedir(), '.ai-advent-challenge', 'llm-opt', 'results.json')
}

export function loadRuns(): StoredRun[] {
  const path = resultsPath()
  if (!existsSync(path)) {
    return []
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed as StoredRun[]
  } catch {
    return []
  }
}

function saveRuns(runs: StoredRun[]): void {
  const path = resultsPath()
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  writeFileSync(path, JSON.stringify(runs), { mode: 0o600 })
}

export function upsertRun(run: StoredRun): StoredRun[] {
  const runs = loadRuns().filter((existing) => existing.id !== run.id)
  runs.push(run)
  saveRuns(runs)
  return runs
}

export function resetRuns(): void {
  const path = resultsPath()
  if (existsSync(path)) {
    rmSync(path)
  }
}

export { resultsPath }
