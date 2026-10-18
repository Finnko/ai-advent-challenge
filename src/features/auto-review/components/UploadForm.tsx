import { useState } from 'react'
import { Upload, X } from 'lucide-react'

import { cn } from '@lib/utils'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useStartReview } from '../api/use-auto-review'
import { fileToBase64 } from '../domain/file-upload'
import { projectKeyFromSourceName } from '../domain/project-key'

type Props = {
  resumedFrom?: number | null
  defaultKey?: string
  onStarted: (input: { reviewId: number; projectKey: string }) => void
}

type SourceMode = 'zip' | 'path'

const MODES: { id: SourceMode; label: string }[] = [
  { id: 'zip', label: 'zip-архив' },
  { id: 'path', label: 'папка на диске' },
]

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} КБ`
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

export default function UploadForm({
  resumedFrom = null,
  defaultKey = '',
  onStarted,
}: Props) {
  const [key, setKey] = useState(defaultKey)
  const [autoKey, setAutoKey] = useState(defaultKey.trim().length === 0)
  const [mode, setMode] = useState<SourceMode>('zip')
  const [file, setFile] = useState<File | null>(null)
  const [sourcePath, setSourcePath] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const start = useStartReview()

  const applySourceKey = (source: string) => {
    if (!autoKey) {
      return
    }
    const next = projectKeyFromSourceName(source)
    if (next.length > 0) {
      setKey(next)
    }
  }

  const acceptFile = (next: File | null) => {
    if (!next) {
      setFile(null)
      return
    }
    if (!next.name.toLowerCase().endsWith('.zip')) {
      setError('Нужен zip-архив проекта.')
      return
    }
    setError(null)
    setFile(next)
    applySourceKey(next.name)
  }

  const submit = async () => {
    setError(null)
    if (key.trim().length === 0) {
      setError('Укажите ключ проекта (студент или e-mail).')
      return
    }
    const path = sourcePath.trim()
    if (mode === 'zip' && !file) {
      setError('Выберите zip-архив проекта.')
      return
    }
    if (mode === 'path' && path.length === 0) {
      setError('Укажите путь к уже распакованному проекту.')
      return
    }
    try {
      const zipBase64 = mode === 'zip' && file ? await fileToBase64(file) : ''
      const result = await start.mutateAsync({
        key: key.trim(),
        zipBase64,
        sourcePath: mode === 'path' ? path : null,
        resumedFrom,
      })
      onStarted({ reviewId: result.reviewId, projectKey: result.projectKey })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label
          className="text-xs font-medium text-[var(--ink-soft)]"
          htmlFor="auto-review-key"
        >
          Ключ проекта
        </label>
        <Input
          id="auto-review-key"
          value={key}
          placeholder="ivan-ivanov или ivan@example.com"
          onChange={(event) => {
            const value = event.target.value
            setKey(value)
            setAutoKey(value.trim().length === 0)
          }}
        />
        <span className="text-[11px] text-[var(--ink-muted)]">
          Заполняется из имени архива или папки, можно поправить.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[var(--ink-soft)]">
          Источник проекта
        </span>
        <div
          role="group"
          aria-label="Источник проекта"
          className="inline-flex w-fit rounded-lg border border-[var(--line)] bg-[var(--surface-tint)] p-0.5"
        >
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={mode === item.id}
              onClick={() => setMode(item.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                mode === item.id
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-e1'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink-soft)]',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'zip' ? (
        <div className="flex flex-col gap-2">
          <label
            htmlFor="auto-review-zip"
            onDragOver={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragActive(false)
              acceptFile(event.dataTransfer.files?.[0] ?? null)
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center transition-colors',
              'focus-within:ring-2 focus-within:ring-[var(--ring)]',
              dragActive
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                : 'border-[var(--line-strong)] bg-[var(--surface-tint)] hover:border-[var(--accent)]',
            )}
          >
            <Upload
              className="h-5 w-5 text-[var(--ink-muted)]"
              strokeWidth={1.75}
            />
            <span className="max-w-full break-words text-xs font-semibold text-[var(--ink)]">
              {file ? file.name : 'Перетащите zip-архив или выберите файл'}
            </span>
            <span className="text-[11px] text-[var(--ink-muted)]">
              {file
                ? `${formatSize(file.size)} · архив распакуется локально`
                : 'Архив распакуется локально, исходники останутся в сервисе'}
            </span>
            <input
              id="auto-review-zip"
              type="file"
              accept=".zip,application/zip"
              className="sr-only"
              onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
            />
          </label>
          {file && (
            <button
              type="button"
              className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--danger)]"
              onClick={() => setFile(null)}
            >
              <X className="h-3 w-3" />
              Убрать файл
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-medium text-[var(--ink-soft)]"
            htmlFor="auto-review-path"
          >
            Путь к распакованному проекту
          </label>
          <Input
            id="auto-review-path"
            value={sourcePath}
            placeholder="/Users/me/work/student-project"
            onChange={(event) => {
              const value = event.target.value
              setSourcePath(value)
              applySourceKey(value)
            }}
          />
          <span className="text-[11px] text-[var(--ink-muted)]">
            Папка с package.json; такую папку сервис не удаляет при очистке.
          </span>
        </div>
      )}

      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="flex flex-col gap-1.5">
        <Button type="submit" className="w-full" disabled={start.isPending}>
          {start.isPending ? 'Читаю проект…' : 'Разобрать проект'}
        </Button>
        <span className="text-center text-[11px] text-[var(--ink-muted)]">
          План проверки появится до запуска.
        </span>
      </div>
    </form>
  )
}
