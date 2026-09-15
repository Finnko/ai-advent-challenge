import { useEffect, useMemo, useState } from 'react'
import type { AgentRunResult } from '../domain/agent'
import type { MemoryLayer } from '../domain/memory/types'
import { accountSession } from '../domain/accounting'
import {
  DEFAULT_MEMORY_SCENARIO,
  MEMORY_SESSION_ONE,
  MEMORY_SESSION_TWO,
  MEMORY_STRATEGY,
} from '../data/day11'
import { useOrg } from '../api/get-org'
import { useSessions } from '../api/get-sessions'
import { useSessionMessages } from '../api/get-session-messages'
import { useMemory } from '../api/get-memory'
import { useSaveMemory } from '../api/save-memory'
import { useDeleteMemory } from '../api/delete-memory'
import { useSendMessage } from '../api/send-message'
import { useDeleteSession } from '../api/delete-session'
import PersonaPicker from '../components/PersonaPicker'
import ChatThread from '../components/ChatThread'
import type { ThreadMessage } from '../components/ChatThread'
import SessionList from '../components/SessionList'
import TokenReport from '../components/TokenReport'
import ScenarioChips from '../components/ScenarioChips'
import MemoryInspector from '../components/MemoryInspector'
import MemoryPanel from '../components/MemoryPanel'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'

const EMPTY_MEMORY = { working: [], longTerm: [] }

export default function AgentMemoryPage() {
  const [activeToken, setActiveToken] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')

  const orgQuery = useOrg()
  const people = orgQuery.data ?? []
  const manager = people.find((person) => person.role === 'manager') ?? null
  const employees = people.filter((person) => person.role === 'employee')
  const activePerson =
    people.find((person) => person.token === activeToken) ?? manager ?? null

  useEffect(() => {
    if (!activeToken && manager) {
      setActiveToken(manager.token)
    }
  }, [activeToken, manager])

  const sessionsQuery = useSessions(activeToken)
  const messagesQuery = useSessionMessages(sessionId)
  const memoryQuery = useMemory(sessionId, activeToken)

  const sendMutation = useSendMessage(activeToken ?? '')
  const deleteSessionMutation = useDeleteSession(activeToken ?? '')
  const saveMemoryMutation = useSaveMemory()
  const deleteMemoryMutation = useDeleteMemory()

  const messages: ThreadMessage[] = (messagesQuery.data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    ...(row.run ? { run: row.run as AgentRunResult } : {}),
  }))
  const memory = memoryQuery.data ?? EMPTY_MEMORY
  const sessionSummary = (sessionsQuery.data ?? []).find(
    (session) => session.id === sessionId,
  )
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user')?.content
  const scriptIndex = useMemo(
    () => messages.filter((message) => message.role === 'user').length,
    [messages],
  )
  const script =
    scriptIndex < MEMORY_SESSION_ONE.length
      ? MEMORY_SESSION_ONE
      : MEMORY_SESSION_TWO

  const busy =
    sendMutation.isPending ||
    deleteSessionMutation.isPending ||
    saveMemoryMutation.isPending ||
    deleteMemoryMutation.isPending

  const lastRun: AgentRunResult | null =
    [...messages].reverse().find((message) => message.run)?.run ?? null
  const accounting = accountSession(messages, draft)

  const handlePickPerson = (token: string) => {
    if (token === activeToken || busy) {
      return
    }
    sendMutation.reset()
    setActiveToken(token)
    setSessionId(null)
    setDraft('')
  }

  const handleNewSession = () => {
    if (busy) {
      return
    }
    sendMutation.reset()
    setSessionId(null)
    setDraft('')
  }

  const handleOpenSession = (id: number) => {
    if (busy || id === sessionId) {
      return
    }
    setSessionId(id)
    setDraft('')
  }

  const handleDeleteSession = (id: number) => {
    if (busy) {
      return
    }
    deleteSessionMutation.mutate(id, {
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
      {
        token: activeToken,
        sessionId,
        user: text,
        strategy: MEMORY_STRATEGY,
        scenario: DEFAULT_MEMORY_SCENARIO,
        memory: true,
      },
      { onSuccess: (result) => setSessionId(result.sessionId) },
    )
  }

  const handleSave = (input: {
    scope: MemoryLayer
    key: string
    value: string
  }) => {
    if (!activeToken || sessionId === null) {
      return
    }
    saveMemoryMutation.mutate({
      ...input,
      token: activeToken,
      sessionId,
      scenario: DEFAULT_MEMORY_SCENARIO,
    })
  }

  const handleForget = (scope: MemoryLayer, key: string) => {
    if (!activeToken || sessionId === null) {
      return
    }
    deleteMemoryMutation.mutate({ scope, key, token: activeToken, sessionId })
  }

  const sendError = sendMutation.isError ? toError(sendMutation.error) : null
  let memoryError: string | null = null
  if (saveMemoryMutation.isError) {
    memoryError = toError(saveMemoryMutation.error)
  } else if (deleteMemoryMutation.isError) {
    memoryError = toError(deleteMemoryMutation.error)
  }
  const orgError = orgQuery.isError ? toError(orgQuery.error) : null

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pb-6 pt-6">
      <header className="mb-1">
        <p className="island-kicker mb-2">Day 11 · Memory layers</p>
        <h1 className="demo-title mb-2">Модель памяти агента</h1>
        <p className="demo-muted m-0 max-w-4xl text-sm">
          Три слоя хранятся раздельно: краткосрочная (диалог), рабочая (данные
          задачи, сбрасывается с сессией) и долговременная (профиль и решения,
          переживает сессии). Агент сам раскладывает сведения по слоям через
          MemoryRouter, а вы можете писать и забывать записи вручную.
        </p>
      </header>

      {orgQuery.isLoading && <p className="demo-muted">Загружаю сотрудников…</p>}
      {orgError && <Alert variant="destructive">{orgError}</Alert>}

      {activePerson && manager && (
        <section className="demo-panel p-5">
          <h2 className="demo-section-title mb-2">За кого говорит агент</h2>
          <PersonaPicker
            manager={manager}
            employees={employees}
            activeToken={activePerson.token}
            disabled={busy}
            onPick={handlePickPerson}
          />
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
                onOpen={handleOpenSession}
                onDelete={handleDeleteSession}
                onNew={handleNewSession}
              />
            </div>
          </aside>

          <section className="demo-panel flex min-w-0 flex-1 flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="demo-section-title m-0">
                Чат · {activePerson.name}
              </h2>
              <span className="demo-muted text-xs">
                {sessionId ? `сессия #${sessionId}` : 'новая сессия'}
              </span>
            </div>

            {sessionId !== null &&
              sessionSummary &&
              !sessionSummary.memoryEnabled && (
                <p className="demo-muted m-0 text-xs">
                  В этой сессии память выключена. Начни новую сессию, чтобы
                  включить слои.
                </p>
              )}

            <ScenarioChips
              messages={script}
              index={scriptIndex}
              disabled={busy}
              onPick={setDraft}
            />

            <TokenReport
              requestTokens={accounting.requestTokens}
              historyTokens={accounting.historyTokens}
              historyTokensSent={
                lastRun ? lastRun.tokens.historyTokensSent : null
              }
              responseTokens={lastRun ? lastRun.tokens.responseTokens : null}
              contextTokens={lastRun ? lastRun.tokens.contextTokens : null}
            />

            <ChatThread messages={messages} running={sendMutation.isPending} />

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
                placeholder="Сообщение из сценария «Запуск линии кофе» или своё…"
                className="min-h-0"
                rows={4}
                disabled={busy}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="demo-muted text-xs">
                  Стратегия контекста — скользящее окно (краткосрочный слой)
                </span>
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

      {activePerson && (
        <div className="flex items-stretch gap-4">
          <section className="demo-panel min-w-0 flex-1 p-5">
            <h2 className="demo-section-title mb-3">Слои памяти</h2>
            <MemoryInspector
              working={memory.working}
              longTerm={memory.longTerm}
              shortTermCount={messagesQuery.data?.length ?? 0}
              disabled={busy || sessionId === null}
              onForget={handleForget}
            />
            {memoryError && (
              <Alert variant="destructive" className="mt-3">
                {memoryError}
              </Alert>
            )}
          </section>
          <div className="flex w-[360px] shrink-0 flex-col gap-3">
            {sessionId === null ? (
              <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                <p className="island-kicker m-0 text-[10px]">Запомнить явно</p>
                <p className="demo-muted m-0 mt-1 text-xs">
                  Отправь первое сообщение — появится сессия, и станут доступны
                  ручные записи.
                </p>
              </section>
            ) : (
              <MemoryPanel
                disabled={busy}
                lastUserMessage={lastUserMessage}
                onSave={handleSave}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function toError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
