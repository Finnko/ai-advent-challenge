import { Link } from '@tanstack/react-router'
import { ChevronRight, Inbox } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useProjects } from '../api/use-auto-review'
import { formatTimestamp } from '../domain/format'
import { REVIEW_STATUS_LABELS } from '../types'
import ProjectRowsSkeleton from './ProjectRowsSkeleton'
import VerdictBar from './VerdictBar'
import { reviewStatusVariant } from './status'

export default function ProjectList() {
  const projects = useProjects()

  if (projects.isLoading) {
    return <ProjectRowsSkeleton />
  }
  if (projects.isError) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-xl border border-[color-mix(in_oklab,var(--danger)_34%,var(--line))] bg-[color-mix(in_oklab,var(--danger)_8%,var(--surface))] px-4 py-3">
        <p className="m-0 text-sm font-semibold text-[var(--ink)]">
          Не удалось загрузить проекты
        </p>
        <p className="m-0 text-xs text-[var(--ink-muted)]">
          Проверьте, что сервис отвечает, и попробуйте снова.
        </p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void projects.refetch()}
        >
          Повторить
        </Button>
      </div>
    )
  }
  if (!projects.data || projects.data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--line-strong)] px-4 py-10 text-center">
        <Inbox className="h-6 w-6 text-[var(--ink-muted)]" strokeWidth={1.5} />
        <p className="m-0 text-sm font-semibold text-[var(--ink)]">
          Пока нет ни одного проекта
        </p>
        <p className="m-0 max-w-[40ch] text-xs text-[var(--ink-muted)]">
          Загрузите zip-архив студенческого проекта в форме слева, чтобы начать
          проверку.
        </p>
      </div>
    )
  }

  return (
    <ul className="m-0 list-none divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-0">
      {projects.data.map((project) => {
        const last = project.lastReview
        const total = last ? last.passed + last.failed + last.notChecked : 0
        const counts = {
          passed: last?.passed ?? 0,
          failed: last?.failed ?? 0,
          notChecked: last?.notChecked ?? 0,
          total,
        }
        return (
          <li key={project.id}>
            <Link
              to="/auto-review/$projectKey"
              params={{ projectKey: project.key }}
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 no-underline transition-colors hover:bg-[var(--surface-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-[var(--ink)]">
                    {project.name}
                  </span>
                  {last && (
                    <Badge variant={reviewStatusVariant(last.status)}>
                      {REVIEW_STATUS_LABELS[last.status]}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--ink-muted)]">
                  <span className="truncate font-mono">{project.key}</span>
                  {last && (
                    <span className="shrink-0">
                      {formatTimestamp(last.createdAt)}
                    </span>
                  )}
                </div>
                {last ? (
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <VerdictBar counts={counts} className="h-1.5 w-32" />
                    <span className="text-[11px] tabular-nums text-[var(--ink-muted)]">
                      {last.passed} из {total}
                    </span>
                    {last.failed > 0 && (
                      <span className="text-[11px] text-[var(--danger)]">
                        не пройдено {last.failed}
                      </span>
                    )}
                    {last.notChecked > 0 && (
                      <span className="text-[11px] text-[var(--warn)]">
                        не проверено {last.notChecked}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] text-[var(--ink-muted)]">
                    проверок ещё нет
                  </span>
                )}
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-transform group-hover:translate-x-0.5"
                strokeWidth={1.75}
              />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
