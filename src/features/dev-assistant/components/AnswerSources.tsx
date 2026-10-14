import type { DevAssistantAnswer } from '../types'
import { Badge } from '@/components/ui/Badge'

const GENERATOR_LABELS: Record<DevAssistantAnswer['generator'], string> = {
  cloud: 'облако DeepSeek',
  local: 'локально MLX',
}

function usageLabel(result: DevAssistantAnswer): string {
  if (!result.usage) {
    return `${result.latencyMs} мс`
  }
  return `${result.usage.prompt_tokens} + ${result.usage.completion_tokens} токенов · ${result.latencyMs} мс`
}

export default function AnswerSources({
  result,
}: {
  result: DevAssistantAnswer
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{GENERATOR_LABELS[result.generator]}</Badge>
        <span className="demo-muted text-xs">{usageLabel(result)}</span>
        {result.contextUsed && <Badge variant="accent">git-контекст</Badge>}
        {result.reranked && <Badge variant="success">реранк</Badge>}
        {result.abstained && <Badge variant="warn">нет данных</Badge>}
        {result.model && (
          <span className="demo-muted font-mono text-xs">{result.model}</span>
        )}
      </div>

      {result.quotes.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="demo-muted text-xs">Цитаты:</span>
          {result.quotes.map((quote, index) => (
            <div
              key={`${quote.n}-${index}`}
              className="flex flex-col gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-tint)] px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="accent">[{quote.n}]</Badge>
                <Badge variant={quote.verified ? 'success' : 'danger'}>
                  {quote.verified ? 'подтверждена' : 'не найдена'}
                </Badge>
                {quote.title && (
                  <span className="demo-muted">{quote.title}</span>
                )}
              </div>
              <span className="italic leading-relaxed text-[var(--ink-soft)]">
                «{quote.text}»
              </span>
            </div>
          ))}
        </div>
      )}

      {result.sources.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="demo-muted text-xs">Источники:</span>
          {result.sources.map((source, index) => (
            <div
              key={source.chunk.chunkId}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-xs"
            >
              <Badge variant="accent">[{index + 1}]</Badge>
              {source.relevance !== undefined ? (
                <Badge>rel {source.relevance.toFixed(3)}</Badge>
              ) : (
                <Badge>score {source.score.toFixed(3)}</Badge>
              )}
              <span className="font-semibold text-[var(--ink)]">
                {source.chunk.title}
              </span>
              {source.chunk.section && (
                <span className="demo-muted">
                  раздел: {source.chunk.section}
                </span>
              )}
              <span className="demo-muted font-mono">
                {source.chunk.source}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
