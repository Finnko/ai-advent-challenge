import { useState } from 'react'
import { useBuildIndex, useRagIndex } from '../api/use-rag-index'
import { useRagCorpus } from '../api/use-rag-corpus'
import {
  STRATEGY_DETAILS,
  STRATEGY_LABELS,
} from '../data/rag-ui'
import type { ChunkingStrategyId } from '../types'
import ChunkBrowser from './ChunkBrowser'
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

export default function IndexPanel() {
  const index = useRagIndex()
  const corpus = useRagCorpus()
  const build = useBuildIndex()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (strategy: ChunkingStrategyId | 'all') => {
    setMessage(null)
    setError(null)
    try {
      const result = await build.mutateAsync(strategy)
      const chunks = result.results.reduce((sum, item) => sum + item.chunks, 0)
      setMessage(
        `Готово: ${result.results.length} индекс(а), ${chunks} чанков за ${result.results
          .map((item) => `${item.durationMs} мс`)
          .join(', ')}`,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const cachedCount = corpus.data?.filter((doc) => doc.cached).length ?? 0

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Корпус</CardTitle>
        </CardHeader>
        <CardContent className="mt-3 flex flex-col gap-3">
          <p className="demo-muted m-0 text-xs">
            {cachedCount} из {corpus.data?.length ?? 0} статей в кеше ·{' '}
            {index.data?.embedModel ?? 'модель неизвестна'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => run('all')} disabled={build.isPending}>
              {build.isPending ? 'Индексирую…' : 'Собрать обе стратегии'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => run('fixed')}
              disabled={build.isPending}
            >
              Только fixed
            </Button>
            <Button
              variant="secondary"
              onClick={() => run('structural')}
              disabled={build.isPending}
            >
              Только structural
            </Button>
          </div>
          {message && <Alert>{message}</Alert>}
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                  <Badge variant="default">не загружена</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Индексы</CardTitle>
        </CardHeader>
        <CardContent className="mt-3 flex flex-col gap-2">
          {index.data?.strategies.map((strategy) => (
            <div
              key={strategy.strategy}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-xs"
            >
              <div className="flex flex-col">
                <span className="font-semibold text-[var(--ink)]">
                  {STRATEGY_LABELS[strategy.strategy]}
                </span>
                <span className="demo-muted">
                  {STRATEGY_DETAILS[strategy.strategy]}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">{strategy.chunkCount} чанков</Badge>
                {strategy.dim > 0 && <Badge>dim {strategy.dim}</Badge>}
                <span className="demo-muted">
                  {formatDate(strategy.builtAt)}
                </span>
              </div>
            </div>
          ))}
          {index.data?.documents.length === 0 && (
            <p className="demo-muted m-0 text-xs">
              Документы ещё не индексировались.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Чанки</CardTitle>
        </CardHeader>
        <CardContent className="mt-3">
          <ChunkBrowser />
        </CardContent>
      </Card>
    </div>
  )
}
