import { runLocalChat } from '@lib/local-llm.server'
import type { LocalLlmDeps } from '@lib/local-llm.server'
import { buildQuestionPrompt } from '../data/prompts'
import { isDuplicateQuestion, parseQuestion } from '../domain/question'
import type { Difficulty, QuizQuestion, Topic } from '../domain/types'

export const GENERATOR_MAX_TOKENS = 512
export const GENERATOR_ATTEMPTS = 4
export const GENERATOR_TEMPERATURE = 0.9

export type GenerateQuestionInput = {
  topic: Topic
  difficulty: Difficulty
  avoid: string[]
}

export type QuestionGenerator = (
  input: GenerateQuestionInput,
) => Promise<QuizQuestion>

export function createLocalQuestionGenerator(
  deps: LocalLlmDeps = {},
): QuestionGenerator {
  return async (input) => {
    const { system, user } = buildQuestionPrompt({
      topic: input.topic,
      difficulty: input.difficulty,
    })
    const messages = [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: user },
    ]

    let lastError: unknown = null
    for (let attempt = 0; attempt < GENERATOR_ATTEMPTS; attempt += 1) {
      const result = await runLocalChat(
        messages,
        {
          max_tokens: GENERATOR_MAX_TOKENS,
          temperature: GENERATOR_TEMPERATURE,
        },
        deps,
      )
      try {
        const question = parseQuestion(result.content)
        if (isDuplicateQuestion(question, input.avoid)) {
          lastError = new Error('модель повторила уже заданный вопрос')
          continue
        }
        return question
      } catch (error) {
        lastError = error
      }
    }

    throw new Error(
      `Локальная модель не выдала корректный вопрос: ${describe(lastError)}`,
    )
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
