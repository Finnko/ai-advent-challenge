import { Badge } from '@/components/ui/Badge'
import type { Grounding, RetrievedSource } from '../domain/capabilities/types'
import { GROUNDING_LABELS, GROUNDING_TONES } from '../data/agent-ui'

function scoreLine(source: RetrievedSource): string {
  const cosine = `cos ${(source.originalScore ?? source.score).toFixed(3)}`
  return source.relevance === undefined
    ? cosine
    : `${cosine} → rel ${source.relevance.toFixed(3)}`
}

export default function RagSources({
  sources,
  grounding,
  citations,
}: {
  sources: RetrievedSource[]
  grounding: Grounding
  citations: number[]
}) {
  return (
    <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--surface-tint)] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="island-kicker m-0">Источники</span>
        <Badge variant={GROUNDING_TONES[grounding]}>
          {GROUNDING_LABELS[grounding]}
        </Badge>
        {citations.length > 0 && (
          <span className="text-xs text-ink-muted">
            цитаты: {citations.map((index) => `[${index}]`).join(' ')}
          </span>
        )}
      </div>
      {sources.length === 0 ? (
        <p className="demo-muted m-0 mt-2 text-xs">
          Релевантных фрагментов не найдено.
        </p>
      ) : (
        <ol className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
          {sources.map((source, index) => (
            <li key={source.chunkId} className="text-xs">
              <details>
                <summary className="cursor-pointer text-[var(--ink-soft)]">
                  <span className="font-semibold">
                    [{index + 1}] {source.title}
                  </span>
                  {source.section ? ` — ${source.section}` : ''}
                  <span className="ml-1 tabular-nums text-ink-muted">
                    {scoreLine(source)}
                  </span>
                </summary>
                <p className="demo-muted m-0 mt-1 whitespace-pre-wrap">
                  {source.text}
                </p>
                <a
                  className="text-xs text-[var(--accent-strong)]"
                  href={source.source}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.source}
                </a>
              </details>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
