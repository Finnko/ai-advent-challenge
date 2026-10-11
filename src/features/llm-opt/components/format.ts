export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function formatLatency(value: number | null): string {
  if (value === null) {
    return '—'
  }
  return `${(value / 1000).toFixed(1)} с`
}

export function formatMemory(value: number | null): string {
  if (value === null) {
    return '—'
  }
  return `${(value / 1024).toFixed(1)} ГБ`
}

export function formatSpeed(value: number | null): string {
  if (value === null) {
    return '—'
  }
  return value.toFixed(1)
}

export function formatLatencyDelta(
  base: number | null,
  value: number | null,
): string | null {
  if (base === null || value === null) {
    return null
  }
  const delta = (value - base) / 1000
  if (Math.abs(delta) < 0.05) {
    return '='
  }
  const sign = delta > 0 ? '+' : '−'
  return `${sign}${Math.abs(delta).toFixed(1)} с`
}
