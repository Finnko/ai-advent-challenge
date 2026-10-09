import { useState } from 'react'
import { useRagAnswer } from '../api/use-rag-answer'
import { useRagLocalStatus } from '../api/use-rag-local-status'
import {
  GENERATOR_IDS,
  GENERATOR_LABELS,
  GENERATOR_SHORT_LABELS,
  MODE_LABELS,
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
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

const K_OPTIONS = [3, 5, 10]

type CompareMode = 'mode' | 'generator'

type PanelResults = {
  left: { title: string; result: AnswerResult }
  right: { title: string; result: AnswerResult }
}

export default function AnswerPanel() {
  const [strategy, setStrategy] = useState<ChunkingStrategyId>('fixed')
  const [k, setK] = useState(5)
  const [pipeline, setPipeline] = useState<RagPipelineId>('rag+rerank')
  const [stitch, setStitch] = useState(true)
  const [generator, setGenerator] = useState<AnswerGenerator>('cloud')
  const [compare, setCompare] = useState<CompareMode>('mode')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PanelResults | null>(null)
  const answer = useRagAnswer()
  const localStatus = useRagLocalStatus()

  const generatorLabel = GENERATOR_SHORT_LABELS[generator]
  const pipelineLabel = PIPELINE_LABELS[pipeline]
  const localUnavailable =
    (generator === 'local' || compare === 'generator') &&
    localStatus.data?.available === false

  const submit = async () => {
    if (query.trim().length === 0) {
      return
    }
    setResults(null)
    try {
      if (compare === 'generator') {
        const [cloud, local] = await Promise.all([
          answer.mutateAsync({
            mode: 'rag',
            strategy,
            query,
            k,
            pipeline,
            stitch,
            generator: 'cloud',
          }),
          answer.mutateAsync({
            mode: 'rag',
            strategy,
            query,
            k,
            pipeline,
            stitch,
            generator: 'local',
          }),
        ])
        setResults({
          left: { title: `${pipelineLabel} · облако`, result: cloud },
          right: { title: `${pipelineLabel} · локально`, result: local },
        })
        return
      }
      const [rag, baseline] = await Promise.all([
        answer.mutateAsync({
          mode: 'rag',
          strategy,
          query,
          k,
          pipeline,
          stitch,
          generator,
        }),
        answer.mutateAsync({
          mode: 'baseline',
          strategy,
          query,
          k,
          generator,
        }),
      ])
      setResults({
        left: { title: `${pipelineLabel} · ${generatorLabel}`, result: rag },
        right: {
          title: `${MODE_LABELS.baseline} · ${generatorLabel}`,
          result: baseline,
        },
      })
    } catch {
      setResults(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Ответ по вопросу: режим RAG и без RAG</CardTitle>
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
            <span className="demo-muted text-xs">режим</span>
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
            <span className="demo-muted text-xs">генератор</span>
            {GENERATOR_IDS.map((id) => (
              <Button
                key={id}
                size="xs"
                variant={generator === id ? 'default' : 'secondary'}
                onClick={() => setGenerator(id)}
                disabled={compare === 'generator'}
              >
                {GENERATOR_LABELS[id]}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="demo-muted text-xs">сравнить</span>
            <Button
              size="xs"
              variant={compare === 'mode' ? 'default' : 'secondary'}
              onClick={() => setCompare('mode')}
            >
              RAG vs без RAG
            </Button>
            <Button
              size="xs"
              variant={compare === 'generator' ? 'default' : 'secondary'}
              onClick={() => setCompare('generator')}
            >
              Облако vs локально
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="demo-muted text-xs">контекст</span>
            <Button
              size="xs"
              variant={stitch ? 'default' : 'secondary'}
              onClick={() => setStitch((value) => !value)}
            >
              {stitch ? 'широкий (соседние чанки)' : 'только top-k'}
            </Button>
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
          {localUnavailable && (
            <Alert variant="destructive">
              Локальный сервер недоступен
              {localStatus.data?.error ? `: ${localStatus.data.error}` : ''} —
              запустите mlx_lm.server с моделью{' '}
              {localStatus.data?.model ?? 'Qwen3-14B-4bit'}.
            </Alert>
          )}
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
          <AnswerCard title={results.left.title} result={results.left.result} />
          <AnswerCard
            title={results.right.title}
            result={results.right.result}
          />
        </div>
      )}
    </div>
  )
}
