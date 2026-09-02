import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4">
      <nav className="page-wrap flex items-center py-3 sm:py-4">
        <h1 className="m-0 text-base font-bold tracking-tight text-[var(--sea-ink)] sm:text-lg">
          AI Advent Challenge
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
