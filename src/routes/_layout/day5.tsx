import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { askModel } from '@lib/functions/ask-model.functions'
import { readBrief } from '@lib/functions/read-brief.functions'
import { saveProposal } from '@lib/functions/save-proposal.functions'
import type { ChatResult } from '@lib/llm'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import TypingDots from '@/components/TypingDots'
import { COMPARISON_NOTE, DAY5_SYSTEM, LINKS, TIERS } from '@lib/day5'
import TierCard from './-day5/TierCard'
import type { Answer, BriefState, CardState } from './-day5/types'

export const Route = createFileRoute('/_layout/day5')({ component: Day5 })

const IDLE_STATE: CardState = { status: 'idle' }

function createRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function Day5() {
  const [brief, setBrief] = useState<BriefState>({ status: 'loading' })
  const [results, setResults] = useState<Record<string, CardState>>({})
  const [running, setRunning] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const text = await readBrief()
        if (active) {
          setBrief({ status: 'ready', text })
        }
      } catch (err) {
        if (active) {
          setBrief({ status: 'error', error: toError(err) })
        }
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const handleRunAll = async (runId: string) => {
    if (running || brief.status !== 'ready') {
      return
    }
    setRunning(true)
    setResults({})
    await Promise.all(
      TIERS.map(async (tier) => {
        setResult(tier.id, { status: 'loading' })
        try {
          const res = await askModel({
            data: { tier: tier.id, system: DAY5_SYSTEM, user: brief.text },
          })
          guardNonEmpty(res)
          let savedPath: string | null = null
          try {
            const saved = await saveProposal({
              data: {
                tier: tier.id,
                model: res.model ?? tier.model,
                content: res.content,
                runId,
              },
            })
            savedPath = saved.path
          } catch {
            savedPath = null
          }
          setResult(tier.id, {
            status: 'done',
            answer: decorate(res),
            savedPath,
            runId,
          })
        } catch (err) {
          setResult(tier.id, { status: 'error', error: toError(err) })
        }
      }),
    )
    setRunning(false)
  }

  const setResult = (tier: string, state: CardState) => {
    setResults((prev) => ({ ...prev, [tier]: state }))
  }

  const briefReady = brief.status === 'ready'

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-6 pt-6">
      <header className="mb-2">
        <p className="island-kicker mb-2">Model tiers</p>
        <h1 className="demo-title mb-2">Версии моделей</h1>
        <p className="demo-muted m-0 max-w-2xl text-sm">
          Один и тот же запрос — продуктовое ТЗ интернет-магазина — уходит в три
          модели разного уровня: слабую (Qwen 8B), среднюю (deepseek-flash) и
          сильную (deepseek-v4-pro). Каждая сама предлагает архитектуру. Сравни
          качество, скорость, токены и стоимость.
        </p>
      </header>

      <section className="demo-panel flex flex-col gap-5 p-5">
        <div>
          <h2 className="demo-section-title mb-1">Архитектура по брифу</h2>
          <p className="demo-muted m-0 mb-2 text-xs">
            Бриф читается с сервера из <code>md/design/brief.md</code>. Модели
            отвечают параллельно; пока все три не ответят, кнопка заблокирована.
          </p>
          {brief.status === 'error' && (
            <Alert variant="destructive">
              <p className="m-0 text-sm">{brief.error}</p>
            </Alert>
          )}
          {brief.status === 'loading' && (
            <div className="flex items-center gap-2">
              <TypingDots />
              <span className="demo-muted text-xs">Читаю бриф…</span>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void handleRunAll(createRunId())}
              disabled={running || !briefReady}
            >
              {running ? 'Модели думают…' : 'Собрать 3 предложения'}
            </Button>
            {running && <TypingDots text="Один бриф у трёх моделей…" />}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {TIERS.map((tier) => {
          const state = results[tier.id] ?? IDLE_STATE
          return <TierCard key={tier.id} tier={tier} state={state} />
        })}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="demo-panel p-5">
          <h2 className="demo-section-title mb-1">Что было отправлено</h2>
          <p className="demo-muted m-0 mb-3 text-xs">
            Одинаковый system и одинаковый user (полный текст брифа) для всех
            трёх ступеней.
          </p>
          <div className="space-y-3">
            <div className="demo-code-block whitespace-pre-wrap">
              <span className="island-kicker">system</span>
              {'\n'}
              {DAY5_SYSTEM}
            </div>
            <div className="demo-code-block whitespace-pre-wrap select-text">
              <span className="island-kicker">user · brief</span>
              {'\n'}
              {brief.status === 'ready' ? brief.text : '…'}
            </div>
          </div>
        </div>

        <div className="demo-panel p-5">
          <h2 className="demo-section-title mb-1">Выводы и ссылки</h2>
          <p className="demo-muted m-0 mb-3 text-xs">{COMPARISON_NOTE}</p>
          <ul className="m-0 list-disc space-y-2 pl-5">
            {LINKS.map((link) => (
              <li key={link.url} className="text-sm">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-[var(--line)] underline-offset-2 hover:text-[var(--accent)]"
                >
                  {link.title}
                </a>
                <span className="demo-muted"> — {link.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function guardNonEmpty(res: ChatResult) {
  if (!res.content.trim()) {
    throw new Error('Модель вернула пустой ответ. Попробуй ещё раз.')
  }
}

function decorate(res: ChatResult): Answer {
  const words = res.content.trim().split(/\s+/).filter(Boolean).length
  return {
    content: res.content,
    usage: res.usage,
    model: res.model,
    latencyMs: res.latencyMs,
    chars: res.content.length,
    words,
  }
}

function toError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
