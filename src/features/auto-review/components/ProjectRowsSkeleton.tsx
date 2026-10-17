import Skeleton from './Skeleton'

export default function ProjectRowsSkeleton() {
  return (
    <div
      className="divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]"
      aria-busy="true"
    >
      <span className="sr-only">Загружаю проекты…</span>
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-2.5 w-28" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-1.5 w-32" />
            <Skeleton className="h-2.5 w-10" />
          </div>
        </div>
      ))}
    </div>
  )
}
