import { useEffect, useState } from 'react'
import type { ProfileField, ProfileInput } from '../domain/profile/types'
import {
  PROFILE_CONSTRAINTS_MAX,
  PROFILE_FIELD_MAX,
  PROFILE_INSTRUCTIONS_MAX,
  PROFILE_NAME_MAX,
  PROFILE_FIELD_LABELS,
} from '../domain/profile/types'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'

type ProfileEditorProps = {
  profileId: number | null
  initial: ProfileInput | null
  disabled?: boolean
  onSave: (input: ProfileInput) => void
  onCancel: () => void
}

const EMPTY_FORM = {
  name: '',
  addressing: '',
  tone: '',
  language: '',
  verbosity: '',
  format: '',
  constraints: '',
  instructions: '',
}

type FormState = typeof EMPTY_FORM

const SHORT_FIELDS: ProfileField[] = [
  'addressing',
  'tone',
  'language',
  'verbosity',
  'format',
]

export default function ProfileEditor({
  profileId,
  initial,
  disabled,
  onSave,
  onCancel,
}: ProfileEditorProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  useEffect(() => {
    setForm({
      name: initial?.name ?? '',
      addressing: initial?.addressing ?? '',
      tone: initial?.tone ?? '',
      language: initial?.language ?? '',
      verbosity: initial?.verbosity ?? '',
      format: initial?.format ?? '',
      constraints: initial?.constraints ?? '',
      instructions: initial?.instructions ?? '',
    })
  }, [profileId, initial])

  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const submit = () => {
    if (form.name.trim().length === 0) {
      return
    }
    onSave({
      name: form.name.trim(),
      addressing: form.addressing.trim() || null,
      tone: form.tone.trim() || null,
      language: form.language.trim() || null,
      verbosity: form.verbosity.trim() || null,
      format: form.format.trim() || null,
      constraints: form.constraints.trim() || null,
      instructions: form.instructions.trim() || null,
    })
  }

  return (
    <section className="rounded-xl border border-[color-mix(in_oklab,var(--accent)_35%,var(--line))] bg-[var(--surface)] p-3">
      <p className="island-kicker m-0 text-[10px]">
        {profileId === null ? 'Новый профиль' : 'Настройки профиля'}
      </p>
      <p className="demo-muted m-0 mt-1 text-xs">
        Стиль, формат и ограничения применяются к каждому запросу. Свободные
        инструкции можно использовать для режимов работы.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <label className="demo-muted flex flex-col gap-1 text-[11px]">
          название
          <Input
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            disabled={disabled}
            maxLength={PROFILE_NAME_MAX}
            placeholder="напр. Формальный"
            className="h-8 py-1 text-xs"
          />
        </label>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SHORT_FIELDS.map((field) => (
            <label
              key={field}
              className="demo-muted flex flex-col gap-1 text-[11px]"
            >
              {PROFILE_FIELD_LABELS[field]}
              <Input
                value={form[field]}
                onChange={(event) => set(field, event.target.value)}
                disabled={disabled}
                maxLength={PROFILE_FIELD_MAX}
                className="h-8 py-1 text-xs"
              />
            </label>
          ))}
        </div>

        <label className="demo-muted flex flex-col gap-1 text-[11px]">
          {PROFILE_FIELD_LABELS.constraints}
          <Textarea
            value={form.constraints}
            onChange={(event) => set('constraints', event.target.value)}
            disabled={disabled}
            rows={2}
            maxLength={PROFILE_CONSTRAINTS_MAX}
            className="min-h-0 py-1 text-xs"
            placeholder="чего не делать, запреты, ограничения"
          />
        </label>

        <label className="demo-muted flex flex-col gap-1 text-[11px]">
          {PROFILE_FIELD_LABELS.instructions}
          <Textarea
            value={form.instructions}
            onChange={(event) => set('instructions', event.target.value)}
            disabled={disabled}
            rows={3}
            maxLength={PROFILE_INSTRUCTIONS_MAX}
            className="min-h-0 py-1 text-xs"
            placeholder="напр. на запрос «напиши фичу» сначала уточни требования, затем предложи план"
          />
        </label>

        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={disabled}>
            Отмена
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={disabled || form.name.trim().length === 0}
          >
            {profileId === null ? 'Создать профиль' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </section>
  )
}
