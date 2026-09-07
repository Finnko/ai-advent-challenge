import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ask } from '../../lib/chat'
import type { ChatResult } from '../../lib/chat'
import {
  EXPERT_ROLES,
  HELPFUL_SYSTEM,
  JUDGE_SYSTEM,
  PROMPT_ENGINEER_SYSTEM,
  STEPWISE_SYSTEM,
  STRATEGIES,
  TASKS,
  buildJudgePrompt,
} from '../../lib/day3'
import type { Day3Task, ExpertId, StrategyId } from '../../lib/day3'

export const Route = createFileRoute('/_layout/day3')({ component: Day3 })

type Answer = {
  content: string
  usage: ChatResult['usage']
  chars: number
  words: number
}

type ExpertAnswer = { id: ExpertId; label: string; answer: Answer }

type StrategyResult =
  | { kind: 'answer'; answer: Answer; promptUsed: string }
  | { kind: 'promptcraft'; composed: Answer; final: Answer; promptUsed: string }
  | { kind: 'experts'; experts: ExpertAnswer[]; promptUsed: string }

type ResultState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: StrategyResult }
  | { status: 'error'; error: string }

type VerdictShape = {
  summary?: string
  scores?: Partial<Record<StrategyId, number>>
  winner?: string
  why?: string
}

type VerdictState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; verdict: VerdictShape }
  | { status: 'error'; error: string; raw: string }

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
  resultsRef.current = results

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
        <p className="island-kicker mb-2">AI Advent Challenge · Day 3</p>
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
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTask(t.id)}
                className={`demo-button ${isActive ? '' : 'demo-button-secondary'}`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <p className="demo-muted m-0 mb-2 text-xs">
          Задание для всех четырёх стратегий (выбери одно):
        </p>
        <div className="demo-code-block whitespace-pre-wrap">{task.prompt}</div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleRunAll()}
            disabled={running}
            className="demo-button"
          >
            {running ? 'Выполняется…' : 'Запустить 4 стратегии'}
          </button>
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
                  <button
                    type="button"
                    onClick={() => void handleRerun(id)}
                    disabled={running}
                    className="demo-button demo-button-secondary shrink-0 px-3 py-1 text-xs"
                  >
                    Повторить
                  </button>
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

function StrategyCard({
  state,
  id,
  prompt,
}: {
  state: ResultState
  id: StrategyId
  prompt: string
}) {
  switch (state.status) {
    case 'idle':
      return (
        <div>
          <p className="demo-muted m-0 text-sm">
            Пока не запущено. Нажми «Запустить 4 стратегии», чтобы решить задачу
            этим способом.
          </p>
          <PromptPreview
            title="Что будет отправлено в модель"
            blocks={previewBlocks(id, prompt)}
          />
        </div>
      )
    case 'loading':
      return (
        <div className="flex flex-col gap-3">
          <TypingDots />
        </div>
      )
    case 'error':
      return (
        <div className="demo-alert demo-alert-danger">
          <p className="m-0 text-sm">{state.error}</p>
        </div>
      )
    case 'done':
      return <ResultBody result={state.result} />
  }
}

function ResultBody({ result }: { result: StrategyResult }) {
  switch (result.kind) {
    case 'answer':
      return <AnswerBlock answer={result.answer} blocks={sentBlocks(result)} />
    case 'promptcraft':
      return (
        <div className="flex flex-col gap-3">
          <details className="demo-code-block">
            <summary className="cursor-pointer select-none text-xs text-[var(--sea-ink-soft)]">
              Сгенерированный промпт (им решается задача)
            </summary>
            <pre className="mt-2 whitespace-pre-wrap text-sm">
              {result.composed.content}
            </pre>
            {usageLine(result.composed.usage, 'создание промпта')}
          </details>
          <AnswerBlock answer={result.final} blocks={sentBlocks(result)} />
        </div>
      )
    case 'experts':
      return (
        <div className="flex flex-col gap-3">
          {result.experts.map(({ id, label, answer }) => (
            <div key={id}>
              <p className="island-kicker mb-1">{label}</p>
              <AnswerBlock answer={answer} blocks={sentBlocks(result, id)} />
            </div>
          ))}
        </div>
      )
  }
}

function AnswerBlock({
  answer,
  blocks,
}: {
  answer: Answer
  blocks: SentBlock[]
}) {
  return (
    <div>
      {answer.content.trim().length === 0 ? (
        <div className="demo-alert">
          <p className="m-0 text-sm">
            Модель вернула пустой ответ. Попробуй ещё раз.
          </p>
        </div>
      ) : (
        <pre className="demo-code-block whitespace-pre-wrap text-sm">
          {answer.content}
        </pre>
      )}
      <p className="demo-muted mt-1.5 text-xs">
        {answer.chars ?? 0} симв. · {answer.words ?? 0} слов
        {answer.usage ? ` · ${answer.usage.completion_tokens} ток.` : ''}
      </p>
      <PromptPreview title="Что было отправлено" blocks={blocks} />
    </div>
  )
}

function PromptPreview({
  title,
  blocks,
}: {
  title: string
  blocks: SentBlock[]
}) {
  return (
    <details className="mt-1">
      <summary className="cursor-pointer select-none text-xs text-[var(--sea-ink-soft)]">
        {title}
      </summary>
      <div className="mt-2 space-y-2">
        {blocks.map((block, i) => (
          <div key={i} className="demo-code-block whitespace-pre-wrap text-xs">
            <span className="island-kicker">{block.label}</span>
            {'\n'}
            {block.text}
          </div>
        ))}
      </div>
    </details>
  )
}

type SentBlock = { label: string; text: string }

function previewBlocks(id: StrategyId, prompt: string): SentBlock[] {
  switch (id) {
    case 'direct':
      return [
        { label: 'system', text: HELPFUL_SYSTEM },
        { label: 'user', text: prompt },
      ]
    case 'stepwise':
      return [
        { label: 'system', text: STEPWISE_SYSTEM },
        { label: 'user', text: prompt },
      ]
    case 'promptcraft':
      return [
        { label: 'шаг 1 · system', text: PROMPT_ENGINEER_SYSTEM },
        { label: 'шаг 1 · user', text: prompt },
        { label: 'шаг 2 · system', text: HELPFUL_SYSTEM },
        {
          label: 'шаг 2 · user',
          text: 'Сгенерированный промпт — появится после шага 1.',
        },
      ]
    case 'expert':
      return EXPERT_ROLES.flatMap((role) => [
        { label: `${role.label} · system`, text: role.system },
        { label: `${role.label} · user`, text: prompt },
      ])
  }
}

function sentBlocks(result: StrategyResult, expertId?: ExpertId): SentBlock[] {
  const { promptUsed } = result
  switch (result.kind) {
    case 'answer':
      return [
        { label: 'system', text: HELPFUL_SYSTEM },
        { label: 'user', text: promptUsed },
      ]
    case 'promptcraft':
      return [
        { label: 'call 1 · system', text: PROMPT_ENGINEER_SYSTEM },
        { label: 'call 1 · user', text: promptUsed },
        { label: 'call 2 · system', text: HELPFUL_SYSTEM },
        { label: 'call 2 · user', text: result.composed.content },
      ]
    case 'experts': {
      const role = EXPERT_ROLES.find((r) => r.id === expertId)
      if (role) {
        return [
          { label: `${role.label} · system`, text: role.system },
          { label: `${role.label} · user`, text: promptUsed },
        ]
      }
      return EXPERT_ROLES.flatMap((role) => [
        { label: `${role.label} · system`, text: role.system },
        { label: `${role.label} · user`, text: promptUsed },
      ])
    }
  }
}

function VerdictCard({ verdict }: { verdict: VerdictState }) {
  switch (verdict.status) {
    case 'idle':
      return (
        <p className="demo-muted m-0 text-sm">
          Появится после того, как ответят все четыре стратегии.
        </p>
      )
    case 'loading':
      return <TypingDots text="Сравниваю четыре ответа с эталоном…" />
    case 'error':
      return (
        <div className="flex flex-col gap-3">
          <div className="demo-alert demo-alert-danger">
            <p className="m-0 text-sm">{verdict.error}</p>
          </div>
          {verdict.raw && (
            <pre className="demo-code-block whitespace-pre-wrap text-xs">
              {verdict.raw}
            </pre>
          )}
        </div>
      )
    case 'done':
      return <VerdictBody verdict={verdict.verdict} />
  }
}

function VerdictBody({ verdict }: { verdict: VerdictShape }) {
  const winner = verdict.winner
  const winnerMeta = STRATEGIES.find((s) => s.id === winner)
  return (
    <div className="flex flex-col gap-3">
      {verdict.summary && (
        <p className="demo-muted m-0 text-sm">{verdict.summary}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {STRATEGIES.map(({ id, label }) => {
          const score = verdict.scores?.[id]
          const isWinner = id === winner
          return (
            <span
              key={id}
              className={`demo-pill ${
                isWinner
                  ? '!border-[color-mix(in_oklab,var(--lagoon)_60%,var(--line))] !bg-[color-mix(in_oklab,var(--lagoon)_22%,var(--chip-bg))]'
                  : ''
              }`}
            >
              {label}: {typeof score === 'number' ? score : '—'}
              {isWinner ? '  (победитель)' : ''}
            </span>
          )
        })}
      </div>
      {winnerMeta && verdict.why && (
        <div className="demo-code-block whitespace-pre-wrap text-sm">
          <span className="island-kicker">
            Почему победила стратегия «{winnerMeta.label}»
          </span>
          {'\n'}
          {verdict.why}
        </div>
      )}
    </div>
  )
}

function TypingDots({ text }: { text?: string }) {
  return (
    <div className="flex items-center gap-2" aria-label="Ожидание ответа">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="typing-dot h-2 w-2 rounded-full bg-[var(--lagoon)]"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
      {text && <span className="demo-muted text-xs">{text}</span>}
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

function usageLine(usage: ChatResult['usage'], label: string): ReactNode {
  return (
    <p className="demo-muted mt-1.5 text-xs">
      {label}:{' '}
      {usage
        ? `${usage.completion_tokens} ток.`
        : 'нет данных об использовании'}
    </p>
  )
}

function toError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
