import type { StrategyResult } from './types'
import AnswerBlock from './AnswerBlock'
import { sentBlocks } from './blocks'
import { usageLine } from './usageLine'

export default function ResultBody({ result }: { result: StrategyResult }) {
  switch (result.kind) {
    case 'answer':
      return <AnswerBlock answer={result.answer} blocks={sentBlocks(result)} />
    case 'promptcraft':
      return (
        <div className="flex flex-col gap-3">
          <details className="demo-code-block">
            <summary className="cursor-pointer select-none text-xs text-[var(--ink-muted)]">
              Сгенерированный промпт (им решается задача)
            </summary>
            <pre className="mt-2 whitespace-pre-wrap text-sm">
              {result.composed.content}
            </pre>
            {usageLine(result.composed.usage, 'создание промпта')}
          </details>
          <AnswerBlock answer={result.final} blocks={sentBlocks(result)} />
        </div>
      )
    case 'experts':
      return (
        <div className="flex flex-col gap-3">
          {result.experts.map(({ id, label, answer }) => (
            <div key={id}>
              <p className="island-kicker mb-1">{label}</p>
              <AnswerBlock answer={answer} blocks={sentBlocks(result, id)} />
            </div>
          ))}
        </div>
      )
  }
}
