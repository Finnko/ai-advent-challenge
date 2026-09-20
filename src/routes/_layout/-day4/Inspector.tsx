import type { ChatResult } from '@lib/llm'
import { DAY4_SYSTEM } from '@lib/day4'

export default function Inspector({
  user,
  model,
  activeTemp,
  hasRun,
}: {
  user: string
  model: ChatResult['model']
  activeTemp: number
  hasRun: boolean
}) {
  return (
    <div className="space-y-3 text-sm">
      <p className="demo-muted m-0 text-xs">
        {hasRun
          ? 'Что было отправлено (temperature активной карточки)'
          : 'Что будет отправлено'}
      </p>
      <div className="demo-code-block whitespace-pre-wrap">
        <span className="island-kicker">model</span>
        {'\n'}
        {model ?? '— (станет известна после запуска)'}
      </div>
      <div className="demo-code-block whitespace-pre-wrap">
        <span className="island-kicker">system</span>
        {'\n'}
        {DAY4_SYSTEM}
      </div>
      <div className="demo-code-block whitespace-pre-wrap">
        <span className="island-kicker">user</span>
        {'\n'}
        {user}
      </div>
      <div className="demo-code-block whitespace-pre-wrap">
        <span className="island-kicker">params</span>
        {'\n'}
        {JSON.stringify(
          {
            thinking: { type: 'disabled' },
            temperature: activeTemp,
          },
          null,
          2,
        )}
      </div>
    </div>
  )
}
