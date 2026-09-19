import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RunAgentResult } from '../types'
import { runAgent } from '../functions/run-agent.functions'
import { sessionsQueryOptions } from './get-sessions'
import { sessionMessagesQueryOptions } from './get-session-messages'
import { sessionBranchesQueryOptions } from './get-branches'
import { sessionFactsQueryOptions } from './get-facts'
import { memoryQueryOptions } from './get-memory'
import { taskStateQueryOptions } from './task-state'

export type SendMessageInput = {
  token: string
  sessionId: number
  user: string
}

export async function sendMessage(
  input: SendMessageInput,
): Promise<RunAgentResult> {
  return runAgent({
    data: {
      token: input.token,
      sessionId: input.sessionId,
      user: input.user,
    },
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    onSuccess: (result, vars) => {
      const sessionId = result.sessionId
      queryClient.invalidateQueries({
        queryKey: sessionsQueryOptions(vars.token).queryKey,
      })
      queryClient.invalidateQueries({
        queryKey: sessionMessagesQueryOptions(sessionId).queryKey,
      })
      queryClient.invalidateQueries({
        queryKey: sessionBranchesQueryOptions(sessionId).queryKey,
      })
      queryClient.invalidateQueries({
        queryKey: sessionFactsQueryOptions(sessionId).queryKey,
      })
      queryClient.invalidateQueries({
        queryKey: memoryQueryOptions(sessionId, vars.token).queryKey,
      })
      queryClient.invalidateQueries({
        queryKey: taskStateQueryOptions(sessionId).queryKey,
      })
    },
    mutationFn: sendMessage,
  })
}
