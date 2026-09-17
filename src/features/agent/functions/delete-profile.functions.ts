import { createServerFn } from '@tanstack/react-start'
import { deleteProfile as deleteProfileInStore } from '../server/store.server'
import { asObject, requireProfileId } from './validation'

export const deleteProfile = createServerFn({ method: 'POST' })
  .validator((input: { profileId: number }) => {
    const data = asObject(input)
    return { profileId: requireProfileId(data.profileId) }
  })
  .handler(async ({ data }) => {
    await deleteProfileInStore(data.profileId)
    return { ok: true } as const
  })
