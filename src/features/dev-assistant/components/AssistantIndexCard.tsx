import { useState } from 'react'
import { useAssistantCorpus } from '../api/use-assistant-corpus'
import {
  useAssistantIndex,
  useBuildAssistantIndex,
} from '../api/use-assistant-index'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

function formatDate(value: string | null): string {
  if (!value) {
    return '—'
  }
  return new Date(value).toLocaleString('ru-RU')
}

export default function AssistantIndexCard() {
  const index = useAssistantIndex()
  const corpus = useAssistantCorpus()
  const build = useBuildAssistantIndex()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const missing = corpus.data?.filter((doc) => !doc.cached).length ?? 0

  const run = async () => {
    setMessage(null)
    setError(null)
    try {
      const result = await build.mutateAsync()
      setMessage(
        `Готово: ${result.documents} документов, ${result.chunks} чанков за ${result.durationMs} мс`,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Индекс проекта</CardTitle>
        {index.data && (
          <Badge variant="accent">{index.data.chunkCount} чанков</Badge>
        )}
      </CardHeader>
      <CardContent className="mt-3 flex flex-col gap-3">
        <p className="demo-muted m-0 text-xs">
          {corpus.data?.length ?? 0} документов с диска
          {missing > 0 ? `, ${missing} не найдено` : ''} ·{' '}
          {index.data?.embedModel ?? 'модель неизвестна'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void run()} disabled={build.isPending}>
            {build.isPending ? 'Индексирую…' : 'Переиндексировать'}
          </Button>
          {index.data && (
            <span className="demo-muted text-xs">
              модель: {index.data.model ?? '—'} · dim {index.data.dim} ·{' '}
              {formatDate(index.data.builtAt)}
            </span>
          )}
        </div>
        {message && <Alert>{message}</Alert>}
        {error && <Alert variant="destructive">{error}</Alert>}
        <div className="flex flex-col gap-2">
          {corpus.data?.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-xs"
            >
              <span className="font-semibold text-[var(--ink)]">
                {doc.title}
              </span>
              {doc.cached ? (
                <span className="demo-muted">{doc.charCount} симв.</span>
              ) : (
                <Badge variant="danger">нет файла</Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
