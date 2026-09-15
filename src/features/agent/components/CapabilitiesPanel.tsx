import { TOOL_INFO } from '../data/agent-ui'
import type { AgentCapabilities } from '../domain/agent'
import TypingDots from '@/components/TypingDots'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'

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
      <Alert variant="destructive" className="mt-3">
        <p className="m-0 text-sm">{props.message}</p>
      </Alert>
    )
  }

  const { caps } = props
  const availableTools = TOOL_INFO.filter((t) =>
    caps.allowedTools.includes(t.name),
  )
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>
          {caps.identity.title} {caps.identity.name}
        </Badge>
        <Badge>роль: {caps.identity.role}</Badge>
        {availableTools.map((t) => (
          <Badge key={t.name} title={t.description}>
            {t.label}
          </Badge>
        ))}
      </div>
      {caps.identity.subordinates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="demo-muted text-xs">Подчинённые:</span>
          {caps.identity.subordinates.map((name) => (
            <Badge key={name}>{name}</Badge>
          ))}
        </div>
      )}
    </div>
  )
}
