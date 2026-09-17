import { useMemo } from 'react'
import type { AgentRunResult } from '../domain/agent'
import type { ContextStrategyId } from '../domain/context/types'
import type { ProfileInput } from '../domain/profile/types'
import {
  CONTEXT_STRATEGIES,
  CONTEXT_STRATEGY_IDS,
} from '../domain/context/registry'
import { accountSession } from '../domain/accounting'
import {
  WINDOW_SIZE_MAX,
  WINDOW_SIZE_MIN,
  clampWindowSize,
} from '../domain/session/config'
import { CONTEXT_BUDGET_TOKENS, MODEL_CONTEXT_TOKENS } from '../domain/tokens'
import { EXAMPLES, TOOL_INFO, TOKEN_SCENARIOS } from '../data/agent-ui'
import type { Example, PersonaKind, ToolInfo } from '../data/agent-ui'
import { useAgentWorkspace } from '../api/use-agent-workspace'
import type { ProfileItem } from '../types'
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
import FactsPanel from '../components/FactsPanel'
import BranchPanel from '../components/BranchPanel'
import MemoryInspector from '../components/MemoryInspector'
import MemoryPanel from '../components/MemoryPanel'
import TaskStatePanel from '../components/TaskStatePanel'
import ProfileList from '../components/ProfileList'
import ProfileEditor from '../components/ProfileEditor'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'

const STRATEGY_CHOICES = CONTEXT_STRATEGY_IDS.map((id) => ({
  id,
  label: CONTEXT_STRATEGIES[id].label,
  description: CONTEXT_STRATEGIES[id].description,
}))

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
    selectedProfile,
    defaultProfile,
    messagesData,
    capabilities,
    capabilitiesError,
    orgLoading,
    orgError,
    sendError,
    branchError,
    settingsError,
    taskError,
    busy,
    sending,
    actions,
  } = workspace

  const kind: PersonaKind = activePerson?.role ?? 'employee'
  const roleExamples: Example[] = EXAMPLES.filter(
    (example) => example.kind === kind,
  )
  const availableTools: ToolInfo[] = TOOL_INFO.filter((tool) =>
    tool.roles.includes(kind),
  )

  const messages: ThreadMessage[] = useMemo(
    () =>
      messagesData.map((row) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        ...(row.run ? { run: row.run as AgentRunResult } : {}),
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

  let capsPanel: Parameters<typeof CapabilitiesPanel>[0] = { status: 'loading' }
  if (capabilities) {
    capsPanel = { status: 'ready', caps: capabilities }
  } else if (capabilitiesError) {
    capsPanel = { status: 'error', message: capabilitiesError }
  }

  const sessionLocked = sessionId !== null
  const showProfileEditor = creatingProfile || editingProfileId !== null

  let sessionHint: string
  if (sessionLocked) {
    sessionHint = 'Конфиг зафиксирован за сессией'
  } else if (config.profileId === null) {
    sessionHint = 'Будет применён профиль по умолчанию'
  } else {
    sessionHint = `Новая сессия с профилем «${selectedProfile?.name ?? ''}»`
  }

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
                <TabsTrigger value="task">Задача</TabsTrigger>
                <TabsTrigger
                  value="invariants"
                  disabled
                  title="Day 14 — Инварианты и ограничения"
                >
                  Инварианты
                </TabsTrigger>
                <TabsTrigger value="settings">Настройки</TabsTrigger>
              </TabsList>

              <TabsContent value="dialog">
                <div className="flex flex-col gap-3">
                  <ExampleChips
                    examples={roleExamples}
                    disabled={busy}
                    onPick={actions.setDraft}
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

                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                    {TOKEN_SCENARIOS.map((scenario) => (
                      <Button
                        key={scenario.id}
                        variant="secondary"
                        size="sm"
                        onClick={() => actions.setDraft(scenario.text)}
                        disabled={busy}
                        title={scenario.hint}
                      >
                        {scenario.label}
                      </Button>
                    ))}
                  </div>

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
              </TabsContent>

              <TabsContent value="task">
                <div className="flex flex-col gap-3">
                  <p className="demo-muted m-0 text-sm">
                    Агент ведёт состояние задачи как конечный автомат: этап,
                    текущий шаг и ожидаемое действие. Задача фиксируется за
                    сессией — пауза и продолжение сохраняются.
                  </p>
                  <TaskStatePanel
                    state={taskState}
                    enabled={active.taskStateEnabled}
                    hasSession={sessionLocked}
                    busy={busy}
                    onPause={actions.pauseTask}
                    onResume={actions.resumeTask}
                    onCancel={actions.cancelTask}
                  />
                  {taskError && <Alert variant="destructive">{taskError}</Alert>}
                </div>
              </TabsContent>

              <TabsContent value="settings">
                <div className="flex flex-col gap-4">
                  <SessionConfig
                    locked={sessionLocked}
                    strategy={activeStrategy}
                    windowSize={activeWindowSize}
                    memory={activeMemory}
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
                          profileId={creatingProfile ? null : editingProfileId}
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
                            shortTermCount={messagesData.length}
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

type SessionConfigProps = {
  locked: boolean
  strategy: ContextStrategyId
  windowSize: number
  memory: boolean
  taskState: boolean
  activeTaskState: boolean
  profileName: string | null
  profiles: ProfileItem[]
  selectedProfileId: number | null
  busy: boolean
  onStrategy: (id: ContextStrategyId) => void
  onWindowSize: (size: number) => void
  onMemory: (value: boolean) => void
  onTaskState: (value: boolean) => void
  onProfile: (id: number | null) => void
}

function SessionConfig({
  locked,
  strategy,
  windowSize,
  memory,
  taskState,
  activeTaskState,
  profileName,
  profiles,
  selectedProfileId,
  busy,
  onStrategy,
  onWindowSize,
  onMemory,
  onTaskState,
  onProfile,
}: SessionConfigProps) {
  const list = profiles ?? []
  if (locked) {
    return (
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="island-kicker m-0 text-[10px]">Конфиг сессии</p>
        <p className="demo-muted m-0 mt-1 text-xs">
          Конфиг фиксируется при создании сессии. Чтобы изменить — начни новую
          сессию.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge>{strategyLabel(strategy)}</Badge>
          {strategy === 'window' && <Badge>окно {windowSize}</Badge>}
          <Badge>{memory ? 'память вкл.' : 'память выкл.'}</Badge>
          <Badge>{activeTaskState ? 'задача вкл.' : 'задача выкл.'}</Badge>
          <Badge>{profileName ?? 'профиль по умолчанию'}</Badge>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-[color-mix(in_oklab,var(--accent)_35%,var(--line))] bg-[var(--surface)] p-4">
      <p className="island-kicker m-0 text-[10px]">Конфиг новой сессии</p>
      <p className="demo-muted m-0 mt-1 text-xs">
        Выбери настройки — они зафиксируются при первом сообщении.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="demo-muted flex flex-col gap-1 text-[11px]">
          стратегия контекста
          <Select
            value={strategy}
            onValueChange={(value) => onStrategy(value as ContextStrategyId)}
            disabled={busy}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STRATEGY_CHOICES.map((choice) => (
                <SelectItem key={choice.id} value={choice.id}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="demo-muted flex flex-col gap-1 text-[11px]">
          профиль
          <Select
            value={
              selectedProfileId === null ? 'default' : String(selectedProfileId)
            }
            onValueChange={(value) =>
              onProfile(value === 'default' ? null : Number(value))
            }
            disabled={busy}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">По умолчанию</SelectItem>
              {list.map((profile) => (
                <SelectItem key={profile.id} value={String(profile.id)}>
                  {profile.name}
                  {profile.isDefault ? ' · по умолчанию' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        {strategy === 'window' && (
          <label className="demo-muted flex flex-col gap-1 text-[11px]">
            размер скользящего окна
            <Input
              type="number"
              min={WINDOW_SIZE_MIN}
              max={WINDOW_SIZE_MAX}
              value={windowSize}
              onChange={(event) =>
                onWindowSize(clampWindowSize(Number(event.target.value)))
              }
              disabled={busy}
              className="h-9"
            />
          </label>
        )}

        <label className="demo-muted flex items-center gap-2 self-end text-xs">
          <Checkbox
            checked={memory}
            onCheckedChange={(checked) => onMemory(checked === true)}
            disabled={busy}
          />
          слои памяти (рабочая и долговременная)
        </label>

        <label className="demo-muted flex items-center gap-2 self-end text-xs">
          <Checkbox
            checked={taskState}
            onCheckedChange={(checked) => onTaskState(checked === true)}
            disabled={busy}
          />
          состояние задачи (этап, шаг, ожидаемое действие)
        </label>
      </div>

      <p className="demo-muted m-0 mt-3 text-xs">
        {STRATEGY_CHOICES.find((choice) => choice.id === strategy)
          ?.description ?? ''}
      </p>
    </section>
  )
}

function lastUserMessage(messages: ThreadMessage[]): string | undefined {
  return [...messages]
    .reverse()
    .find((message) => message.role === 'user')?.content
}

function strategyLabel(id: ContextStrategyId): string {
  return CONTEXT_STRATEGIES[id]?.label ?? id
}
