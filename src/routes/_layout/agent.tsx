import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import {
  deleteSession,
  listOrg,
  listSessions,
  loadSession,
  resolveCapabilities,
  runAgent,
} from '../../lib/chat'
import type { AgentRunResult } from '../../lib/agent'
import { EXAMPLES, TOOL_INFO, TOKEN_SCENARIOS } from '../../lib/agent-ui'
import type {
  Example,
  PersonaKind,
  ToolInfo,
  TokenScenarioId,
} from '../../lib/agent-ui'
import {
  CONTEXT_BUDGET_TOKENS,
  MODEL_CONTEXT_TOKENS,
  estimateTokens,
  formatUsd,
} from '../../lib/tokens'
import type { OrgPerson, SessionSummary } from '../../lib/chat'
import PersonaPicker from '../../components/agent/PersonaPicker'
import CapabilitiesPanel from '../../components/agent/CapabilitiesPanel'
import ExampleChips from '../../components/agent/ExampleChips'
import ChatThread from '../../components/agent/ChatThread'
import type { ThreadMessage } from '../../components/agent/ChatThread'
import SessionList from '../../components/agent/SessionList'
import TokenMeter from '../../components/agent/TokenMeter'
import TokenReport from '../../components/agent/TokenReport'

export const Route = createFileRoute('/_layout/agent')({ component: AgentPage })

function AgentPage() {
  const queryClient = useQueryClient()
  const [activeToken, setActiveToken] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [draft, setDraft] = useState('')
  const [enforceBudget, setEnforceBudget] = useState(true)
  const autoPickRef = useRef(false)

  const orgQuery = useQuery({
    queryKey: ['agent-org'],
    queryFn: () => listOrg(),
  })
  const people: OrgPerson[] = orgQuery.data ?? []
  const manager = people.find((p) => p.role === 'manager') ?? null
  const employees = people.filter((p) => p.role === 'employee')
  const activePerson =
    people.find((p) => p.token === activeToken) ?? manager ?? null
  const kind: PersonaKind = activePerson?.role ?? 'employee'
  const roleExamples: Example[] = EXAMPLES.filter((e) => e.kind === kind)
  const availableTools: ToolInfo[] = TOOL_INFO.filter((t) =>
    t.roles.includes(kind),
  )

  useEffect(() => {
    if (!activeToken && manager) {
      setActiveToken(manager.token)
    }
  }, [activeToken, manager])

  const capsQuery = useQuery({
    queryKey: ['agent-capabilities', activeToken],
    queryFn: () =>
      resolveCapabilities({ data: { token: activeToken as string } }),
    enabled: Boolean(activeToken),
  })

  const sessionsQuery = useQuery({
    queryKey: ['agent-sessions', activeToken],
    queryFn: () => listSessions({ data: { token: activeToken as string } }),
    enabled: Boolean(activeToken),
  })

  const sendMutation = useMutation({
    mutationFn: (input: {
      token: string
      sessionId: number | null
      user: string
      enforceContextBudget: boolean
    }) => runAgent({ data: input }),
  })
  const loadMutation = useMutation({
    mutationFn: (id: number) => loadSession({ data: { sessionId: id } }),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSession({ data: { sessionId: id } }),
  })

  const busy =
    sendMutation.isPending ||
    loadMutation.isPending ||
    deleteMutation.isPending ||
    capsQuery.isLoading

  const handlePickPerson = (token: string) => {
    if (token === activeToken || busy) {
      return
    }
    sendMutation.reset()
    loadMutation.reset()
    setActiveToken(token)
    setSessionId(null)
    setMessages([])
    setDraft('')
    autoPickRef.current = true
  }

  const openSession = (id: number) => {
    if (busy || id === sessionId) {
      return
    }
    setSessionId(id)
    setMessages([])
    loadMutation.mutate(id, {
      onSuccess: (rows) => {
        setMessages(
          rows.map((row): ThreadMessage => ({
            role: row.role,
            content: row.content,
            ...(row.run
              ? { run: row.run as AgentRunResult }
              : {}),
          })),
        )
      },
    })
  }

  useEffect(() => {
    if (!autoPickRef.current) {
      return
    }
    if (sessionsQuery.isSuccess) {
      autoPickRef.current = false
      const first = sessionsQuery.data[0]
      if (first) {
        openSession(first.id)
      }
    }
  }, [sessionsQuery.isSuccess, sessionsQuery.data])

  const handleNewSession = () => {
    if (busy) {
      return
    }
    sendMutation.reset()
    setSessionId(null)
    setMessages([])
    setDraft('')
  }

  const handleDeleteSession = (id: number) => {
    if (busy) {
      return
    }
    deleteMutation.mutate(id, {
      onSuccess: () => {
        if (id === sessionId) {
          setSessionId(null)
          setMessages([])
        }
        queryClient.invalidateQueries({
          queryKey: ['agent-sessions', activeToken],
        })
      },
    })
  }

  const handleSend = () => {
    const text = draft.trim()
    if (text.length === 0 || busy || !activeToken) {
      return
    }
    setDraft('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    sendMutation.mutate(
      { token: activeToken, sessionId, user: text, enforceContextBudget: enforceBudget },
      {
        onSuccess: (result) => {
          setSessionId(result.sessionId)
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: result.run.answer, run: result.run },
          ])
          queryClient.invalidateQueries({
            queryKey: ['agent-sessions', activeToken],
          })
        },
      },
    )
  }

  const pickExample = (text: string) => {
    setDraft(text)
  }

  const pickScenario = (id: TokenScenarioId) => {
    const scenario = TOKEN_SCENARIOS.find((s) => s.id === id)
    if (scenario) {
      setDraft(scenario.text)
    }
  }

  const historyTokens = messages.reduce(
    (sum, message) => sum + estimateTokens(message.content),
    0,
  )
  const requestTokens = estimateTokens(draft)
  const lastRun: AgentRunResult | null =
    [...messages].reverse().find((message) => message.run)?.run ?? null
  const sessionTotals = messages.reduce(
    (acc, message) => {
      if (message.role !== 'assistant' || !message.run?.usage) {
        return acc
      }
      const usage = message.run.usage
      acc.prompt += usage.prompt_tokens
      acc.completion += usage.completion_tokens
      acc.cost += message.run.tokens?.costUsd ?? 0
      return acc
    },
    { prompt: 0, completion: 0, cost: 0 },
  )

  const capsPanel: Parameters<typeof CapabilitiesPanel>[0] = capsQuery.data
    ? { status: 'ready', caps: capsQuery.data }
    : capsQuery.isError
      ? { status: 'error', message: toError(capsQuery.error) }
      : { status: 'loading' }

  const sendError = sendMutation.isError ? toError(sendMutation.error) : null
  const orgError = orgQuery.isError ? toError(orgQuery.error) : null

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pb-6 pt-6">
      <header className="mb-1">
        <p className="island-kicker mb-2">Agent · Context memory</p>
        <h1 className="demo-title mb-2">Корпоративный агент с памятью</h1>
        <p className="demo-muted m-0 max-w-4xl text-sm">
          Тот же агент, что в первый день, — теперь он помнит: диалоги живут в
          SQLite и переживают перезапуск, а результаты инструментов
          (согласования отпусков, брони) сохраняются в БД. Роль и подчинённые
          приходят с «бэкенда» (таблица people), а не из константы.
        </p>
      </header>

      {orgQuery.isLoading && <p className="demo-muted">Загружаю сотрудников…</p>}

      {orgError && <div className="demo-alert demo-alert-danger">{orgError}</div>}

      {activePerson && manager && (
        <section className="demo-panel p-5">
          <h2 className="demo-section-title mb-2">За кого говорит агент</h2>
          <p className="demo-muted m-0 mb-3 text-xs">
            Выбери персону — сессии и права переключатся вместе с ней. Список
            людей грузится серверной функцией из таблицы people (в проде это
            будет бэкенд).
          </p>
          <PersonaPicker
            manager={manager}
            employees={employees}
            activeToken={activePerson.token}
            disabled={busy}
            onPick={handlePickPerson}
          />
          <CapabilitiesPanel {...capsPanel} />
        </section>
      )}

      {activePerson && (
        <div className="flex items-stretch gap-4">
          <aside className="demo-panel flex w-[300px] shrink-0 flex-col p-3">
            <div className="border-b border-[var(--line)] px-1 pb-2">
              <p className="island-kicker m-0">Сессии</p>
              <p className="m-0 text-sm font-bold text-[var(--ink)]">
                {activePerson.name}
              </p>
            </div>
            <div className="min-h-0 flex-1 py-2">
              <SessionList
                sessions={(sessionsQuery.data ?? []) as SessionSummary[]}
                activeId={sessionId}
                disabled={busy}
                onOpen={openSession}
                onDelete={handleDeleteSession}
                onNew={handleNewSession}
              />
            </div>
          </aside>

          <section className="demo-panel flex min-w-0 flex-1 flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="demo-section-title m-0">
                Чат с агентом · {activePerson.name}
              </h2>
              <span className="demo-muted text-xs">
                {sessionId ? `сессия #${sessionId}` : 'новая сессия'}
              </span>
            </div>
            <p className="demo-muted m-0 text-xs">
              Сообщения и результат каждого запуска сохраняются в SQLite.
              Перезапусти приложение — диалог продолжится.
            </p>

            <ExampleChips
              examples={roleExamples}
              disabled={busy}
              onPick={pickExample}
            />
            {availableTools.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {availableTools.map((tool) => (
                  <span
                    key={tool.name}
                    className="demo-pill"
                    title={tool.description}
                  >
                    {tool.label}
                  </span>
                ))}
              </div>
            )}

            {sessionTotals.prompt + sessionTotals.completion > 0 && (
              <p className="demo-muted m-0 text-xs">
                Суммарно за сессию: prompt {sessionTotals.prompt} + completion{' '}
                {sessionTotals.completion} ток. · ~{formatUsd(sessionTotals.cost)}
              </p>
            )}

            <TokenReport
              requestTokens={requestTokens}
              historyTokens={historyTokens}
              historyTokensSent={
                lastRun ? lastRun.tokens.historyTokensSent : null
              }
              responseTokens={lastRun ? lastRun.tokens.responseTokens : null}
            />

            <TokenMeter
              historyTokens={historyTokens}
              requestTokens={requestTokens}
              budget={CONTEXT_BUDGET_TOKENS}
              modelContext={MODEL_CONTEXT_TOKENS}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <div className="flex flex-wrap gap-2">
                {TOKEN_SCENARIOS.map((scenario) => (
                  <button
                    key={scenario.id}
                    type="button"
                    onClick={() => pickScenario(scenario.id)}
                    disabled={busy}
                    className="demo-button demo-button-secondary px-3 py-1 text-xs"
                    title={scenario.hint}
                  >
                    {scenario.label}
                  </button>
                ))}
              </div>
              <label
                className="demo-muted flex cursor-pointer select-none items-center gap-1.5 text-xs"
                title={
                  enforceBudget
                    ? 'Агент урежет историю и откажет запрос больше бюджета'
                    : 'Агент шлёт всё как есть — история растёт без ограничений'
                }
              >
                <input
                  type="checkbox"
                  checked={enforceBudget}
                  onChange={(e) => setEnforceBudget(e.target.checked)}
                  disabled={busy}
                  className="accent-[var(--accent)]"
                />
                защита бюджета
              </label>
            </div>

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
                rows={6}
                disabled={busy}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="demo-button"
                  disabled={busy || draft.trim().length === 0}
                >
                  {busy ? 'Агент работает…' : 'Отправить агенту'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

function toError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
