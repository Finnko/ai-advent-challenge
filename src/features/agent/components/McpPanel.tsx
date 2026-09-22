import { useMcpTools } from '../api/use-mcp-tools'
import McpToolCard from './McpToolCard'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'

export default function McpPanel() {
  const { data, isPending, isFetching, error, refetch } = useMcpTools()
  const tools = data?.ok ? data.tools : []

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="island-kicker m-0 text-[10px]">Локальный MCP-сервер</p>
          <p className="demo-muted m-0 mt-1 text-xs">
            Клиент поднимает stdio-процесс, получает список инструментов и
            закрывает соединение.
          </p>
        </div>
        <Button
          variant="secondary"
          size="xs"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? 'Обновляю…' : 'Обновить'}
        </Button>
      </div>

      {isPending && (
        <p className="demo-muted m-0 text-xs">Подключаюсь к MCP…</p>
      )}
      {error && (
        <Alert variant="destructive">
          {error instanceof Error ? error.message : String(error)}
        </Alert>
      )}
      {data && !data.ok && <Alert variant="destructive">{data.error}</Alert>}
      {data?.ok &&
        (tools.length === 0 ? (
          <p className="demo-muted m-0 text-xs">
            Сервер не вернул ни одного инструмента.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {tools.map((tool) => (
              <McpToolCard key={tool.name} tool={tool} />
            ))}
          </div>
        ))}
    </div>
  )
}
