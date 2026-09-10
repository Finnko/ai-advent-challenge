import type { SessionSummary } from '../../lib/chat'

type SessionListProps = {
  sessions: SessionSummary[]
  activeId: number | null
  disabled?: boolean
  onOpen: (id: number) => void
  onDelete: (id: number) => void
  onNew: () => void
}

export default function SessionList({
  sessions,
  activeId,
  disabled,
  onOpen,
  onDelete,
  onNew,
}: SessionListProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <button
        type="button"
        onClick={onNew}
        disabled={disabled}
        className="demo-button justify-center"
      >
        + Новая сессия
      </button>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {sessions.length === 0 && (
          <p className="demo-muted m-0 px-1 py-4 text-center text-xs">
            Пока пусто. Начни новую сессию.
          </p>
        )}
        {sessions.map((session) => {
          const active = session.id === activeId
          return (
            <div
              key={session.id}
              className={`group rounded-xl border px-3 py-2 text-left transition-colors ${
                active
                  ? 'border-[color-mix(in_oklab,var(--accent)_60%,var(--line))] bg-[color-mix(in_oklab,var(--accent)_12%,var(--surface-strong))]'
                  : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]'
              }`}
            >
              <button
                type="button"
                onClick={() => onOpen(session.id)}
                disabled={disabled || active}
                className="block w-full text-left"
              >
                <span className="block truncate text-sm font-semibold text-[var(--ink)]">
                  {session.title}
                </span>
                <span className="demo-muted mt-0.5 block text-[11px]">
                  {session.messageCount > 0
                    ? `${session.messageCount} сообщ. · `
                    : ''}
                  {formatDate(session.createdAt)}
                </span>
                {session.lastMessage && (
                  <span className="demo-muted mt-0.5 block truncate text-[11px] opacity-80">
                    {session.lastMessage}
                  </span>
                )}
              </button>
              <div className="mt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => onDelete(session.id)}
                  disabled={disabled}
                  className="demo-button demo-button-danger px-2 py-0.5 !text-[10px]"
                  title="Удалить сессию"
                >
                  Удалить
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
