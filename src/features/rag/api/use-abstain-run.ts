import { useState } from 'react'
import { ABSTAIN_QUESTIONS } from '../data/abstain-questions'
import type { AbstainQuestion } from '../data/abstain-questions'
import { answerQuestionFn } from '../functions/answer.functions'
import type { AnswerResult, ChunkingStrategyId, RagPipelineId } from '../types'

export type AbstainRunRow = {
  question: AbstainQuestion
  results: Record<string, AnswerResult>
}

export type AbstainRunState = {
  running: boolean
  completed: number
  total: number
  rows: AbstainRunRow[]
  error: string | null
}

const INITIAL: AbstainRunState = {
  running: false,
  completed: 0,
  total: ABSTAIN_QUESTIONS.length,
  rows: [],
  error: null,
}

export function useAbstainRun() {
  const [state, setState] = useState<AbstainRunState>(INITIAL)

  const run = async (input: {
    strategy: ChunkingStrategyId
    k: number
    pipelines: RagPipelineId[]
  }) => {
    setState({ ...INITIAL, running: true })
    const rows: AbstainRunRow[] = []
    for (let index = 0; index < ABSTAIN_QUESTIONS.length; index += 1) {
      const question = ABSTAIN_QUESTIONS[index]
      try {
        const results: Record<string, AnswerResult> = {}
        for (const pipeline of input.pipelines) {
          results[pipeline] = await answerQuestionFn({
            data: {
              mode: 'rag',
              strategy: input.strategy,
              query: question.query,
              k: input.k,
              pipeline,
            },
          })
        }
        rows.push({ question, results })
        setState({
          running: true,
          completed: index + 1,
          total: ABSTAIN_QUESTIONS.length,
          rows: [...rows],
          error: null,
        })
      } catch (cause) {
        setState({
          running: false,
          completed: index,
          total: ABSTAIN_QUESTIONS.length,
          rows: [...rows],
          error: cause instanceof Error ? cause.message : String(cause),
        })
        return
      }
    }
    setState({
      running: false,
      completed: ABSTAIN_QUESTIONS.length,
      total: ABSTAIN_QUESTIONS.length,
      rows,
      error: null,
    })
  }

  const reset = () => setState(INITIAL)

  return { ...state, run, reset }
}
