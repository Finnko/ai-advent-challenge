import { useEffect, useRef, useState } from 'react'
import type { AgentRunResult } from '../domain/agent'
import type { ContextStrategyId } from '../domain/context/types'
import { accountSession } from '../domain/accounting'
import { CONTEXT_BUDGET_TOKENS, MODEL_CONTEXT_TOKENS } from '../domain/tokens'
import { EXAMPLES, TOOL_INFO, TOKEN_SCENARIOS } from '../data/agent-ui'
import type { Example, PersonaKind, ToolInfo } from '../data/agent-ui'
import { useOrg } from '../api/get-org'
import { useSessions } from '../api/get-sessions'
import { useCapabilities } from '../api/get-capabilities'
import { useSessionMessages } from '../api/get-session-messages'
import { useSendMessage } from '../api/send-message'
import { useDeleteSession } from '../api/delete-session'
import { useCompareCompression } from '../api/compare-compression'
import PersonaPicker from '../components/PersonaPicker'
import CapabilitiesPanel from '../components/CapabilitiesPanel'
import ExampleChips from '../components/ExampleChips'
import ChatThread from '../components/ChatThread'
import type { ThreadMessage } from '../components/ChatThread'
import SessionList from '../components/SessionList'
import TokenMeter from '../components/TokenMeter'
import TokenReport from '../components/TokenReport'
import ContextPanel from '../components/ContextPanel'
import SessionAccounting from '../components/SessionAccounting'
import CompressionCompare from '../components/CompressionCompare'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Checkbox } from '@/components/ui/Checkbox'

export default function AgentPage() {
  const [activeToken, setActiveToken] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [strategy, setStrategy] = useState<ContextStrategyId>('summary')
  const autoPickRef = useRef(false)

  const orgQuery = useOrg()
  const people = orgQuery.data ?? []
  const manager = people.find((person) => person.role === 'manager') ?? null
  const employees = people.filter((person) => person.role === 'employee')
  const activePerson =
    people.find((person) => person.token === activeToken) ?? manager ?? null
  const kind: PersonaKind = activePerson?.role ?? 'employee'
  const roleExamples: Example[] = EXAMPLES.filter((example) => example.kind === kind)
  const availableTools: ToolInfo[] = TOOL_INFO.filter((tool) =>
    tool.roles.includes(kind),
  )

  useEffect(() => {
    if (!activeToken && manager) {
      setActiveToken(manager.token)
    }
  }, [activeToken, manager])

  const capabilitiesQuery = useCapabilities(activeToken)
  const sessionsQuery = useSessions(activeToken)
  const messagesQuery = useSessionMessages(sessionId)

  const sendMutation = useSendMessage(activeToken ?? '')
  const deleteMutation = useDeleteSession(activeToken ?? '')
  const compareMutation = useCompareCompression()

  const messages: ThreadMessage[] = (messagesQuery.data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    ...(row.run ? { run: row.run as AgentRunResult } : {}),
  }))

  const busy =
    sendMutation.isPending ||
    compareMutation.isPending ||
    deleteMutation.isPending ||
    capabilitiesQuery.isLoading

  const openSession = (id: number) => {
    if (busy || id === sessionId) {
      return
    }
    sendMutation.reset()
    compareMutation.reset()
    setSessionId(id)
    setDraft('')
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

  const handlePickPerson = (token: string) => {
    if (token === activeToken || busy) {
      return
    }
    sendMutation.reset()
    compareMutation.reset()
    setActiveToken(token)
    setSessionId(null)
    setDraft('')
    autoPickRef.current = true
  }

  const handleNewSession = () => {
    if (busy) {
      return
    }
    sendMutation.reset()
    compareMutation.reset()
    setSessionId(null)
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
        }
      },
    })
  }

  const handleSend = () => {
    const text = draft.trim()
    if (text.length === 0 || busy || !activeToken) {
      return
    }
    setDraft('')
    sendMutation.mutate(
      { token: activeToken, sessionId, user: text, strategy },
      { onSuccess: (result) => setSessionId(result.sessionId) },
    )
  }

  const handleCompare = () => {
    const text = draft.trim()
    if (text.length === 0 || sessionId === null || busy || !activeToken) {
      return
    }
    compareMutation.mutate({ token: activeToken, sessionId, user: text })
  }

  const accounting = accountSession(messages, draft)
  const lastRun: AgentRunResult | null =
    [...messages].reverse().find((message) => message.run)?.run ?? null
  const noteState = lastRun?.contextNote ?? null
  const comparison = compareMutation.data ?? null
  const compareError = compareMutation.isError
    ? toError(compareMutation.error)
    : null
  const sendError = sendMutation.isError ? toError(sendMutation.error) : null
  const orgError = orgQuery.isError ? toError(orgQuery.error) : null

  let capsPanel: Parameters<typeof CapabilitiesPanel>[0] = { status: 'loading' }
  if (capabilitiesQuery.data) {
    capsPanel = { status: 'ready', caps: capabilitiesQuery.data }
  } else if (capabilitiesQuery.isError) {
    capsPanel = { status: 'error', message: toError(capabilitiesQuery.error) }
  }

  let strategyHint: string
  if (sessionId !== null) {
    strategyHint =
      'Стратегия зафиксирована за сессией — начни новую сессию, чтобы сменить'
  } else if (strategy === 'summary') {
    strategyHint =
      'Агент шлёт последние N сообщений и сводку старой истории; одиночный запрос больше бюджета отклоняется'
  } else {
    strategyHint = 'История уходит целиком, без сводки — база для сравнения'
  }

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pb-6 pt-6">
      <header className="mb-1">
        <p className="island-kicker mb-2">Agent · Context strategies</p>
        <h1 className="demo-title mb-2">
          Корпоративный агент со стратегиями контекста
        </h1>
        <p className="demo-muted m-0 max-w-4xl text-sm">
          Тот же агент, что в первый день, — теперь контекст собирается подключаемой
          стратегией. Сейчас активна «сжатие истории»: последние сообщения уходят
          как есть, а старая история сворачивается в сводку, которая хранится
          отдельно в SQLite. Стратегия фиксируется на сессию: переключать её можно
          только до первого сообщения. A/B сравнение показывает экономию токенов и
          цены.
        </p>
      </header>

      {orgQuery.isLoading && <p className="demo-muted">Загружаю сотрудников…</p>}
      {orgError && <Alert variant="destructive">{orgError}</Alert>}

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
                sessions={sessionsQuery.data ?? []}
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
              onPick={setDraft}
            />
            {availableTools.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {availableTools.map((tool) => (
                  <Badge key={tool.name} title={tool.description}>
                    {tool.label}
                  </Badge>
                ))}
              </div>
            )}

            <SessionAccounting totals={accounting} />

            <TokenReport
              requestTokens={accounting.requestTokens}
              historyTokens={accounting.historyTokens}
              historyTokensSent={
                lastRun ? lastRun.tokens.historyTokensSent : null
              }
              responseTokens={lastRun ? lastRun.tokens.responseTokens : null}
              contextTokens={lastRun ? lastRun.tokens.contextTokens : null}
            />

            {noteState && <ContextPanel note={noteState} />}

            <TokenMeter
              historyTokens={accounting.historyTokens}
              requestTokens={accounting.requestTokens}
              budget={CONTEXT_BUDGET_TOKENS}
              modelContext={MODEL_CONTEXT_TOKENS}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
              <div className="flex flex-wrap gap-2">
                {TOKEN_SCENARIOS.map((scenario) => (
                  <Button
                    key={scenario.id}
                    variant="secondary"
                    size="sm"
                    onClick={() => setDraft(scenario.text)}
                    disabled={busy}
                    title={scenario.hint}
                  >
                    {scenario.label}
                  </Button>
                ))}
              </div>
              <label
                className="demo-muted flex cursor-pointer select-none items-center gap-1.5 text-xs"
                title={strategyHint}
              >
                <Checkbox
                  checked={strategy === 'summary'}
                  onCheckedChange={(checked) =>
                    setStrategy(checked ? 'summary' : 'none')
                  }
                  disabled={busy || sessionId !== null}
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
              <Alert variant="destructive">{sendError}</Alert>
            )}

            <form
              onSubmit={(event) => {
                event.preventDefault()
                handleSend()
              }}
              className="flex flex-col gap-3"
            >
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Например: забронируй переговорку на завтра на 15:00 на 6 человек…"
                className="min-h-0"
                rows={6}
                disabled={busy}
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={busy || draft.trim().length === 0}
                >
                  {busy ? 'Агент работает…' : 'Отправить агенту'}
                </Button>
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
