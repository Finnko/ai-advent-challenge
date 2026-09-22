import type { McpToolDescriptor } from '../domain/mcp/types'
import { Badge } from '@/components/ui/Badge'

export default function McpToolCard({ tool }: { tool: McpToolDescriptor }) {
  return (
    <article className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="accent">{tool.name}</Badge>
        {tool.title && (
          <span className="text-sm font-bold text-[var(--ink)]">
            {tool.title}
          </span>
        )}
      </div>
      {tool.description && (
        <p className="demo-muted m-0 mt-2 text-xs">{tool.description}</p>
      )}
      <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--surface-tint)] p-2 text-[10px] text-[var(--ink-muted)]">
        {JSON.stringify(tool.inputSchema, null, 2)}
      </pre>
    </article>
  )
}
