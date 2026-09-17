import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentRunResult } from '../domain/agent'
import type { ContextStrategyId } from '../domain/context/types'
import type { MemoryLayer } from '../domain/memory/types'
import type { ProfileInput } from '../domain/profile/types'
import {
  CONTEXT_STRATEGIES,
  CONTEXT_STRATEGY_IDS,
} from '../domain/context/registry'
import { accountSession } from '../domain/accounting'
import { CONTEXT_BUDGET_TOKENS, MODEL_CONTEXT_TOKENS } from '../domain/tokens'
import { EXAMPLES, TOOL_INFO, TOKEN_SCENARIOS } from '../data/agent-ui'
import type { Example, PersonaKind, ToolInfo } from '../data/agent-ui'
import { useOrg } from '../api/get-org'
import { useSessions } from '../api/get-sessions'
import { useCapabilities } from '../api/get-capabilities'
import { useSessionMessages } from '../api/get-session-messages'
import { useSessionFacts } from '../api/get-facts'
import { useSessionBranches } from '../api/get-branches'
import { useMemory } from '../api/get-memory'
import { useProfiles } from '../api/get-profiles'
import { useSendMessage } from '../api/send-message'
import { useDeleteSession } from '../api/delete-session'
import { useCreateBranch } from '../api/create-branch'
import { useSwitchBranch } from '../api/switch-branch'
import { useSaveMemory } from '../api/save-memory'
import { useDeleteMemory } from '../api/delete-memory'
import { useCreateProfile } from '../api/create-profile'
import { useUpdateProfile } from '../api/update-profile'
import { useDeleteProfile } from '../api/delete-profile'
import { useSetDefaultProfile } from '../api/set-default-profile'
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

export const WINDOW_SIZE_MIN = 2
export const WINDOW_SIZE_MAX = 50
export const DEFAULT_WINDOW_SIZE = 10

const STRATEGY_CHOICES = CONTEXT_STRATEGY_IDS.map((id) => ({
  id,
  label: CONTEXT_STRATEGIES[id].label,
  description: CONTEXT_STRATEGIES[id].description,
}))

const EMPTY_MEMORY = { working: [], longTerm: [] }

export default function AgentPage() {
  const [activeToken, setActiveToken] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [strategy, setStrategy] = useState<ContextStrategyId>('window')
  const [windowSize, setWindowSize] = useState(DEFAULT_WINDOW_SIZE)
  const [memory, setMemory] = useState(true)
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null)
  const [editingProfileId, setEditingProfileId] = useState<number | null>(null)
  const [creatingProfile, setCreatingProfile] = useState(false)
  const autoPickRef = useRef(false)

  const orgQuery = useOrg()
  const people = orgQuery.data ?? []
  const manager = people.find((person) => person.role === 'manager') ?? null
  const employees = people.filter((person) => person.role === 'employee')
  const activePerson =
    people.find((person) => person.token === activeToken) ?? manager ?? null
  const kind: PersonaKind = activePerson?.role ?? 'employee'
  const roleExamples: Example[] = EXAMPLES.filter(
    (example) => example.kind === kind,
  )
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
  const factsQuery = useSessionFacts(sessionId)
  const branchesQuery = useSessionBranches(sessionId)
  const memoryQuery = useMemory(sessionId, activeToken)
  const profilesQuery = useProfiles(activeToken)
  const profiles = profilesQuery.data ?? []

  const sendMutation = useSendMessage()
  const deleteMutation = useDeleteSession()
  const branchMutation = useCreateBranch()
  const switchMutation = useSwitchBranch()
  const saveMemoryMutation = useSaveMemory()
  const deleteMemoryMutation = useDeleteMemory()
  const createProfileMutation = useCreateProfile()
  const updateProfileMutation = useUpdateProfile()
  const deleteProfileMutation = useDeleteProfile()
  const setDefaultMutation = useSetDefaultProfile()

  const messages: ThreadMessage[] = (messagesQuery.data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    ...(row.run ? { run: row.run as AgentRunResult } : {}),
  }))

  const sessionSummary = (sessionsQuery.data ?? []).find(
    (session) => session.id === sessionId,
  )
  const facts = factsQuery.data ?? []
  const branches = branchesQuery.data ?? []
  const memoryView = memoryQuery.data ?? EMPTY_MEMORY
  const selectedProfile =
    profiles.find((profile) => profile.id === selectedProfileId) ?? null
  const defaultProfile = profiles.find((profile) => profile.isDefault) ?? null

  const busy =
    sendMutation.isPending ||
    deleteMutation.isPending ||
    branchMutation.isPending ||
    switchMutation.isPending ||
    saveMemoryMutation.isPending ||
    deleteMemoryMutation.isPending ||
    createProfileMutation.isPending ||
    updateProfileMutation.isPending ||
    deleteProfileMutation.isPending ||
    setDefaultMutation.isPending ||
    capabilitiesQuery.isLoading

  const activeStrategy: ContextStrategyId = sessionSummary?.strategy ?? strategy
  const activeWindowSize = sessionSummary?.windowSize ?? windowSize
  const activeMemory = sessionSummary?.memoryEnabled ?? memory
  const activeProfileName = sessionSummary
    ? (sessionSummary.profileName ?? null)
    : (selectedProfile?.name ?? defaultProfile?.name ?? null)

  const lastRun: AgentRunResult | null =
    [...messages].reverse().find((message) => message.run)?.run ?? null
  const noteState = lastRun?.contextNote ?? null
  const accounting = accountSession(messages, draft)

  const openSession = (id: number) => {
    if (busy || id === sessionId) {
      return
    }
    sendMutation.reset()
    setSessionId(id)
    setDraft('')
    setEditingProfileId(null)
    setCreatingProfile(false)
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
    setActiveToken(token)
    setSessionId(null)
    setDraft('')
    setSelectedProfileId(null)
    setEditingProfileId(null)
    setCreatingProfile(false)
    autoPickRef.current = true
  }

  const handleNewSession = () => {
    if (busy) {
      return
    }
    sendMutation.reset()
    setSessionId(null)
    setDraft('')
    setEditingProfileId(null)
    setCreatingProfile(false)
  }

  const handleDeleteSession = (id: number) => {
    if (busy) {
      return
    }
    deleteMutation.mutate(
      { token: activeToken ?? '', sessionId: id },
      {
        onSuccess: () => {
          if (id === sessionId) {
            setSessionId(null)
          }
        },
      },
    )
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
        strategy,
        windowSize,
        memory,
        profileId:
          sessionId === null ? (selectedProfileId ?? undefined) : undefined,
      },
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

  const handleSaveMemory = (input: {
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
      scenario: sessionSummary?.scenario ?? null,
    })
  }

  const handleForgetMemory = (scope: MemoryLayer, key: string) => {
    if (!activeToken || sessionId === null) {
      return
    }
    deleteMemoryMutation.mutate({ scope, key, token: activeToken, sessionId })
  }

  const handleSelectProfile = (id: number) => {
    setCreatingProfile(false)
    setEditingProfileId(id)
    setSelectedProfileId(id)
  }

  const handleCreateProfile = () => {
    setCreatingProfile(true)
    setEditingProfileId(null)
  }

  const handleSaveProfile = (input: ProfileInput) => {
    if (!activeToken) {
      return
    }
    if (creatingProfile) {
      createProfileMutation.mutate(
        { token: activeToken, ...input, isDefault: profiles.length === 0 },
        {
          onSuccess: (profile) => {
            setCreatingProfile(false)
            setEditingProfileId(profile.id)
            setSelectedProfileId(profile.id)
          },
        },
      )
      return
    }
    if (editingProfileId === null) {
      return
    }
    updateProfileMutation.mutate({
      token: activeToken,
      profileId: editingProfileId,
      ...input,
    })
  }

  const handleDeleteProfile = (id: number) => {
    if (busy) {
      return
    }
    deleteProfileMutation.mutate(
      { token: activeToken ?? '', profileId: id },
      {
        onSuccess: () => {
          if (editingProfileId === id) {
            setEditingProfileId(null)
          }
          if (selectedProfileId === id) {
            setSelectedProfileId(null)
          }
        },
      },
    )
  }

  const sendError = sendMutation.isError ? toError(sendMutation.error) : null
  const branchError = branchMutation.isError
    ? toError(branchMutation.error)
    : null
  const orgError = orgQuery.isError ? toError(orgQuery.error) : null
  let settingsError: string | null = null
  if (saveMemoryMutation.isError) {
    settingsError = toError(saveMemoryMutation.error)
  } else if (deleteMemoryMutation.isError) {
    settingsError = toError(deleteMemoryMutation.error)
  } else if (createProfileMutation.isError) {
    settingsError = toError(createProfileMutation.error)
  } else if (updateProfileMutation.isError) {
    settingsError = toError(updateProfileMutation.error)
  } else if (deleteProfileMutation.isError) {
    settingsError = toError(deleteProfileMutation.error)
  } else if (setDefaultMutation.isError) {
    settingsError = toError(setDefaultMutation.error)
  }

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
  if (capabilitiesQuery.data) {
    capsPanel = { status: 'ready', caps: capabilitiesQuery.data }
  } else if (capabilitiesQuery.isError) {
    capsPanel = { status: 'error', message: toError(capabilitiesQuery.error) }
  }

  const sessionLocked = sessionId !== null
  const showProfileEditor = creatingProfile || editingProfileId !== null

  let sessionHint: string
  if (sessionLocked) {
    sessionHint = 'Конфиг зафиксирован за сессией'
  } else if (selectedProfileId === null) {
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
          краткосрочная память), слои памяти, профиль пользователя. Настрой конфиг
          во вкладке «Настройки», создай сессию и работай во вкладке «Диалог».
          Задача и инварианты — точки расширения для следующих дней.
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
                Работа · {activePerson.name}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{strategyLabel(activeStrategy)}</Badge>
                {activeStrategy === 'window' && (
                  <Badge>окно {activeWindowSize}</Badge>
                )}
                <Badge>{activeMemory ? 'память вкл.' : 'память выкл.'}</Badge>
                {activeProfileName && <Badge>{activeProfileName}</Badge>}
                <span className="demo-muted text-xs">
                  {sessionId ? `сессия #${sessionId}` : 'новая сессия'}
                </span>
              </div>
            </div>

            <Tabs defaultValue="dialog">
              <TabsList>
                <TabsTrigger value="dialog">Диалог</TabsTrigger>
                <TabsTrigger value="task" disabled title="Day 13 — Task state machine">
                  Задача
                </TabsTrigger>
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
                        onClick={() => setDraft(scenario.text)}
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
                      onSwitch={handleSwitchBranch}
                      onForkCheckpoint={handleForkCheckpoint}
                    />
                  )}

                  <ChatThread
                    messages={messages}
                    running={sendMutation.isPending}
                    onFork={activeStrategy === 'branch' ? handleFork : undefined}
                    forkDisabled={busy}
                  />

                  {sendError && <Alert variant="destructive">{sendError}</Alert>}
                  {branchError && (
                    <Alert variant="destructive">{branchError}</Alert>
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

              <TabsContent value="settings">
                <div className="flex flex-col gap-4">
                  <SessionConfig
                    locked={sessionLocked}
                    strategy={activeStrategy}
                    windowSize={activeWindowSize}
                    memory={activeMemory}
                    profileName={activeProfileName}
                    profiles={profiles}
                    selectedProfileId={selectedProfileId}
                    busy={busy}
                    onStrategy={setStrategy}
                    onWindowSize={setWindowSize}
                    onMemory={setMemory}
                    onProfile={(id) => setSelectedProfileId(id)}
                  />

                  <div className="flex items-stretch gap-4">
                    <aside className="w-[300px] shrink-0">
                      <ProfileList
                        profiles={profiles}
                        activeId={editingProfileId}
                        disabled={busy}
                        onSelect={handleSelectProfile}
                        onCreate={handleCreateProfile}
                        onDelete={handleDeleteProfile}
                        onSetDefault={(id) =>
                          setDefaultMutation.mutate({
                            token: activeToken ?? '',
                            profileId: id,
                          })
                        }
                      />
                    </aside>
                    <div className="min-w-0 flex-1">
                      {showProfileEditor ? (
                        <ProfileEditor
                          profileId={creatingProfile ? null : editingProfileId}
                          initial={editorInitial}
                          disabled={busy}
                          onSave={handleSaveProfile}
                          onCancel={() => {
                            setCreatingProfile(false)
                            setEditingProfileId(null)
                          }}
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
                            shortTermCount={messagesQuery.data?.length ?? 0}
                            disabled={busy}
                            onForget={handleForgetMemory}
                          />
                        </div>
                        <div className="w-[360px] shrink-0">
                          <MemoryPanel
                            disabled={busy}
                            lastUserMessage={lastUserMessage(messages)}
                            onSave={handleSaveMemory}
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
  profileName: string | null
  profiles: ReturnType<typeof useProfiles>['data']
  selectedProfileId: number | null
  busy: boolean
  onStrategy: (id: ContextStrategyId) => void
  onWindowSize: (size: number) => void
  onMemory: (value: boolean) => void
  onProfile: (id: number | null) => void
}

function SessionConfig({
  locked,
  strategy,
  windowSize,
  memory,
  profileName,
  profiles,
  selectedProfileId,
  busy,
  onStrategy,
  onWindowSize,
  onMemory,
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

function clampWindowSize(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_WINDOW_SIZE
  }
  return Math.min(WINDOW_SIZE_MAX, Math.max(WINDOW_SIZE_MIN, Math.round(value)))
}

function strategyLabel(id: ContextStrategyId): string {
  return CONTEXT_STRATEGIES[id]?.label ?? id
}

function toError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
