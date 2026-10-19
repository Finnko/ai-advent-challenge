import { Badge } from '@/components/ui/Badge'
import type { AskResult } from '../domain/types'

export default function ContextPanel({ result }: { result: AskResult | null }) {
  return (
    <section className="island-shell flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="island-kicker m-0">Что ушло в контекст</h2>
        {result?.contextUsed && <Badge variant="accent">MCP</Badge>}
        {result?.seller && (
          <Badge variant="outline">{result.seller.scheme}</Badge>
        )}
      </div>

      {!result && (
        <p className="demo-muted m-0 text-xs">
          Задайте вопрос — здесь появятся факты из аккаунта, тикета и
          отправлений.
        </p>
      )}

      {result?.contextError && (
        <p className="m-0 rounded-lg border border-[var(--warn)] bg-[color-mix(in_oklab,var(--warn)_10%,var(--surface))] px-3 py-2 text-xs text-[var(--ink-soft)]">
          MCP-контекст недоступен: {result.contextError}
        </p>
      )}

      {result?.seller && result.ticket && (
        <div className="flex flex-col gap-1 text-xs text-[var(--ink-soft)]">
          <span className="font-semibold text-[var(--ink)]">
            {result.seller.name}
          </span>
          <span>
            Тикет {result.ticket.id}: {result.ticket.subject}
          </span>
        </div>
      )}

      {result?.contextBlocks.length === 0 && (
        <p className="demo-muted m-0 text-xs">
          MCP не вернул данных по аккаунту и тикету.
        </p>
      )}

      {result?.contextBlocks.map((block, index) => (
        <details
          key={`${index}-${block.slice(0, 24)}`}
          className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
          open={index === 0}
        >
          <summary className="cursor-pointer text-xs font-semibold text-[var(--ink)]">
            {block.split('\n')[0]}
          </summary>
          <pre className="m-0 mt-2 whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-[var(--ink-soft)]">
            {block.split('\n').slice(1).join('\n')}
          </pre>
        </details>
      ))}
    </section>
  )
}
