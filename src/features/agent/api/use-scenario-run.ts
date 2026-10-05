import { useState } from 'react'
import type { AgentRunResult } from '../domain/agent'
import { sessionConfigInput } from '../domain/session/config'
import {
  scoreStep,
  summarizeOutcome,
  type ScenarioOutcome,
  type StepVerdict,
} from '../domain/scenario-score'
import type { Scenario, ScenarioStep } from '../data/scenarios'
import { createSession } from '../functions/create-session.functions'
import { deleteSession } from '../functions/delete-session.functions'
import { getMemory } from '../functions/get-memory.functions'
import { runAgent } from '../functions/run-agent.functions'

export type ScenarioRunRow = {
  step: ScenarioStep
  run: AgentRunResult
  verdict: StepVerdict
}

export type ScenarioRunState = {
  running: boolean
  completed: number
  total: number
  rows: ScenarioRunRow[]
  outcome: ScenarioOutcome | null
  error: string | null
}

function emptyState(total: number): ScenarioRunState {
  return {
    running: false,
    completed: 0,
    total,
    rows: [],
    outcome: null,
    error: null,
  }
}

export function useScenarioRun() {
  const [state, setState] = useState<ScenarioRunState>(emptyState(0))

  const run = async (scenario: Scenario, token: string) => {
    setState({ ...emptyState(scenario.steps.length), running: true })
    const rows: ScenarioRunRow[] = []
    let sessionId: number | null = null
    try {
      const created = await createSession({
        data: {
          token,
          config: sessionConfigInput({
            strategy: 'window',
            memoryEnabled: true,
            taskStateEnabled: false,
            ragEnabled: true,
            scenario: `[сценарий] ${scenario.title}`,
          }),
        },
      })
      sessionId = created.sessionId
      for (let index = 0; index < scenario.steps.length; index += 1) {
        const step = scenario.steps[index]
        const result = await runAgent({
          data: { token, sessionId, user: step.question },
        })
        rows.push({
          step,
          run: result.run,
          verdict: scoreStep(step, result.run),
        })
        setState({
          running: true,
          completed: index + 1,
          total: scenario.steps.length,
          rows: [...rows],
          outcome: null,
          error: null,
        })
      }
      const memory = await getMemory({ data: { sessionId, token } })
      const outcome = summarizeOutcome(
        rows.map((row) => row.verdict),
        memory.working,
        scenario.goalKeyword,
      )
      setState({
        running: false,
        completed: scenario.steps.length,
        total: scenario.steps.length,
        rows,
        outcome,
        error: null,
      })
    } catch (cause) {
      setState({
        running: false,
        completed: rows.length,
        total: scenario.steps.length,
        rows: [...rows],
        outcome: null,
        error: cause instanceof Error ? cause.message : String(cause),
      })
    } finally {
      if (sessionId !== null) {
        await deleteSession({ data: { sessionId } }).catch(() => undefined)
      }
    }
  }

  const reset = () => setState(emptyState(0))

  return { ...state, run, reset }
}
