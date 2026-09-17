import { createServerFn } from '@tanstack/react-start'
import { listProfiles as listProfilesInStore } from '../server/store.server'
import { asObject, requireToken } from './validation'

export const listProfiles = createServerFn({ method: 'POST' })
  .validator((input: { token: string }) => {
    const data = asObject(input)
    return { token: requireToken(data.token) }
  })
  .handler(async ({ data }) => listProfilesInStore(data.token))
