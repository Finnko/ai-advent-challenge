import type { StrategyId } from '@lib/day3'
import type { ResultState } from './types'
import ResultBody from './ResultBody'
import PromptPreview from './PromptPreview'
import { previewBlocks } from './blocks'
import TypingDots from '@/components/TypingDots'
import { Alert } from '@/components/ui/Alert'

export default function StrategyCard({
  state,
  id,
  prompt,
}: {
  state: ResultState
  id: StrategyId
  prompt: string
}) {
  switch (state.status) {
    case 'idle':
      return (
        <div>
          <p className="demo-muted m-0 text-sm">
            Пока не запущено. Нажми «Запустить 4 стратегии», чтобы решить задачу
            этим способом.
          </p>
          <PromptPreview
            title="Что будет отправлено в модель"
            blocks={previewBlocks(id, prompt)}
          />
        </div>
      )
    case 'loading':
      return (
        <div className="flex flex-col gap-3">
          <TypingDots />
        </div>
      )
    case 'error':
      return (
        <Alert variant="destructive">
          <p className="m-0 text-sm">{state.error}</p>
        </Alert>
      )
    case 'done':
      return <ResultBody result={state.result} />
  }
}
