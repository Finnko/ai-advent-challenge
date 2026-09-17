import { createServerFn } from '@tanstack/react-start'
import { executeAgent, resolveCapabilitiesByToken } from '../server/agent-service.server'
import type { ProfileComparison } from '../types'
import { resolveStrategy } from '../domain/context/registry'
import { getProfile } from '../server/store.server'
import { asObject, requireProfileId, requireToken, requireUser } from './validation'

const noop = () => {}

export const compareProfiles = createServerFn({ method: 'POST' })
  .validator((input: { token: string; profileIds: number[]; user: string }) => {
    const data = asObject(input)
    if (!Array.isArray(data.profileIds) || data.profileIds.length < 2) {
      throw new Error('Нужны минимум два профиля для сравнения')
    }
    return {
      token: requireToken(data.token),
      profileIds: data.profileIds.map((id) => requireProfileId(id)),
      user: requireUser(data.user),
    }
  })
  .handler(async ({ data }) => {
    const capabilities = await resolveCapabilitiesByToken(data.token)
    const results = await Promise.all(
      data.profileIds.map(async (profileId) => {
        const profile = await getProfile(profileId)
        if (!profile) {
          throw new Error('Профиль не найден')
        }
        const execution = await executeAgent({
          capabilities,
          user: data.user,
          strategy: resolveStrategy('none'),
          rows: [],
          previousSummary: null,
          facts: [],
          profile,
          saveSummary: noop,
          saveFacts: noop,
        })
        return {
          profileId: profile.id,
          profileName: profile.name,
          run: execution.run,
        }
      }),
    )
    return { results } satisfies ProfileComparison
  })
