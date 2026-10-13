import { useMutation } from '@tanstack/react-query'
import { askAssistant } from '../functions/answer.functions'
import type { DevAssistantAnswerInput } from '../types'

export function useAssistantAnswer() {
  return useMutation({
    mutationFn: (input: DevAssistantAnswerInput) =>
      askAssistant({ data: input }),
  })
}
