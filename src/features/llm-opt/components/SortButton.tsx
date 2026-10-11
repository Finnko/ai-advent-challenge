type SortButtonProps = {
  label: string
  active: boolean
  direction: 'asc' | 'desc'
  align?: 'left' | 'right'
  onClick: () => void
}

export default function SortButton({
  label,
  active,
  direction,
  align = 'left',
  onClick,
}: SortButtonProps) {
  let arrow = ''
  if (active) {
    arrow = direction === 'asc' ? '↑' : '↓'
  }
  let alignClass = ''
  if (align === 'right') {
    alignClass = 'flex-row-reverse'
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${alignClass}`}
    >
      {label}
      <span className="text-[var(--accent)]">{arrow}</span>
    </button>
  )
}
