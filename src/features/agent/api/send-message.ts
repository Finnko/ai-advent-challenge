import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RunAgentResult } from '../types'
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
  strategy: string
  scenario?: string | null
  memory?: boolean
  profileId?: number | null
  windowSize?: number
  taskStateEnabled?: boolean
  invariantSetId?: number | null
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
        memory: input.memory ?? false,
        profileId: input.profileId,
        windowSize: input.windowSize,
        taskStateEnabled: input.taskStateEnabled,
        invariantSetId: input.invariantSetId,
      },
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
