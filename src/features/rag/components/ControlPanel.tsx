import { useControlRun } from '../api/use-control-run'
import { STRATEGY_IDS, STRATEGY_LABELS, VERDICT_LABELS } from '../data/rag-ui'
import type { AnswerVerdict, ChunkingStrategyId } from '../types'
import { useState } from 'react'
import AnswerCard from './AnswerCard'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const K_OPTIONS = [3, 5, 10]

const VERDICTS: AnswerVerdict[] = ['correct', 'partial', 'wrong', 'ungrounded']

function countCorrect(
  rows: { rag: { verdict: AnswerVerdict | null }; baseline: { verdict: AnswerVerdict | null } }[],
  key: 'rag' | 'baseline',
): number {
  return rows.filter((row) => row[key].verdict === 'correct').length
}

export default function ControlPanel() {
  const [strategy, setStrategy] = useState<ChunkingStrategyId>('fixed')
  const [k, setK] = useState(5)
  const run = useControlRun()

  const ragCorrect = countCorrect(run.rows, 'rag')
  const baselineCorrect = countCorrect(run.rows, 'baseline')

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Контрольный набор: 10 вопросов</CardTitle>
        </CardHeader>
        <CardContent className="mt-3 flex flex-col gap-3">
          <p className="demo-muted m-0 text-xs">
            Каждый вопрос прогоняется дважды — с RAG и без. Ответ считается
            верным, если найдены все ожидаемые факты (для RAG — ещё и со
            ссылкой на ожидаемый источник).
          </p>
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
              onClick={() => void run.run({ strategy, k })}
              disabled={run.running}
            >
              {run.running ? 'Прогоняю…' : 'Прогнать все'}
            </Button>
            <Button
              variant="secondary"
              onClick={run.reset}
              disabled={run.running || run.rows.length === 0}
            >
              Сбросить
            </Button>
            <span className="demo-muted text-xs">
              {run.completed} / {run.total}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {VERDICTS.map((verdict) => (
              <Badge key={verdict} variant="outline">
                {VERDICT_LABELS[verdict]}
              </Badge>
            ))}
          </div>
          {run.error && <Alert variant="destructive">{run.error}</Alert>}
          {run.rows.length > 0 && (
            <Alert>
              Верно: RAG {ragCorrect} / {run.rows.length} · без RAG{' '}
              {baselineCorrect} / {run.rows.length}
            </Alert>
          )}
        </CardContent>
      </Card>

      {run.rows.map((row) => (
        <div key={row.question.id} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 px-1">
            <Badge variant="accent">#{row.question.id}</Badge>
            <span className="font-semibold text-[var(--ink)]">
              {row.question.query}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-1">
            <span className="demo-muted text-xs">
              Ожидание: {row.question.expected.join(', ')}
            </span>
            <span className="demo-muted text-xs">
              Источники: {row.question.sources.join(', ')}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <AnswerCard result={row.rag} />
            <AnswerCard result={row.baseline} />
          </div>
        </div>
      ))}
    </div>
  )
}
