import type { VerdictState } from './types'
import VerdictBody from './VerdictBody'
import TypingDots from '@/components/TypingDots'
import { Alert } from '@/components/ui/Alert'

export default function VerdictCard({ verdict }: { verdict: VerdictState }) {
  switch (verdict.status) {
    case 'idle':
      return (
        <p className="demo-muted m-0 text-sm">
          Появится после того, как ответят все четыре стратегии.
        </p>
      )
    case 'loading':
      return <TypingDots text="Сравниваю четыре ответа с эталоном…" />
    case 'error':
      return (
        <div className="flex flex-col gap-3">
          <Alert variant="destructive">
            <p className="m-0 text-sm">{verdict.error}</p>
          </Alert>
          {verdict.raw && (
            <pre className="demo-code-block whitespace-pre-wrap text-xs">
              {verdict.raw}
            </pre>
          )}
        </div>
      )
    case 'done':
      return <VerdictBody verdict={verdict.verdict} />
  }
}
