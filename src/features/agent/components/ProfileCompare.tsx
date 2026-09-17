import { useEffect, useState } from 'react'
import type { ProfileComparison } from '../types'
import type { ProfileItem } from '../types'
import { formatUsd } from '../domain/tokens'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Alert } from '@/components/ui/Alert'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select'

type ProfileCompareProps = {
  profiles: ProfileItem[]
  disabled?: boolean
  running: boolean
  result: ProfileComparison | null
  error: string | null
  onCompare: (profileIds: number[], user: string) => void
}

export default function ProfileCompare({
  profiles,
  disabled,
  running,
  result,
  error,
  onCompare,
}: ProfileCompareProps) {
  const [leftId, setLeftId] = useState<number | null>(null)
  const [rightId, setRightId] = useState<number | null>(null)
  const [text, setText] = useState('')

  useEffect(() => {
    if (profiles.length < 2) {
      return
    }
    setLeftId((current) =>
      current && profiles.some((p) => p.id === current)
        ? current
        : profiles[0].id,
    )
    setRightId((current) =>
      current && profiles.some((p) => p.id === current)
        ? current
        : profiles[1].id,
    )
  }, [profiles])

  const canCompare =
    leftId !== null &&
    rightId !== null &&
    leftId !== rightId &&
    text.trim().length > 0

  return (
    <section className="demo-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="demo-section-title m-0">Ответы для разных профилей</h2>
          <p className="demo-muted m-0 text-xs">
            Один запрос прогоняется под двумя профилями; ничего не сохраняется.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            leftId !== null &&
            rightId !== null &&
            onCompare([leftId, rightId], text.trim())
          }
          disabled={!canCompare || running || disabled}
        >
          {running ? 'Сравниваю…' : 'Сравнить'}
        </Button>
      </div>

      {profiles.length < 2 && (
        <p className="demo-muted m-0 mt-2 text-xs">
          Нужны минимум два профиля, чтобы сравнить.
        </p>
      )}

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <ProfileSelect
          label="Профиль A"
          profiles={profiles}
          value={leftId}
          disabled={disabled || running}
          onChange={setLeftId}
        />
        <ProfileSelect
          label="Профиль B"
          profiles={profiles}
          value={rightId}
          disabled={disabled || running}
          onChange={setRightId}
        />
      </div>

      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={disabled || running}
        rows={3}
        className="mt-3 min-h-0 text-xs"
        placeholder="Один и тот же запрос для обоих профилей…"
      />

      {error && (
        <Alert variant="destructive" className="m-0 mt-2 text-xs">
          {error}
        </Alert>
      )}

      {result && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {result.results.map((entry) => (
            <div
              key={entry.profileId}
              className="rounded-xl border border-[var(--line)] p-3"
            >
              <p className="m-0 text-xs font-bold text-[var(--ink)]">
                {entry.profileName}
              </p>
              <p className="demo-muted m-0 mt-0.5 text-[10px]">
                prompt {entry.run.tokens.promptTokensActual} · ответ{' '}
                {entry.run.tokens.responseTokens} · ~
                {formatUsd(entry.run.tokens.costUsd)}
              </p>
              <p className="m-0 mt-2 whitespace-pre-wrap border-t border-[var(--line)] pt-2 text-[11px] text-[var(--ink-soft)]">
                {entry.run.answer}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ProfileSelect({
  label,
  profiles,
  value,
  disabled,
  onChange,
}: {
  label: string
  profiles: ProfileItem[]
  value: number | null
  disabled?: boolean
  onChange: (id: number) => void
}) {
  return (
    <label className="demo-muted flex flex-col gap-1 text-[11px]">
      {label}
      <Select
        value={value === null ? '' : String(value)}
        onValueChange={(next) => onChange(Number(next))}
        disabled={disabled || profiles.length === 0}
      >
        <SelectTrigger className="h-8 py-1 text-xs">
          <SelectValue placeholder="выбери профиль" />
        </SelectTrigger>
        <SelectContent>
          {profiles.map((profile) => (
            <SelectItem key={profile.id} value={String(profile.id)}>
              {profile.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}
