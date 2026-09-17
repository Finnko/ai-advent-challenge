import { createServerFn } from '@tanstack/react-start'
import { setDefaultProfile as setDefaultProfileInStore } from '../server/store.server'
import { asObject, requireProfileId, requireToken } from './validation'

export const setDefaultProfile = createServerFn({ method: 'POST' })
  .validator((input: { token: string; profileId: number }) => {
    const data = asObject(input)
    return {
      token: requireToken(data.token),
      profileId: requireProfileId(data.profileId),
    }
  })
  .handler(async ({ data }) => {
    await setDefaultProfileInStore(data.token, data.profileId)
    return { ok: true } as const
  })
