import { createServerFn } from '@tanstack/react-start'
import type { MemoryEntry, MemoryLayer } from '../domain/memory/types'
import {
  applyLongTermLimit,
  mergeMemoryEntries,
} from '../domain/memory/read'
import {
  getLongTermMemory,
  getWorkingMemory,
  saveLongTermMemory,
  saveWorkingMemory,
} from '../server/store.server'
import {
  asObject,
  requireMemoryLayer,
  requireMemoryValue,
  requireSessionId,
  requireText,
  requireToken,
} from './validation'

export const saveMemory = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      scope: string
      sessionId: number
      token: string
      key: string
      value: string
      scenario?: string | null
    }) => {
      const data = asObject(input)
      return {
        scope: requireMemoryLayer(data.scope),
        sessionId: requireSessionId(data.sessionId),
        token: requireToken(data.token),
        key: requireText(data.key, 'Ключ памяти обязателен'),
        value: requireMemoryValue(data.value),
        scenario:
          typeof data.scenario === 'string' && data.scenario.trim().length > 0
            ? data.scenario.trim()
            : null,
      }
    },
  )
  .handler(async ({ data }) => {
    const entry: MemoryEntry = {
      layer: data.scope as MemoryLayer,
      key: data.key,
      value: data.value,
      source: 'manual',
      updatedAt: new Date().toISOString(),
      scenario: data.scenario,
    }
    if (data.scope === 'working') {
      const existing = await getWorkingMemory(data.sessionId)
      await saveWorkingMemory(
        data.sessionId,
        mergeMemoryEntries(existing, [entry]),
      )
    } else {
      const existing = await getLongTermMemory(data.token)
      await saveLongTermMemory(
        data.token,
        applyLongTermLimit(mergeMemoryEntries(existing, [entry])),
      )
    }
    return { ok: true } as const
  })
