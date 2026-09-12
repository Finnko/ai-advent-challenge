import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import {
  compareCompression,
  deleteSession,
  listOrg,
  listSessions,
  loadSession,
  resolveCapabilities,
  runAgent,
} from '../../lib/chat'
import type { CompressionComparison } from '../../lib/chat'
import type { AgentRunResult } from '../../lib/agent'
import { EXAMPLES, TOOL_INFO, TOKEN_SCENARIOS } from '../../lib/agent-ui'
import type {
  Example,
  PersonaKind,
  ToolInfo,
  TokenScenarioId,
} from '../../lib/agent-ui'
import { accountSession } from '../../lib/accounting'
import { CONTEXT_BUDGET_TOKENS, MODEL_CONTEXT_TOKENS } from '../../lib/tokens'
import type { OrgPerson, SessionSummary } from '../../lib/chat'
import PersonaPicker from '../../components/agent/PersonaPicker'
import CapabilitiesPanel from '../../components/agent/CapabilitiesPanel'
import ExampleChips from '../../components/agent/ExampleChips'
import ChatThread from '../../components/agent/ChatThread'
import type { ThreadMessage } from '../../components/agent/ChatThread'
import SessionList from '../../components/agent/SessionList'
import TokenMeter from '../../components/agent/TokenMeter'
import TokenReport from '../../components/agent/TokenReport'
import SummaryPanel from '../../components/agent/SummaryPanel'
import SessionAccounting from '../../components/agent/SessionAccounting'
import CompressionCompare from '../../components/agent/CompressionCompare'

export const Route = createFileRoute('/_layout/agent')({ component: AgentPage })

function AgentPage() {
  const queryClient = useQueryClient()
  const [activeToken, setActiveToken] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [draft, setDraft] = useState('')
  const [compressHistory, setCompressHistory] = useState(true)
  const [summaryState, setSummaryState] = useState<{
    summary: string
    summarizedMessages: number
    throughMessageId: number | null
  } | null>(null)
  const [comparison, setComparison] = useState<CompressionComparison | null>(
    null,
  )
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
      compressHistory: boolean
    }) => runAgent({ data: input }),
  })
  const compareMutation = useMutation({
    mutationFn: (input: { token: string; sessionId: number; user: string }) =>
      compareCompression({ data: input }),
  })
  const loadMutation = useMutation({
    mutationFn: (id: number) => loadSession({ data: { sessionId: id } }),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSession({ data: { sessionId: id } }),
  })

  const busy =
    sendMutation.isPending ||
    compareMutation.isPending ||
    loadMutation.isPending ||
    deleteMutation.isPending ||
    capsQuery.isLoading

  const handlePickPerson = (token: string) => {
    if (token === activeToken || busy) {
      return
    }
    sendMutation.reset()
    loadMutation.reset()
    compareMutation.reset()
    setActiveToken(token)
    setSessionId(null)
    setMessages([])
    setDraft('')
    setSummaryState(null)
    setComparison(null)
    autoPickRef.current = true
  }

  const openSession = (id: number) => {
    if (busy || id === sessionId) {
      return
    }
    setSessionId(id)
    setMessages([])
    setSummaryState(null)
    setComparison(null)
    compareMutation.reset()
    loadMutation.mutate(id, {
      onSuccess: (rows) => {
        setMessages(
          rows.map((row): ThreadMessage => ({
            role: row.role,
            content: row.content,
            ...(row.run ? { run: row.run as AgentRunResult } : {}),
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
    compareMutation.reset()
    setSessionId(null)
    setMessages([])
    setDraft('')
    setSummaryState(null)
    setComparison(null)
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
          setSummaryState(null)
          setComparison(null)
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
      { token: activeToken, sessionId, user: text, compressHistory },
      {
        onSuccess: (result) => {
          setSessionId(result.sessionId)
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: result.run.answer, run: result.run },
          ])
          setSummaryState(
            result.summary
              ? {
                  summary: result.summary,
                  summarizedMessages: result.summarizedMessages,
                  throughMessageId: result.summaryThroughMessageId,
                }
              : null,
          )
          queryClient.invalidateQueries({
            queryKey: ['agent-sessions', activeToken],
          })
        },
      },
    )
  }

  const handleCompare = () => {
    const text = draft.trim()
    if (text.length === 0 || sessionId === null || busy || !activeToken) {
      return
    }
    setComparison(null)
    compareMutation.mutate(
      { token: activeToken, sessionId, user: text },
      {
        onSuccess: (result) => setComparison(result),
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

  const accounting = accountSession(messages, draft)
  const requestTokens = accounting.requestTokens
  const historyTokens = accounting.historyTokens
  const lastRun: AgentRunResult | null =
    [...messages].reverse().find((message) => message.run)?.run ?? null
  const compareError = compareMutation.isError
    ? toError(compareMutation.error)
    : null

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
        <p className="island-kicker mb-2">Agent · Context compression</p>
        <h1 className="demo-title mb-2">
          Корпоративный агент со сжатием истории
        </h1>
        <p className="demo-muted m-0 max-w-4xl text-sm">
          Тот же агент, что в первый день, — теперь он управляет контекстом:
          последние сообщения уходят как есть, а старая история сворачивается в
          сводку, которая хранится отдельно в SQLite. Сводка вставляется
          system-блоком в обе стадии, а общий префикс промпта кешируется. A/B
          сравнение показывает экономию токенов и цены.
        </p>
      </header>

      {orgQuery.isLoading && (
        <p className="demo-muted">Загружаю сотрудников…</p>
      )}

      {orgError && (
        <div className="demo-alert demo-alert-danger">{orgError}</div>
      )}

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

            <SessionAccounting totals={accounting} />

            <TokenReport
              requestTokens={requestTokens}
              historyTokens={historyTokens}
              historyTokensSent={
                lastRun ? lastRun.tokens.historyTokensSent : null
              }
              responseTokens={lastRun ? lastRun.tokens.responseTokens : null}
              summaryTokens={lastRun ? lastRun.tokens.summaryTokens : null}
            />

            {summaryState && (
              <SummaryPanel
                summary={summaryState.summary}
                summarizedMessages={summaryState.summarizedMessages}
                throughMessageId={summaryState.throughMessageId}
                onClear={() => setSummaryState(null)}
              />
            )}

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
                  compressHistory
                    ? 'Агент шлёт последние N сообщений и сводку старой истории; одиночный запрос больше бюджета отклоняется'
                    : 'История уходит целиком, без сводки — база для сравнения'
                }
              >
                <input
                  type="checkbox"
                  checked={compressHistory}
                  onChange={(e) => setCompressHistory(e.target.checked)}
                  disabled={busy}
                  className="accent-[var(--accent)]"
                />
                сжатие истории
              </label>
            </div>

            <CompressionCompare
              canCompare={sessionId !== null && draft.trim().length > 0}
              running={compareMutation.isPending}
              disabled={busy}
              result={comparison}
              error={compareError}
              onCompare={handleCompare}
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
