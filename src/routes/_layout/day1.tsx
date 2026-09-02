import { createFileRoute } from '@tanstack/react-router'
import Chat from '../../components/Chat'
import { chat } from '../../lib/chat'

export const Route = createFileRoute('/_layout/day1')({ component: Day1 })

function Day1() {
  return (
    <div className="mx-auto flex h-full min-h-0 max-w-3xl flex-col px-4 py-6">
      <header className="mb-5 mt-2">
        <p className="island-kicker mb-2">AI Advent Challenge · Day 1</p>
        <h1 className="demo-title">Чат с DeepSeek</h1>
      </header>
      <section className="demo-panel flex min-h-0 flex-1 flex-col p-5">
        <Chat onSend={(prompt) => chat({ data: { prompt, mode: 'free' } })} />
      </section>
    </div>
  )
}
