import type { AnswerQuote, ScoredChunk } from '@lib/rag-engine.types'
import { Badge } from '@/components/ui/Badge'

export default function SourcesList({
  sources,
  quotes,
}: {
  sources: ScoredChunk[]
  quotes: AnswerQuote[]
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="island-kicker m-0">Источники</h2>
        {sources.length === 0 && (
          <p className="demo-muted m-0 text-xs">
            В базе знаний не нашлось подходящих фрагментов.
          </p>
        )}
        {sources.map((source, index) => (
          <div
            key={source.chunk.chunkId}
            className="flex flex-col gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">[{index + 1}]</Badge>
              <span className="font-semibold text-[var(--ink)]">
                {source.chunk.title}
              </span>
              {source.relevance !== undefined ? (
                <Badge>rel {source.relevance.toFixed(3)}</Badge>
              ) : (
                <Badge>score {source.score.toFixed(3)}</Badge>
              )}
              {source.originalScore !== undefined &&
                source.score - source.originalScore > 1e-6 && (
                  <Badge variant="accent">
                    лексика +{(source.score - source.originalScore).toFixed(3)}
                  </Badge>
                )}
            </div>
            {source.chunk.section && (
              <span className="demo-muted">{source.chunk.section}</span>
            )}
            <a
              href={source.chunk.source}
              target="_blank"
              rel="noreferrer noopener"
              className="break-all font-mono text-[11px] text-[var(--accent-strong)] underline underline-offset-2"
            >
              {source.chunk.source}
            </a>
          </div>
        ))}
      </div>

      {quotes.length > 0 && (
        <div className="flex flex-col gap-1">
          <h2 className="island-kicker m-0">Цитаты</h2>
          {quotes.map((quote, index) => (
            <div
              key={`${quote.n}-${index}`}
              className="flex flex-col gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-tint)] px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">[{quote.n}]</Badge>
                <Badge variant={quote.verified ? 'success' : 'danger'}>
                  {quote.verified ? 'подтверждена' : 'не найдена'}
                </Badge>
              </div>
              <span className="italic leading-relaxed text-[var(--ink-soft)]">
                «{quote.text}»
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
