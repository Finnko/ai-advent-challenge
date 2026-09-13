import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RunAgentResult } from '../types'
import { createSession } from '../functions/create-session.functions'
import { runAgent } from '../functions/run-agent.functions'
import { sessionsQueryOptions } from './get-sessions'
import { sessionMessagesQueryOptions } from './get-session-messages'
import { sessionBranchesQueryOptions } from './get-branches'
import { sessionFactsQueryOptions } from './get-facts'

export type SendMessageInput = {
  token: string
  sessionId: number | null
  user: string
  strategy: string
  scenario?: string | null
}

export async function sendMessage(
  input: SendMessageInput,
): Promise<RunAgentResult> {
  let sessionId = input.sessionId
  if (sessionId === null) {
    const created = await createSession({
      data: {
        token: input.token,
        strategy: input.strategy,
        scenario: input.scenario ?? null,
      },
    })
    sessionId = created.sessionId
  }
  return runAgent({
    data: { token: input.token, sessionId, user: input.user },
  })
}

export function useSendMessage(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: sendMessage,
    onSuccess: (result) => {
      const sessionId = result.sessionId
      queryClient.invalidateQueries({
        queryKey: sessionsQueryOptions(token).queryKey,
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
    },
  })
}
