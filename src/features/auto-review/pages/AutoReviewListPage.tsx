import { useNavigate } from '@tanstack/react-router'

import ProjectList from '../components/ProjectList'
import UploadForm from '../components/UploadForm'

export default function AutoReviewListPage() {
  const navigate = useNavigate()

  return (
    <div className="page-wrap flex flex-col gap-5 px-4 pb-10 pt-6">
      <header className="flex max-w-[70ch] flex-col gap-2">
        <p className="island-kicker m-0">
          Авторевью · проверка проектов на защите
        </p>
        <h1 className="demo-title m-0">Консоль проверяющего</h1>
        <p className="m-0 text-sm leading-relaxed text-[var(--ink-muted)]">
          Загрузите архив или папку с проектом «Шесть городов». Playwright
          прогоняет обязательные сценарии в Chromium и Firefox, статические
          правила и модель проверяют дополнительные критерии — отчёт показывает
          вердикт по каждому пункту с причиной.
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section className="flex flex-col gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-4 shadow-e2 xl:sticky xl:top-0">
          <h2 className="m-0 text-sm font-bold text-[var(--ink)]">
            Новый проект
          </h2>
          <p className="m-0 mb-2 text-xs leading-relaxed text-[var(--ink-muted)]">
            Архив распакуется локально; для папки зависимости установятся прямо
            в ней.
          </p>
          <UploadForm
            onStarted={({ projectKey }) =>
              void navigate({
                to: '/auto-review/$projectKey',
                params: { projectKey },
              })
            }
          />
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 text-sm font-bold text-[var(--ink)]">Проекты</h2>
            <span className="text-[11px] text-[var(--ink-muted)]">
              последняя проверка сверху
            </span>
          </div>
          <ProjectList />
        </section>
      </div>
    </div>
  )
}
