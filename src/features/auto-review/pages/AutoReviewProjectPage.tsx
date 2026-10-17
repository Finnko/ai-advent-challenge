import { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { RotateCw } from 'lucide-react'

import TaskStateBar from '@/components/TaskStateBar'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  useApproveReview,
  useCancelReview,
  useCleanupProject,
  useProjectView,
} from '../api/use-auto-review'
import CriteriaReport from '../components/CriteriaReport'
import HistoryList from '../components/HistoryList'
import ReviewTimeline from '../components/ReviewTimeline'
import RunConsole from '../components/RunConsole'
import SourcesCard from '../components/SourcesCard'
import UploadForm from '../components/UploadForm'
import VerdictPanel from '../components/VerdictPanel'
import ProjectPageSkeleton from '../components/ProjectPageSkeleton'
import { reviewStatusVariant } from '../components/status'
import { formatTimestamp } from '../domain/format'
import { REVIEW_STATUS_LABELS } from '../types'

function cleanupConfirmation(external: boolean, dropHistory: boolean): string {
  if (external) {
    return 'Проект на диске останется. Удалить запись проверки?'
  }
  if (dropHistory) {
    return 'Удалить исходники и всю историю проверок? Действие необратимо.'
  }
  return 'Удалить исходники проекта? История проверок останется.'
}

export default function AutoReviewProjectPage() {
  const { projectKey } = useParams({ from: '/_layout/auto-review/$projectKey' })
  const navigate = useNavigate()
  const view = useProjectView(projectKey)
  const approve = useApproveReview()
  const cancel = useCancelReview()
  const cleanup = useCleanupProject()
  const [rerunFrom, setRerunFrom] = useState<number | null>(null)
  const [dropHistory, setDropHistory] = useState(false)

  if (view.isLoading) {
    return <ProjectPageSkeleton />
  }
  if (view.isError || !view.data) {
    return (
      <div className="page-wrap flex flex-col gap-3 px-4 pb-10 pt-6">
        <Alert variant="destructive">Проект не найден.</Alert>
        <Button
          variant="secondary"
          className="w-fit"
          onClick={() => void view.refetch()}
        >
          Повторить
        </Button>
      </div>
    )
  }

  const { project, reviews } = view.data
  const latest = reviews[0] ?? null
  const history = reviews.slice(1)
  const busy = approve.isPending || cancel.isPending || cleanup.isPending
  const active = latest?.status === 'running' || latest?.status === 'planning'
  const canRerun = Boolean(latest) && !active

  const runCleanup = async () => {
    const external = project.sourcesPresent && !project.sourcesOwned
    const confirmed = window.confirm(cleanupConfirmation(external, dropHistory))
    if (!confirmed) {
      return
    }
    await cleanup.mutateAsync({ key: project.key, dropHistory })
    if (dropHistory) {
      void navigate({ to: '/auto-review' })
      return
    }
    void view.refetch()
  }

  return (
    <div className="page-wrap flex flex-col gap-4 px-4 pb-10 pt-6">
      <header className="flex flex-col gap-1.5">
        <p className="island-kicker m-0">Проверка проекта</p>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="demo-title m-0">{project.name}</h1>
          {latest && (
            <Badge variant={reviewStatusVariant(latest.status)}>
              {REVIEW_STATUS_LABELS[latest.status]}
            </Badge>
          )}
        </div>
        <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-[var(--ink-muted)]">
          <span>{project.key}</span>
          {latest && (
            <span>
              #{latest.id} · {formatTimestamp(latest.createdAt)}
            </span>
          )}
          <span>
            {project.sourcesPresent
              ? 'исходники загружены'
              : 'исходники очищены'}
          </span>
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {rerunFrom !== null && (
            <section className="flex flex-col gap-3 rounded-xl border border-[var(--accent)] bg-[var(--surface)] px-4 py-3 shadow-e2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="m-0 text-sm font-bold text-[var(--ink)]">
                    Повторная проверка по #{rerunFrom}
                  </h2>
                  <p className="m-0 mt-1 max-w-[65ch] text-xs leading-relaxed text-[var(--ink-muted)]">
                    Загрузите исправленный проект: проверятся только пункты, не
                    пройденные в #{rerunFrom}, остальные перенесутся из него.
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setRerunFrom(null)}
                >
                  Отмена
                </Button>
              </div>
              <UploadForm
                resumedFrom={rerunFrom}
                defaultKey={project.key}
                onStarted={({ projectKey: nextKey }) => {
                  setRerunFrom(null)
                  void view.refetch()
                  void navigate({
                    to: '/auto-review/$projectKey',
                    params: { projectKey: nextKey },
                  })
                }}
              />
            </section>
          )}

          {!latest && (
            <section className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-4 shadow-e2">
              <div>
                <h2 className="m-0 text-base font-bold text-[var(--ink)]">
                  Проверок ещё не было
                </h2>
                <p className="m-0 mt-1 text-xs text-[var(--ink-muted)]">
                  Загрузите архив, чтобы получить план проверки.
                </p>
              </div>
              <UploadForm
                defaultKey={project.key}
                onStarted={({ projectKey: nextKey }) => {
                  void view.refetch()
                  void navigate({
                    to: '/auto-review/$projectKey',
                    params: { projectKey: nextKey },
                  })
                }}
              />
            </section>
          )}

          {latest?.status === 'planning' && (
            <section className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-4 shadow-e2">
              <div>
                <p className="island-kicker m-0 text-[10px]">План проверки</p>
                <h2 className="m-0 mt-1 text-base font-bold text-[var(--ink)]">
                  Проверка #{latest.id}
                </h2>
                <p className="m-0 mt-1 text-xs text-[var(--ink-muted)]">
                  Проект получен. Утвердите план, чтобы запустить прогон.
                </p>
              </div>
              <TaskStateBar
                state={latest.state}
                enabled
                hasSession
                busy={busy}
                onPause={() => undefined}
                onResume={() => undefined}
                onCancel={() => void cancel.mutateAsync(latest.id)}
                onApprove={() => void approve.mutateAsync(latest.id)}
              />
            </section>
          )}

          {latest && latest.status !== 'planning' && (
            <>
              <VerdictPanel
                project={project}
                review={latest}
                actions={
                  <>
                    {latest.status === 'running' && (
                      <Button
                        size="xs"
                        variant="danger"
                        disabled={busy}
                        onClick={() => void cancel.mutateAsync(latest.id)}
                      >
                        Прервать проверку
                      </Button>
                    )}
                    {canRerun && (
                      <Button
                        size="xs"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => setRerunFrom(latest.id)}
                      >
                        <RotateCw className="h-3 w-3" strokeWidth={2} />
                        Повторная проверка
                      </Button>
                    )}
                  </>
                }
              />
              {latest.error && latest.status !== 'cancelled' && (
                <Alert variant="destructive">{latest.error}</Alert>
              )}
              {latest.results.length > 0 && (
                <CriteriaReport results={latest.results} />
              )}
            </>
          )}

          <section className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-4 shadow-e1">
            <h2 className="m-0 text-sm font-bold text-[var(--ink)]">
              Прошлые проверки
            </h2>
            {history.length > 0 ? (
              <HistoryList
                project={project}
                reviews={history}
                busy={busy}
                onRerun={(reviewId) => setRerunFrom(reviewId)}
              />
            ) : (
              <p className="m-0 text-xs text-[var(--ink-muted)]">
                Это первая проверка проекта — прошлых пока нет.
              </p>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-4 shadow-e1">
            <h2 className="m-0 text-sm font-bold text-[var(--ink)]">
              Исходники проекта
            </h2>
            <SourcesCard
              present={project.sourcesPresent}
              owned={project.sourcesOwned}
              busy={busy}
              dropHistory={dropHistory}
              onDropHistoryChange={setDropHistory}
              onCleanup={() => void runCleanup()}
            />
          </section>
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-0">
          <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-4 shadow-e1">
            <h2 className="m-0 mb-3 text-sm font-bold text-[var(--ink)]">
              Этапы
            </h2>
            <ReviewTimeline progress={latest?.progress ?? []} />
          </section>
          <RunConsole
            progress={latest?.progress ?? []}
            live={latest?.status === 'running'}
          />
        </aside>
      </div>
    </div>
  )
}
