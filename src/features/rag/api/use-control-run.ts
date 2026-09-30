import { useState } from 'react'
import { CONTROL_QUESTIONS } from '../data/control-questions'
import type { ControlQuestion } from '../data/control-questions'
import { answerQuestionFn } from '../functions/answer.functions'
import type { AnswerResult, ChunkingStrategyId, RagPipelineId } from '../types'

export type ControlRunRow = {
  question: ControlQuestion
  results: Record<string, AnswerResult>
}

export type ControlRunState = {
  running: boolean
  completed: number
  total: number
  rows: ControlRunRow[]
  error: string | null
}

const INITIAL: ControlRunState = {
  running: false,
  completed: 0,
  total: CONTROL_QUESTIONS.length,
  rows: [],
  error: null,
}

export function useControlRun() {
  const [state, setState] = useState<ControlRunState>(INITIAL)

  const run = async (input: {
    strategy: ChunkingStrategyId
    k: number
    pipelines: RagPipelineId[]
  }) => {
    setState({ ...INITIAL, running: true })
    const rows: ControlRunRow[] = []
    for (let index = 0; index < CONTROL_QUESTIONS.length; index += 1) {
      const question = CONTROL_QUESTIONS[index]
      try {
        const shared = {
          strategy: input.strategy,
          query: question.query,
          k: input.k,
          expected: question.expected,
          expectedSources: question.sources,
        }
        const results: Record<string, AnswerResult> = {}
        results.baseline = await answerQuestionFn({
          data: { ...shared, mode: 'baseline' },
        })
        for (const pipeline of input.pipelines) {
          results[pipeline] = await answerQuestionFn({
            data: { ...shared, mode: 'rag', pipeline },
          })
        }
        rows.push({ question, results })
        setState({
          running: true,
          completed: index + 1,
          total: CONTROL_QUESTIONS.length,
          rows: [...rows],
          error: null,
        })
      } catch (cause) {
        setState({
          running: false,
          completed: index,
          total: CONTROL_QUESTIONS.length,
          rows: [...rows],
          error: cause instanceof Error ? cause.message : String(cause),
        })
        return
      }
    }
    setState({
      running: false,
      completed: CONTROL_QUESTIONS.length,
      total: CONTROL_QUESTIONS.length,
      rows,
      error: null,
    })
  }

  const reset = () => setState(INITIAL)

  return { ...state, run, reset }
}
