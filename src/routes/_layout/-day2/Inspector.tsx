import { CHAT_CONFIGS } from '@lib/day2'
import type { ChatMode } from '@lib/day2'

export default function Inspector({ mode }: { mode: ChatMode }) {
  const config = CHAT_CONFIGS[mode]
  return (
    <div className="space-y-3 text-sm">
      <p className="demo-muted m-0 text-xs">{config.description}</p>
      <div className="demo-code-block whitespace-pre-wrap">
        <span className="island-kicker">system</span>
        {'\n'}
        {config.system}
      </div>
      <div className="demo-code-block whitespace-pre-wrap">
        <span className="island-kicker">params</span>
        {'\n'}
        {JSON.stringify(
          {
            thinking: { type: 'disabled' },
            ...config.params,
          },
          null,
          2,
        )}
      </div>
    </div>
  )
}
