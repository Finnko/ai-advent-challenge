import type { LocalLlmAnswer } from '../types'

function formatLatency(latencyMs: number): string {
  if (latencyMs < 1000) {
    return `${latencyMs} мс`
  }
  return `${(latencyMs / 1000).toFixed(1)} с`
}

export default function MetricsRow({ result }: { result: LocalLlmAnswer }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      <span className="demo-muted text-xs">
        модель <span className="font-semibold text-ink">{result.model}</span>
      </span>
      <span className="demo-muted text-xs">
        latency{' '}
        <span className="font-semibold text-ink">
          {formatLatency(result.latencyMs)}
        </span>
      </span>
      {result.usage && (
        <span className="demo-muted text-xs">
          tokens{' '}
          <span className="font-semibold text-ink">
            {result.usage.completion_tokens}
          </span>
        </span>
      )}
      {result.tokensPerSecond !== null && (
        <span className="demo-muted text-xs">
          tok/s{' '}
          <span className="font-semibold text-ink">
            {result.tokensPerSecond}
          </span>
        </span>
      )}
    </div>
  )
}
