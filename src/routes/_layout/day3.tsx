import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { ask } from '@lib/functions/ask.functions'
import type { ChatResult } from '@lib/llm'
import {
  EXPERT_ROLES,
  HELPFUL_SYSTEM,
  JUDGE_SYSTEM,
  PROMPT_ENGINEER_SYSTEM,
  STEPWISE_SYSTEM,
  STRATEGIES,
  TASKS,
  buildJudgePrompt,
} from '@lib/day3'
import type { Day3Task, StrategyId } from '@lib/day3'
import { Button } from '@/components/ui/Button'
import TypingDots from '@/components/TypingDots'
import StrategyCard from './-day3/StrategyCard'
import VerdictCard from './-day3/VerdictCard'
import type {
  Answer,
  ResultState,
  StrategyResult,
  VerdictShape,
  VerdictState,
} from './-day3/types'

export const Route = createFileRoute('/_layout/day3')({ component: Day3 })

const IDLE_RESULTS = Object.fromEntries(
  STRATEGIES.map((s) => [s.id, { status: 'idle' }]),
) as Record<StrategyId, ResultState>

function Day3() {
  const [selectedId, setSelectedId] = useState<string>(TASKS[0].id)
  const [results, setResults] =
    useState<Record<StrategyId, ResultState>>(IDLE_RESULTS)
  const [verdict, setVerdict] = useState<VerdictState>({ status: 'idle' })
  const [running, setRunning] = useState(false)
  const resultsRef = useRef(results)

  const task = TASKS.find((t) => t.id === selectedId) ?? TASKS[0]

  const updateResult = (id: StrategyId, state: ResultState) => {
    resultsRef.current = { ...resultsRef.current, [id]: state }
    setResults((prev) => ({ ...prev, [id]: state }))
  }

  const clearAll = () => {
    resultsRef.current = { ...IDLE_RESULTS }
    setResults({ ...IDLE_RESULTS })
    setVerdict({ status: 'idle' })
  }

  const handleSelectTask = (id: string) => {
    if (id === selectedId || running) {
      return
    }
    setSelectedId(id)
    clearAll()
  }

  const runJudge = async (
    task: Day3Task,
    answers: { id: StrategyId; content: string }[],
  ) => {
    setVerdict({ status: 'loading' })
    try {
      const res = await ask({
        data: {
          system: JUDGE_SYSTEM,
          user: buildJudgePrompt(task, answers),
          params: {
            response_format: { type: 'json_object' },
            max_tokens: 700,
          },
        },
      })
      const parsed = parseVerdict(res.content)
      if (!parsed) {
        setVerdict({
          status: 'error',
          error: 'Судья вернул некорректный вердикт',
          raw: res.content,
        })
        return
      }
      setVerdict({ status: 'done', verdict: parsed })
    } catch (err) {
      setVerdict({ status: 'error', error: toError(err), raw: '' })
    }
  }

  const runStrategy = async (
    id: StrategyId,
    task: Day3Task,
  ): Promise<string | null> => {
    updateResult(id, { status: 'loading' })
    try {
      const result = await executeStrategy(id, task)
      updateResult(id, { status: 'done', result })
      return resultToText(result)
    } catch (err) {
      updateResult(id, { status: 'error', error: toError(err) })
      return null
    }
  }

  const handleRunAll = async () => {
    if (running) {
      return
    }
    setRunning(true)
    clearAll()
    const texts = await Promise.all(
      STRATEGIES.map(({ id }) => runStrategy(id, task)),
    )
    const answers = texts.flatMap((text, i) =>
      text ? [{ id: STRATEGIES[i].id, content: text }] : [],
    )
    if (answers.length === STRATEGIES.length) {
      await runJudge(task, answers)
    } else if (answers.length > 0) {
      setVerdict({
        status: 'error',
        error: 'Не удалось оценить: не все четыре стратегии вернули ответ.',
        raw: '',
      })
    }
    setRunning(false)
  }

  const handleRerun = async (id: StrategyId) => {
    if (running) {
      return
    }
    setRunning(true)
    setVerdict({ status: 'idle' })
    await runStrategy(id, task)
    const ready = STRATEGIES.every(
      ({ id: sid }) => resultsRef.current[sid].status === 'done',
    )
    if (ready) {
      const answers = STRATEGIES.flatMap(({ id: sid }) => {
        const state = resultsRef.current[sid]
        return state.status === 'done'
          ? [{ id: sid, content: resultToText(state.result) }]
          : []
      })
      await runJudge(task, answers)
    }
    setRunning(false)
  }

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col gap-4 overflow-y-auto px-4 py-6">
      <header className="mb-2">
        <p className="island-kicker mb-2">Prompt strategies</p>
        <h1 className="demo-title mb-2">Стратегии промптов</h1>
        <p className="demo-muted m-0 max-w-2xl text-sm">
          Выбери задачу и реши её четырьмя способами: напрямую, пошагово, через
          самостоятельно написанный промпт и группой экспертов. Когда все четыре
          ответят, судья сравнивает их с эталонным ответом.
        </p>
      </header>

      <section className="demo-panel p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          {TASKS.map((t) => {
            const isActive = t.id === selectedId
            return (
              <Button
                key={t.id}
                variant={isActive ? 'default' : 'secondary'}
                onClick={() => handleSelectTask(t.id)}
              >
                {t.label}
              </Button>
            )
          })}
        </div>
        <p className="demo-muted m-0 mb-2 text-xs">
          Задание для всех четырёх стратегий (выбери одно):
        </p>
        <div className="demo-code-block whitespace-pre-wrap">{task.prompt}</div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => void handleRunAll()} disabled={running}>
            {running ? 'Выполняется…' : 'Запустить 4 стратегии'}
          </Button>
          {verdict.status === 'loading' && (
            <TypingDots text="Судья оценивает ответы…" />
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {STRATEGIES.map(({ id, label, description }) => {
          const state = results[id]
          return (
            <div key={id} className="demo-panel flex min-h-0 flex-col p-5">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <h2 className="demo-section-title m-0">{label}</h2>
                  <p className="demo-muted m-0 text-xs">{description}</p>
                </div>
                {(state.status === 'done' || state.status === 'error') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleRerun(id)}
                    disabled={running}
                  >
                    Повторить
                  </Button>
                )}
              </div>
              <div className="min-h-0 flex-1 pt-3">
                <StrategyCard state={state} id={id} prompt={task.prompt} />
              </div>
            </div>
          )
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="demo-panel p-5">
          <h2 className="demo-section-title mb-3">Эталонный ответ</h2>
          <div className="demo-code-block whitespace-pre-wrap text-sm">
            {task.reference}
          </div>
          <p className="demo-muted m-0 mt-2 text-xs">
            Ожидаемое решение, с которым судья сверяет четыре ответа.
          </p>
        </div>
        <div className="demo-panel p-5">
          <h2 className="demo-section-title mb-3">Вердикт сравнения</h2>
          <VerdictCard verdict={verdict} />
        </div>
      </section>
    </div>
  )
}

async function executeStrategy(
  id: StrategyId,
  task: Day3Task,
): Promise<StrategyResult> {
  switch (id) {
    case 'direct': {
      const answer = await ask({
        data: { system: HELPFUL_SYSTEM, user: task.prompt },
      })
      guardNonEmpty(answer)
      return {
        kind: 'answer',
        answer: decorate(answer),
        promptUsed: task.prompt,
      }
    }
    case 'stepwise': {
      const answer = await ask({
        data: { system: STEPWISE_SYSTEM, user: task.prompt },
      })
      guardNonEmpty(answer)
      return {
        kind: 'answer',
        answer: decorate(answer),
        promptUsed: task.prompt,
      }
    }
    case 'promptcraft': {
      const composed = await ask({
        data: { system: PROMPT_ENGINEER_SYSTEM, user: task.prompt },
      })
      guardNonEmpty(composed)
      const final = await ask({
        data: { system: HELPFUL_SYSTEM, user: composed.content },
      })
      guardNonEmpty(final)
      return {
        kind: 'promptcraft',
        composed: decorate(composed),
        final: decorate(final),
        promptUsed: task.prompt,
      }
    }
    case 'expert': {
      const settled = await Promise.all(
        EXPERT_ROLES.map(async (role) => {
          const answer = await ask({
            data: { system: role.system, user: task.prompt },
          })
          guardNonEmpty(answer)
          return { id: role.id, label: role.label, answer: decorate(answer) }
        }),
      )
      return { kind: 'experts', experts: settled, promptUsed: task.prompt }
    }
  }
}

function guardNonEmpty(res: ChatResult) {
  if (!res.content.trim()) {
    throw new Error('Модель вернула пустой ответ. Попробуй ещё раз.')
  }
}

function decorate(answer: ChatResult): Answer {
  const words = answer.content.trim().split(/\s+/).filter(Boolean).length
  return { ...answer, chars: answer.content.length, words }
}

function resultToText(result: StrategyResult): string {
  switch (result.kind) {
    case 'answer':
      return result.answer.content
    case 'promptcraft':
      return result.final.content
    case 'experts':
      return result.experts
        .map(({ label, answer }) => `${label}:\n${answer.content}`)
        .join('\n\n')
  }
}

function parseVerdict(content: string): VerdictShape | null {
  const stripped = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    return null
  }
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1))
    if (parsed && typeof parsed === 'object') {
      return parsed as VerdictShape
    }
    return null
  } catch {
    return null
  }
}

function toError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
