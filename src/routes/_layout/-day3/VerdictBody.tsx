import type { VerdictShape } from './types'
import { STRATEGIES } from '@lib/day3'
import { Badge } from '@/components/ui/Badge'

export default function VerdictBody({ verdict }: { verdict: VerdictShape }) {
  const winner = verdict.winner
  const winnerMeta = STRATEGIES.find((s) => s.id === winner)
  return (
    <div className="flex flex-col gap-3">
      {verdict.summary && (
        <p className="demo-muted m-0 text-sm">{verdict.summary}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {STRATEGIES.map(({ id, label }) => {
          const score = verdict.scores?.[id]
          const isWinner = id === winner
          return (
            <Badge key={id} variant={isWinner ? 'accent' : 'default'}>
              {label}: {typeof score === 'number' ? score : '—'}
              {isWinner ? '  (победитель)' : ''}
            </Badge>
          )
        })}
      </div>
      {winnerMeta && verdict.why && (
        <div className="demo-code-block whitespace-pre-wrap text-sm">
          <span className="island-kicker">
            Почему победила стратегия «{winnerMeta.label}»
          </span>
          {'\n'}
          {verdict.why}
        </div>
      )}
    </div>
  )
}
