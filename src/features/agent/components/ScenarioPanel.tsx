import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useScenarioRun } from '../api/use-scenario-run'
import { SCENARIOS } from '../data/scenarios'
import ScenarioRow from './ScenarioRow'

export default function ScenarioPanel({ token }: { token: string }) {
  const scenarioRun = useScenarioRun()
  const [activeId, setActiveId] = useState<string | null>(null)

  const activeScenario =
    SCENARIOS.find((scenario) => scenario.id === activeId) ?? null

  return (
    <div className="flex flex-col gap-4">
      <p className="demo-muted m-0 text-sm">
        Два длинных диалога (по 13 реплик). Прогон создаёт временную сессию с
        включённым RAG, проверяет источники/опору/факты на каждом ходу и удаляет
        её в конце.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {SCENARIOS.map((scenario) => (
          <section
            key={scenario.id}
            className="demo-panel flex flex-col gap-2 p-4"
          >
            <h3 className="demo-section-title m-0">{scenario.title}</h3>
            <p className="demo-muted m-0 text-xs">{scenario.description}</p>
            <p className="demo-muted m-0 text-xs">
              {scenario.steps.length} реплик · ключ цели: «
              {scenario.goalKeyword}»
            </p>
            <Button
              size="sm"
              variant="secondary"
              disabled={scenarioRun.running}
              onClick={() => {
                setActiveId(scenario.id)
                void scenarioRun.run(scenario, token)
              }}
            >
              {scenarioRun.running && activeId === scenario.id
                ? 'Идёт прогон…'
                : 'Прогнать'}
            </Button>
          </section>
        ))}
      </div>

      {scenarioRun.error && (
        <Alert variant="destructive">{scenarioRun.error}</Alert>
      )}

      {activeScenario && scenarioRun.rows.length > 0 && (
        <section className="demo-panel flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="demo-section-title m-0">{activeScenario.title}</h3>
            <span className="text-xs text-ink-muted tabular-nums">
              {scenarioRun.completed} / {scenarioRun.total}
            </span>
          </div>
          {scenarioRun.outcome && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">
                пройдено {scenarioRun.outcome.passed} /{' '}
                {scenarioRun.outcome.total}
              </Badge>
              <Badge
                variant={
                  scenarioRun.outcome.goalRetained ? 'success' : 'danger'
                }
              >
                цель{' '}
                {scenarioRun.outcome.goalRetained ? 'удержана' : 'потеряна'}
              </Badge>
            </div>
          )}
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {scenarioRun.rows.map((row, index) => (
              <ScenarioRow
                key={`${activeScenario.id}-${index}`}
                row={row}
                index={index}
              />
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
