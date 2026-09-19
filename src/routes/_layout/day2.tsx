import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import Chat from '@/components/Chat'
import { CHAT_CONFIGS } from '@lib/day2'
import type { ChatMode } from '@lib/day2'
import { chat } from '@lib/functions/chat.functions'
import { Button } from '@/components/ui/Button'
import Inspector from './-day2/Inspector'
import ConstrainedMessage from './-day2/ConstrainedMessage'

export const Route = createFileRoute('/_layout/day2')({ component: Day2 })

function Day2() {
  const [active, setActive] = useState<ChatMode>('free')

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col gap-4 px-4 py-6">
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="mb-4">
            <p className="island-kicker mb-2">Response format</p>
            <h1 className="demo-title mb-2">Формат ответа</h1>
            <p className="demo-muted m-0 max-w-2xl text-sm">
              Отправь один и тот же промпт в обе вкладки: простой запрос против
              явного формата + лимита длины + ограничения завершения. Сравни
              ответы.
            </p>
          </header>

          <div className="mb-4 flex flex-wrap gap-2">
            {(Object.keys(CHAT_CONFIGS) as ChatMode[]).map((mode) => {
              const config = CHAT_CONFIGS[mode]
              const isActive = mode === active
              return (
                <Button
                  key={mode}
                  variant={isActive ? 'default' : 'secondary'}
                  onClick={() => setActive(mode)}
                >
                  {config.label}
                </Button>
              )
            })}
          </div>

          <section className="demo-panel flex min-h-0 flex-1 flex-col p-5">
            <div
              className={`min-h-0 flex-1 ${active === 'free' ? 'flex flex-col' : 'hidden'}`}
            >
              <Chat
                onSend={(prompt) => chat({ data: { prompt, mode: 'free' } })}
                placeholder="Отправь один и тот же промпт сюда и во вкладку «С ограничениями»…"
              />
            </div>
            <div
              className={`min-h-0 flex-1 ${active === 'constrained' ? 'flex flex-col' : 'hidden'}`}
            >
              <Chat
                onSend={(prompt) =>
                  chat({ data: { prompt, mode: 'constrained' } })
                }
                placeholder="Отправь один и тот же промпт сюда и во вкладку «Свободная форма»…"
                renderAssistant={(message) => (
                  <ConstrainedMessage message={message} />
                )}
              />
            </div>
          </section>
        </div>

        <aside className="demo-panel min-h-0 shrink-0 p-4 lg:w-[340px] lg:overflow-y-auto">
          <h2 className="demo-section-title mb-1">Что было отправлено</h2>
          <p className="demo-muted m-0 mb-3 text-xs">
            Конфигурация запроса активной вкладки
          </p>
          <Inspector mode={active} />
        </aside>
      </div>
    </div>
  )
}
