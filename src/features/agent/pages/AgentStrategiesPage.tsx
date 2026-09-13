import { useEffect, useMemo, useState } from 'react'
import type { AgentRunResult } from '../domain/agent'
import type { ContextStrategyId } from '../domain/context/types'
import { accountSession } from '../domain/accounting'
import {
  DEFAULT_SCENARIO,
  SCENARIO_CHECKLIST,
  SCENARIO_MESSAGES,
  STRATEGY_CHOICES,
  strategyLabel,
} from '../data/day10'
import { useOrg } from '../api/get-org'
import { useSessions } from '../api/get-sessions'
import { useSessionMessages } from '../api/get-session-messages'
import { useSessionBranches } from '../api/get-branches'
import { useSessionFacts } from '../api/get-facts'
import { useChecklist } from '../api/get-checklist'
import { useSendMessage } from '../api/send-message'
import { useDeleteSession } from '../api/delete-session'
import { useCreateBranch } from '../api/create-branch'
import { useSwitchBranch } from '../api/switch-branch'
import { useCompareSessions } from '../api/compare-sessions'
import { useSaveChecklist } from '../api/save-checklist'
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/Tabs'
import PersonaPicker from '../components/PersonaPicker'
import ChatThread from '../components/ChatThread'
import type { ThreadMessage } from '../components/ChatThread'
import SessionList from '../components/SessionList'
import TokenReport from '../components/TokenReport'
import ContextPanel from '../components/ContextPanel'
import FactsPanel from '../components/FactsPanel'
import BranchPanel from '../components/BranchPanel'
import ScenarioChips from '../components/ScenarioChips'
import ScenarioCompare from '../components/ScenarioCompare'

export default function AgentStrategiesPage() {
  const [activeToken, setActiveToken] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [strategy, setStrategy] = useState<ContextStrategyId>('window')
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO)
  const [checklistDraft, setChecklistDraft] = useState('')

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
  const branchesQuery = useSessionBranches(sessionId)
  const factsQuery = useSessionFacts(sessionId)
  const checklistQuery = useChecklist(activeToken, scenario)

  const sendMutation = useSendMessage(activeToken ?? '')
  const deleteMutation = useDeleteSession(activeToken ?? '')
  const branchMutation = useCreateBranch()
  const switchMutation = useSwitchBranch()
  const compareMutation = useCompareSessions()
  const saveChecklistMutation = useSaveChecklist(activeToken ?? '', scenario)

  const messages: ThreadMessage[] = (messagesQuery.data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    ...(row.run ? { run: row.run as AgentRunResult } : {}),
  }))
  const branches = branchesQuery.data ?? []
  const facts = factsQuery.data ?? []
  const checklist =
    checklistQuery.data && checklistQuery.data.length > 0
      ? checklistQuery.data
      : SCENARIO_CHECKLIST

  const sessionSummary = (sessionsQuery.data ?? []).find(
    (session) => session.id === sessionId,
  )
  const sessionLocked = sessionId !== null
  const activeStrategy: ContextStrategyId =
    sessionSummary?.strategy ?? strategy
  const scriptIndex = useMemo(
    () => messages.filter((message) => message.role === 'user').length,
    [messages],
  )

  const busy =
    sendMutation.isPending ||
    deleteMutation.isPending ||
    branchMutation.isPending ||
    switchMutation.isPending ||
    compareMutation.isPending

  const lastRun: AgentRunResult | null =
    [...messages].reverse().find((message) => message.run)?.run ?? null
  const noteState = lastRun?.contextNote ?? null

  const accounting = accountSession(messages, draft)
  const comparison = compareMutation.data ?? null

  const handlePickPerson = (token: string) => {
    if (token === activeToken || busy) {
      return
    }
    sendMutation.reset()
    compareMutation.reset()
    setActiveToken(token)
    setSessionId(null)
    setDraft('')
  }

  const openSession = (id: number) => {
    if (busy || id === sessionId) {
      return
    }
    setSessionId(id)
    setDraft('')
    const summary = (sessionsQuery.data ?? []).find(
      (session) => session.id === id,
    )
    if (summary) {
      setStrategy(summary.strategy)
      if (summary.scenario) {
        setScenario(summary.scenario)
      }
    }
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
      { token: activeToken, sessionId, user: text, strategy, scenario },
      { onSuccess: (result) => setSessionId(result.sessionId) },
    )
  }

  const handleFork = (messageId: number) => {
    if (busy || sessionId === null) {
      return
    }
    branchMutation.mutate({ sessionId, fromMessageId: messageId })
  }

  const handleSwitchBranch = (branchId: number) => {
    if (busy || sessionId === null) {
      return
    }
    switchMutation.mutate({ sessionId, branchId })
  }

  const handleForkCheckpoint = (
    parentBranchId: number,
    forkMessageId: number,
  ) => {
    if (busy || sessionId === null) {
      return
    }
    branchMutation.mutate({
      sessionId,
      fromMessageId: forkMessageId,
      parentBranchId,
    })
  }

  const handleCompare = () => {
    if (!activeToken || scenario.trim().length === 0 || busy) {
      return
    }
    compareMutation.mutate({ token: activeToken, scenario })
  }

  const handleAddChecklist = () => {
    const value = checklistDraft.trim()
    if (value.length === 0 || !activeToken) {
      return
    }
    setChecklistDraft('')
    saveChecklistMutation.mutate([...checklist, value])
  }

  const handleRemoveChecklist = (index: number) => {
    if (!activeToken) {
      return
    }
    saveChecklistMutation.mutate(checklist.filter((_, i) => i !== index))
  }

  const sendError = sendMutation.isError ? toError(sendMutation.error) : null
  const branchError = branchMutation.isError
    ? toError(branchMutation.error)
    : null
  const compareError = compareMutation.isError
    ? toError(compareMutation.error)
    : null
  const orgError = orgQuery.isError ? toError(orgQuery.error) : null

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pb-6 pt-6">
      <header className="mb-1">
        <p className="island-kicker mb-2">Day 10 · Context strategies</p>
        <h1 className="demo-title mb-2">Три стратегии управления контекстом</h1>
        <p className="demo-muted m-0 max-w-4xl text-sm">
          Скользящее окно, key-value факты и ветки диалога — по одной стратегии на
          сессию. Прогони один и тот же сценарий «{DEFAULT_SCENARIO}» в трёх
          сессиях и сравни ответы, стабильность и расход токенов в панели ниже.
        </p>
      </header>

      {orgQuery.isLoading && <p className="demo-muted">Загружаю сотрудников…</p>}
      {orgError && <div className="demo-alert demo-alert-danger">{orgError}</div>}

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
                onOpen={openSession}
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

            <div className="flex flex-wrap items-center gap-3">
              <Tabs
                value={strategy}
                onValueChange={(value) =>
                  setStrategy(value as ContextStrategyId)
                }
              >
                <TabsList>
                  {STRATEGY_CHOICES.map((choice) => (
                    <TabsTrigger
                      key={choice.id}
                      value={choice.id}
                      disabled={sessionLocked || busy}
                      title={choice.description}
                    >
                      {choice.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <label className="demo-muted flex items-center gap-2 text-xs">
                сценарий
                <input
                  value={scenario}
                  onChange={(event) => setScenario(event.target.value)}
                  disabled={busy || sessionLocked}
                  className="demo-input demo-input-fit w-48 py-1 text-xs"
                />
              </label>
            </div>

            <p className="demo-muted m-0 text-xs">
              {sessionLocked
                ? `Стратегия «${strategyLabel(activeStrategy)}» зафиксирована за сессией — переключить её можно только в новой сессии.`
                : 'Выбор стратегии и метки сценария зафиксируются при первом сообщении. Совет: заведи три сессии с одним сценарием — по одной на стратегию.'}
            </p>

            <ScenarioChips
              messages={SCENARIO_MESSAGES}
              index={scriptIndex}
              disabled={busy}
              onPick={setDraft}
            />

            <FactsPanel facts={facts} />

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

            <ChatThread
              messages={messages}
              running={sendMutation.isPending}
              onFork={activeStrategy === 'branch' ? handleFork : undefined}
              forkDisabled={busy}
            />

            {activeStrategy === 'branch' && (
              <BranchPanel
                branches={branches}
                disabled={busy}
                onSwitch={handleSwitchBranch}
                onForkCheckpoint={handleForkCheckpoint}
              />
            )}

            {sendError && (
              <div className="demo-alert demo-alert-danger">{sendError}</div>
            )}
            {branchError && (
              <div className="demo-alert demo-alert-danger">{branchError}</div>
            )}

            <form
              onSubmit={(event) => {
                event.preventDefault()
                handleSend()
              }}
              className="flex flex-col gap-3"
            >
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Введите сообщение из сценария или своё…"
                className="demo-textarea min-h-0"
                rows={4}
                disabled={busy}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="demo-muted text-xs">
                  {STRATEGY_CHOICES.find((c) => c.id === activeStrategy)
                    ?.description ?? ''}
                </span>
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

      {activePerson && (
        <ScenarioCompare
          scenario={scenario}
          canCompare={
            scenario.trim().length > 0 &&
            (sessionsQuery.data ?? []).some(
              (session) => session.scenario === scenario,
            )
          }
          running={compareMutation.isPending}
          disabled={busy}
          result={comparison}
          error={compareError}
          checklist={checklist}
          checklistDraft={checklistDraft}
          onChecklistDraft={setChecklistDraft}
          onAddChecklist={handleAddChecklist}
          onRemoveChecklist={handleRemoveChecklist}
          onCompare={handleCompare}
        />
      )}
    </div>
  )
}

function toError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
