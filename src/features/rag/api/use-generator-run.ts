import { useState } from 'react'
import { CONTROL_QUESTIONS } from '../data/control-questions'
import type { ControlQuestion } from '../data/control-questions'
import { answerQuestionFn } from '../functions/answer.functions'
import type {
  AnswerGenerator,
  AnswerResult,
  ChunkingStrategyId,
  RagPipelineId,
} from '../types'

export type GeneratorCell = {
  result: AnswerResult | null
  error: string | null
}

export type GeneratorRunRow = {
  question: ControlQuestion
  cells: Record<AnswerGenerator, GeneratorCell>
}

export type GeneratorRunState = {
  running: boolean
  completed: number
  total: number
  rows: GeneratorRunRow[]
}

const GENERATORS: AnswerGenerator[] = ['cloud', 'local']

const INITIAL: GeneratorRunState = {
  running: false,
  completed: 0,
  total: CONTROL_QUESTIONS.length,
  rows: [],
}

export function useGeneratorRun() {
  const [state, setState] = useState<GeneratorRunState>(INITIAL)

  const run = async (input: {
    strategy: ChunkingStrategyId
    k: number
    pipeline: RagPipelineId
  }) => {
    setState({ ...INITIAL, running: true })
    const rows: GeneratorRunRow[] = []
    for (let index = 0; index < CONTROL_QUESTIONS.length; index += 1) {
      const question = CONTROL_QUESTIONS[index]
      const cells: Record<AnswerGenerator, GeneratorCell> = {
        cloud: { result: null, error: null },
        local: { result: null, error: null },
      }
      for (const generator of GENERATORS) {
        try {
          cells[generator] = {
            result: await answerQuestionFn({
              data: {
                mode: 'rag',
                strategy: input.strategy,
                query: question.query,
                k: input.k,
                pipeline: input.pipeline,
                generator,
                expected: question.expected,
                expectedSources: question.sources,
              },
            }),
            error: null,
          }
        } catch (cause) {
          cells[generator] = {
            result: null,
            error: cause instanceof Error ? cause.message : String(cause),
          }
        }
      }
      rows.push({ question, cells })
      setState({
        running: true,
        completed: index + 1,
        total: CONTROL_QUESTIONS.length,
        rows: [...rows],
      })
    }
    setState({
      running: false,
      completed: CONTROL_QUESTIONS.length,
      total: CONTROL_QUESTIONS.length,
      rows,
    })
  }

  const reset = () => setState(INITIAL)

  return { ...state, run, reset }
}
