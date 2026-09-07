import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import Chat from '../../components/Chat'
import type { ChatMessage } from '../../components/Chat'
import { CHAT_CONFIGS, chat } from '../../lib/chat'
import type { ChatMode } from '../../lib/chat'

export const Route = createFileRoute('/_layout/day2')({ component: Day2 })

function Day2() {
  const [active, setActive] = useState<ChatMode>('free')

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="mb-4">
            <p className="island-kicker mb-2">AI Advent Challenge · Day 2</p>
            <h1 className="demo-title mb-2">Формат ответа</h1>
            <p className="demo-muted m-0 max-w-2xl text-sm">
              Отправь один и тот же промпт в обе вкладки: простой запрос против
              явного формата + лимита длины + ограничения завершения. Сравни ответы.
            </p>
          </header>

          <div className="mb-4 flex flex-wrap gap-2">
            {(Object.keys(CHAT_CONFIGS) as ChatMode[]).map((mode) => {
              const config = CHAT_CONFIGS[mode]
              const isActive = mode === active
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setActive(mode)}
                  className={`demo-button ${isActive ? '' : 'demo-button-secondary'}`}
                >
                  {config.label}
                </button>
              )
            })}
          </div>

          <section className="demo-panel flex min-h-0 flex-1 flex-col p-5">
            <div className={`min-h-0 flex-1 ${active === 'free' ? 'flex flex-col' : 'hidden'}`}>
              <Chat
                onSend={(prompt) => chat({ data: { prompt, mode: 'free' } })}
                placeholder="Отправь один и тот же промпт сюда и во вкладку «С ограничениями»…"
              />
            </div>
            <div className={`min-h-0 flex-1 ${active === 'constrained' ? 'flex flex-col' : 'hidden'}`}>
              <Chat
                onSend={(prompt) => chat({ data: { prompt, mode: 'constrained' } })}
                placeholder="Отправь один и тот же промпт сюда и во вкладку «Свободная форма»…"
                renderAssistant={(message) => <ConstrainedMessage message={message} />}
              />
            </div>
          </section>
        </div>

        <aside className="demo-panel min-h-0 shrink-0 p-4 lg:w-[340px] lg:overflow-y-auto">
          <h2 className="demo-section-title mb-1">Что было отправлено</h2>
          <p className="demo-muted m-0 mb-3 text-xs">Конфигурация запроса активной вкладки</p>
          <Inspector mode={active} />
        </aside>
      </div>
    </div>
  )
}

function Inspector({ mode }: { mode: ChatMode }) {
  const config = CHAT_CONFIGS[mode]
  return (
    <div className="space-y-3 text-sm">
      <p className="demo-muted m-0 text-xs">{config.description}</p>
      <div className="demo-code-block whitespace-pre-wrap">
        <span className="island-kicker">system</span>
        {'\n'}
        {config.system}
      </div>
      <div className="demo-code-block whitespace-pre-wrap">
        <span className="island-kicker">params</span>
        {'\n'}
        {JSON.stringify(
          {
            thinking: { type: 'disabled' },
            ...config.params,
          },
          null,
          2,
        )}
      </div>
    </div>
  )
}

type ConstrainedShape = {
  title?: string
  summary?: string
  keywords?: string[]
}

function ConstrainedMessage({ message }: { message: ChatMessage }) {
  if (message.content.trim().length === 0) {
    return (
      <div className="demo-alert">
        <p className="m-0 text-sm">
          Модель вернула пустой ответ — известная особенность JSON-режима.
          Попробуй ещё раз.
        </p>
      </div>
    )
  }

  const parsed = parseConstrained(message.content)

  if (!parsed) {
    return (
      <div className="demo-alert demo-alert-danger">
        <p className="m-0 mb-2 text-sm font-semibold">
          Ответ — не валидный JSON
        </p>
        <pre className="m-0 whitespace-pre-wrap text-xs">{message.content}</pre>
        <p className="m-0 mt-2 text-xs opacity-80">
          Возможно, ответ обрезан лимитом токенов. Попробуй ещё раз.
        </p>
      </div>
    )
  }

  return (
    <div className="demo-code-block max-w-full">
      {parsed.title && (
        <p className="mb-2 text-base font-bold text-[var(--sea-ink)]">{parsed.title}</p>
      )}
      {parsed.summary && (
        <p className="mb-3 text-sm text-[var(--sea-ink-soft)]">{parsed.summary}</p>
      )}
      {Array.isArray(parsed.keywords) && parsed.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {parsed.keywords.map((keyword, i) => (
            <span key={i} className="demo-pill">
              {keyword}
            </span>
          ))}
        </div>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer select-none text-xs text-[var(--sea-ink-soft)]">
          Сырой ответ
        </summary>
        <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--line)] bg-[color-mix(in_oklab,var(--chip-bg)_85%,transparent)] p-2 text-xs">
          {message.content}
        </pre>
      </details>
    </div>
  )
}

function parseConstrained(content: string): ConstrainedShape | null {
  const stripped = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  const jsonText = extractJsonObject(stripped)
  try {
    const parsed = JSON.parse(jsonText)
    if (parsed && typeof parsed === 'object') {return parsed as ConstrainedShape}
    return null
  } catch {
    return null
  }
}

function extractJsonObject(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {return text}
  return text.slice(start, end + 1)
}
