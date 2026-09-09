import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ask } from '../../lib/chat'
import type { ChatResult } from '../../lib/chat'
import {
  CONCLUSIONS,
  CONCLUSION_NOTE,
  DAY4_SYSTEM,
  TASKS,
  TEMPERATURES,
  checkFinalAnswer,
} from '../../lib/day4'
import type { Day4Task, FinalCheck } from '../../lib/day4'

export const Route = createFileRoute('/_layout/day4')({ component: Day4 })

type Source = 'curated' | 'custom'

type Answer = {
  content: string
  usage: ChatResult['usage']
  model: ChatResult['model']
  chars: number
  words: number
  check: FinalCheck
}

type TempState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; answer: Answer }
  | { status: 'error'; error: string }

type LastRun = { source: Source; user: string }

const IDLE_STATE: TempState = { status: 'idle' }

const TASK = TASKS[0]

function Day4() {
  const [customPrompt, setCustomPrompt] = useState('')
  const [results, setResults] = useState<Record<number, TempState>>({})
  const [activeTemp, setActiveTemp] = useState<number>(TEMPERATURES[0].value)
  const [running, setRunning] = useState(false)
  const [lastRun, setLastRun] = useState<LastRun | null>(null)

  const firstModel =
    TEMPERATURES.map((t) => results[t.value]).find(
      (s): s is Extract<TempState, { status: 'done' }> =>
        s?.status === 'done' && !!s.answer.model,
    )?.answer.model ?? null

  const handleRunAll = async (source: Source) => {
    if (running) {
      return
    }
    const user = source === 'curated' ? TASK.prompt : customPrompt.trim()
    if (!user) {
      return
    }
    setRunning(true)
    setLastRun({ source, user })
    setResults({})
    await Promise.all(
      TEMPERATURES.map(async (t) => {
        setResult(t.value, { status: 'loading' })
        try {
          const res = await ask({
            data: {
              system: DAY4_SYSTEM,
              user,
              params: { temperature: t.value },
            },
          })
          guardNonEmpty(res)
          setResult(t.value, {
            status: 'done',
            answer: decorate(res, source === 'curated' ? TASK : null),
          })
        } catch (err) {
          setResult(t.value, { status: 'error', error: toError(err) })
        }
      }),
    )
    setRunning(false)
  }

  const setResult = (temp: number, state: TempState) => {
    setResults((prev) => ({ ...prev, [temp]: state }))
  }

  const source = lastRun?.source ?? 'curated'
  const runUser = lastRun?.user ?? TASK.prompt

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-6 pt-6">
      <header className="mb-2">
        <p className="island-kicker mb-2">Temperature</p>
        <h1 className="demo-title mb-2">Температура</h1>
        <p className="demo-muted m-0 max-w-2xl text-sm">
          Один и тот же запрос отправляется с тремя значениями temperature — 0,
          0.7 и 1.2. Возьми готовую логическую задачу или впиши свой промпт и
          сравни ответы по точности, креативности и разнообразию, затем сверься
          с выводами ниже.
        </p>
      </header>

      <section className="demo-panel flex flex-col gap-5 p-5">
        <div>
          <h2 className="demo-section-title mb-1">{TASK.label}</h2>
          <p className="demo-muted m-0 mb-2 text-xs">
            Логическая задача с эталонным ответом и автопроверкой строки
            «Итог:».
          </p>
          <div className="demo-code-block whitespace-pre-wrap">
            {TASK.prompt}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleRunAll('curated')}
              disabled={running}
              className="demo-button"
            >
              {running && source === 'curated'
                ? 'Выполняется…'
                : 'Запустить при трёх температурах'}
            </button>
            {running && source === 'curated' && (
              <TypingDots text="Отправляю три одинаковых запроса…" />
            )}
          </div>
        </div>

        <hr className="border-[var(--line)]" />

        <div>
          <h2 className="demo-section-title mb-1">Свой промпт</h2>
          <p className="demo-muted m-0 mb-2 text-xs">
            Свободный запрос без эталона: здесь высокая температура особенно
            заметна.
          </p>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={4}
            placeholder="Например: придумай 5 необычных названий для кофейни у моря…"
            className="demo-textarea resize-y text-sm"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleRunAll('custom')}
              disabled={running || customPrompt.trim().length === 0}
              className="demo-button demo-button-secondary"
            >
              {running && source === 'custom'
                ? 'Выполняется…'
                : 'Запустить при трёх температурах'}
            </button>
            {running && source === 'custom' && (
              <TypingDots text="Отправляю три одинаковых запроса…" />
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <section className="grid gap-4 sm:grid-cols-3">
            {TEMPERATURES.map((t) => {
              const state = results[t.value] ?? IDLE_STATE
              const isActive = t.value === activeTemp
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setActiveTemp(t.value)}
                  className={`demo-panel flex min-h-0 flex-col p-5 text-left ${
                    isActive
                      ? '!border-[color-mix(in_oklab,var(--lagoon)_60%,var(--line))]'
                      : ''
                  }`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div>
                      <p className="island-kicker mb-1">
                        temperature = {t.value}
                      </p>
                      <h2 className="demo-section-title m-0">{t.label}</h2>
                    </div>
                    {state.status === 'done' && source === 'curated' && (
                      <CheckPill check={state.answer.check} />
                    )}
                  </div>
                  <p className="demo-muted m-0 mb-2 text-xs">{t.description}</p>
                  <div className="min-h-0 flex-1 pt-2">
                    <TempCard state={state} />
                  </div>
                </button>
              )
            })}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="demo-panel p-5">
              <h2 className="demo-section-title mb-3">Эталонный ответ</h2>
              {source === 'custom' ? (
                <div className="demo-alert">
                  <p className="m-0 text-sm">
                    У своего промпта нет эталона — сравнивай ответы по точности,
                    креативности и разнообразию сам.
                  </p>
                </div>
              ) : (
                <>
                  <div className="demo-code-block whitespace-pre-wrap text-sm">
                    {TASK.reference}
                  </div>
                  <p className="demo-muted m-0 mt-2 text-xs">
                    С ним сверяются строки «Итог:» в ответах выше.
                  </p>
                </>
              )}
            </div>
            <div className="demo-panel p-5">
              <h2 className="demo-section-title mb-3">Выводы</h2>
              <p className="demo-muted m-0 mb-3 text-xs">{CONCLUSION_NOTE}</p>
              <div className="space-y-3">
                {CONCLUSIONS.map((c) => (
                  <div key={c.value}>
                    <p className="mb-1 text-sm font-semibold text-[var(--sea-ink)]">
                      {c.title}
                    </p>
                    <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
                      {c.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className="demo-panel w-full shrink-0 self-start p-4 lg:w-[340px]">
          <h2 className="demo-section-title mb-1">Параметры запроса</h2>
          <p className="demo-muted m-0 mb-3 text-xs">
            Один и тот же запрос для всех температур; в каждом прогоне меняется
            только temperature. Клик по карточке показывает её значение.
          </p>
          <Inspector
            user={runUser}
            model={firstModel}
            activeTemp={activeTemp}
            hasRun={lastRun !== null}
          />
        </aside>
      </div>
    </div>
  )
}

function TempCard({ state }: { state: TempState }) {
  switch (state.status) {
    case 'idle':
      return (
        <p className="demo-muted m-0 text-sm">
          Пока не запущено. Нажми кнопку выше, чтобы отправить запрос с этой
          температурой.
        </p>
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
      return <AnswerBlock answer={state.answer} />
  }
}

function AnswerBlock({ answer }: { answer: Answer }) {
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
    </div>
  )
}

function CheckPill({ check }: { check: FinalCheck }) {
  if (check === 'correct') {
    return (
      <span className="demo-pill !border-[color-mix(in_oklab,var(--lagoon)_60%,var(--line))] !bg-[color-mix(in_oklab,var(--lagoon)_22%,var(--chip-bg))]">
        Итог верный
      </span>
    )
  }
  if (check === 'wrong') {
    return (
      <span className="demo-pill !border-[color-mix(in_oklab,#e5484d_55%,var(--line))] !bg-[color-mix(in_oklab,#e5484d_18%,var(--chip-bg))]">
        Не совпал
      </span>
    )
  }
  return <span className="demo-pill">Нет строки «Итог:»</span>
}

function Inspector({
  user,
  model,
  activeTemp,
  hasRun,
}: {
  user: string
  model: ChatResult['model']
  activeTemp: number
  hasRun: boolean
}) {
  return (
    <div className="space-y-3 text-sm">
      <p className="demo-muted m-0 text-xs">
        {hasRun
          ? 'Что было отправлено (temperature активной карточки)'
          : 'Что будет отправлено'}
      </p>
      <div className="demo-code-block whitespace-pre-wrap">
        <span className="island-kicker">model</span>
        {'\n'}
        {model ?? '— (станет известна после запуска)'}
      </div>
      <div className="demo-code-block whitespace-pre-wrap">
        <span className="island-kicker">system</span>
        {'\n'}
        {DAY4_SYSTEM}
      </div>
      <div className="demo-code-block whitespace-pre-wrap">
        <span className="island-kicker">user</span>
        {'\n'}
        {user}
      </div>
      <div className="demo-code-block whitespace-pre-wrap">
        <span className="island-kicker">params</span>
        {'\n'}
        {JSON.stringify(
          {
            thinking: { type: 'disabled' },
            temperature: activeTemp,
          },
          null,
          2,
        )}
      </div>
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

function guardNonEmpty(res: ChatResult) {
  if (!res.content.trim()) {
    throw new Error('Модель вернула пустой ответ. Попробуй ещё раз.')
  }
}

function decorate(res: ChatResult, task: Day4Task | null): Answer {
  const words = res.content.trim().split(/\s+/).filter(Boolean).length
  return {
    ...res,
    chars: res.content.length,
    words,
    check: task ? checkFinalAnswer(res.content, task) : 'none',
  }
}

function toError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
