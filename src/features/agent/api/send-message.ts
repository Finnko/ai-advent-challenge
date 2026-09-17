import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RunAgentResult } from '../types'
import type { SessionConfigInput } from '../domain/session/config'
import { createSession } from '../functions/create-session.functions'
import { runAgent } from '../functions/run-agent.functions'
import { sessionsQueryOptions } from './get-sessions'
import { sessionMessagesQueryOptions } from './get-session-messages'
import { sessionBranchesQueryOptions } from './get-branches'
import { sessionFactsQueryOptions } from './get-facts'
import { memoryQueryOptions } from './get-memory'

export type SendMessageInput = {
  token: string
  sessionId: number | null
  user: string
  config: SessionConfigInput
}

export async function sendMessage(
  input: SendMessageInput,
): Promise<RunAgentResult> {
  let sessionId = input.sessionId
  if (sessionId === null) {
    const created = await createSession({
      data: { token: input.token, config: input.config },
    })
    sessionId = created.sessionId
  }
  return runAgent({
    data: { token: input.token, sessionId, user: input.user },
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
    },
    mutationFn: sendMessage,
  })
}
