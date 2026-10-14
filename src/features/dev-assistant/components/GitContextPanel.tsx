import { useGitContext } from '../api/use-git-context'
import type { GitContext } from '../types'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function GitContextPanel({
  context,
}: {
  context?: GitContext | null
}) {
  const query = useGitContext()
  const data = context ?? query.data

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Контекст репозитория</CardTitle>
        {data?.branch && <Badge variant="accent">{data.branch}</Badge>}
      </CardHeader>
      <CardContent className="mt-3 flex flex-col gap-3">
        <p className="demo-muted m-0 text-xs">
          Живые данные из git-MCP-сервера (read-only): ветка, статус, коммиты,
          изменённые файлы и дифф.
        </p>
        {data?.available === false && (
          <span className="demo-muted text-xs">
            git-контекст недоступен
            {data.error ? `: ${data.error}` : ''}.
          </span>
        )}
        {data?.sections.map((section) => (
          <div key={section.tool} className="flex flex-col gap-1">
            <span className="demo-muted text-xs">{section.title}</span>
            <pre className="m-0 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--line)] bg-[var(--surface-tint)] p-2 text-[11px] leading-relaxed text-[var(--ink-soft)]">
              {section.text}
            </pre>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
