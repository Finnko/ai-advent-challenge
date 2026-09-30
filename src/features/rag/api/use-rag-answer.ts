import { useMutation } from '@tanstack/react-query'
import { answerQuestionFn } from '../functions/answer.functions'
import type { AnswerInput } from '../types'

export function useRagAnswer() {
  return useMutation({
    mutationFn: (input: AnswerInput) => answerQuestionFn({ data: input }),
  })
}
