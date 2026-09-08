import { TOOL_INFO } from '../../lib/day6'
import type { AgentCapabilities } from '../../lib/agent'
import TypingDots from '../TypingDots'

type CapabilitiesPanelProps =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; caps: AgentCapabilities }

export default function CapabilitiesPanel(props: CapabilitiesPanelProps) {
  if (props.status === 'loading') {
    return (
      <div className="mt-3 flex items-center gap-2">
        <TypingDots />
        <span className="demo-muted text-xs">
          Резолвлю способности по токену…
        </span>
      </div>
    )
  }

  if (props.status === 'error') {
    return (
      <div className="demo-alert demo-alert-danger mt-3">
        <p className="m-0 text-sm">{props.message}</p>
      </div>
    )
  }

  const { caps } = props
  const availableTools = TOOL_INFO.filter((t) =>
    caps.allowedTools.includes(t.name),
  )
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="demo-pill">
          {caps.identity.title} {caps.identity.name}
        </span>
        <span className="demo-pill">роль: {caps.identity.role}</span>
        {availableTools.map((t) => (
          <span key={t.name} className="demo-pill" title={t.description}>
            {t.label}
          </span>
        ))}
      </div>
      {caps.identity.subordinates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="demo-muted text-xs">Подчинённые:</span>
          {caps.identity.subordinates.map((name) => (
            <span key={name} className="demo-pill">
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
