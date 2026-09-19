import type { SentBlock } from './types'

export default function PromptPreview({
  title,
  blocks,
}: {
  title: string
  blocks: SentBlock[]
}) {
  return (
    <details className="mt-1">
      <summary className="cursor-pointer select-none text-xs text-[var(--ink-muted)]">
        {title}
      </summary>
      <div className="mt-2 space-y-2">
        {blocks.map((block, i) => (
          <div key={i} className="demo-code-block whitespace-pre-wrap text-xs">
            <span className="island-kicker">{block.label}</span>
            {'\n'}
            {block.text}
          </div>
        ))}
      </div>
    </details>
  )
}
