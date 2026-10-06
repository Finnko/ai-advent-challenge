import { useState } from 'react'
import { useLocalLlmRun, useLocalLlmStatus } from '../api/use-local-llm'
import { LOCAL_LLM_PRESETS } from '../data/presets'
import type { LocalLlmAnswer, LocalLlmInput, LocalLlmPreset } from '../types'
import AnswerCard from '../components/AnswerCard'
import PresetButtons from '../components/PresetButtons'
import PromptForm from '../components/PromptForm'
import StatusBanner from '../components/StatusBanner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

type Entry = {
  id: string
  title: string
  prompt: string
  state: 'running' | 'done' | 'error'
  result?: LocalLlmAnswer
  error?: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function LocalLlmPage() {
  const status = useLocalLlmStatus()
  const run = useLocalLlmRun()
  const [entries, setEntries] = useState<Entry[]>([])

  const start = async (title: string, prompt: string, input: LocalLlmInput) => {
    const id = crypto.randomUUID()
    setEntries((prev) => [{ id, title, prompt, state: 'running' }, ...prev])
    try {
      const result = await run.mutateAsync(input)
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === id ? { ...entry, state: 'done', result } : entry,
        ),
      )
    } catch (error) {
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? { ...entry, state: 'error', error: errorMessage(error) }
            : entry,
        ),
      )
    }
  }

  const runPreset = (preset: LocalLlmPreset) => {
    void start(preset.label, preset.prompt, { presetId: preset.id })
  }

  const runCustom = (prompt: string) => {
    void start('Свой вопрос', prompt, { prompt })
  }

  return (
    <div className="page-wrap flex flex-col gap-4 px-4 pb-8 pt-6">
      <header className="mb-1">
        <p className="island-kicker mb-2">Day 26 · локальная LLM</p>
        <h1 className="demo-title mb-2">Локальная LLM</h1>
        <p className="demo-muted m-0 max-w-[70ch] text-sm">
          Модель Qwen3-8B-4bit работает локально через MLX на Apple Silicon и
          отвечает по OpenAI-совместимому HTTP API — без облака. Прогони три
          пресета разной сложности или задай свой вопрос и посмотри ответ,
          латентность и скорость генерации.
        </p>
      </header>

      <StatusBanner
        status={status.data}
        isPending={status.isFetching}
        onRetry={() => void status.refetch()}
      />

      <Card>
        <CardHeader>
          <CardTitle>Запрос к локальной модели</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="demo-muted m-0 text-xs">Пресеты разной сложности</p>
            <PresetButtons
              presets={LOCAL_LLM_PRESETS}
              onRun={runPreset}
              disabled={run.isPending}
            />
          </div>
          <div className="border-t border-[var(--line)] pt-4">
            <PromptForm onSubmit={runCustom} disabled={run.isPending} />
          </div>
        </CardContent>
      </Card>

      {entries.length > 0 && (
        <div className="flex flex-col gap-4">
          {entries.map((entry) => (
            <AnswerCard key={entry.id} {...entry} />
          ))}
        </div>
      )}
    </div>
  )
}
