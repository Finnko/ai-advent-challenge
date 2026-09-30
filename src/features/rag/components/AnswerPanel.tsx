import { useState } from 'react'
import { useRagAnswer } from '../api/use-rag-answer'
import { STRATEGY_IDS, STRATEGY_LABELS } from '../data/rag-ui'
import type { AnswerResult, ChunkingStrategyId } from '../types'
import AnswerCard from './AnswerCard'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

const K_OPTIONS = [3, 5, 10]

export default function AnswerPanel() {
  const [strategy, setStrategy] = useState<ChunkingStrategyId>('fixed')
  const [k, setK] = useState(5)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{
    rag: AnswerResult
    baseline: AnswerResult
  } | null>(null)
  const answer = useRagAnswer()

  const submit = async () => {
    if (query.trim().length === 0) {
      return
    }
    setResults(null)
    try {
      const [rag, baseline] = await Promise.all([
        answer.mutateAsync({ mode: 'rag', strategy, query, k }),
        answer.mutateAsync({ mode: 'baseline', strategy, query, k }),
      ])
      setResults({ rag, baseline })
    } catch {
      setResults(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Ответ по вопросу: с RAG и без RAG</CardTitle>
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
              placeholder="Например: в каком году основан Воронеж?"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void submit()
                }
              }}
            />
            <Button onClick={() => void submit()} disabled={answer.isPending}>
              {answer.isPending ? 'Отвечаю…' : 'Сравнить'}
            </Button>
          </div>
          {answer.error && (
            <Alert variant="destructive">
              {answer.error instanceof Error
                ? answer.error.message
                : String(answer.error)}
            </Alert>
          )}
        </CardContent>
      </Card>

      {results && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AnswerCard result={results.rag} />
          <AnswerCard result={results.baseline} />
        </div>
      )}
    </div>
  )
}
