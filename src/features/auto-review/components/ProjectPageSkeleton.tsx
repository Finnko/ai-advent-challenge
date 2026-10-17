import Skeleton from './Skeleton'

export default function ProjectPageSkeleton() {
  return (
    <div
      className="page-wrap flex flex-col gap-4 px-4 pb-10 pt-6"
      aria-busy="true"
    >
      <span className="sr-only">Загружаю проверки…</span>
      <Skeleton className="h-3 w-36" />
      <Skeleton className="h-8 w-72" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
