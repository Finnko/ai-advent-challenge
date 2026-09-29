import { useState } from 'react'
import { useRagSearch } from '../api/use-rag-search'
import {
  STRATEGY_IDS,
  STRATEGY_LABELS,
  STRATEGY_SHORT_LABELS,
} from '../data/rag-ui'
import type { ChunkingStrategyId } from '../types'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

const K_OPTIONS = [3, 5, 10]

function scoreLabel(score: number): string {
  return score.toFixed(3)
}

export default function SearchPanel() {
  const [strategy, setStrategy] = useState<ChunkingStrategyId>('fixed')
  const [query, setQuery] = useState('')
  const [k, setK] = useState(5)
  const search = useRagSearch()
  const results = search.data ?? []

  const submit = () => {
    if (query.trim().length === 0) {
      return
    }
    search.mutate({ strategy, query, k })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Поиск по индексу</CardTitle>
        </CardHeader>
        <CardContent className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {STRATEGY_IDS.map((id) => (
              <Button
                key={id}
                size="xs"
                variant={strategy === id ? 'default' : 'secondary'}
                onClick={() => setStrategy(id)}
              >
                {STRATEGY_LABELS[id]}
              </Button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <span className="demo-muted text-xs">top-k</span>
              {K_OPTIONS.map((option) => (
                <Button
                  key={option}
                  size="xs"
                  variant={k === option ? 'default' : 'secondary'}
                  onClick={() => setK(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              value={query}
              placeholder="Например: город на Волге с Мамаевым курганом"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  submit()
                }
              }}
            />
            <Button onClick={submit} disabled={search.isPending}>
              {search.isPending ? 'Ищу…' : 'Найти'}
            </Button>
          </div>
          {search.error && (
            <Alert variant="destructive">
              {search.error instanceof Error
                ? search.error.message
                : String(search.error)}
            </Alert>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((result, index) => (
            <div
              key={result.chunk.chunkId}
              className="demo-panel flex flex-col gap-1 rounded-lg border border-[var(--line)] p-3"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="accent">#{index + 1}</Badge>
                <Badge>score {scoreLabel(result.score)}</Badge>
                <span className="font-semibold text-[var(--ink)]">
                  {result.chunk.title}
                </span>
                {result.chunk.section && (
                  <span className="demo-muted">
                    раздел: {result.chunk.section}
                  </span>
                )}
                <span className="demo-muted">
                  {STRATEGY_SHORT_LABELS[result.chunk.strategy]}
                </span>
              </div>
              <p className="m-0 whitespace-pre-wrap text-xs leading-relaxed text-[var(--ink-soft)]">
                {result.chunk.text}
              </p>
            </div>
          ))}
        </div>
      )}
      {search.isSuccess && results.length === 0 && (
        <p className="demo-muted text-xs">Ничего не найдено.</p>
      )}
    </div>
  )
}
