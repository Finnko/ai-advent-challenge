import { Badge } from '@/components/ui/Badge'

export default function ShortTermSection({ count }: { count: number }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="island-kicker m-0 text-[10px]">Краткосрочная · диалог</p>
        <Badge>{count} сообщ.</Badge>
      </div>
      <p className="demo-muted m-0 mt-2 text-xs">
        Последние сообщения активной ветки (стратегия «скользящее окно»).
        Хранятся в таблице messages и не переживают сессию.
      </p>
    </section>
  )
}
