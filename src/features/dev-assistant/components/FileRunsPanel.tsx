import { useFileRuns } from '../api/use-file-task'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export default function FileRunsPanel() {
  const runs = useFileRuns()
  const items = runs.data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Последние прогоны</CardTitle>
      </CardHeader>
      <CardContent className="mt-2 flex flex-col gap-2">
        {runs.isLoading && <p className="demo-muted m-0 text-sm">Загружаю…</p>}
        {!runs.isLoading && items.length === 0 && (
          <p className="demo-muted m-0 text-sm">
            Прогонов ещё нет. Файловые задачи сохраняются сюда для
            воспроизводимости.
          </p>
        )}
        {items.map((run) => (
          <div
            key={run.id}
            className="flex flex-col gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="island-kicker m-0 text-[10px]">
                {run.mode === 'read' ? 'чтение' : 'запись'}
              </span>
              <span className="demo-muted ml-auto text-[10px]">
                {run.createdAt.slice(0, 16).replace('T', ' ')}
              </span>
            </div>
            <p className="m-0 text-xs">{run.goal}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
