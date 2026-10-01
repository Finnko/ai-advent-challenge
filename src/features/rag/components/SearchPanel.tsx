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
const CANDIDATE_K_OPTIONS = [10, 20, 40]

function scoreLabel(score: number): string {
  return score.toFixed(3)
}

export default function SearchPanel() {
  const [strategy, setStrategy] = useState<ChunkingStrategyId>('fixed')
  const [query, setQuery] = useState('')
  const [k, setK] = useState(5)
  const [candidateK, setCandidateK] = useState(20)
  const [rerank, setRerank] = useState(false)
  const [rewrite, setRewrite] = useState(false)
  const [useThreshold, setUseThreshold] = useState(true)
  const [threshold, setThreshold] = useState(0.5)
  const search = useRagSearch()
  const result = search.data
  const results = result?.results ?? []

  const submit = () => {
    if (query.trim().length === 0) {
      return
    }
    search.mutate({
      strategy,
      query,
      k,
      candidateK,
      rerank,
      rewrite,
      threshold: rerank && useThreshold ? threshold : null,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Поиск по индексу: реранкинг и порог</CardTitle>
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

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="xs"
              variant={rerank ? 'default' : 'secondary'}
              onClick={() => setRerank((value) => !value)}
            >
              {rerank ? 'Реранк: вкл' : 'Реранк: выкл'}
            </Button>
            <Button
              size="xs"
              variant={rewrite ? 'default' : 'secondary'}
              onClick={() => setRewrite((value) => !value)}
            >
              {rewrite ? 'Rewrite: вкл' : 'Rewrite: выкл'}
            </Button>
            <span className="demo-muted ml-auto text-xs">кандидатов</span>
            {CANDIDATE_K_OPTIONS.map((option) => (
              <Button
                key={option}
                size="xs"
                variant={candidateK === option ? 'default' : 'secondary'}
                onClick={() => setCandidateK(option)}
              >
                {option}
              </Button>
            ))}
          </div>

          {rerank && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="xs"
                variant={useThreshold ? 'default' : 'secondary'}
                onClick={() => setUseThreshold((value) => !value)}
              >
                {useThreshold ? 'Порог: вкл' : 'Порог: выкл'}
              </Button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={threshold}
                disabled={!useThreshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
                className="h-1 flex-1 cursor-pointer accent-[var(--accent)]"
              />
              <span className="demo-muted text-xs">
                {useThreshold ? threshold.toFixed(2) : 'без порога'}
              </span>
            </div>
          )}

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

      {result && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">кандидатов: {result.candidateCount}</Badge>
          <Badge variant={result.reranked ? 'success' : 'outline'}>
            {result.reranked ? 'реранк применён' : 'реранк не применён'}
          </Badge>
          {result.rewrittenQuery && (
            <Badge variant="accent">запрос: {result.rewrittenQuery}</Badge>
          )}
        </div>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((item, index) => (
            <div
              key={item.chunk.chunkId}
              className="demo-panel flex flex-col gap-1 rounded-lg border border-[var(--line)] p-3"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="accent">#{index + 1}</Badge>
                {item.relevance !== undefined ? (
                  <>
                    <Badge>rel {scoreLabel(item.relevance)}</Badge>
                    {item.originalScore !== undefined && (
                      <Badge variant="outline">
                        cos {scoreLabel(item.originalScore)}
                      </Badge>
                    )}
                  </>
                ) : (
                  <Badge>score {scoreLabel(item.score)}</Badge>
                )}
                <span className="font-semibold text-[var(--ink)]">
                  {item.chunk.title}
                </span>
                {item.chunk.section && (
                  <span className="demo-muted">
                    раздел: {item.chunk.section}
                  </span>
                )}
                <span className="demo-muted">
                  {STRATEGY_SHORT_LABELS[item.chunk.strategy]}
                </span>
              </div>
              <p className="m-0 whitespace-pre-wrap text-xs leading-relaxed text-[var(--ink-soft)]">
                {item.chunk.text}
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
