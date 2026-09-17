import { createServerFn } from '@tanstack/react-start'
import { runAgentTurn } from '../server/agent-turn.server'
import type { RunAgentResult } from '../types'
import { asObject, requireSessionId, requireToken, requireUser } from './validation'

export const runAgent = createServerFn({ method: 'POST' })
  .validator((input: { token: string; sessionId: number; user: string }) => {
    const data = asObject(input)
    return {
      token: requireToken(data.token),
      sessionId: requireSessionId(data.sessionId),
      user: requireUser(data.user),
    }
  })
  .handler(async ({ data }) => {
    const execution = await runAgentTurn(data)
    return {
      run: execution.run,
      sessionId: data.sessionId,
      auxUsage: execution.auxUsage,
    } satisfies RunAgentResult
  })
