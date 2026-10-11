import { execFileSync } from 'node:child_process'

function pidsFor(pattern: string): string[] {
  const raw = execFileSync('pgrep', ['-f', pattern], { encoding: 'utf8' })
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function toMb(value: number, unit: string): number {
  if (unit === 'GB') {
    return value * 1024
  }
  if (unit === 'KB') {
    return value / 1024
  }
  return value
}

function footprintMb(pid: string): number | null {
  try {
    const out = execFileSync('footprint', [pid], { encoding: 'utf8' })
    const match = out.match(/Footprint:\s+([\d.]+)\s*(MB|GB|KB)/)
    if (!match) {
      return null
    }
    return Math.round(toMb(Number(match[1]), match[2]))
  } catch {
    return null
  }
}

function rssMb(pid: string): number | null {
  try {
    const out = execFileSync('ps', ['-o', 'rss=', '-p', pid], {
      encoding: 'utf8',
    }).trim()
    const kb = Number(out)
    return Number.isFinite(kb) && kb > 0 ? Math.round(kb / 1024) : null
  } catch {
    return null
  }
}

// MLX allocates through Metal, so RSS misses most of the model memory on macOS.
// `footprint` reflects the real process footprint; `ps -o rss` is the fallback.
export function sampleMlxMemoryMb(): number | null {
  try {
    const pids = pidsFor('mlx_lm.server')
    if (pids.length === 0) {
      return null
    }
    let total = 0
    for (const pid of pids) {
      const value = footprintMb(pid) ?? rssMb(pid)
      if (value !== null) {
        total += value
      }
    }
    return total > 0 ? total : null
  } catch {
    return null
  }
}
