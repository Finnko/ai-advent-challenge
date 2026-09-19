import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'

export default function EmptySessionPanel({
  busy,
  error,
  onCreate,
}: {
  busy: boolean
  error: string | null
  onCreate: () => void
}) {
  return (
    <section className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--line)] p-8">
      <p className="m-0 text-sm font-semibold text-[var(--ink)]">
        Сессия не выбрана
      </p>
      <p className="demo-muted m-0 max-w-sm text-center text-xs">
        Создайте новую сессию (конфиг возьмётся из вкладки «Настройки») или
        выберите существующую в списке слева.
      </p>
      <Button onClick={onCreate} disabled={busy}>
        Новая сессия
      </Button>
      {error && <Alert variant="destructive">{error}</Alert>}
    </section>
  )
}
