import { useState } from 'react'
import { useGeneratorRun, type GeneratorRunRow } from '../api/use-generator-run'
import { useRagLocalStatus } from '../api/use-rag-local-status'
import {
  GENERATOR_LABELS,
  PIPELINE_IDS,
  PIPELINE_LABELS,
  STRATEGY_IDS,
  STRATEGY_LABELS,
} from '../data/rag-ui'
import type {
  AnswerGenerator,
  AnswerResult,
  ChunkingStrategyId,
  RagPipelineId,
} from '../types'
import AnswerCard from './AnswerCard'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const K_OPTIONS = [3, 5, 10]
const GENERATORS: AnswerGenerator[] = ['cloud', 'local']

type GeneratorSummary = {
  correct: number
  grounded: number
  abstained: number
  parseFallback: number
  errors: number
  avgLatencyMs: number | null
  avgTokensPerSecond: number | null
}

function tokensPerSecond(result: AnswerResult): number | null {
  const completion = result.usage?.completion_tokens
  if (!completion || result.latencyMs <= 0) {
    return null
  }
  return completion / (result.latencyMs / 1000)
}

function summarize(
  rows: GeneratorRunRow[],
  generator: AnswerGenerator,
): GeneratorSummary {
  let correct = 0
  let grounded = 0
  let abstained = 0
  let parseFallback = 0
  let errors = 0
  let latencyTotal = 0
  let speedTotal = 0
  let speedCount = 0
  let answered = 0

  for (const row of rows) {
    const cell = row.cells[generator]
    if (cell.error) {
      errors += 1
      continue
    }
    const result = cell.result
    if (!result) {
      continue
    }
    if (result.verdict === 'correct') {
      correct += 1
    }
    if (result.sources.length > 0 && result.quotes.some((q) => q.verified)) {
      grounded += 1
    }
    if (result.abstained) {
      abstained += 1
      continue
    }
    answered += 1
    if (result.format === 'text') {
      parseFallback += 1
    }
    latencyTotal += result.latencyMs
    const speed = tokensPerSecond(result)
    if (speed !== null) {
      speedTotal += speed
      speedCount += 1
    }
  }

  return {
    correct,
    grounded,
    abstained,
    parseFallback,
    errors,
    avgLatencyMs: answered > 0 ? Math.round(latencyTotal / answered) : null,
    avgTokensPerSecond:
      speedCount > 0 ? Math.round((speedTotal / speedCount) * 10) / 10 : null,
  }
}

function summaryText(summary: GeneratorSummary, total: number): string {
  const parts = [
    `верно ${summary.correct} / ${total}`,
    `с цитатами ${summary.grounded} / ${total}`,
    `не знаю ${summary.abstained}`,
  ]
  if (summary.avgLatencyMs !== null) {
    parts.push(`~${summary.avgLatencyMs} мс`)
  }
  if (summary.avgTokensPerSecond !== null) {
    parts.push(`${summary.avgTokensPerSecond} ток/с`)
  }
  if (summary.parseFallback > 0) {
    parts.push(`JSON-сбой ${summary.parseFallback}`)
  }
  if (summary.errors > 0) {
    parts.push(`ошибок ${summary.errors}`)
  }
  return parts.join(' · ')
}

export default function LocalVsCloudPanel() {
  const [strategy, setStrategy] = useState<ChunkingStrategyId>('fixed')
  const [k, setK] = useState(5)
  const [pipeline, setPipeline] = useState<RagPipelineId>('rag+rerank')
  const run = useGeneratorRun()
  const localStatus = useRagLocalStatus()

  const total = run.rows.length
  const summaries: Record<AnswerGenerator, GeneratorSummary> = {
    cloud: summarize(run.rows, 'cloud'),
    local: summarize(run.rows, 'local'),
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Локальная vs облачная модель (RAG)</CardTitle>
      </CardHeader>
      <CardContent className="mt-3 flex flex-col gap-3">
        <p className="demo-muted m-0 text-xs">
          Контрольный набор прогоняется в режиме RAG выбранным пайплайном двумя
          генераторами — облачным и локальным. Промпт, контракт и верификация
          цитат одинаковые: сравниваем качество, скорость и стабильность.
        </p>

        {localStatus.data?.available === false && (
          <Alert variant="destructive">
            Локальный сервер недоступен
            {localStatus.data.error ? `: ${localStatus.data.error}` : ''} —
            запустите mlx_lm.server с моделью{' '}
            {localStatus.data.model ?? 'Qwen3-14B-4bit'}.
          </Alert>
        )}

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
          <span className="demo-muted text-xs">пайплайн</span>
          {PIPELINE_IDS.map((id) => (
            <Button
              key={id}
              size="xs"
              variant={pipeline === id ? 'default' : 'secondary'}
              onClick={() => setPipeline(id)}
            >
              {PIPELINE_LABELS[id]}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => void run.run({ strategy, k, pipeline })}
            disabled={run.running}
          >
            {run.running ? 'Сравниваю…' : 'Сравнить генераторы'}
          </Button>
          <Button
            variant="secondary"
            onClick={run.reset}
            disabled={run.running || total === 0}
          >
            Сбросить
          </Button>
          <span className="demo-muted text-xs">
            {run.completed} / {run.total}
          </span>
        </div>

        {total > 0 && (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {GENERATORS.map((generator) => (
              <div
                key={generator}
                className="rounded-lg border border-[var(--line)] bg-[var(--surface-tint)] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Badge variant={generator === 'local' ? 'accent' : 'default'}>
                    {GENERATOR_LABELS[generator]}
                  </Badge>
                </div>
                <p className="demo-muted m-0 mt-1 text-xs">
                  {summaryText(summaries[generator], total)}
                </p>
              </div>
            ))}
          </div>
        )}

        {run.rows.map((row) => (
          <div key={row.question.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 px-1">
              <Badge variant="accent">#{row.question.id}</Badge>
              <span className="font-semibold text-[var(--ink)]">
                {row.question.query}
              </span>
              <span className="demo-muted text-xs">
                Ожидание: {row.question.expected.join(', ')}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {GENERATORS.map((generator) => {
                const cell = row.cells[generator]
                if (cell.error) {
                  return (
                    <Alert key={generator} variant="destructive">
                      {GENERATOR_LABELS[generator]}: {cell.error}
                    </Alert>
                  )
                }
                if (!cell.result) {
                  return null
                }
                return (
                  <AnswerCard
                    key={generator}
                    title={GENERATOR_LABELS[generator]}
                    result={cell.result}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
