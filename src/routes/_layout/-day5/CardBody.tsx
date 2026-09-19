import type { CardState } from './types'
import AnswerBlock from './AnswerBlock'
import TypingDots from '@/components/TypingDots'
import { Alert } from '@/components/ui/Alert'

export default function CardBody({ state }: { state: CardState }) {
  switch (state.status) {
    case 'idle':
      return (
        <p className="demo-muted m-0 text-sm">
          Пока не запущено. Нажми кнопку выше.
        </p>
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
      return <AnswerBlock answer={state.answer} savedPath={state.savedPath} />
  }
}
