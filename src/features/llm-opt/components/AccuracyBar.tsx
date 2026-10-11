type AccuracyBarProps = {
  value: number
}

function toneFor(value: number): string {
  if (value >= 1) {
    return 'var(--positive)'
  }
  if (value <= 0) {
    return 'var(--danger)'
  }
  return 'var(--warn)'
}

export default function AccuracyBar({ value }: AccuracyBarProps) {
  const percent = Math.round(value * 100)
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--surface-tint)]">
        <span
          className="block h-full rounded-full"
          style={{ width: `${percent}%`, backgroundColor: toneFor(value) }}
        />
      </span>
      <span className="text-xs font-semibold text-[var(--ink)]">
        {percent}%
      </span>
    </div>
  )
}
