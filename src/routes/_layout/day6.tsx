import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { resolveCapabilities, runAgent } from '../../lib/chat'
import type { AgentCapabilities } from '../../lib/agent'
import { CONCLUSION_NOTE, EXAMPLES, LINKS, ROLE_PRESETS } from '../../lib/day6'
import type { RoleId } from '../../lib/day6'
import RolePicker from '../../components/day6/RolePicker'
import CapabilitiesPanel from '../../components/day6/CapabilitiesPanel'
import ExampleChips from '../../components/day6/ExampleChips'
import ChatThread from '../../components/day6/ChatThread'
import type { ThreadMessage } from '../../components/day6/ChatThread'

export const Route = createFileRoute('/_layout/day6')({ component: Day6 })

const DEFAULT_ROLE: RoleId = 'employee'

function Day6() {
  const [roleId, setRoleId] = useState<RoleId>(DEFAULT_ROLE)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [draft, setDraft] = useState('')

  const preset = ROLE_PRESETS.find((r) => r.id === roleId) ?? ROLE_PRESETS[0]
  const roleExamples = EXAMPLES.filter((e) => e.role === roleId)

  const capsQuery = useQuery({
    queryKey: ['agent-capabilities', preset.token],
    queryFn: () => resolveCapabilities({ data: { token: preset.token } }),
  })

  const sendMutation = useMutation({
    mutationFn: (text: string) =>
      runAgent({ data: { token: preset.token, user: text } }),
  })

  const handlePickRole = (id: RoleId) => {
    if (id === roleId || sendMutation.isPending) {return}
    sendMutation.reset()
    setMessages([])
    setDraft('')
    setRoleId(id)
  }

  const handleSend = () => {
    const text = draft.trim()
    if (text.length === 0 || sendMutation.isPending || capsQuery.isLoading)
      {return}
    setDraft('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    sendMutation.mutate(text, {
      onSuccess: (run) => {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: run.answer, run },
        ])
      },
    })
  }

  const pickExample = (text: string) => {
    setDraft(text)
  }

  const capsPanel: Parameters<typeof CapabilitiesPanel>[0] = capsQuery.isLoading
    ? { status: 'loading' }
    : capsQuery.isError
      ? { status: 'error', message: toError(capsQuery.error) }
      : { status: 'ready', caps: capsQuery.data as AgentCapabilities }

  const sendError = sendMutation.isError ? toError(sendMutation.error) : null
  const busy = sendMutation.isPending

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-6 pt-6">
      <header className="mb-1">
        <p className="island-kicker mb-2">AI Advent Challenge · Day 6</p>
        <h1 className="demo-title mb-2">Первый агент</h1>
        <p className="demo-muted m-0 max-w-3xl text-sm">
          Агент — изолированная сущность, а не один вызов API. Он принимает
          запрос, роутит его на инструмент (JSON-роутинг), исполняет его строго
          в рамках прав роли и проходит через судей. Роль определяется
          мок-токеном на сервере, а не словами пользователя. Каждый запуск —
          новый экземпляр агента в одном процессе.
        </p>
      </header>

      <section className="demo-panel p-5">
        <h2 className="demo-section-title mb-2">Выбери роль (мок-токен)</h2>
        <p className="demo-muted m-0 mb-3 text-xs">
          В проде сотрудник получает токен на корп-портале и отдаёт его агенту;
          здесь роль имитируется двумя мок-токенами, которые сервер обменивает
          на профиль способностей.
        </p>
        <RolePicker activeId={roleId} disabled={busy} onPick={handlePickRole} />
        <CapabilitiesPanel {...capsPanel} />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="demo-panel flex flex-col gap-3 p-5 lg:col-span-2">
          <h2 className="demo-section-title m-0">Чат с агентом</h2>
          <p className="demo-muted m-0 text-xs">
            Смена роли очищает диалог: агент без памяти, каждый запуск — новый
            инстанс.
          </p>

          <ExampleChips
            examples={roleExamples}
            disabled={busy}
            onPick={pickExample}
          />

          <ChatThread messages={messages} running={busy} />

          {sendError && (
            <div className="demo-alert demo-alert-danger">{sendError}</div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex flex-col gap-3"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Например: забронируй переговорку на завтра на 15:00 на 6 человек…"
              className="demo-textarea min-h-0"
              rows={2}
              disabled={busy || capsQuery.isLoading}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="demo-button"
                disabled={
                  busy || draft.trim().length === 0 || capsQuery.isLoading
                }
              >
                {busy ? 'Агент работает…' : 'Отправить агенту'}
              </button>
            </div>
          </form>
        </section>

        <div className="flex flex-col gap-4">
          <section className="demo-panel p-5">
            <h2 className="demo-section-title mb-2">Выводы</h2>
            <p className="demo-muted m-0 text-xs">{CONCLUSION_NOTE}</p>
          </section>
          <section className="demo-panel p-5">
            <h2 className="demo-section-title mb-2">Ссылки</h2>
            <ul className="m-0 list-disc space-y-2 pl-5">
              {LINKS.map((link) => (
                <li key={link.url} className="text-sm">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-[var(--line)] underline-offset-2 hover:text-[var(--lagoon)]"
                  >
                    {link.title}
                  </a>
                  <span className="demo-muted"> — {link.note}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function toError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
