import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header className="shrink-0 border-b border-line bg-[var(--header-bg)] backdrop-blur-md backdrop-saturate-150">
      <div className="page-wrap flex h-14 items-center gap-3 px-4">
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-[13px] font-extrabold text-white shadow-e1"
        >
          AI
        </span>
        <div className="min-w-0">
          <h1 className="m-0 text-sm font-bold leading-none tracking-tight text-ink">
            AI Advent Challenge
          </h1>
          <p className="m-0 mt-1 truncate text-[11px] leading-none text-ink-muted">
            Практика по LLM, агентам и RAG
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
