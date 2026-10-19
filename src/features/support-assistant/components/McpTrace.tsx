import { Badge } from '@/components/ui/Badge'
import type { ToolTrace } from '../domain/types'

export default function McpTrace({ trace }: { trace: ToolTrace[] }) {
  return (
    <section className="island-shell flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        <h2 className="island-kicker m-0">MCP-вызовы</h2>
        <Badge variant="outline">{trace.length}</Badge>
      </div>
      {trace.length === 0 && (
        <p className="demo-muted m-0 text-xs">
          Вызовов не было — MCP-сервер недоступен или вопрос обошёлся без него.
        </p>
      )}
      {trace.map((call, index) => (
        <div
          key={`${call.name}-${index}`}
          className="flex flex-col gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={call.ok ? 'success' : 'danger'}>
              {call.ok ? 'ok' : 'error'}
            </Badge>
            <span className="font-mono font-semibold text-[var(--ink)]">
              {call.name}
            </span>
            <span className="demo-muted">{call.durationMs} мс</span>
          </div>
          <span className="break-all font-mono text-[11px] text-[var(--ink-muted)]">
            {JSON.stringify(call.args)}
          </span>
          {call.error && (
            <span className="text-[11px] text-[var(--danger)]">
              {call.error}
            </span>
          )}
        </div>
      ))}
    </section>
  )
}
