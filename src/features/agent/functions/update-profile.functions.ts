import { createServerFn } from '@tanstack/react-start'
import { updateProfile as updateProfileInStore } from '../server/store.server'
import {
  asObject,
  requireProfileId,
  requireProfileInput,
} from './validation'

export const updateProfile = createServerFn({ method: 'POST' })
  .validator((input: { profileId: number }) => {
    const data = asObject(input)
    return {
      profileId: requireProfileId(data.profileId),
      input: requireProfileInput(data),
    }
  })
  .handler(async ({ data }) => {
    const profile = await updateProfileInStore(data.profileId, data.input)
    if (!profile) {
      throw new Error('Профиль не найден')
    }
    return profile
  })
