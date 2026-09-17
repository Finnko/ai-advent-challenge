import { useEffect, useMemo, useState } from 'react'
import type { AgentRunResult } from '../domain/agent'
import type { ProfileInput } from '../domain/profile/types'
import { accountSession } from '../domain/accounting'
import {
  DEFAULT_PROFILE_SCENARIO,
  PROFILE_SCRIPT,
  PROFILE_PAGE_HINT,
  PROFILE_STRATEGY,
} from '../data/day12'
import { useOrg } from '../api/get-org'
import { useSessions } from '../api/get-sessions'
import { useSessionMessages } from '../api/get-session-messages'
import { useProfiles } from '../api/get-profiles'
import { useCreateProfile } from '../api/create-profile'
import { useUpdateProfile } from '../api/update-profile'
import { useDeleteProfile } from '../api/delete-profile'
import { useSetDefaultProfile } from '../api/set-default-profile'
import { useCompareProfiles } from '../api/compare-profiles'
import { useSendMessage } from '../api/send-message'
import { useDeleteSession } from '../api/delete-session'
import PersonaPicker from '../components/PersonaPicker'
import ChatThread from '../components/ChatThread'
import type { ThreadMessage } from '../components/ChatThread'
import SessionList from '../components/SessionList'
import TokenReport from '../components/TokenReport'
import ScenarioChips from '../components/ScenarioChips'
import ProfileList from '../components/ProfileList'
import ProfileEditor from '../components/ProfileEditor'
import ProfileCompare from '../components/ProfileCompare'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'

export default function AgentProfilePage() {
  const [activeToken, setActiveToken] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)

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
  const profilesQuery = useProfiles(activeToken)
  const profiles = profilesQuery.data ?? []

  const sendMutation = useSendMessage()
  const deleteSessionMutation = useDeleteSession()
  const createProfileMutation = useCreateProfile()
  const updateProfileMutation = useUpdateProfile()
  const deleteProfileMutation = useDeleteProfile()
  const setDefaultMutation = useSetDefaultProfile()
  const compareMutation = useCompareProfiles()

  const messages: ThreadMessage[] = (messagesQuery.data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    ...(row.run ? { run: row.run as AgentRunResult } : {}),
  }))
  const sessionSummary = (sessionsQuery.data ?? []).find(
    (session) => session.id === sessionId,
  )
  const selectedProfile =
    profiles.find((profile) => profile.id === selectedProfileId) ?? null
  const defaultProfile = profiles.find((profile) => profile.isDefault) ?? null
  const activeProfileName = sessionId
    ? sessionSummary?.profileName ?? null
    : (selectedProfile?.name ?? defaultProfile?.name ?? null)

  const scriptIndex = messages.filter((message) => message.role === 'user').length

  const busy =
    sendMutation.isPending ||
    deleteSessionMutation.isPending ||
    createProfileMutation.isPending ||
    updateProfileMutation.isPending ||
    deleteProfileMutation.isPending ||
    setDefaultMutation.isPending ||
    compareMutation.isPending

  const lastRun: AgentRunResult | null =
    [...messages].reverse().find((message) => message.run)?.run ?? null
  const accounting = accountSession(messages, draft)

  const handlePickPerson = (token: string) => {
    if (token === activeToken || busy) {
      return
    }
    sendMutation.reset()
    compareMutation.reset()
    setActiveToken(token)
    setSessionId(null)
    setDraft('')
    setSelectedProfileId(null)
    setCreating(false)
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
    const session = (sessionsQuery.data ?? []).find((item) => item.id === id)
    setSelectedProfileId(session?.profileId ?? null)
    setCreating(false)
  }

  const handleDeleteSession = (id: number) => {
    if (busy) {
      return
    }
    deleteSessionMutation.mutate(
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
        strategy: PROFILE_STRATEGY,
        scenario: DEFAULT_PROFILE_SCENARIO,
        memory: true,
        profileId: sessionId === null ? (selectedProfileId ?? undefined) : undefined,
      },
      { onSuccess: (result) => setSessionId(result.sessionId) },
    )
  }

  const handleSelectProfile = (id: number) => {
    setCreating(false)
    setSelectedProfileId(id)
  }

  const handleCreateNew = () => {
    setCreating(true)
    setSelectedProfileId(null)
  }

  const handleSaveProfile = (input: ProfileInput) => {
    if (!activeToken) {
      return
    }
    if (creating) {
      createProfileMutation.mutate(
        { token: activeToken, ...input, isDefault: profiles.length === 0 },
        {
          onSuccess: (profile) => {
            setCreating(false)
            setSelectedProfileId(profile.id)
          },
        },
      )
      return
    }
    if (selectedProfileId === null) {
      return
    }
    updateProfileMutation.mutate({
      token: activeToken,
      profileId: selectedProfileId,
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
          if (selectedProfileId === id) {
            setSelectedProfileId(null)
          }
        },
      },
    )
  }

  const sendError = sendMutation.isError ? toError(sendMutation.error) : null
  const compareError = compareMutation.isError
    ? toError(compareMutation.error)
    : null
  let profilesError: string | null = null
  if (createProfileMutation.isError) {
    profilesError = toError(createProfileMutation.error)
  } else if (updateProfileMutation.isError) {
    profilesError = toError(updateProfileMutation.error)
  } else if (deleteProfileMutation.isError) {
    profilesError = toError(deleteProfileMutation.error)
  } else if (setDefaultMutation.isError) {
    profilesError = toError(setDefaultMutation.error)
  }
  const orgError = orgQuery.isError ? toError(orgQuery.error) : null

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

  const showEditor = creating || selectedProfileId !== null

  let sessionHint: string
  if (sessionId !== null) {
    sessionHint = 'Профиль зафиксирован за сессией'
  } else if (selectedProfileId === null) {
    sessionHint = 'Будет применён профиль по умолчанию'
  } else {
    sessionHint = `Новая сессия с профилем «${selectedProfile?.name ?? ''}»`
  }

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pb-6 pt-6">
      <header className="mb-1">
        <p className="island-kicker mb-2">Day 12 · Personalization</p>
        <h1 className="demo-title mb-2">Профиль пользователя</h1>
        <p className="demo-muted m-0 max-w-4xl text-sm">{PROFILE_PAGE_HINT}</p>
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
              <div className="flex items-center gap-2">
                {activeProfileName && <Badge>{activeProfileName}</Badge>}
                <span className="demo-muted text-xs">
                  {sessionId ? `сессия #${sessionId}` : 'новая сессия'}
                </span>
              </div>
            </div>

            <ScenarioChips
              messages={PROFILE_SCRIPT}
              index={scriptIndex}
              disabled={busy}
              onPick={setDraft}
            />

            <TokenReport
              requestTokens={accounting.requestTokens}
              historyTokens={accounting.historyTokens}
              historyTokensSent={lastRun ? lastRun.tokens.historyTokensSent : null}
              responseTokens={lastRun ? lastRun.tokens.responseTokens : null}
              contextTokens={lastRun ? lastRun.tokens.contextTokens : null}
            />

            <ChatThread messages={messages} running={sendMutation.isPending} />

            {sendError && <Alert variant="destructive">{sendError}</Alert>}

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
                placeholder="Сообщение или запрос из сценария…"
                className="min-h-0"
                rows={4}
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
          </section>
        </div>
      )}

      {activePerson && (
        <div className="flex items-stretch gap-4">
          <aside className="demo-panel w-[300px] shrink-0 p-3">
            <ProfileList
              profiles={profiles}
              activeId={selectedProfileId}
              disabled={busy}
              onSelect={handleSelectProfile}
              onCreate={handleCreateNew}
              onDelete={handleDeleteProfile}
              onSetDefault={(id) =>
                setDefaultMutation.mutate({
                  token: activeToken ?? '',
                  profileId: id,
                })
              }
            />
          </aside>

          <section className="min-w-0 flex-1">
            {showEditor ? (
              <ProfileEditor
                profileId={creating ? null : selectedProfileId}
                initial={editorInitial}
                disabled={busy}
                onSave={handleSaveProfile}
                onCancel={() => {
                  setCreating(false)
                  setSelectedProfileId(null)
                }}
              />
            ) : (
              <section className="flex h-full items-center justify-center rounded-xl border border-dashed border-[var(--line)] p-6">
                <p className="demo-muted m-0 text-xs">
                  Выбери профиль слева или создай новый.
                </p>
              </section>
            )}
            {profilesError && (
              <Alert variant="destructive" className="mt-3">
                {profilesError}
              </Alert>
            )}
          </section>
        </div>
      )}

      {activePerson && (
        <ProfileCompare
          profiles={profiles}
          disabled={busy}
          running={compareMutation.isPending}
          result={compareMutation.data ?? null}
          error={compareError}
          onCompare={(profileIds, user) => {
            if (!activeToken) {
              return
            }
            compareMutation.mutate({ token: activeToken, profileIds, user })
          }}
        />
      )}
    </div>
  )
}

function toError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
