import { useState } from 'react'
import { useRagChunks } from '../api/use-rag-chunks'
import { STRATEGY_IDS, STRATEGY_SHORT_LABELS } from '../data/rag-ui'
import type { ChunkingStrategyId } from '../types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'

function excerpt(text: string, limit = 220): string {
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

export default function ChunkBrowser() {
  const [strategy, setStrategy] = useState<ChunkingStrategyId>('fixed')
  const chunks = useRagChunks(strategy)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {STRATEGY_IDS.map((id) => (
          <Button
            key={id}
            size="xs"
            variant={strategy === id ? 'default' : 'secondary'}
            onClick={() => setStrategy(id)}
          >
            {STRATEGY_SHORT_LABELS[id]}
          </Button>
        ))}
        <span className="demo-muted text-xs">
          {chunks.data ? `${chunks.data.length} чанков` : ''}
        </span>
      </div>

      {chunks.error && (
        <Alert variant="destructive">
          {chunks.error instanceof Error
            ? chunks.error.message
            : String(chunks.error)}
        </Alert>
      )}
      {chunks.data && chunks.data.length === 0 && (
        <p className="demo-muted m-0 text-xs">
          Индекс для стратегии {STRATEGY_SHORT_LABELS[strategy]} ещё не собран.
        </p>
      )}
      <div className="flex flex-col gap-2">
        {chunks.data?.map((chunk) => (
          <div
            key={chunk.chunkId}
            className="flex flex-col gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">#{chunk.position}</Badge>
              <span className="font-semibold text-[var(--ink)]">
                {chunk.title}
              </span>
              {chunk.section && (
                <span className="demo-muted">раздел: {chunk.section}</span>
              )}
              <span className="demo-muted">{chunk.nTokens} токенов</span>
              <span className="demo-muted">
                [{chunk.charStart}–{chunk.charEnd}]
              </span>
              {chunk.crossesSection && (
                <Badge variant="warn">граница раздела</Badge>
              )}
            </div>
            <p className="m-0 text-xs leading-relaxed text-[var(--ink-soft)]">
              {excerpt(chunk.text)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
