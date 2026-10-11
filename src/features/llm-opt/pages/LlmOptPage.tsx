import { useMemo, useState } from 'react'
import { SWEEP_CONFIGS, DEFAULT_CONFIG_ID } from '../data/configs'
import { TASK_PROFILE } from '../data/profile'
import { summarizeRuns } from '../domain/results'
import {
  useLlmOptStatus,
  useResetRuns,
  useRuns,
  useSweepRun,
} from '../api/use-llm-opt'
import ConfigPicker from '../components/ConfigPicker'
import InspectorPanel from '../components/InspectorPanel'
import ResultsView from '../components/ResultsView'
import StatusBanner from '../components/StatusBanner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const ALL_CONFIG_IDS = SWEEP_CONFIGS.map((config) => config.id)
const ALL_DOC_IDS = TASK_PROFILE.docs.map((doc) => doc.id)

export default function LlmOptPage() {
  const status = useLlmOptStatus()
  const runsQuery = useRuns()
  const sweep = useSweepRun()
  const resetRuns = useResetRuns()
  const [selected, setSelected] = useState<string[]>(ALL_CONFIG_IDS)

  const runs = useMemo(() => runsQuery.data ?? [], [runsQuery.data])
  const summaries = useMemo(() => summarizeRuns(runs), [runs])

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  return (
    <div className="page-wrap flex flex-col gap-4 px-4 pb-8 pt-6">
      <header className="mb-1">
        <p className="island-kicker mb-2">Day 29 · оптимизация локальной LLM</p>
        <h1 className="demo-title mb-2">Лаборатория оптимизации</h1>
        <p className="demo-muted m-0 max-w-[74ch] text-sm">
          Задача: {TASK_PROFILE.description} Стенд прогоняет один и тот же набор
          из {TASK_PROFILE.docs.length} документов по разным конфигурациям
          (prompt, temperature, max_tokens, размер контекста, JSON-режим) и
          считает качество (точность по полям), скорость (латентность, ток/с) и
          память (footprint процесса модели). Победитель и дефолт профиля
          считаются по каждой модели отдельно.
        </p>
      </header>

      <StatusBanner
        status={status.data}
        isPending={status.isFetching}
        onRetry={() => void status.refetch()}
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>Обслуживаемая модель</CardTitle>
          <Badge variant={status.data?.available ? 'success' : 'danger'}>
            {status.data?.available ? 'онлайн' : 'офлайн'}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="demo-muted m-0 text-xs">
            Прогоны подписываются id модели из <code>/models</code>. Между
            квантизациями перезапусти сервер — сессии сложатся в одну таблицу.
          </p>
          <pre className="m-0 overflow-x-auto rounded-md border border-[var(--line)] bg-[var(--surface-tint)] p-2 text-xs text-[var(--ink-soft)]">
            {`.local-llm-venv/bin/mlx_lm.convert --hf-path mlx-community/Qwen3-14B-4bit -q --q-bits 6 --mlx-path ~/models/qwen3-14b-6bit
.local-llm-venv/bin/mlx_lm.server --model ~/models/qwen3-14b-6bit --port 8080`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sweep конфигураций</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ConfigPicker
            selected={selected}
            disabled={sweep.running}
            onToggle={toggle}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() =>
                void sweep.run({ configIds: selected, docIds: ALL_DOC_IDS })
              }
              disabled={sweep.running || selected.length === 0}
            >
              {sweep.running ? 'Гоняю…' : `Прогнать ${selected.length} конфиг.`}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSelected(ALL_CONFIG_IDS)}
              disabled={sweep.running}
            >
              Выбрать все
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSelected([ALL_CONFIG_IDS[0]])}
              disabled={sweep.running}
            >
              Только база
            </Button>
            {sweep.total > 0 && (
              <span className="demo-muted text-xs">
                {sweep.completed} / {sweep.total}
                {sweep.currentLabel ? ` · ${sweep.currentLabel}` : ''}
              </span>
            )}
          </div>
          {sweep.error && (
            <Alert variant="destructive">
              <AlertTitle>Прогон прервался</AlertTitle>
              <AlertDescription>{sweep.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>Результаты: до / после</CardTitle>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => resetRuns.mutate()}
            disabled={resetRuns.isPending || runs.length === 0}
          >
            Сбросить результаты
          </Button>
        </CardHeader>
        <CardContent>
          <ResultsView
            summaries={summaries}
            runs={runs}
            defaultConfigId={DEFAULT_CONFIG_ID}
            fields={TASK_PROFILE.fields}
            fieldLabels={TASK_PROFILE.fieldLabels}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Разбор прогонов</CardTitle>
        </CardHeader>
        <CardContent>
          <InspectorPanel runs={runs} fieldLabels={TASK_PROFILE.fieldLabels} />
        </CardContent>
      </Card>
    </div>
  )
}
