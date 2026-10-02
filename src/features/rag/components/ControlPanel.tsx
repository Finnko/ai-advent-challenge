import { useState } from 'react'
import { useAbstainRun } from '../api/use-abstain-run'
import { useControlRun } from '../api/use-control-run'
import { ABSTAIN_QUESTIONS } from '../data/abstain-questions'
import {
  PIPELINE_IDS,
  PIPELINE_LABELS,
  PIPELINE_SHORT_LABELS,
  STRATEGY_IDS,
  STRATEGY_LABELS,
  VERDICT_LABELS,
} from '../data/rag-ui'
import type { AnswerVerdict, ChunkingStrategyId, RagPipelineId } from '../types'
import AnswerCard from './AnswerCard'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const K_OPTIONS = [3, 5, 10]

const VERDICTS: AnswerVerdict[] = [
  'correct',
  'partial',
  'wrong',
  'ungrounded',
  'abstained',
]

const DEFAULT_PIPELINES: RagPipelineId[] = ['rag', 'rag+rerank']

function countCorrect(
  rows: { results: Record<string, { verdict: AnswerVerdict | null }> }[],
  key: string,
): number {
  return rows.filter((row) => row.results[key]?.verdict === 'correct').length
}

function countGrounded(
  rows: {
    results: Record<
      string,
      { sources: unknown[]; quotes: { verified: boolean }[] }
    >
  }[],
  key: string,
): number {
  return rows.filter((row) => {
    const result = row.results[key]
    return (
      result !== undefined &&
      result.sources.length > 0 &&
      result.quotes.some((quote) => quote.verified)
    )
  }).length
}

function countAbstained(
  rows: { results: Record<string, { abstained: boolean }> }[],
  key: string,
): number {
  return rows.filter((row) => row.results[key]?.abstained === true).length
}

export default function ControlPanel() {
  const [strategy, setStrategy] = useState<ChunkingStrategyId>('fixed')
  const [k, setK] = useState(5)
  const [pipelines, setPipelines] = useState<RagPipelineId[]>(DEFAULT_PIPELINES)
  const run = useControlRun()
  const abstain = useAbstainRun()

  const togglePipeline = (id: RagPipelineId) => {
    setPipelines((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Контрольный набор: 10 вопросов</CardTitle>
        </CardHeader>
        <CardContent className="mt-3 flex flex-col gap-3">
          <p className="demo-muted m-0 text-xs">
            Каждый вопрос прогоняется по выбранным режимам и без RAG. Ответ
            верен, если найдены все ожидаемые факты (для RAG — ещё и со ссылкой
            на ожидаемый источник).
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
            <span className="demo-muted text-xs">режимы</span>
            {PIPELINE_IDS.map((id) => (
              <Button
                key={id}
                size="xs"
                variant={pipelines.includes(id) ? 'default' : 'secondary'}
                onClick={() => togglePipeline(id)}
              >
                {PIPELINE_LABELS[id]}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => void run.run({ strategy, k, pipelines })}
              disabled={run.running || pipelines.length === 0}
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
              {pipelines.map((id) => (
                <span key={id} className="mr-3">
                  {PIPELINE_LABELS[id]}: {countCorrect(run.rows, id)} /{' '}
                  {run.rows.length}
                </span>
              ))}
              <span>
                без RAG: {countCorrect(run.rows, 'baseline')} /{' '}
                {run.rows.length}
              </span>
            </Alert>
          )}
          {run.rows.length > 0 && (
            <Alert>
              <span className="demo-muted text-xs">
                с источниками и подтверждёнными цитатами:{' '}
              </span>
              {pipelines.map((id) => (
                <span key={id} className="mr-3 text-xs">
                  {PIPELINE_SHORT_LABELS[id]}: {countGrounded(run.rows, id)} /{' '}
                  {run.rows.length}
                </span>
              ))}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Режим «не знаю»: {ABSTAIN_QUESTIONS.length} вопроса
          </CardTitle>
        </CardHeader>
        <CardContent className="mt-3 flex flex-col gap-3">
          <p className="demo-muted m-0 text-xs">
            Вопросы заведомо вне корпуса. Для каждого RAG-режима ожидается
            abstain: ассистент обязан сказать «не знаю» и попросить уточнение,
            не вызывая модель.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => void abstain.run({ strategy, k, pipelines })}
              disabled={abstain.running || pipelines.length === 0}
            >
              {abstain.running ? 'Прогоняю…' : 'Проверить «не знаю»'}
            </Button>
            <Button
              variant="secondary"
              onClick={abstain.reset}
              disabled={abstain.running || abstain.rows.length === 0}
            >
              Сбросить
            </Button>
            <span className="demo-muted text-xs">
              {abstain.completed} / {abstain.total}
            </span>
          </div>
          {abstain.error && (
            <Alert variant="destructive">{abstain.error}</Alert>
          )}
          {abstain.rows.length > 0 && (
            <Alert>
              {pipelines.map((id) => (
                <span key={id} className="mr-3 text-xs">
                  {PIPELINE_SHORT_LABELS[id]}:{' '}
                  {countAbstained(abstain.rows, id)} / {abstain.rows.length}
                </span>
              ))}
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
            {pipelines.map((id) => {
              const result = row.results[id]
              return result ? <AnswerCard key={id} result={result} /> : null
            })}
            {row.results.baseline && (
              <AnswerCard result={row.results.baseline} />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
