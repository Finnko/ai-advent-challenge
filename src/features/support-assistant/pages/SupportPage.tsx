import { useEffect, useState } from 'react'
import { SUPPORT_SCENARIOS, type SupportScenario } from '../data/help'
import type { AskResult, Catalog } from '../domain/types'
import AskPanel from '../components/AskPanel'
import ContextPanel from '../components/ContextPanel'
import McpTrace from '../components/McpTrace'
import SourcesList from '../components/SourcesList'
import TicketPicker from '../components/TicketPicker'

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string }
    }
    return body.error?.message ?? `Ошибка сервиса (${response.status}).`
  } catch {
    return `Ошибка сервиса (${response.status}).`
  }
}

export default function SupportPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [sellerId, setSellerId] = useState('')
  const [ticketId, setTicketId] = useState('')
  const [question, setQuestion] = useState(SUPPORT_SCENARIOS[0]?.question ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AskResult | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch('/api/support/sellers')
        if (!response.ok) {
          throw new Error(await readError(response))
        }
        const data = (await response.json()) as Catalog
        if (cancelled) {
          return
        }
        setCatalog(data)
        const firstSeller = data.sellers[0]?.id ?? ''
        const firstTicket =
          data.tickets.find((ticket) => ticket.sellerId === firstSeller)?.id ??
          ''
        setSellerId((current) => current || firstSeller)
        setTicketId((current) => current || firstTicket)
      } catch (loadError) {
        if (!cancelled) {
          setCatalogError(
            loadError instanceof Error
              ? loadError.message
              : 'Не удалось загрузить данные.',
          )
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  function selectSeller(id: string): void {
    setSellerId(id)
    const first = catalog?.tickets.find((ticket) => ticket.sellerId === id)
    setTicketId(first?.id ?? '')
    setResult(null)
    setError(null)
  }

  function applyScenario(scenario: SupportScenario): void {
    setSellerId(scenario.sellerId)
    setTicketId(scenario.ticketId)
    setQuestion(scenario.question)
    setResult(null)
    setError(null)
  }

  async function submit(): Promise<void> {
    if (!sellerId || !ticketId) {
      setError('Выберите продавца и тикет.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/support/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId, ticketId, question }),
      })
      if (!response.ok) {
        throw new Error(await readError(response))
      }
      setResult((await response.json()) as AskResult)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Не удалось получить ответ.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[var(--bg-base)] text-[var(--ink)]">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pb-4 pt-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="island-kicker m-0">
            День 33 · RAG + MCP + Funnel
          </span>
          <span className="rounded-full border border-[var(--line-strong)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-muted)]">
            демо на фикстурах
          </span>
        </div>
        <h1 className="demo-title m-0 text-3xl sm:text-4xl">
          Неофициальный помощник Ozon
        </h1>
        <p className="demo-muted m-0 max-w-[75ch] text-sm leading-relaxed">
          Ответ по документации Ozon, фактам вашего аккаунта и тикета. База
          знаний ищется локальным индексом, данные продавца приходят из
          MCP-сервера, ответ собирает DeepSeek. Это не официальная поддержка
          Ozon.
        </p>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-10 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="island-shell flex flex-col gap-3 p-4">
            <h2 className="island-kicker m-0">Продавец и тикет</h2>
            {catalogError ? (
              <p className="m-0 text-sm text-[var(--danger)]">{catalogError}</p>
            ) : (
              <TicketPicker
                catalog={catalog}
                sellerId={sellerId}
                ticketId={ticketId}
                onSeller={selectSeller}
                onTicket={(id) => {
                  setTicketId(id)
                  setResult(null)
                  setError(null)
                }}
                disabled={pending}
              />
            )}
          </section>

          <AskPanel
            scenarios={SUPPORT_SCENARIOS}
            onScenario={applyScenario}
            question={question}
            onQuestion={setQuestion}
            onSubmit={() => void submit()}
            pending={pending}
            error={error}
            result={result}
          />
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <ContextPanel result={result} />
          <McpTrace trace={result?.trace ?? []} />
          {result && (
            <section className="island-shell p-4">
              <SourcesList sources={result.sources} quotes={result.quotes} />
            </section>
          )}
        </aside>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-8">
        <p className="demo-muted m-0 border-t border-[var(--line)] pt-4 text-xs leading-relaxed">
          Неофициальный учебный сервис. Не является поддержкой Ozon, не пишет в
          тикеты и не меняет данные аккаунта. Продавцы, тикеты и отправления —
          синтетические фикстуры. Документация принадлежит Ozon и открывается по
          ссылкам на seller-edu.
        </p>
      </footer>
    </div>
  )
}
