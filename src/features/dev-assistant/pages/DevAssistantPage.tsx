import { useState } from 'react'
import AssistantChat from '../components/AssistantChat'
import AssistantIndexCard from '../components/AssistantIndexCard'
import GitContextPanel from '../components/GitContextPanel'
import type { DevAssistantAnswer } from '../types'

export default function DevAssistantPage() {
  const [latest, setLatest] = useState<DevAssistantAnswer | null>(null)

  return (
    <div className="page-wrap flex flex-col gap-4 px-4 pb-8 pt-6">
      <header className="mb-1">
        <p className="island-kicker mb-2">Ассистент разработчика · RAG + MCP</p>
        <h1 className="demo-title mb-2">Помощник по проекту</h1>
        <p className="demo-muted m-0 max-w-[70ch] text-sm">
          Ассистент отвечает на вопросы о самом проекте. Корпус — README,
          docs/adr, README фич и схемы данных, проиндексированные локально;
          живое состояние репозитория (ветка, статус, коммиты, дифф) приходит из
          git-MCP-сервера. Задайте вопрос или введите команду{' '}
          <span className="font-mono">/help</span>.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <AssistantChat onAnswer={setLatest} />
        <div className="flex flex-col gap-4">
          <GitContextPanel context={latest?.gitContext ?? null} />
          <AssistantIndexCard />
        </div>
      </div>
    </div>
  )
}
