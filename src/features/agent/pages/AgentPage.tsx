import { useMemo } from 'react'
import type { AgentCapabilities, AgentRunResult } from '../domain/agent'
import type { ContextStrategyId } from '../domain/context/types'
import type { ProfileInput } from '../domain/profile/types'
import { strategyLabel } from '../domain/context/registry'
import { accountSession } from '../domain/accounting'
import { CONTEXT_BUDGET_TOKENS, MODEL_CONTEXT_TOKENS } from '../domain/tokens'
import { useAgentWorkspace } from '../api/use-agent-workspace'
import PersonaPicker from '../components/PersonaPicker'
import CapabilitiesPanel from '../components/CapabilitiesPanel'
import ChatThread from '../components/ChatThread'
import type { ThreadMessage } from '../components/ChatThread'
import SessionList from '../components/SessionList'
import TokenMeter from '../components/TokenMeter'
import TokenReport from '../components/TokenReport'
import ContextPanel from '../components/ContextPanel'
import SessionAccounting from '../components/SessionAccounting'
import FactsPanel from '../components/FactsPanel'
import BranchPanel from '../components/BranchPanel'
import MemoryInspector from '../components/MemoryInspector'
import MemoryPanel from '../components/MemoryPanel'
import InvariantsPanel from '../components/InvariantsPanel'

import ProfileList from '../components/ProfileList'
import ProfileEditor from '../components/ProfileEditor'
import TaskStateBar from '../components/TaskStateBar'
import SessionConfig from '../components/SessionConfig'
import EmptySessionPanel from '../components/EmptySessionPanel'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'

function resolveCapsPanel(
  capabilities: AgentCapabilities | undefined,
  error: string | null,
): Parameters<typeof CapabilitiesPanel>[0] {
  if (capabilities) {
    return { status: 'ready', caps: capabilities }
  }
  if (error) {
    return { status: 'error', message: error }
  }
  return { status: 'loading' }
}

function resolveSessionHint(
  sessionLocked: boolean,
  profileId: number | null,
  profileName: string | undefined,
): string {
  if (sessionLocked) {
    return 'Конфиг зафиксирован за сессией'
  }
  if (profileId === null) {
    return 'Будет применён профиль по умолчанию'
  }
  return `Новая сессия с профилем «${profileName ?? ''}»`
}

export default function AgentPage() {
  const workspace = useAgentWorkspace()
  const {
    sessionId,
    draft,
    config,
    editingProfileId,
    creatingProfile,
    active,
    manager,
    employees,
    activePerson,
    sessions,
    facts,
    branches,
    memoryView,
    taskState,
    profiles,
    invariants,
    selectedProfile,
    defaultProfile,
    messagesData,
    capabilities,
    capabilitiesError,
    orgLoading,
    orgError,
    sendError,
    branchError,
    sessionError,
    settingsError,
    taskError,
    busy,
    taskBusy,
    sending,
    actions,
  } = workspace

  const messages: ThreadMessage[] = useMemo(
    () =>
      messagesData.map((row) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        ...(row.run ? { run: row.run as AgentRunResult } : {}),
        ...(row.taskEvent ? { taskEvent: row.taskEvent } : {}),
      })),
    [messagesData],
  )

  const activeStrategy: ContextStrategyId = active.strategy
  const activeWindowSize = active.windowSize
  const activeMemory = active.memoryEnabled
  const activeProfileName = workspace.sessionSummary
    ? (workspace.sessionSummary.profileName ?? null)
    : (selectedProfile?.name ?? defaultProfile?.name ?? null)

  const lastRun: AgentRunResult | null =
    [...messages].reverse().find((message) => message.run)?.run ?? null
  const noteState = lastRun?.contextNote ?? null
  const accounting = accountSession(messages, draft)

  const editorInitial: ProfileInput | null = useMemo(
    () =>
      selectedProfile
        ? {
            name: selectedProfile.name,
            addressing: selectedProfile.addressing,
            tone: selectedProfile.tone,
            language: selectedProfile.language,
            verbosity: selectedProfile.verbosity,
            format: selectedProfile.format,
            constraints: selectedProfile.constraints,
            instructions: selectedProfile.instructions,
          }
        : null,
    [selectedProfile],
  )

  const capsPanel = resolveCapsPanel(capabilities, capabilitiesError)

  const sessionLocked = sessionId !== null
  const showProfileEditor = creatingProfile || editingProfileId !== null
  const editorProfileId = creatingProfile ? null : editingProfileId
  const sessionHint = resolveSessionHint(
    sessionLocked,
    config.profileId,
    selectedProfile?.name,
  )

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pb-6 pt-6">
      <header className="mb-1">
        <p className="island-kicker mb-2">Agent · единый рабочий экран</p>
        <h1 className="demo-title mb-2">Корпоративный агент</h1>
        <p className="demo-muted m-0 max-w-4xl text-sm">
          Все доработки в одном месте: стратегии контекста (скользящее окно —
          краткосрочная память), слои памяти, профиль пользователя и состояние
          задачи. Настрой конфиг во вкладке «Настройки», создай сессию и работай
          во вкладке «Диалог». Инварианты — точка расширения для следующего дня.
        </p>
      </header>

      {orgLoading && <p className="demo-muted">Загружаю сотрудников…</p>}
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
            onPick={actions.pickPerson}
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
                sessions={sessions}
                activeId={sessionId}
                disabled={busy}
                onOpen={actions.openSession}
                onDelete={actions.deleteSession}
                onNew={actions.newSession}
              />
            </div>
          </aside>

          <section className="demo-panel flex min-w-0 flex-1 flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="demo-section-title m-0">
                Работа · {activePerson.name}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{strategyLabel(activeStrategy)}</Badge>
                {activeStrategy === 'window' && (
                  <Badge>окно {activeWindowSize}</Badge>
                )}
                <Badge>{activeMemory ? 'память вкл.' : 'память выкл.'}</Badge>
                <Badge>
                  {active.taskStateEnabled ? 'задача вкл.' : 'задача выкл.'}
                </Badge>
                {activeProfileName && <Badge>{activeProfileName}</Badge>}
                <span className="demo-muted text-xs">
                  {sessionId ? `сессия #${sessionId}` : 'новая сессия'}
                </span>
              </div>
            </div>

            <Tabs defaultValue="dialog">
              <TabsList>
                <TabsTrigger value="dialog">Диалог</TabsTrigger>
                <TabsTrigger
                  value="invariants"
                >
                  Инварианты
                </TabsTrigger>
                <TabsTrigger value="settings">Настройки</TabsTrigger>
              </TabsList>

              <TabsContent value="invariants">
                <InvariantsPanel
                  invariants={invariants}
                  disabled={busy}
                  onCreate={actions.createInvariant}
                  onUpdate={actions.updateInvariant}
                  onDelete={actions.deleteInvariant}
                />
              </TabsContent>

              <TabsContent value="dialog">
                {sessionId === null ? (
                  <EmptySessionPanel
                    busy={busy}
                    error={sessionError}
                    onCreate={actions.newSession}
                  />
                ) : (
                <div className="flex flex-col gap-3">
                  <SessionAccounting totals={accounting} />

                  <TokenReport
                    requestTokens={accounting.requestTokens}
                    historyTokens={accounting.historyTokens}
                    historyTokensSent={
                      lastRun ? lastRun.tokens.historyTokensSent : null
                    }
                    responseTokens={
                      lastRun ? lastRun.tokens.responseTokens : null
                    }
                    contextTokens={lastRun ? lastRun.tokens.contextTokens : null}
                  />

                  {noteState && <ContextPanel note={noteState} />}

                  <TokenMeter
                    historyTokens={accounting.historyTokens}
                    requestTokens={accounting.requestTokens}
                    budget={CONTEXT_BUDGET_TOKENS}
                    modelContext={MODEL_CONTEXT_TOKENS}
                  />

                  {activeStrategy === 'facts' && <FactsPanel facts={facts} />}

                  {activeStrategy === 'branch' && (
                    <BranchPanel
                      branches={branches}
                      disabled={busy}
                      onSwitch={actions.switchBranch}
                      onForkCheckpoint={actions.forkCheckpoint}
                    />
                  )}

                  <ChatThread
                    messages={messages}
                    running={sending}
                    onFork={activeStrategy === 'branch' ? actions.fork : undefined}
                    forkDisabled={busy}
                  />

                  {sendError && <Alert variant="destructive">{sendError}</Alert>}
                  {branchError && (
                    <Alert variant="destructive">{branchError}</Alert>
                  )}

                  <TaskStateBar
                    state={taskState}
                    enabled={active.taskStateEnabled}
                    hasSession={sessionLocked}
                    busy={taskBusy}
                    onPause={actions.pauseTask}
                    onResume={actions.resumeTask}
                    onCancel={actions.cancelTask}
                  />
                  {taskError && <Alert variant="destructive">{taskError}</Alert>}

                  {taskState?.stage === 'paused' && (
                    <p className="demo-muted m-0 text-xs">Задача на паузе</p>
                  )}

                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      actions.send()
                    }}
                    className="flex flex-col gap-3"
                  >
                    <Textarea
                      value={draft}
                      onChange={(event) => actions.setDraft(event.target.value)}
                      placeholder="Например: забронируй переговорку на завтра на 15:00 на 6 человек…"
                      className="min-h-0"
                      rows={6}
                      disabled={busy}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="demo-muted text-xs">{sessionHint}</span>
                      <Button
                        type="submit"
                        disabled={busy || draft.trim().length === 0}
                      >
                        {busy ? 'Агент работает…' : 'Отправить агенту'}
                      </Button>
                    </div>
                  </form>
                </div>
                )}
              </TabsContent>

              <TabsContent value="settings">
                <div className="flex flex-col gap-4">
                  {sessionLocked && (
                    <SessionConfig
                      locked
                      strategy={activeStrategy}
                      windowSize={activeWindowSize}
                      memory={activeMemory}
                      taskState={config.taskStateEnabled}
                      activeTaskState={active.taskStateEnabled}
                      profileName={activeProfileName}
                      profiles={profiles}
                      selectedProfileId={config.profileId}
                      busy={busy}
                      onStrategy={(id) =>
                        actions.patchConfig({ strategy: id })
                      }
                      onWindowSize={(size) =>
                        actions.patchConfig({ windowSize: size })
                      }
                      onMemory={(value) =>
                        actions.patchConfig({ memoryEnabled: value })
                      }
                      onTaskState={(value) =>
                        actions.patchConfig({ taskStateEnabled: value })
                      }
                      onProfile={(id) => actions.patchConfig({ profileId: id })}
                    />
                  )}
                  <SessionConfig
                    locked={false}
                    strategy={config.strategy}
                    windowSize={config.windowSize}
                    memory={config.memoryEnabled}
                    taskState={config.taskStateEnabled}
                    activeTaskState={active.taskStateEnabled}
                    profileName={activeProfileName}
                    profiles={profiles}
                    selectedProfileId={config.profileId}
                    busy={busy}
                    onStrategy={(id) => actions.patchConfig({ strategy: id })}
                    onWindowSize={(size) =>
                      actions.patchConfig({ windowSize: size })
                    }
                    onMemory={(value) =>
                      actions.patchConfig({ memoryEnabled: value })
                    }
                    onTaskState={(value) =>
                      actions.patchConfig({ taskStateEnabled: value })
                    }
                    onProfile={(id) => actions.patchConfig({ profileId: id })}
                  />

                  <div className="flex items-stretch gap-4">
                    <aside className="w-[300px] shrink-0">
                      <ProfileList
                        profiles={profiles}
                        activeId={editingProfileId}
                        disabled={busy}
                        onSelect={actions.selectProfile}
                        onCreate={actions.startCreateProfile}
                        onDelete={actions.deleteProfile}
                        onSetDefault={actions.setDefaultProfile}
                      />
                    </aside>
                    <div className="min-w-0 flex-1">
                      {showProfileEditor ? (
                        <ProfileEditor
                          key={editorProfileId ?? 'new-profile'}
                          profileId={editorProfileId}
                          initial={editorInitial}
                          disabled={busy}
                          onSave={actions.saveProfile}
                          onCancel={actions.finishProfileEdit}
                        />
                      ) : (
                        <section className="flex h-full items-center justify-center rounded-xl border border-dashed border-[var(--line)] p-6">
                          <p className="demo-muted m-0 text-xs">
                            Выбери профиль или создай новый.
                          </p>
                        </section>
                      )}
                    </div>
                  </div>

                  <section className="demo-panel p-5">
                    <h2 className="demo-section-title mb-3">
                      Слои памяти
                    </h2>
                    {sessionId === null ? (
                      <p className="demo-muted m-0 text-xs">
                        Отправь первое сообщение — появится сессия, и станут
                        доступны слои памяти и ручные записи.
                      </p>
                    ) : (
                      <div className="flex items-stretch gap-4">
                        <div className="min-w-0 flex-1">
                          <MemoryInspector
                            working={memoryView.working}
                            longTerm={memoryView.longTerm}
                            shortTermCount={
                              messages.filter(
                                (message) => message.role !== 'task',
                              ).length
                            }
                            disabled={busy}
                            onForget={actions.forgetMemory}
                          />
                        </div>
                        <div className="w-[360px] shrink-0">
                          <MemoryPanel
                            disabled={busy}
                            lastUserMessage={lastUserMessage(messages)}
                            onSave={actions.saveMemory}
                          />
                        </div>
                      </div>
                    )}
                  </section>

                  {settingsError && (
                    <Alert variant="destructive">{settingsError}</Alert>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </section>
        </div>
      )}
    </div>
  )
}

function lastUserMessage(messages: ThreadMessage[]): string | undefined {
  return [...messages]
    .reverse()
    .find((message) => message.role === 'user')?.content
}
